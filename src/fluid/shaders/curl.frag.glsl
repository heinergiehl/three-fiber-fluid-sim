precision highp float;
precision mediump sampler2D;

varying vec2 vUv;

uniform sampler2D uVelocity;
uniform vec2 texelSize;

void main() {
  float L = texture2D(uVelocity, vUv - vec2(texelSize.x, 0.0)).y;
  float R = texture2D(uVelocity, vUv + vec2(texelSize.x, 0.0)).y;
  float B = texture2D(uVelocity, vUv - vec2(0.0, texelSize.y)).x;
  float T = texture2D(uVelocity, vUv + vec2(0.0, texelSize.y)).x;

  float curl = R - L - T + B;
  gl_FragColor = vec4(curl, 0.0, 0.0, 1.0);
}
