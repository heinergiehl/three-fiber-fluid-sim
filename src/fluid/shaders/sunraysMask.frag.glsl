precision mediump float;
precision mediump sampler2D;

varying vec2 vUv;

uniform sampler2D uTexture;

void main() {
  vec3 c = texture2D(uTexture, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  gl_FragColor = vec4(vec3(l), 1.0);
}
