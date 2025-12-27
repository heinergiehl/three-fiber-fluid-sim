precision mediump float;
precision mediump sampler2D;

varying vec2 vUv;

uniform sampler2D uTexture;
uniform float weight;

void main() {
  vec2 coord = vUv;
  vec2 dir = vUv - vec2(0.5);
  float decay = 0.97;
  float exposure = weight;
  float illumination = 0.0;
  float samples = 16.0;
  vec2 step = dir / samples;

  for (float i = 0.0; i < samples; i += 1.0) {
    coord -= step;
    illumination += texture2D(uTexture, coord).r * exposure;
    exposure *= decay;
  }

  gl_FragColor = vec4(vec3(illumination), 1.0);
}
