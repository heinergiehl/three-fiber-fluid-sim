import {
  Color,
  GLSL1,
  NoBlending,
  LinearFilter,
  ClampToEdgeWrapping,
  RawShaderMaterial,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { defaultFluidConfig, type FluidConfig } from './config';
import { DoubleFBO } from './gl/DoubleFBO';
import { FullscreenPass } from './gl/FullscreenPass';
import { createRenderTarget } from './gl/createRenderTarget';
import { getFluidCapabilities } from './gl/capabilities';
import { PointerTracker } from './input/PointerTracker';

import baseVertex from './shaders/base.vert.glsl?raw';
import clearFragment from './shaders/clear.frag.glsl?raw';
import displayFragment from './shaders/display.frag.glsl?raw';
import splatFragment from './shaders/splat.frag.glsl?raw';
import advectionFragment from './shaders/advection.frag.glsl?raw';
import advectionManualFragment from './shaders/advection_manual.frag.glsl?raw';
import divergenceFragment from './shaders/divergence.frag.glsl?raw';
import curlFragment from './shaders/curl.frag.glsl?raw';
import vorticityFragment from './shaders/vorticity.frag.glsl?raw';
import pressureFragment from './shaders/pressure.frag.glsl?raw';
import gradSubtractFragment from './shaders/gradSubtract.frag.glsl?raw';
import boundaryReflectFragment from './shaders/boundaryReflect.frag.glsl?raw';
import bloomPrefilterFragment from './shaders/bloomPrefilter.frag.glsl?raw';
import bloomBlurFragment from './shaders/bloomBlur.frag.glsl?raw';
import bloomFinalFragment from './shaders/bloomFinal.frag.glsl?raw';
import sunraysMaskFragment from './shaders/sunraysMask.frag.glsl?raw';
import sunraysFragment from './shaders/sunrays.frag.glsl?raw';
import velocityMagnitudeFragment from './shaders/velocityMagnitude.frag.glsl?raw';

export class FluidEngine {
  private renderer: WebGLRenderer;
  private config: FluidConfig;
  private pass: FullscreenPass;
  private pointers = new PointerTracker();
  private texelSize = new Vector2();
  private dyeTexelSize = new Vector2();
  private simSize = new Vector2();
  private dyeSize = new Vector2();
  private dpr = 1;
  private width = 1;
  private height = 1;
  private supportLinearFiltering = true;
  private autoSplatTimer = 0;

  private velocity!: DoubleFBO;
  private dye!: DoubleFBO;
  private pressure!: DoubleFBO;
  private divergence!: WebGLRenderTarget;
  private curl!: WebGLRenderTarget;
  private bloomTarget!: WebGLRenderTarget;
  private bloomTemp!: WebGLRenderTarget;
  private sunraysTarget!: WebGLRenderTarget;
  private sunraysTemp!: WebGLRenderTarget;
  private velocityStatsTarget!: WebGLRenderTarget;

  private advectionMaterial!: ShaderMaterial;
  private clearMaterial!: ShaderMaterial;
  private displayMaterial!: ShaderMaterial;
  private splatMaterial!: ShaderMaterial;
  private curlMaterial!: ShaderMaterial;
  private vorticityMaterial!: ShaderMaterial;
  private divergenceMaterial!: ShaderMaterial;
  private pressureMaterial!: ShaderMaterial;
  private gradSubtractMaterial!: ShaderMaterial;
  private boundaryReflectMaterial!: ShaderMaterial;
  private bloomPrefilterMaterial!: ShaderMaterial;
  private bloomBlurMaterial!: ShaderMaterial;
  private bloomFinalMaterial!: ShaderMaterial;
  private sunraysMaskMaterial!: ShaderMaterial;
  private sunraysMaterial!: ShaderMaterial;
  private velocityMagnitudeMaterial!: ShaderMaterial;

  constructor(renderer: WebGLRenderer, config: Partial<FluidConfig> = {}) {
    this.renderer = renderer;
    this.config = { ...defaultFluidConfig, ...config };
    const capabilities = getFluidCapabilities(renderer);
    this.supportLinearFiltering = capabilities.supportLinearFiltering;
    this.pass = new FullscreenPass(renderer);
    this.initMaterials();
  }

  resize(widthCss: number, heightCss: number, dpr: number): void {
    this.dpr = dpr;
    this.width = Math.max(1, Math.floor(widthCss * dpr));
    this.height = Math.max(1, Math.floor(heightCss * dpr));

    const aspect = this.width / this.height;
    const baseSim = this.config.SIM_RESOLUTION;
    const baseDye = this.config.DYE_RESOLUTION;

    const simWidthRaw = aspect >= 1 ? baseSim * aspect : baseSim;
    const simHeightRaw = aspect >= 1 ? baseSim : baseSim / aspect;
    const simWidth = Math.max(2, Math.floor(simWidthRaw / this.config.TEXTURE_DOWNSAMPLE));
    const simHeight = Math.max(2, Math.floor(simHeightRaw / this.config.TEXTURE_DOWNSAMPLE));
    this.simSize.set(simWidth, simHeight);
    this.texelSize.set(1 / simWidth, 1 / simHeight);

    const dyeWidth = Math.max(2, Math.floor(aspect >= 1 ? baseDye * aspect : baseDye));
    const dyeHeight = Math.max(2, Math.floor(aspect >= 1 ? baseDye : baseDye / aspect));
    this.dyeSize.set(dyeWidth, dyeHeight);
    this.dyeTexelSize.set(1 / dyeWidth, 1 / dyeHeight);

    this.disposeTargets();
    this.velocity = this.createDoubleFBO(simWidth, simHeight);
    this.dye = this.createDoubleFBO(dyeWidth, dyeHeight);
    this.pressure = this.createDoubleFBO(simWidth, simHeight);
    this.divergence = createRenderTarget(simWidth, simHeight, this.supportLinearFiltering);
    this.curl = createRenderTarget(simWidth, simHeight, this.supportLinearFiltering);
    const bloomW = Math.max(2, Math.floor(dyeWidth / 2));
    const bloomH = Math.max(2, Math.floor(dyeHeight / 2));
    this.bloomTarget = createRenderTarget(bloomW, bloomH, this.supportLinearFiltering);
    this.bloomTemp = createRenderTarget(bloomW, bloomH, this.supportLinearFiltering);
    const sunW = Math.max(2, Math.floor(dyeWidth / 2));
    const sunH = Math.max(2, Math.floor(dyeHeight / 2));
    this.sunraysTarget = createRenderTarget(sunW, sunH, this.supportLinearFiltering);
    this.sunraysTemp = createRenderTarget(sunW, sunH, this.supportLinearFiltering);
    // Small byte target for velocity stats (easy readback).
    const statsSize = Math.max(4, Math.floor(Math.min(simWidth, simHeight) / 8));
    this.velocityStatsTarget = new WebGLRenderTarget(statsSize, statsSize, {
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      wrapS: ClampToEdgeWrapping,
      wrapT: ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
    });

    // Clear newly created targets to avoid random initial junk.
    this.clearTarget(this.velocity.read, 0);
    this.clearTarget(this.velocity.write, 0);
    this.clearTarget(this.dye.read, 0);
    this.clearTarget(this.dye.write, 0);
    this.clearTarget(this.pressure.read, 0);
    this.clearTarget(this.pressure.write, 0);
    this.clearTarget(this.divergence, 0);
    this.clearTarget(this.curl, 0);

    this.updateTexelUniforms();
  }

  update(dt: number): void {
    if (!this.velocity || !this.dye || this.config.PAUSED) {
      return;
    }

    const clampedDt = Math.min(dt, 0.016);

    this.applySplats();
    this.applyBoundaryReflect(); // keep injected velocity inside before solving
    if (this.config.AUTO_SPLATS) {
      this.autoSplatTimer += clampedDt;
      if (this.autoSplatTimer >= this.config.AUTO_SPLAT_INTERVAL) {
        this.autoSplatTimer = 0;
        const uv = { x: Math.random(), y: Math.random() };
        const angle = Math.random() * Math.PI * 2;
        const force = this.config.AUTO_SPLAT_FORCE;
        const delta = { x: Math.cos(angle) * force, y: Math.sin(angle) * force };
        this.splat(uv, delta, this.randomColor());
      }
    }

    this.computeCurl();
    this.applyVorticity(clampedDt);
    this.computeDivergence();
    this.clearPressure();
    this.solvePressure();
    this.subtractGradient();
    this.applyBoundaryReflect(); // enforce walls on the projected field

    this.applyViscosity(clampedDt);
    this.advect(
      this.velocity,
      this.velocity,
      this.config.VELOCITY_DISSIPATION,
      clampedDt,
      this.texelSize,
      this.texelSize,
    );
    this.advect(
      this.dye,
      this.velocity,
      this.config.DENSITY_DISSIPATION,
      clampedDt,
      this.texelSize,
      this.dyeTexelSize,
    );

    this.display();
    this.pointers.resetMoved();
  }

  pointerDown(id: number, x: number, y: number): void {
    this.pointers.pointerDown(id, x, y, this.randomColor());
  }

  pointerMove(id: number, x: number, y: number): void {
    this.pointers.pointerMove(id, x, y);
  }

  pointerUp(id: number): void {
    this.pointers.pointerUp(id);
  }

  dispose(): void {
    this.disposeTargets();
    this.pointers.dispose();
    this.advectionMaterial.dispose();
    this.clearMaterial.dispose();
    this.displayMaterial.dispose();
    this.splatMaterial.dispose();
    this.curlMaterial.dispose();
    this.vorticityMaterial.dispose();
    this.divergenceMaterial.dispose();
    this.pressureMaterial.dispose();
    this.gradSubtractMaterial.dispose();
    this.boundaryReflectMaterial.dispose();
    this.bloomPrefilterMaterial.dispose();
    this.bloomBlurMaterial.dispose();
    this.bloomFinalMaterial.dispose();
    this.sunraysMaskMaterial.dispose();
    this.sunraysMaterial.dispose();
  }

  private initMaterials(): void {
    const advectionFragmentSource = this.supportLinearFiltering ? advectionFragment : advectionManualFragment;
    this.advectionMaterial = new RawShaderMaterial({
      glslVersion: GLSL1,
      vertexShader: baseVertex,
      fragmentShader: advectionFragmentSource,
      uniforms: {
        uVelocity: { value: null },
        uSource: { value: null },
        texelSize: { value: this.texelSize },
        dyeTexelSize: { value: this.dyeTexelSize },
        dt: { value: 0 },
        dissipation: { value: 1 },
      },
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
      transparent: false,
    });

    this.clearMaterial = new RawShaderMaterial({
      glslVersion: GLSL1,
      vertexShader: baseVertex,
      fragmentShader: clearFragment,
      uniforms: {
        uTexture: { value: null },
        value: { value: 1 },
      },
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
      transparent: false,
    });

    this.displayMaterial = new RawShaderMaterial({
      glslVersion: GLSL1,
      vertexShader: baseVertex,
      fragmentShader: displayFragment,
      uniforms: {
        uTexture: { value: null },
        uBloom: { value: null },
        uSunrays: { value: null },
        texelSize: { value: this.dyeTexelSize },
        shadingEnabled: { value: this.config.SHADING ? 1 : 0 },
        shadingStrength: { value: this.config.SHADING_STRENGTH },
        bloomEnabled: { value: this.config.BLOOM ? 1 : 0 },
        bloomIntensity: { value: this.config.BLOOM_INTENSITY },
        sunraysEnabled: { value: this.config.SUNRAYS ? 1 : 0 },
        sunraysWeight: { value: this.config.SUNRAYS_WEIGHT },
        exposure: { value: this.config.EXPOSURE },
        gamma: { value: this.config.GAMMA },
        debugMode: { value: 0 },
      },
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
      transparent: false,
    });

    this.splatMaterial = new RawShaderMaterial({
      glslVersion: GLSL1,
      vertexShader: baseVertex,
      fragmentShader: splatFragment,
      uniforms: {
        uTarget: { value: null },
        point: { value: new Vector2() },
        aspectRatio: { value: 1 },
        radius: { value: 0.5 },
        color: { value: new Color() },
      },
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
      transparent: false,
    });

    this.curlMaterial = new RawShaderMaterial({
      glslVersion: GLSL1,
      vertexShader: baseVertex,
      fragmentShader: curlFragment,
      uniforms: {
        uVelocity: { value: null },
        texelSize: { value: this.texelSize },
      },
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
      transparent: false,
    });

    this.vorticityMaterial = new RawShaderMaterial({
      glslVersion: GLSL1,
      vertexShader: baseVertex,
      fragmentShader: vorticityFragment,
      uniforms: {
        uVelocity: { value: null },
        uCurl: { value: null },
        texelSize: { value: this.texelSize },
        curl: { value: this.config.CURL },
        dt: { value: 0 },
      },
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
      transparent: false,
    });

    this.divergenceMaterial = new RawShaderMaterial({
      glslVersion: GLSL1,
      vertexShader: baseVertex,
      fragmentShader: divergenceFragment,
      uniforms: {
        uVelocity: { value: null },
        texelSize: { value: this.texelSize },
      },
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
      transparent: false,
    });

    this.pressureMaterial = new RawShaderMaterial({
      glslVersion: GLSL1,
      vertexShader: baseVertex,
      fragmentShader: pressureFragment,
      uniforms: {
        uPressure: { value: null },
        uDivergence: { value: null },
        texelSize: { value: this.texelSize },
      },
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
      transparent: false,
    });

    this.gradSubtractMaterial = new RawShaderMaterial({
      glslVersion: GLSL1,
      vertexShader: baseVertex,
      fragmentShader: gradSubtractFragment,
      uniforms: {
        uPressure: { value: null },
        uVelocity: { value: null },
        texelSize: { value: this.texelSize },
      },
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
      transparent: false,
    });

    this.boundaryReflectMaterial = new RawShaderMaterial({
      glslVersion: GLSL1,
      vertexShader: baseVertex,
      fragmentShader: boundaryReflectFragment,
      uniforms: {
        uVelocity: { value: null },
        texelSize: { value: this.texelSize },
        wallThickness: { value: this.config.WALL_THICKNESS },
        restitution: { value: this.config.WALL_RESTITUTION },
        friction: { value: this.config.WALL_FRICTION },
      },
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
      transparent: false,
    });

    this.bloomPrefilterMaterial = new RawShaderMaterial({
      glslVersion: GLSL1,
      vertexShader: baseVertex,
      fragmentShader: bloomPrefilterFragment,
      uniforms: {
        uTexture: { value: null },
        threshold: { value: this.config.BLOOM_THRESHOLD },
        softKnee: { value: this.config.BLOOM_SOFT_KNEE },
      },
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
      transparent: false,
    });

    this.bloomBlurMaterial = new RawShaderMaterial({
      glslVersion: GLSL1,
      vertexShader: baseVertex,
      fragmentShader: bloomBlurFragment,
      uniforms: {
        uTexture: { value: null },
        direction: { value: new Vector2(1, 0) },
      },
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
      transparent: false,
    });

    this.bloomFinalMaterial = new RawShaderMaterial({
      glslVersion: GLSL1,
      vertexShader: baseVertex,
      fragmentShader: bloomFinalFragment,
      uniforms: {
        uBase: { value: null },
        uBloom: { value: null },
        intensity: { value: this.config.BLOOM_INTENSITY },
      },
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
      transparent: false,
    });

    this.sunraysMaskMaterial = new RawShaderMaterial({
      glslVersion: GLSL1,
      vertexShader: baseVertex,
      fragmentShader: sunraysMaskFragment,
      uniforms: {
        uTexture: { value: null },
      },
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
      transparent: false,
    });

    this.sunraysMaterial = new RawShaderMaterial({
      glslVersion: GLSL1,
      vertexShader: baseVertex,
      fragmentShader: sunraysFragment,
      uniforms: {
        uTexture: { value: null },
        weight: { value: this.config.SUNRAYS_WEIGHT },
      },
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
      transparent: false,
    });

    this.velocityMagnitudeMaterial = new RawShaderMaterial({
      glslVersion: GLSL1,
      vertexShader: baseVertex,
      fragmentShader: velocityMagnitudeFragment,
      uniforms: {
        uVelocity: { value: null },
      },
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
      transparent: false,
    });
  }

  private updateTexelUniforms(): void {
    this.advectionMaterial.uniforms.texelSize.value = this.texelSize;
    this.advectionMaterial.uniforms.dyeTexelSize.value = this.dyeTexelSize;
    this.curlMaterial.uniforms.texelSize.value = this.texelSize;
    this.vorticityMaterial.uniforms.texelSize.value = this.texelSize;
    this.divergenceMaterial.uniforms.texelSize.value = this.texelSize;
    this.pressureMaterial.uniforms.texelSize.value = this.texelSize;
    this.gradSubtractMaterial.uniforms.texelSize.value = this.texelSize;
    this.boundaryReflectMaterial.uniforms.texelSize.value = this.texelSize;
    this.displayMaterial.uniforms.texelSize.value = this.dyeTexelSize;
  }

  private createDoubleFBO(width: number, height: number): DoubleFBO {
    return new DoubleFBO(
      createRenderTarget(width, height, this.supportLinearFiltering),
      createRenderTarget(width, height, this.supportLinearFiltering),
    );
  }

  private clearTarget(target: WebGLRenderTarget, value: number): void {
    this.clearMaterial.uniforms.uTexture.value = target.texture;
    this.clearMaterial.uniforms.value.value = value;
    this.pass.render(this.clearMaterial, target);
  }

  private disposeTargets(): void {
    this.velocity?.dispose();
    this.dye?.dispose();
    this.pressure?.dispose();
    this.divergence?.dispose();
    this.curl?.dispose();
    this.bloomTarget?.dispose();
    this.bloomTemp?.dispose();
    this.sunraysTarget?.dispose();
    this.sunraysTemp?.dispose();
    this.velocityStatsTarget?.dispose();
  }

  private advect(
    target: DoubleFBO,
    velocity: DoubleFBO,
    dissipation: number,
    dt: number,
    velocityTexel: Vector2,
    sourceTexel: Vector2,
  ): void {
    this.advectionMaterial.uniforms.texelSize.value = velocityTexel;
    this.advectionMaterial.uniforms.dyeTexelSize.value = sourceTexel;
    this.advectionMaterial.uniforms.uVelocity.value = velocity.read.texture;
    this.advectionMaterial.uniforms.uSource.value = target.read.texture;
    this.advectionMaterial.uniforms.dissipation.value = dissipation;
    this.advectionMaterial.uniforms.dt.value = dt;
    this.pass.render(this.advectionMaterial, target.write);
    target.swap();
  }

  private applySplats(): void {
    const aspectRatio = this.dyeSize.x / this.dyeSize.y;
    this.splatMaterial.uniforms.aspectRatio.value = aspectRatio;

    for (const pointer of this.pointers.all) {
      if (!pointer.down || !pointer.moved) {
        continue;
      }

      const uvx = pointer.x / this.width;
      const uvy = 1 - pointer.y / this.height;

      // Aspect-corrected UV deltas (match Pavel's correctDelta logic).
      const aspect = this.width / this.height;
      let du = pointer.dx / this.width;
      let dv = -pointer.dy / this.height;
      if (aspect < 1) {
        du *= aspect;
      } else if (aspect > 1) {
        dv /= aspect;
      }

      const velocityScaleX = du * this.config.SPLAT_FORCE;
      const velocityScaleY = dv * this.config.SPLAT_FORCE;

      this.splat({ x: uvx, y: uvy }, { x: velocityScaleX, y: velocityScaleY }, pointer.color);
    }
  }

  private splat(
    uv: { x: number; y: number },
    delta: { x: number; y: number },
    color: [number, number, number],
  ): void {
    let radius = this.config.SPLAT_RADIUS / 100;
    const aspect = this.dyeSize.x / this.dyeSize.y;
    if (aspect > 1) {
      radius *= aspect;
    }
    // Keep total injected momentum roughly consistent as radius changes.
    const area = Math.max(radius * radius, 0.0001);
    const momentumScale = Math.min(20, 0.05 / area);
    const scaledDeltaX = delta.x * momentumScale;
    const scaledDeltaY = delta.y * momentumScale;
    this.splatMaterial.uniforms.point.value.set(uv.x, uv.y);
    this.splatMaterial.uniforms.radius.value = radius;

    this.splatMaterial.uniforms.uTarget.value = this.velocity.read.texture;
    this.splatMaterial.uniforms.color.value.setRGB(scaledDeltaX, scaledDeltaY, 0);
    this.pass.render(this.splatMaterial, this.velocity.write);
    this.velocity.swap();

    this.splatMaterial.uniforms.uTarget.value = this.dye.read.texture;
    this.splatMaterial.uniforms.color.value.setRGB(color[0], color[1], color[2]);
    this.pass.render(this.splatMaterial, this.dye.write);
    this.dye.swap();
  }

  private computeCurl(): void {
    this.curlMaterial.uniforms.uVelocity.value = this.velocity.read.texture;
    this.pass.render(this.curlMaterial, this.curl);
  }

  private applyVorticity(dt: number): void {
    this.vorticityMaterial.uniforms.uVelocity.value = this.velocity.read.texture;
    this.vorticityMaterial.uniforms.uCurl.value = this.curl.texture;
    this.vorticityMaterial.uniforms.curl.value = this.config.CURL;
    this.vorticityMaterial.uniforms.dt.value = dt;
    this.pass.render(this.vorticityMaterial, this.velocity.write);
    this.velocity.swap();
  }

  private computeDivergence(): void {
    this.divergenceMaterial.uniforms.uVelocity.value = this.velocity.read.texture;
    this.pass.render(this.divergenceMaterial, this.divergence);
  }

  private clearPressure(): void {
    this.clearMaterial.uniforms.uTexture.value = this.pressure.read.texture;
    this.clearMaterial.uniforms.value.value = this.config.PRESSURE_DISSIPATION;
    this.pass.render(this.clearMaterial, this.pressure.write);
    this.pressure.swap();
  }

  private solvePressure(): void {
    this.pressureMaterial.uniforms.uDivergence.value = this.divergence.texture;
    for (let i = 0; i < this.config.PRESSURE_ITERATIONS; i += 1) {
      this.pressureMaterial.uniforms.uPressure.value = this.pressure.read.texture;
      this.pass.render(this.pressureMaterial, this.pressure.write);
      this.pressure.swap();
    }
  }

  private subtractGradient(): void {
    this.gradSubtractMaterial.uniforms.uPressure.value = this.pressure.read.texture;
    this.gradSubtractMaterial.uniforms.uVelocity.value = this.velocity.read.texture;
    this.pass.render(this.gradSubtractMaterial, this.velocity.write);
    this.velocity.swap();
  }

  private applyBoundaryReflect(): void {
    this.boundaryReflectMaterial.uniforms.uVelocity.value = this.velocity.read.texture;
    this.boundaryReflectMaterial.uniforms.wallThickness.value = this.config.WALL_THICKNESS;
    this.boundaryReflectMaterial.uniforms.restitution.value = this.config.WALL_RESTITUTION;
    this.boundaryReflectMaterial.uniforms.friction.value = this.config.WALL_FRICTION;
    this.pass.render(this.boundaryReflectMaterial, this.velocity.write);
    this.velocity.swap();
  }

  private applyViscosity(dt: number): void {
    if (this.config.VISCOSITY <= 0) {
      return;
    }
    const factor = Math.exp(-this.config.VISCOSITY * dt);
    this.clearMaterial.uniforms.uTexture.value = this.velocity.read.texture;
    this.clearMaterial.uniforms.value.value = factor;
    this.pass.render(this.clearMaterial, this.velocity.write);
    this.velocity.swap();
  }

  private display(): void {
    const debugMode =
      this.config.DEBUG_VIEW === 'velocity'
        ? 1
        : this.config.DEBUG_VIEW === 'divergence'
          ? 2
          : this.config.DEBUG_VIEW === 'curl'
            ? 3
            : this.config.DEBUG_VIEW === 'pressure'
              ? 4
              : 0;

    const bloomRT = debugMode === 0 ? this.applyBloom(this.dye.read) : null;
    const sunraysRT = debugMode === 0 ? this.applySunrays(this.dye.read) : null;

    let displayTexture = this.dye.read.texture;
    if (debugMode === 1) displayTexture = this.velocity.read.texture;
    if (debugMode === 2) displayTexture = this.divergence.texture;
    if (debugMode === 3) displayTexture = this.curl.texture;
    if (debugMode === 4) displayTexture = this.pressure.read.texture;

    this.displayMaterial.uniforms.uTexture.value = displayTexture;
    this.displayMaterial.uniforms.uBloom.value = bloomRT ? bloomRT.texture : this.dye.read.texture;
    this.displayMaterial.uniforms.uSunrays.value = sunraysRT ? sunraysRT.texture : this.dye.read.texture;
    this.displayMaterial.uniforms.debugMode.value = debugMode;
    this.displayMaterial.uniforms.shadingEnabled.value = debugMode === 0 && this.config.SHADING ? 1 : 0;
    this.displayMaterial.uniforms.bloomEnabled.value = debugMode === 0 && this.config.BLOOM ? 1 : 0;
    this.displayMaterial.uniforms.sunraysEnabled.value = debugMode === 0 && this.config.SUNRAYS ? 1 : 0;
    this.pass.render(this.displayMaterial, null);
  }

  private applyBloom(source: WebGLRenderTarget): WebGLRenderTarget | null {
    if (!this.config.BLOOM || !this.bloomTemp || !this.bloomTarget) {
      return null;
    }

    this.bloomPrefilterMaterial.uniforms.uTexture.value = source.texture;
    this.pass.render(this.bloomPrefilterMaterial, this.bloomTemp);

    let ping = this.bloomTemp;
    let pong = this.bloomTarget;
    const iterations = 5;
    let horizontal = true;
    for (let i = 0; i < iterations; i += 1) {
      this.bloomBlurMaterial.uniforms.uTexture.value = ping.texture;
      const dir = this.bloomBlurMaterial.uniforms.direction.value as Vector2;
      dir.set(horizontal ? 1 / ping.width : 0, horizontal ? 0 : 1 / ping.height);
      this.pass.render(this.bloomBlurMaterial, pong);
      horizontal = !horizontal;
      const temp = ping;
      ping = pong;
      pong = temp;
    }

    this.bloomFinalMaterial.uniforms.uBase.value = source.texture;
    this.bloomFinalMaterial.uniforms.uBloom.value = ping.texture;
    this.bloomFinalMaterial.uniforms.intensity.value = this.config.BLOOM_INTENSITY;
    this.pass.render(this.bloomFinalMaterial, pong);

    return pong;
  }

  private applySunrays(source: WebGLRenderTarget): WebGLRenderTarget | null {
    if (!this.config.SUNRAYS || !this.sunraysTemp || !this.sunraysTarget) {
      return null;
    }

    this.sunraysMaskMaterial.uniforms.uTexture.value = source.texture;
    this.pass.render(this.sunraysMaskMaterial, this.sunraysTemp);

    let ping = this.sunraysTemp;
    let pong = this.sunraysTarget;
    const iterations = 2;
    for (let i = 0; i < iterations; i += 1) {
      this.sunraysMaterial.uniforms.uTexture.value = ping.texture;
      this.sunraysMaterial.uniforms.weight.value = this.config.SUNRAYS_WEIGHT;
      this.pass.render(this.sunraysMaterial, pong);
      const temp = ping;
      ping = pong;
      pong = temp;
    }

    return ping;
  }

  private seedSplats(): void {
    const seedCount = 10;
    for (let i = 0; i < seedCount; i += 1) {
      const uv = { x: Math.random(), y: Math.random() };
      const angle = Math.random() * Math.PI * 2;
      const force = this.config.AUTO_SPLAT_FORCE;
      const delta = { x: Math.cos(angle) * force, y: Math.sin(angle) * force };
      this.splat(uv, delta, this.randomColor());
    }
  }

  setConfig(config: Partial<FluidConfig>): void {
    const prevDownsample = this.config.TEXTURE_DOWNSAMPLE;
    const prevSimRes = this.config.SIM_RESOLUTION;
    const prevDyeRes = this.config.DYE_RESOLUTION;
    const prevAutoSplats = this.config.AUTO_SPLATS;
    this.config = { ...this.config, ...config };

    if (config.QUALITY) {
      // Map quality presets to resolution/downsample like the reference.
      if (config.QUALITY === 'low') {
        this.config.TEXTURE_DOWNSAMPLE = 2;
        this.config.SIM_RESOLUTION = 96;
        this.config.DYE_RESOLUTION = 256;
      } else if (config.QUALITY === 'medium') {
        this.config.TEXTURE_DOWNSAMPLE = 1;
        this.config.SIM_RESOLUTION = 128;
        this.config.DYE_RESOLUTION = 384;
      } else if (config.QUALITY === 'high') {
        this.config.TEXTURE_DOWNSAMPLE = 0.75;
        this.config.SIM_RESOLUTION = 192;
        this.config.DYE_RESOLUTION = 512;
      }
    }

    this.boundaryReflectMaterial.uniforms.wallThickness.value = this.config.WALL_THICKNESS;
    this.boundaryReflectMaterial.uniforms.restitution.value = this.config.WALL_RESTITUTION;
    this.boundaryReflectMaterial.uniforms.friction.value = this.config.WALL_FRICTION;
    this.displayMaterial.uniforms.shadingEnabled.value = this.config.SHADING ? 1 : 0;
    this.displayMaterial.uniforms.shadingStrength.value = this.config.SHADING_STRENGTH;
    this.displayMaterial.uniforms.bloomEnabled.value = this.config.BLOOM ? 1 : 0;
    this.displayMaterial.uniforms.bloomIntensity.value = this.config.BLOOM_INTENSITY;
    this.displayMaterial.uniforms.sunraysEnabled.value = this.config.SUNRAYS ? 1 : 0;
    this.displayMaterial.uniforms.sunraysWeight.value = this.config.SUNRAYS_WEIGHT;
    this.displayMaterial.uniforms.exposure.value = this.config.EXPOSURE;
    this.displayMaterial.uniforms.gamma.value = this.config.GAMMA;
    this.displayMaterial.uniforms.debugMode.value =
      this.config.DEBUG_VIEW === 'velocity'
        ? 1
        : this.config.DEBUG_VIEW === 'divergence'
          ? 2
          : this.config.DEBUG_VIEW === 'curl'
            ? 3
            : this.config.DEBUG_VIEW === 'pressure'
              ? 4
              : 0;
    this.bloomPrefilterMaterial.uniforms.threshold.value = this.config.BLOOM_THRESHOLD;
    this.bloomPrefilterMaterial.uniforms.softKnee.value = this.config.BLOOM_SOFT_KNEE;
    this.bloomFinalMaterial.uniforms.intensity.value = this.config.BLOOM_INTENSITY;
    this.sunraysMaterial.uniforms.weight.value = this.config.SUNRAYS_WEIGHT;
    this.vorticityMaterial.uniforms.curl.value = this.config.CURL;
    if (prevAutoSplats !== this.config.AUTO_SPLATS) {
      this.autoSplatTimer = 0;
    }

    const downsampleChanged =
      config.TEXTURE_DOWNSAMPLE !== undefined && config.TEXTURE_DOWNSAMPLE !== prevDownsample;
    const dyeResChanged = config.DYE_RESOLUTION !== undefined && config.DYE_RESOLUTION !== prevDyeRes;
    const simResChanged = config.SIM_RESOLUTION !== undefined && config.SIM_RESOLUTION !== prevSimRes;
    if (downsampleChanged || dyeResChanged) {
      const cssWidth = this.width / this.dpr;
      const cssHeight = this.height / this.dpr;
      this.resize(cssWidth, cssHeight, this.dpr);
    } else if (simResChanged) {
      const cssWidth = this.width / this.dpr;
      const cssHeight = this.height / this.dpr;
      this.resize(cssWidth, cssHeight, this.dpr);
    }
  }

  /**
   * Dev helper: compute average and max velocity magnitude (renders to a small byte target for cheap readback).
   */
  getVelocityStats(): { avg: number; max: number } {
    if (!this.velocity || !this.velocityStatsTarget) {
      return { avg: 0, max: 0 };
    }
    this.velocityMagnitudeMaterial.uniforms.uVelocity.value = this.velocity.read.texture;
    this.pass.render(this.velocityMagnitudeMaterial, this.velocityStatsTarget);

    const w = this.velocityStatsTarget.width;
    const h = this.velocityStatsTarget.height;
    const pixels = new Uint8Array(4 * w * h);
    this.renderer.readRenderTargetPixels(this.velocityStatsTarget, 0, 0, w, h, pixels);

    let sum = 0;
    let max = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const v = pixels[i] / 255; // red channel holds magnitude
      sum += v;
      if (v > max) max = v;
    }
    const avg = sum / (w * h);
    return { avg, max };
  }

  private randomColor(): [number, number, number] {
    const saturation = this.config.COLORFUL ? 0.9 : 0.0;
    const lightness = this.config.COLORFUL ? 0.55 : 0.5;
    const color = new Color().setHSL(Math.random(), saturation, lightness);
    return [color.r, color.g, color.b];
  }
}
