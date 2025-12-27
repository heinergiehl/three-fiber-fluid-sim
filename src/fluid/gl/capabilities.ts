import { WebGLRenderer } from 'three';

export type FluidCapabilities = {
  isWebGL2: boolean;
  supportLinearFiltering: boolean;
};

export function getFluidCapabilities(renderer: WebGLRenderer): FluidCapabilities {
  const gl = renderer.getContext();
  const isWebGL2 = renderer.capabilities.isWebGL2;

  // Half-float linear filtering is core in WebGL2; otherwise require the extension.
  const supportLinearFiltering =
    isWebGL2 || !!gl.getExtension('OES_texture_half_float_linear') || !!gl.getExtension('OES_texture_float_linear');

  return { isWebGL2, supportLinearFiltering };
}
