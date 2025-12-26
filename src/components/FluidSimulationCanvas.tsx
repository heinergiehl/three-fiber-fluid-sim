import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { FluidEngine } from '../fluid/FluidEngine';
import { defaultFluidConfig, FluidConfig } from '../fluid/config';

function FluidController({ config }: { config: FluidConfig }) {
  const { gl, size } = useThree();
  const engineRef = useRef<FluidEngine | null>(null);

  useEffect(() => {
    const engine = new FluidEngine(gl, config);
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [gl, config]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) {
      return;
    }
    const dpr = gl.getPixelRatio();
    engine.resize(size.width, size.height, dpr);
  }, [gl, size.width, size.height]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) {
      return undefined;
    }

    const element = gl.domElement;

    const getPointer = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      const dpr = gl.getPixelRatio();
      return {
        x: (event.clientX - rect.left) * dpr,
        y: (event.clientY - rect.top) * dpr,
      };
    };

    const onPointerDown = (event: PointerEvent) => {
      const { x, y } = getPointer(event);
      element.setPointerCapture(event.pointerId);
      engine.pointerDown(event.pointerId, x, y);
    };

    const onPointerMove = (event: PointerEvent) => {
      const { x, y } = getPointer(event);
      engine.pointerMove(event.pointerId, x, y);
    };

    const onPointerUp = (event: PointerEvent) => {
      engine.pointerUp(event.pointerId);
      element.releasePointerCapture(event.pointerId);
    };

    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerup', onPointerUp);
    element.addEventListener('pointercancel', onPointerUp);

    return () => {
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerUp);
      element.removeEventListener('pointercancel', onPointerUp);
    };
  }, [gl]);

  useFrame((_, dt) => {
    engineRef.current?.update(dt);
  });

  return null;
}

export function FluidSimulationCanvas({
  className,
  style,
  config,
}: {
  className?: string;
  style?: CSSProperties;
  config?: Partial<FluidConfig>;
}) {
  const mergedConfig = useMemo(() => ({ ...defaultFluidConfig, ...config }), [config]);

  return (
    <Canvas
      className={className}
      style={style}
      gl={{ antialias: false, alpha: false, depth: false, stencil: false }}
      dpr={[1, 2]}
    >
      <FluidController config={mergedConfig} />
    </Canvas>
  );
}
