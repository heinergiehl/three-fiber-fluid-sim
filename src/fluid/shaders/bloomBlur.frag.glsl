precision mediump float;
precision mediump sampler2D;

varying vec2 vUv;

uniform sampler2D uTexture;
uniform vec2 direction;

void main() {
  vec2 off1 = direction * 1.33333333;
  vec4 sum = texture2D(uTexture, vUv) * 0.29411764;
  sum += texture2D(uTexture, vUv + off1) * 0.35294117;
  sum += texture2D(uTexture, vUv - off1) * 0.35294117;
  gl_FragColor = sum;
}
