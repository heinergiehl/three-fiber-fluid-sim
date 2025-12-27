import { useCallback, useState } from 'react';
import { FluidSimulationCanvas } from './components/FluidSimulationCanvas';
import FluidDevControls from './components/FluidDevControls';
import { defaultFluidConfig, type FluidConfig } from './fluid/config';

const App = () => {
  const [config, setConfig] = useState<FluidConfig>(defaultFluidConfig);

  const handleConfigChange = useCallback((partial: Partial<FluidConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  return (
    <div className="viewport">
      <FluidSimulationCanvas config={config} />
      {import.meta.env.DEV ? <FluidDevControls config={config} onChange={handleConfigChange} /> : null}

      <div className="overlay">
        <div className="overlay__heading">
          <p className="eyebrow">GPU Fluid</p>
          <h1>React Three Fiber Fluid Simulation</h1>
        </div>
        <p className="lede">
          Drag or touch the canvas to inject dye and velocity. The fluid reflects against the viewport borders for a
          sealed-container effect.
        </p>
        <div className="chips">
          <span className="chip">R3F</span>
          <span className="chip">WebGL FBO</span>
          <span className="chip">Boundary Reflection</span>
        </div>
      </div>
    </div>
  );
};

export default App;
