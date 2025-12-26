precision highp float;
precision mediump sampler2D;

varying vec2 vUv;

uniform sampler2D uVelocity;
uniform vec2 texelSize;

void main() {
  vec2 L = texture2D(uVelocity, vUv - vec2(texelSize.x, 0.0)).xy;
  vec2 R = texture2D(uVelocity, vUv + vec2(texelSize.x, 0.0)).xy;
  vec2 B = texture2D(uVelocity, vUv - vec2(0.0, texelSize.y)).xy;
  vec2 T = texture2D(uVelocity, vUv + vec2(0.0, texelSize.y)).xy;

  float divergence = 0.5 * (R.x - L.x + T.y - B.y);
  gl_FragColor = vec4(divergence, 0.0, 0.0, 1.0);
}
