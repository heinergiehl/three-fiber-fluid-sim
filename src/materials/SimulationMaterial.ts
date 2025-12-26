import { DataTexture, FloatType, RGBAFormat, ShaderMaterial, type ShaderMaterialParameters, Texture, Vector3 } from 'three';
import simulationFragment from '../shaders/simulation.frag?raw';
import simulationVertex from '../shaders/simulation.vert?raw';

type SimulationUniforms = {
  positionsA: { value: Texture };
  positionsB: { value: Texture };
  uTime: { value: number };
};

const generateSphereTexture = (size: number) => {
  const length = size * size * 4;
  const data = new Float32Array(length);

  for (let i = 0; i < size * size; i++) {
    const stride = i * 4;
    // Distribute points inside a sphere for a nicely filled cloud
    const radius = Math.cbrt(Math.random()) * 1.2;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    const position = new Vector3().setFromSphericalCoords(radius, phi, theta);
    data[stride] = position.x;
    data[stride + 1] = position.y;
    data[stride + 2] = position.z;
    data[stride + 3] = 1;
  }

  const texture = new DataTexture(data, size, size, RGBAFormat, FloatType);
  texture.needsUpdate = true;
  texture.flipY = false;
  return texture;
};

const generateBoxTexture = (size: number) => {
  const length = size * size * 4;
  const data = new Float32Array(length);

  for (let i = 0; i < size * size; i++) {
    const stride = i * 4;
    // Uniformly distribute inside a cube centered at origin
    data[stride] = (Math.random() * 2 - 1) * 1.5;
    data[stride + 1] = (Math.random() * 2 - 1) * 1.5;
    data[stride + 2] = (Math.random() * 2 - 1) * 1.5;
    data[stride + 3] = 1;
  }

  const texture = new DataTexture(data, size, size, RGBAFormat, FloatType);
  texture.needsUpdate = true;
  texture.flipY = false;
  return texture;
};

export class SimulationMaterial extends ShaderMaterial {
  declare uniforms: SimulationUniforms;

  constructor(size: number, params?: ShaderMaterialParameters) {
    const sphere = generateSphereTexture(size);
    const box = generateBoxTexture(size);
    const uniforms: SimulationUniforms = {
      positionsA: { value: sphere },
      positionsB: { value: box },
      uTime: { value: 0 },
    };

    super({
      uniforms,
      vertexShader: simulationVertex,
      fragmentShader: simulationFragment,
      ...params,
    });
    this.transparent = false;
  }
}
