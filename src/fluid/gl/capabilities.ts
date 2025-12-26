import { WebGLRenderer } from 'three';

export type FluidCapabilities = {
  isWebGL2: boolean;
  supportLinearFiltering: boolean;
};

export function getFluidCapabilities(renderer: WebGLRenderer): FluidCapabilities {
  const gl = renderer.getContext();
  const isWebGL2 = renderer.capabilities.isWebGL2;

  let supportLinearFiltering = false;

  if (isWebGL2) {
    supportLinearFiltering = true;
  } else {
    supportLinearFiltering = !!gl.getExtension('OES_texture_half_float_linear');
  }

  return { isWebGL2, supportLinearFiltering };
}
