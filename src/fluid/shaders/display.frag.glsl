precision highp float;
precision mediump sampler2D;

varying vec2 vUv;

uniform sampler2D uTexture;

void main() {
  vec3 color = texture2D(uTexture, vUv).rgb;
  gl_FragColor = vec4(color, 1.0);
}
