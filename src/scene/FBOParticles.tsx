import { createPortal, useFrame, useThree } from '@react-three/fiber';
import { useFBO } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SimulationMaterial } from '../materials/SimulationMaterial';
import particleFragment from '../shaders/particle.frag?raw';
import particleVertex from '../shaders/particle.vert?raw';

type FBOParticlesProps = {
  size?: number;
};

const FBOParticles = ({ size = 256 }: FBOParticlesProps) => {
  const { gl } = useThree();
  const simMaterial = useMemo(() => new SimulationMaterial(size), [size]);
  const simScene = useMemo(() => new THREE.Scene(), []);
  const simCamera = useMemo(
    () => new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1),
    [],
  );

  const pingRef = useRef(true);
  const renderMaterialRef = useRef<THREE.ShaderMaterial>(null);

  const targetOptions = useMemo(
    () => ({
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      stencilBuffer: false,
      depthBuffer: false,
    }),
    [],
  );

  const targetA = useFBO(size, size, targetOptions);
  const targetB = useFBO(size, size, targetOptions);

  const particlePositions = useMemo(() => {
    const length = size * size;
    const positions = new Float32Array(length * 3);

    for (let i = 0; i < length; i++) {
      const i3 = i * 3;
      const x = (i % size) / size;
      const y = Math.floor(i / size) / size;
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = 0;
    }

    return positions;
  }, [size]);

  const renderUniforms = useMemo(
    () => ({
      uPositions: { value: null as THREE.Texture | null },
      uTime: { value: 0 },
      uPointSize: { value: 7.0 },
      uPixelRatio: { value: 1 },
    }),
    [],
  );

  useEffect(() => {
    simCamera.position.z = 1;
    simCamera.updateProjectionMatrix();
  }, [simCamera]);

  useEffect(
    () => () => {
      simMaterial.dispose();
    },
    [simMaterial],
  );

  // Prime the first framebuffer with the initial positions texture
  useEffect(() => {
    gl.setRenderTarget(targetA);
    gl.clear();
    gl.render(simScene, simCamera);
    gl.setRenderTarget(null);

    renderUniforms.uPositions.value = targetA.texture;
    pingRef.current = true;
  }, [gl, renderUniforms, simCamera, simMaterial, simScene, targetA]);

  useFrame((state) => {
    const { clock } = state;
    const elapsed = clock.elapsedTime;

    const writeTarget = pingRef.current ? targetB : targetA;

    simMaterial.uniforms.uTime.value = elapsed;

    gl.setRenderTarget(writeTarget);
    gl.clear();
    gl.render(simScene, simCamera);
    gl.setRenderTarget(null);

    const material = renderMaterialRef.current;
    if (material) {
      // Render with the freshly written texture (different from the current render target)
      material.uniforms.uPositions.value = writeTarget.texture;
      material.uniforms.uTime.value = elapsed;
      material.uniforms.uPixelRatio.value = Math.min(2, gl.getPixelRatio());
    }

    pingRef.current = !pingRef.current;
  });

  return (
    <>
      {createPortal(
        <mesh>
          <planeGeometry args={[2, 2]} />
          <primitive attach="material" object={simMaterial} />
        </mesh>,
        simScene,
      )}

      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} />
        </bufferGeometry>
        <shaderMaterial
          ref={renderMaterialRef}
          vertexShader={particleVertex}
          fragmentShader={particleFragment}
          uniforms={renderUniforms}
          depthWrite={false}
          transparent
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  );
};

export default FBOParticles;
