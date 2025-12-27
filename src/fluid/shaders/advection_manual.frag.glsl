precision highp float;
precision mediump sampler2D;

varying vec2 vUv;

uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform vec2 dyeTexelSize;
uniform float dt;
uniform float dissipation;

vec4 bilerp(sampler2D tex, vec2 uv, vec2 tsize) {
  vec2 st = uv / tsize - 0.5;
  vec2 iuv = floor(st);
  vec2 fuv = fract(st);

  vec2 uv00 = (iuv + vec2(0.5, 0.5)) * tsize;
  vec2 uv10 = (iuv + vec2(1.5, 0.5)) * tsize;
  vec2 uv01 = (iuv + vec2(0.5, 1.5)) * tsize;
  vec2 uv11 = (iuv + vec2(1.5, 1.5)) * tsize;

  vec4 a = texture2D(tex, uv00);
  vec4 b = texture2D(tex, uv10);
  vec4 c = texture2D(tex, uv01);
  vec4 d = texture2D(tex, uv11);

  return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
}

void main() {
  vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
  vec4 result = bilerp(uSource, coord, dyeTexelSize);
  // Exponential decay to make dissipation sliders visibly affect the field.
  float decay = exp(-dissipation * dt);
  gl_FragColor = result * decay;
}
