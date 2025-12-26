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

vec4 bilerp(sampler2D tex, vec2 uv) {
  vec2 st = uv / texelSize - 0.5;
  vec2 iuv = floor(st);
  vec2 fuv = fract(st);

  vec2 uv00 = (iuv + vec2(0.5, 0.5)) * texelSize;
  vec2 uv10 = (iuv + vec2(1.5, 0.5)) * texelSize;
  vec2 uv01 = (iuv + vec2(0.5, 1.5)) * texelSize;
  vec2 uv11 = (iuv + vec2(1.5, 1.5)) * texelSize;

  vec4 a = texture2D(tex, reflectUV(uv00));
  vec4 b = texture2D(tex, reflectUV(uv10));
  vec4 c = texture2D(tex, reflectUV(uv01));
  vec4 d = texture2D(tex, reflectUV(uv11));

  return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
}

void main() {
  vec2 velocity = texture2D(uVelocity, vUv).xy;
  vec2 coord = vUv - dt * velocity * texelSize;
  vec4 result = bilerp(uSource, coord);
  gl_FragColor = dissipation * result;
}
