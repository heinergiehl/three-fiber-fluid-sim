import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import FBOParticles from './scene/FBOParticles';
import StatsPanel from './stats/StatsPanel';

const App = () => {
  return (
    <div className="viewport">
      <Canvas
        camera={{ position: [1.6, 1.2, 2.1], fov: 65, near: 0.1, far: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#04060b']} />
        <ambientLight intensity={0.18} />
        <directionalLight position={[2, 3, 2]} intensity={0.7} color="#8fd0ff" />
        <directionalLight position={[-2.5, -1.5, 1.5]} intensity={0.35} color="#ff9aba" />

        <FBOParticles size={256} />
        <OrbitControls enablePan={false} enableDamping dampingFactor={0.08} minDistance={2} maxDistance={7} />
        {import.meta.env.DEV && <StatsPanel />}
      </Canvas>

      <div className="overlay">
        <div className="overlay__heading">
          <p className="eyebrow">GPU Particles</p>
          <h1>Ping-pong FBO playground</h1>
        </div>
        <p className="lede">
          React Three Fiber + custom simulation shaders. The positions are computed fully on the GPU and rendered as a
          dense, flowing cloud.
        </p>
        <div className="chips">
          <span className="chip">React 19</span>
          <span className="chip">R3F 9</span>
          <span className="chip">GPGPU FBO</span>
        </div>
      </div>
    </div>
  );
};

export default App;
