import {
  Color,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { defaultFluidConfig, FluidConfig } from './config';
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

const FORCE_SCALE = 600;

export class FluidEngine {
  private renderer: WebGLRenderer;
  private config: FluidConfig;
  private pass: FullscreenPass;
  private pointers = new PointerTracker();
  private texelSize = new Vector2();
  private simSize = new Vector2();
  private dpr = 1;
  private width = 1;
  private height = 1;
  private supportLinearFiltering = true;

  private velocity!: DoubleFBO;
  private dye!: DoubleFBO;
  private pressure!: DoubleFBO;
  private divergence!: WebGLRenderTarget;
  private curl!: WebGLRenderTarget;

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

    const simWidth = Math.max(2, Math.floor(this.width / this.config.TEXTURE_DOWNSAMPLE));
    const simHeight = Math.max(2, Math.floor(this.height / this.config.TEXTURE_DOWNSAMPLE));
    this.simSize.set(simWidth, simHeight);
    this.texelSize.set(1 / simWidth, 1 / simHeight);

    this.disposeTargets();
    this.velocity = this.createDoubleFBO(simWidth, simHeight);
    this.dye = this.createDoubleFBO(simWidth, simHeight);
    this.pressure = this.createDoubleFBO(simWidth, simHeight);
    this.divergence = createRenderTarget(simWidth, simHeight, this.supportLinearFiltering);
    this.curl = createRenderTarget(simWidth, simHeight, this.supportLinearFiltering);

    this.updateTexelUniforms();
  }

  update(dt: number): void {
    if (!this.velocity || !this.dye) {
      return;
    }

    const clampedDt = Math.min(dt, 0.016);

    this.advect(this.velocity, this.velocity, this.config.VELOCITY_DISSIPATION, clampedDt);
    this.advect(this.dye, this.dye, this.config.DENSITY_DISSIPATION, clampedDt);

    this.applySplats();
    this.applyBoundaryReflect();

    this.computeCurl();
    this.applyVorticity(clampedDt);
    this.computeDivergence();
    this.clearPressure();
    this.solvePressure();
    this.subtractGradient();
    this.applyBoundaryReflect();

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
  }

  private initMaterials(): void {
    const advectionFragmentSource = this.supportLinearFiltering ? advectionFragment : advectionManualFragment;
    this.advectionMaterial = new ShaderMaterial({
      vertexShader: baseVertex,
      fragmentShader: advectionFragmentSource,
      uniforms: {
        uVelocity: { value: null },
        uSource: { value: null },
        texelSize: { value: this.texelSize },
        dt: { value: 0 },
        dissipation: { value: 1 },
      },
    });

    this.clearMaterial = new ShaderMaterial({
      vertexShader: baseVertex,
      fragmentShader: clearFragment,
      uniforms: {
        uTexture: { value: null },
        value: { value: 1 },
      },
    });

    this.displayMaterial = new ShaderMaterial({
      vertexShader: baseVertex,
      fragmentShader: displayFragment,
      uniforms: {
        uTexture: { value: null },
      },
    });

    this.splatMaterial = new ShaderMaterial({
      vertexShader: baseVertex,
      fragmentShader: splatFragment,
      uniforms: {
        uTarget: { value: null },
        point: { value: new Vector2() },
        aspectRatio: { value: 1 },
        radius: { value: 0.5 },
        color: { value: new Color() },
      },
    });

    this.curlMaterial = new ShaderMaterial({
      vertexShader: baseVertex,
      fragmentShader: curlFragment,
      uniforms: {
        uVelocity: { value: null },
        texelSize: { value: this.texelSize },
      },
    });

    this.vorticityMaterial = new ShaderMaterial({
      vertexShader: baseVertex,
      fragmentShader: vorticityFragment,
      uniforms: {
        uVelocity: { value: null },
        uCurl: { value: null },
        texelSize: { value: this.texelSize },
        curl: { value: this.config.CURL },
        dt: { value: 0 },
      },
    });

    this.divergenceMaterial = new ShaderMaterial({
      vertexShader: baseVertex,
      fragmentShader: divergenceFragment,
      uniforms: {
        uVelocity: { value: null },
        texelSize: { value: this.texelSize },
      },
    });

    this.pressureMaterial = new ShaderMaterial({
      vertexShader: baseVertex,
      fragmentShader: pressureFragment,
      uniforms: {
        uPressure: { value: null },
        uDivergence: { value: null },
        texelSize: { value: this.texelSize },
      },
    });

    this.gradSubtractMaterial = new ShaderMaterial({
      vertexShader: baseVertex,
      fragmentShader: gradSubtractFragment,
      uniforms: {
        uPressure: { value: null },
        uVelocity: { value: null },
        texelSize: { value: this.texelSize },
      },
    });

    this.boundaryReflectMaterial = new ShaderMaterial({
      vertexShader: baseVertex,
      fragmentShader: boundaryReflectFragment,
      uniforms: {
        uVelocity: { value: null },
        texelSize: { value: this.texelSize },
        wallThickness: { value: this.config.WALL_THICKNESS },
        restitution: { value: this.config.WALL_RESTITUTION },
        friction: { value: this.config.WALL_FRICTION },
      },
    });
  }

  private updateTexelUniforms(): void {
    this.advectionMaterial.uniforms.texelSize.value = this.texelSize;
    this.curlMaterial.uniforms.texelSize.value = this.texelSize;
    this.vorticityMaterial.uniforms.texelSize.value = this.texelSize;
    this.divergenceMaterial.uniforms.texelSize.value = this.texelSize;
    this.pressureMaterial.uniforms.texelSize.value = this.texelSize;
    this.gradSubtractMaterial.uniforms.texelSize.value = this.texelSize;
    this.boundaryReflectMaterial.uniforms.texelSize.value = this.texelSize;
  }

  private createDoubleFBO(width: number, height: number): DoubleFBO {
    return new DoubleFBO(
      createRenderTarget(width, height, this.supportLinearFiltering),
      createRenderTarget(width, height, this.supportLinearFiltering),
    );
  }

  private disposeTargets(): void {
    this.velocity?.dispose();
    this.dye?.dispose();
    this.pressure?.dispose();
    this.divergence?.dispose();
    this.curl?.dispose();
  }

  private advect(target: DoubleFBO, velocity: DoubleFBO, dissipation: number, dt: number): void {
    this.advectionMaterial.uniforms.uVelocity.value = velocity.read.texture;
    this.advectionMaterial.uniforms.uSource.value = target.read.texture;
    this.advectionMaterial.uniforms.dissipation.value = dissipation;
    this.advectionMaterial.uniforms.dt.value = dt;
    this.pass.render(this.advectionMaterial, target.write);
    target.swap();
  }

  private applySplats(): void {
    const aspectRatio = this.simSize.x / this.simSize.y;
    this.splatMaterial.uniforms.aspectRatio.value = aspectRatio;

    for (const pointer of this.pointers.all) {
      if (!pointer.down || !pointer.moved) {
        continue;
      }

      const uvx = pointer.x / this.width;
      const uvy = 1 - pointer.y / this.height;

      const velocityScaleX = (pointer.dx / this.width) * FORCE_SCALE;
      const velocityScaleY = (-pointer.dy / this.height) * FORCE_SCALE;

      this.splat({ x: uvx, y: uvy }, { x: velocityScaleX, y: velocityScaleY }, pointer.color);
    }
  }

  private splat(
    uv: { x: number; y: number },
    delta: { x: number; y: number },
    color: [number, number, number],
  ): void {
    const radius = this.config.SPLAT_RADIUS / 100;
    this.splatMaterial.uniforms.point.value.set(uv.x, uv.y);
    this.splatMaterial.uniforms.radius.value = radius;

    this.splatMaterial.uniforms.uTarget.value = this.velocity.read.texture;
    this.splatMaterial.uniforms.color.value.setRGB(delta.x, delta.y, 0);
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

  private display(): void {
    this.displayMaterial.uniforms.uTexture.value = this.dye.read.texture;
    this.pass.render(this.displayMaterial, null);
  }

  private randomColor(): [number, number, number] {
    const color = new Color().setHSL(Math.random(), 0.9, 0.55);
    return [color.r, color.g, color.b];
  }
}
