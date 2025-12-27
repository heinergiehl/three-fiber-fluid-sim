precision highp float;
precision mediump sampler2D;

varying vec2 vUv;

uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 texelSize;

float samplePressure(vec2 uv, vec2 offset) {
    vec2 coord = clamp(uv + offset, 0.0, 1.0);
    return texture2D(uPressure, coord).x;
}

void main() {
    float L = samplePressure(vUv, vec2(-texelSize.x, 0.0));
    float R = samplePressure(vUv, vec2(texelSize.x, 0.0));
    float B = samplePressure(vUv, vec2(0.0, -texelSize.y));
    float T = samplePressure(vUv, vec2(0.0, texelSize.y));
    float divergence = texture2D(uDivergence, vUv).x;

    float pressure = (L + R + B + T - divergence) * 0.25;
    gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
}
