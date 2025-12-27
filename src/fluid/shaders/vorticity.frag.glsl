precision highp float;
precision mediump sampler2D;

varying vec2 vUv;

uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform vec2 texelSize;
uniform float curl;
uniform float dt;

void main() {
    float L = abs(texture2D(uCurl, vUv - vec2(texelSize.x, 0.0)).x);
    float R = abs(texture2D(uCurl, vUv + vec2(texelSize.x, 0.0)).x);
    float B = abs(texture2D(uCurl, vUv - vec2(0.0, texelSize.y)).x);
    float T = abs(texture2D(uCurl, vUv + vec2(0.0, texelSize.y)).x);

    // Gradient of |curl|
    vec2 grad = 0.5 * vec2(R - L, T - B);
    float mag = length(grad) + 0.0001;
    vec2 n = grad / mag;

    float vort = texture2D(uCurl, vUv).x;
    // Rotate gradient 90 deg to push tangentially around vorticity.
    vec2 force = curl * vec2(n.y, -n.x) * vort;

    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity += force * dt;
    velocity = clamp(velocity, vec2(-1000.0), vec2(1000.0));

    gl_FragColor = vec4(velocity, 0.0, 1.0);
}
