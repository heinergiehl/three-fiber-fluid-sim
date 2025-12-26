precision highp float;
precision mediump sampler2D;

varying vec2 vUv;

uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform float dt;
uniform float dissipation;

vec2 reflectUV(vec2 uv) {
  uv = abs(uv);
  uv = 1.0 - abs(1.0 - uv);
  return uv;
}

void main() {
  vec2 velocity = texture2D(uVelocity, vUv).xy;
  vec2 coord = vUv - dt * velocity * texelSize;
  vec4 result = texture2D(uSource, reflectUV(coord));
  gl_FragColor = dissipation * result;
}
