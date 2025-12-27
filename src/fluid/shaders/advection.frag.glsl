precision highp float;
precision mediump sampler2D;

varying vec2 vUv;

uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform vec2 dyeTexelSize;
uniform float dt;
uniform float dissipation;

void main() {
    // Matches Pavel's linear-filter path: single tap with hardware bilerp.
    vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
    vec4 result = texture2D(uSource, coord);
    // Exponential decay so slider changes have a visible effect.
    float decay = exp(-dissipation * dt);
    gl_FragColor = result * decay;
}
