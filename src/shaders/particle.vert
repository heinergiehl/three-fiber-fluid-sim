precision highp float;

uniform sampler2D uPositions;
uniform float uTime;
uniform float uPointSize;
uniform float uPixelRatio;

varying vec3 vParticlePosition;

void main() {
  vec3 pos = texture2D(uPositions, position.xy).xyz;
  vParticlePosition = pos;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float size = uPointSize * uPixelRatio;
  size *= 1.0 / max(0.1, -mvPosition.z);
  gl_PointSize = clamp(size, 1.0, 14.0);
}
