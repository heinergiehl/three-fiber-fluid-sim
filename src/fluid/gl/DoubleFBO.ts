import { WebGLRenderTarget } from 'three';

export class DoubleFBO {
  read: WebGLRenderTarget;
  write: WebGLRenderTarget;

  constructor(read: WebGLRenderTarget, write: WebGLRenderTarget) {
    this.read = read;
    this.write = write;
  }

  swap(): void {
    const temp = this.read;
    this.read = this.write;
    this.write = temp;
  }

  dispose(): void {
    this.read.dispose();
    this.write.dispose();
  }
}
