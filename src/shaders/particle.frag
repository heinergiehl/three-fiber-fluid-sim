precision highp float;

uniform float uTime;
varying vec3 vParticlePosition;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float dist = length(uv);
  float alpha = smoothstep(0.5, 0.15, dist * 1.6);

  if (alpha <= 0.001) {
    discard;
  }

  float sparkle = 0.35 + 0.35 * sin(uTime * 0.65 + vParticlePosition.x * 2.2 + vParticlePosition.y * 1.3);
  vec3 base = vec3(0.24, 0.6, 0.98);
  vec3 highlight = vec3(0.98, 0.88, 0.7);
  vec3 color = mix(base, highlight, sparkle);

  gl_FragColor = vec4(color, alpha);
}
