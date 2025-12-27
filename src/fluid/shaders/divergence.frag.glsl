precision highp float;
precision mediump sampler2D;

varying vec2 vUv;

uniform sampler2D uVelocity;
uniform vec2 texelSize;

vec2 sampleVelocity(vec2 uv, vec2 offset) {
    vec2 coord = uv + offset;
    // Clamp to edge manually; if outside, mirror the normal component to enforce no-flux.
    bool outX = coord.x < 0.0 || coord.x > 1.0;
    bool outY = coord.y < 0.0 || coord.y > 1.0;
    vec2 v = texture2D(uVelocity, clamp(coord, 0.0, 1.0)).xy;
    if (outX) v.x = -v.x;
    if (outY) v.y = -v.y;
    return v;
}

void main() {
    vec2 L = sampleVelocity(vUv, vec2(-texelSize.x, 0.0));
    vec2 R = sampleVelocity(vUv, vec2(texelSize.x, 0.0));
    vec2 B = sampleVelocity(vUv, vec2(0.0, -texelSize.y));
    vec2 T = sampleVelocity(vUv, vec2(0.0, texelSize.y));

    float divergence =.5 * (R.x - L.x + T.y - B.y);
    gl_FragColor = vec4(divergence, 0.0, 0.0, 1.0);
}
