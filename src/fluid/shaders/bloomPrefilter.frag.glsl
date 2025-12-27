precision mediump float;
precision mediump sampler2D;

varying vec2 vUv;

uniform sampler2D uTexture;
uniform float threshold;
uniform float softKnee;

void main() {
  vec3 c = texture2D(uTexture, vUv).rgb;
  float br = max(c.r, max(c.g, c.b));
  float knee = threshold * softKnee + 0.0001;
  float soft = max(br - threshold + knee, 0.0);
  soft = soft * soft / (4.0 * knee + 0.0001);
  float contrib = max(br - threshold, soft) / max(br, 0.0001);
  contrib = max(contrib, 0.0);
  gl_FragColor = vec4(c * contrib, 1.0);
}
