import { useEffect } from 'react';
import GUI from 'lil-gui';
import { defaultFluidConfig, type FluidConfig } from '../fluid/config';

type FluidDevControlsProps = {
  config: FluidConfig;
  onChange: (partial: Partial<FluidConfig>) => void;
};

const ranges: Partial<Record<keyof FluidConfig, [number, number, number]>> = {
  SIM_RESOLUTION: [64, 256, 16],
  DYE_RESOLUTION: [128, 1024, 64],
  TEXTURE_DOWNSAMPLE: [0.5, 2, 0.25],
  // Wide range; start low so sliders have visible impact.
  DENSITY_DISSIPATION: [0, 2, 0.01],
  VELOCITY_DISSIPATION: [0, 2, 0.01],
  PRESSURE_DISSIPATION: [0, 1, 0.01],
  PRESSURE_ITERATIONS: [1, 80, 1],
  CURL: [0, 80, 1],
  SPLAT_RADIUS: [0.1, 1.5, 0.01],
  SPLAT_FORCE: [500, 30000, 100],
  WALL_THICKNESS: [1, 8, 0.25],
  WALL_RESTITUTION: [0, 1, 0.01],
  WALL_FRICTION: [0, 0.5, 0.01],
  SHADING_STRENGTH: [0, 1, 0.01],
  EXPOSURE: [0.4, 2.5, 0.05],
  GAMMA: [1, 3, 0.05],
  VISCOSITY: [0, 5, 0.05],
  BLOOM_INTENSITY: [0, 2, 0.05],
  BLOOM_THRESHOLD: [0, 1, 0.02],
  BLOOM_SOFT_KNEE: [0, 1, 0.02],
  SUNRAYS_WEIGHT: [0.1, 1.5, 0.05],
  AUTO_SPLAT_INTERVAL: [0.05, 2, 0.05],
  AUTO_SPLAT_FORCE: [0.1, 1.5, 0.05],
};

export function FluidDevControls({ config, onChange }: FluidDevControlsProps) {
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;

    const gui = new GUI({ title: 'Fluid Controls' });
    gui.domElement.style.zIndex = '40';

    const params: Record<keyof FluidConfig, number | boolean | string> = { ...defaultFluidConfig, ...config };

    gui
      .add(params, 'QUALITY', ['low', 'medium', 'high'])
      .name('quality')
      .onChange((next: FluidConfig['QUALITY']) => onChange({ QUALITY: next }));

    gui
      .add(params, 'DEBUG_VIEW', ['none', 'velocity', 'divergence', 'curl', 'pressure'])
      .name('debug')
      .onChange((next: FluidConfig['DEBUG_VIEW']) => onChange({ DEBUG_VIEW: next }));

    (Object.keys(defaultFluidConfig) as Array<keyof FluidConfig>).forEach((key) => {
      const value = params[key];
      if (key === 'QUALITY') return;
      if (typeof value === 'boolean') {
        gui.add(params, key).onChange((next: boolean) => onChange({ [key]: next } as Partial<FluidConfig>));
      } else if (ranges[key]) {
        const [min, max, step] = ranges[key]!;
        gui
          .add(params, key, min, max, step)
          .onChange((next: number) => onChange({ [key]: next } as Partial<FluidConfig>));
      }
    });

    return () => {
      gui.destroy();
    };
  }, [onChange]);

  return null;
}

export default FluidDevControls;
