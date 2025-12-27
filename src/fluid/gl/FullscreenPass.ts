import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
  WebGLRenderTarget,
  Vector4,
} from 'three';

export class FullscreenPass {
  private scene: Scene;
  private camera: OrthographicCamera;
  private quad: Mesh;
  private renderer: WebGLRenderer;

  constructor(renderer: WebGLRenderer) {
    this.renderer = renderer;
    this.scene = new Scene();
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial());
    this.scene.add(this.quad);
  }

  render(material: ShaderMaterial, target: WebGLRenderTarget | null): void {
    this.quad.material = material;
    const prevTarget = this.renderer.getRenderTarget();
    const prevViewport = new Vector4();
    this.renderer.getViewport(prevViewport);

    const viewport = target
      ? new Vector4(0, 0, target.width, target.height)
      : new Vector4(0, 0, this.renderer.domElement.width, this.renderer.domElement.height);

    this.renderer.setRenderTarget(target);
    this.renderer.setViewport(viewport.x, viewport.y, viewport.z, viewport.w);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(prevTarget);
    this.renderer.setViewport(prevViewport.x, prevViewport.y, prevViewport.z, prevViewport.w);
  }
}
