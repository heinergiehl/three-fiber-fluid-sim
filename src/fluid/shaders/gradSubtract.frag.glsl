precision highp float;
precision mediump sampler2D;

varying vec2 vUv;

uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform vec2 texelSize;

float samplePressure(vec2 uv, vec2 offset) {
    vec2 coord = uv + offset;

    return texture2D(uPressure, coord).x;
}

void main() {
    float L = samplePressure(vUv, vec2(-texelSize.x, 0.0));
    float R = samplePressure(vUv, vec2(texelSize.x, 0.0));
    float B = samplePressure(vUv, vec2(0.0, -texelSize.y));
    float T = samplePressure(vUv, vec2(0.0, texelSize.y));

    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity.xy -= 0.5 * vec2(R - L, T - B);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
}
