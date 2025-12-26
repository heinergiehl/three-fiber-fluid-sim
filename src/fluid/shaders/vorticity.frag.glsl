precision highp float;
precision mediump sampler2D;

varying vec2 vUv;

uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform vec2 texelSize;
uniform float curl;
uniform float dt;

void main() {
  float L = abs(texture2D(uCurl, vUv - vec2(texelSize.x, 0.0)).x);
  float R = abs(texture2D(uCurl, vUv + vec2(texelSize.x, 0.0)).x);
  float B = abs(texture2D(uCurl, vUv - vec2(0.0, texelSize.y)).x);
  float T = abs(texture2D(uCurl, vUv + vec2(0.0, texelSize.y)).x);

  vec2 force = 0.5 * vec2(R - L, T - B);
  float len = length(force) + 0.0001;
  force = (force / len) * curl * texture2D(uCurl, vUv).x;

  vec2 velocity = texture2D(uVelocity, vUv).xy;
  velocity += force * dt;

  gl_FragColor = vec4(velocity, 0.0, 1.0);
}
