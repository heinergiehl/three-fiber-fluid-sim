import {
  HalfFloatType,
  LinearFilter,
  NearestFilter,
  RGBAFormat,
  WebGLRenderTarget,
} from 'three';

export function createRenderTarget(width: number, height: number, supportLinearFiltering: boolean): WebGLRenderTarget {
  return new WebGLRenderTarget(width, height, {
    type: HalfFloatType,
    format: RGBAFormat,
    minFilter: supportLinearFiltering ? LinearFilter : NearestFilter,
    magFilter: supportLinearFiltering ? LinearFilter : NearestFilter,
    depthBuffer: false,
    stencilBuffer: false,
  });
}
