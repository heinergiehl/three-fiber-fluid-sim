# WebGL-Fluid-Simulation → TypeScript + React Three Fiber (R3F) Porting Instructions
> **Audience:** a coding agent rewriting the project.  
> **Outcome:** a clean, TypeScript-first GPU fluid simulation that runs inside React via `@react-three/fiber`, with **viewport-border reflection** (the fluid “bounces” off the container walls).

---

## 0) Upstream reference (do not change behavior until Milestone 1 passes)

Use these as the “source of truth” for shader math + pass ordering:

```text
Repo: https://github.com/PavelDoGreat/WebGL-Fluid-Simulation
Baseline demo / reference implementation: https://codepen.io/PavelDoGreat/pen/zdWzEL
```

The upstream baseline pipeline (order of passes) must be preserved first, then extended.

---

## 1) Target behavior (important requirements)

### 1.1 Must work in React + TS + R3F
- The simulation must run in a React component (no global canvas queries).
- Use R3F’s render loop (`useFrame`) and `three` GPU utilities (`WebGLRenderTarget`, `ShaderMaterial`, etc).

### 1.2 Fluid respects viewport borders and reflects
**Required:** when the velocity field pushes dye toward an edge, it must **bounce back** (reflection) instead of:
- disappearing (leaking out),
- smearing/clamping at the edge,
- or wrapping around.

Implement as a combination of:
1) **Reflected sampling** during advection (mirror UVs).
2) **Explicit boundary condition pass** that flips the normal velocity component at container walls with optional restitution/friction.

(Details in §10.)

---

## 2) High-level architecture

Split into:

### A) Core engine (no React)
A pure TS module owning:
- all render targets (FBOs / ping-pong buffers),
- all shader materials,
- simulation pipeline (`update(dt)`),
- injection API (`splat()`),
- resize + disposal.

**This module must not import React.**

### B) React wrapper (R3F)
A small component that:
- creates the engine once,
- forwards pointer/touch events,
- calls `engine.resize()` on size/DPR changes,
- calls `engine.update(dt)` each frame.

---

## 3) Suggested folder structure

```
src/
  components/
    FluidSimulationCanvas.tsx
  fluid/
    FluidEngine.ts
    config.ts
    types.ts
    input/
      PointerTracker.ts
    gl/
      capabilities.ts
      DoubleFBO.ts
      FullscreenPass.ts
      createRenderTarget.ts
    shaders/
      base.vert.glsl
      clear.frag.glsl
      display.frag.glsl
      splat.frag.glsl
      advection.frag.glsl
      advection_manual.frag.glsl
      divergence.frag.glsl
      curl.frag.glsl
      vorticity.frag.glsl
      pressure.frag.glsl
      gradSubtract.frag.glsl
      boundaryReflect.frag.glsl      <-- NEW
```

---

## 4) Core types (TypeScript)

### 4.1 Config
Start minimal (match upstream baseline knobs), then expand later.

```ts
export type FluidConfig = {
  TEXTURE_DOWNSAMPLE: number;
  DENSITY_DISSIPATION: number;
  VELOCITY_DISSIPATION: number;
  PRESSURE_DISSIPATION: number;
  PRESSURE_ITERATIONS: number;
  CURL: number;
  SPLAT_RADIUS: number;

  // Added for border reflection:
  WALL_THICKNESS: number;      // in texels, e.g. 2
  WALL_RESTITUTION: number;    // 0..1 (1=perfect bounce), e.g. 0.9
  WALL_FRICTION: number;       // 0..1 tangential damping at wall, e.g. 0.05
};
```

### 4.2 Pointer state
Support multi-pointer (touch).

```ts
export type Pointer = {
  id: number;
  down: boolean;
  moved: boolean;
  x: number;  // pixels
  y: number;  // pixels
  dx: number; // pixels delta (scaled)
  dy: number;
  color: [number, number, number];
};
```

---

## 5) WebGL capability handling (critical)

The upstream uses float/half-float RTs and checks linear filtering support. If linear filtering is missing, it switches to a manual bilerp advection shader.

In three.js:
- Prefer `HalfFloatType` render targets.
- Detect WebGL2 via `renderer.capabilities.isWebGL2`.
- Detect linear filtering for half-float by testing the context extensions (implementation-dependent).

Deliverables:
- `getFluidCapabilities(renderer): { isWebGL2: boolean; supportLinearFiltering: boolean; ... }`
- Choose `advection.frag.glsl` if linear filtering supported, else `advection_manual.frag.glsl`.

---

## 6) Fullscreen quad “pass” helper

Upstream draws a single fullscreen quad for all passes. Mirror this in three.js:

- Create `passScene` with:
  - `OrthographicCamera(-1, 1, 1, -1, 0, 1)`
  - `Mesh(PlaneGeometry(2,2), ShaderMaterial)`
- Provide:

```ts
renderPass(material: ShaderMaterial, target: WebGLRenderTarget | null): void
```

Implementation:
- set quad.material = material
- `renderer.setRenderTarget(target)`
- `renderer.render(passScene, passCamera)`
- optionally reset `setRenderTarget(null)` after the call

---

## 7) Ping-pong buffers (DoubleFBO)

Implement `DoubleFBO`:

```ts
class DoubleFBO {
  read: WebGLRenderTarget;
  write: WebGLRenderTarget;
  swap(): void;
  dispose(): void;
}
```

Used for:
- velocity (RG channels)
- density/dye (RGB or RGBA)
- pressure (R)
Optional single buffers:
- divergence (R)
- curl (R)

---

## 8) Shader porting rules

### 8.1 Keep GLSL near-identical
- Move shader strings into `.glsl` files (Vite supports importing raw strings with plugins; or use a tiny loader).
- Keep the same varying names (`vUv`, `vL/vR/vT/vB`) and uniform names for consistency.

### 8.2 Uniform updates
In three.js:
- define all uniforms explicitly in `ShaderMaterial`
- update uniforms before each pass
- textures: always point to the **current** `DoubleFBO.read.texture`

### 8.3 Coordinate conventions
- canvas pixels → UV:
  - `u = x / width`
  - `v = 1.0 - y / height` (**flip Y**)

---

## 9) Simulation pipeline (base)

**Implement this order first** before adding bloom, sunrays, etc.

1) (If needed) resize/reinit RTs
2) advect velocity (velocity ← advect(velocity, velocity))
3) advect dye/density (dye ← advect(velocity, dye))
4) apply user splats (inject into velocity + dye)
5) curl (curl = curl(velocity))
6) vorticity confinement (velocity ← vorticity(velocity, curl))
7) divergence (div = div(velocity))
8) clear pressure (pressure *= PRESSURE_DISSIPATION)
9) pressure solve (Jacobi) repeat `PRESSURE_ITERATIONS`
10) gradient subtract (velocity ← velocity - ∇pressure)
11) display dye to screen

---

## 10) **Viewport border reflection (REQUIRED)**

This is the new functionality you must add beyond upstream baseline.

### 10.1 Why you need more than “clamp UV”
Upstream commonly clamps neighbor UVs to `[0,1]` in some passes to avoid sampling out of bounds. That prevents crashes/leaks, but it does **not** create realistic “container wall” behavior.

We want:
- fluid stays in a box,
- velocity reflects at walls (like a bounce),
- tangential component can be slightly damped for realism.

### 10.2 Implement reflection in TWO places (do both)

#### A) Reflected sampling for advection (mirror UVs)
In `advection.frag.glsl` and `advection_manual.frag.glsl`, when you compute the backtraced UV:

```glsl
vec2 reflectUV(vec2 uv) {
  // Mirror tiling: keeps uv inside [0,1] by reflecting across edges
  uv = abs(uv);
  uv = 1.0 - abs(1.0 - uv);
  return uv;
}
```

Then:
- compute `coord = vUv - dt * velocity * texelSize;`
- sample at `reflectUV(coord)` (instead of clamping)

This ensures advection doesn’t “lose” samples beyond the edge and visually supports reflection.

#### B) Add an explicit boundary reflection pass (NEW shader)
Add a new pass shader `boundaryReflect.frag.glsl` applied to **velocity** to enforce wall conditions.

**When to run it:**
- after velocity advection,
- after splats (since splats can inject velocity across boundary),
- after vorticity step,
- after gradient subtract (final velocity).

In practice, simplest:
- call it **once** at the end of the velocity pipeline, right after gradient subtract,
- and optionally also after splats for extra stability.

**What it does:**
- In a strip along each edge (thickness in texels), flip the **normal component**:
  - left wall: ensure `vel.x >= 0` (bounce back inside)
  - right wall: ensure `vel.x <= 0`
  - bottom wall: ensure `vel.y >= 0`
  - top wall: ensure `vel.y <= 0`
- Apply restitution (bounce strength).
- Apply friction to tangential component.

Example GLSL (agent can refine, but keep this behavior):

```glsl
precision highp float;
precision mediump sampler2D;

varying vec2 vUv;
uniform sampler2D uVelocity;
uniform vec2 texelSize;          // (1/width, 1/height)
uniform float wallThickness;     // in texels
uniform float restitution;       // 0..1
uniform float friction;          // 0..1

void main () {
  vec2 vel = texture2D(uVelocity, vUv).xy;

  float tX = wallThickness * texelSize.x;
  float tY = wallThickness * texelSize.y;

  bool left   = vUv.x < tX;
  bool right  = vUv.x > 1.0 - tX;
  bool bottom = vUv.y < tY;
  bool top    = vUv.y > 1.0 - tY;

  // Reflect normal component:
  if (left)  { vel.x =  abs(vel.x) * restitution; vel.y *= (1.0 - friction); }
  if (right) { vel.x = -abs(vel.x) * restitution; vel.y *= (1.0 - friction); }
  if (bottom){ vel.y =  abs(vel.y) * restitution; vel.x *= (1.0 - friction); }
  if (top)   { vel.y = -abs(vel.y) * restitution; vel.x *= (1.0 - friction); }

  gl_FragColor = vec4(vel, 0.0, 1.0);
}
```

**Notes:**
- This is a “solid container wall” approximation.
- If it looks too bouncy, reduce `WALL_RESTITUTION` (e.g. 0.6–0.85).
- If it looks too slippery, increase `WALL_FRICTION` (0.05–0.2).
- If edges shimmer, increase `WALL_THICKNESS` to 2–3 texels.

### 10.3 Pressure boundaries
Pressure solve + grad subtract must still avoid sampling outside the domain. The upstream often clamps boundary UVs for these passes. Keep that behavior (clamp), even though advection uses reflect.

---

## 11) Engine responsibilities

Implement `FluidEngine` class:

### 11.1 Constructor
Inputs:
- `renderer: THREE.WebGLRenderer`
- `config: FluidConfig`
- initial size (or call `resize()` immediately)

Responsibilities:
- capability detection
- create render targets
- compile materials (shader materials)
- create fullscreen pass helper

### 11.2 Public API
```ts
update(dt: number): void;
resize(widthCss: number, heightCss: number, dpr: number): void;
pointerDown(id: number, x: number, y: number): void;
pointerMove(id: number, x: number, y: number): void;
pointerUp(id: number): void;
dispose(): void;
```

### 11.3 `splat()`
Signature suggestion:
```ts
splat(uv: {x:number;y:number}, delta: {x:number;y:number}, color: [number,number,number]): void;
```

Implement like upstream:
- write into velocity (add delta to RG)
- write into dye/density (add color)

### 11.4 Resize logic
- use R3F size + dpr:
  - drawing buffer size = `size.width * dpr`, `size.height * dpr`
- compute sim resolution:
  - `simW = floor(width / TEXTURE_DOWNSAMPLE)`
  - `simH = floor(height / TEXTURE_DOWNSAMPLE)`
- recreate all FBOs and update `texelSize` uniforms.

---

## 12) React/R3F wrapper component

Create:

```tsx
export function FluidSimulationCanvas(props: {
  className?: string;
  style?: React.CSSProperties;
  config?: Partial<FluidConfig>;
}) { ... }
```

Implementation:
- Use `<Canvas>` from R3F with `gl={{ antialias:false, alpha:false, depth:false, stencil:false }}`
- Inside, mount a `FluidController` that uses:
  - `const { gl, size } = useThree()`
  - `useFrame((_, dt) => engine.update(dt))`
- Attach pointer events to `gl.domElement`:
  - `pointerdown`, `pointermove`, `pointerup`, `pointercancel`
  - use `event.pointerId`
- Convert to pixel coords in drawing-buffer space:
  - `x = event.offsetX * dpr`
  - `y = event.offsetY * dpr`
  - If offsetX/Y unreliable in your setup, compute from `clientX/Y` and `getBoundingClientRect()`.

Important:
- On each `pointermove` while down:
  - compute `dx = (x - prevX) * forceScale`
  - compute `dy = (y - prevY) * forceScale`
  - mark `moved = true`
- In `engine.update()`:
  - for each moved pointer: call `splat()` then `moved=false`

---

## 13) Milestones & acceptance criteria

### Milestone 1 — Base port works (no bloom)
- [ ] R3F component renders dye on screen
- [ ] Drag injects velocity + color
- [ ] Stable resize (recreates RTs)
- [ ] Works mouse + touch
- [ ] No GPU leaks on unmount

### Milestone 2 — Border reflection works (MANDATORY)
- [ ] Fluid does not leak out of the viewport
- [ ] Dye/flow near edges visibly **reflects** back
- [ ] Velocity at edges obeys reflection rules (normal component flips)
- [ ] Reflection parameters can be tuned via config:
  - `WALL_THICKNESS`, `WALL_RESTITUTION`, `WALL_FRICTION`

### Milestone 3 — Polish
- [ ] Optional UI controls (Leva)
- [ ] Optional background transparency
- [ ] Optional nicer shading / post effects (bloom/sunrays) after core is correct

---

## 14) Common pitfalls (warn the agent)

- **DPR mismatch** causes pointer splats to appear offset or scaled wrong.
- **State leakage**: R3F + three.js can change renderer state; keep each pass self-contained.
- **Wrong ping-pong usage**: always render into `write`, then `swap()`.
- **Edge flicker**: increase wall thickness and ensure boundary pass runs after velocity updates.
- **Manual bilerp** fallback must be used if linear filtering on half-float isn’t available.

---

## 15) “Done” definition

You’re done when:
- `FluidSimulationCanvas` is a drop-in React component
- engine is isolated, typed, disposable
- simulation matches upstream baseline behavior
- borders behave like solid container walls with reflection
