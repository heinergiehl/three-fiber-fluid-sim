precision highp float;
precision mediump sampler2D;

varying vec2 vUv;

uniform sampler2D uVelocity;

void main() {
  float m = length(texture2D(uVelocity, vUv).xy);
  gl_FragColor = vec4(m, m, m, 1.0);
}
