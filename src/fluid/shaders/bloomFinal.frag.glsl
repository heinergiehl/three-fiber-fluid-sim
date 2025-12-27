precision mediump float;
precision mediump sampler2D;

varying vec2 vUv;

uniform sampler2D uBase;
uniform sampler2D uBloom;
uniform float intensity;

void main() {
  vec3 base = texture2D(uBase, vUv).rgb;
  vec3 bloom = texture2D(uBloom, vUv).rgb * intensity;
  gl_FragColor = vec4(base + bloom, 1.0);
}
