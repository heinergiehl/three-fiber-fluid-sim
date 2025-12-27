export type FluidConfig = {
  QUALITY: 'low' | 'medium' | 'high';
  SIM_RESOLUTION: number; // max dimension in texels
  DYE_RESOLUTION: number; // max dimension for dye (color) buffer
  TEXTURE_DOWNSAMPLE: number;
  DENSITY_DISSIPATION: number;
  VELOCITY_DISSIPATION: number;
  PRESSURE_DISSIPATION: number;
  PRESSURE_ITERATIONS: number;
  CURL: number;
  SPLAT_RADIUS: number;
  SPLAT_FORCE: number;
  WALL_THICKNESS: number;
  WALL_RESTITUTION: number;
  WALL_FRICTION: number;
  VISCOSITY: number;

  // Rendering
  SHADING: boolean;
  SHADING_STRENGTH: number;
  EXPOSURE: number;
  GAMMA: number;
  COLORFUL: boolean;
  BLOOM: boolean;
  BLOOM_INTENSITY: number;
  BLOOM_THRESHOLD: number;
  BLOOM_SOFT_KNEE: number;
  SUNRAYS: boolean;
  SUNRAYS_WEIGHT: number;
  DEBUG_VIEW: 'none' | 'velocity' | 'divergence' | 'curl' | 'pressure';

  // Automation / control
  AUTO_SPLATS: boolean;
  AUTO_SPLAT_INTERVAL: number;
  AUTO_SPLAT_FORCE: number;
  PAUSED: boolean;
};

export const defaultFluidConfig: FluidConfig = {
  QUALITY: 'high',
  SIM_RESOLUTION: 192,
  DYE_RESOLUTION: 512,
  TEXTURE_DOWNSAMPLE: 1,
  // Lower default decay so motion and dye persist better.
  DENSITY_DISSIPATION: 0.35,
  VELOCITY_DISSIPATION: 0.05,
  PRESSURE_DISSIPATION: 0.8,
  PRESSURE_ITERATIONS: 45,
  CURL: 45,
  SPLAT_RADIUS: 0.4,
  // Higher impulse so each drag injects more momentum per frame.
  SPLAT_FORCE: 18000,
  WALL_THICKNESS: 3,
  WALL_RESTITUTION: 0.98,
  WALL_FRICTION: 0.0,
  VISCOSITY: 0.0,

  SHADING: true,
  SHADING_STRENGTH: 0.6,
  EXPOSURE: 0.9,
  GAMMA: 2.2,
  COLORFUL: true,
  BLOOM: true,
  BLOOM_INTENSITY: 0.8,
  BLOOM_THRESHOLD: 0.6,
  BLOOM_SOFT_KNEE: 0.7,
  SUNRAYS: true,
  SUNRAYS_WEIGHT: 1.0,
  DEBUG_VIEW: 'none',

  AUTO_SPLATS: false,
  AUTO_SPLAT_INTERVAL: 0.35,
  AUTO_SPLAT_FORCE: 0.8,
  PAUSED: false,
};
