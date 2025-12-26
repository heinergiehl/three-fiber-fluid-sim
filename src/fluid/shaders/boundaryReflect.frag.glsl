precision highp float;
precision mediump sampler2D;

varying vec2 vUv;

uniform sampler2D uVelocity;
uniform vec2 texelSize;
uniform float wallThickness;
uniform float restitution;
uniform float friction;

void main() {
  vec2 vel = texture2D(uVelocity, vUv).xy;

  float tX = wallThickness * texelSize.x;
  float tY = wallThickness * texelSize.y;

  bool left = vUv.x < tX;
  bool right = vUv.x > 1.0 - tX;
  bool bottom = vUv.y < tY;
  bool top = vUv.y > 1.0 - tY;

  if (left) {
    vel.x = abs(vel.x) * restitution;
    vel.y *= (1.0 - friction);
  }
  if (right) {
    vel.x = -abs(vel.x) * restitution;
    vel.y *= (1.0 - friction);
  }
  if (bottom) {
    vel.y = abs(vel.y) * restitution;
    vel.x *= (1.0 - friction);
  }
  if (top) {
    vel.y = -abs(vel.y) * restitution;
    vel.x *= (1.0 - friction);
  }

  gl_FragColor = vec4(vel, 0.0, 1.0);
}
