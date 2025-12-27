precision highp float;
precision mediump sampler2D;

varying vec2 vUv;

uniform sampler2D uTexture;
uniform sampler2D uBloom;
uniform sampler2D uSunrays;
uniform vec2 texelSize;
uniform float shadingEnabled;
uniform float shadingStrength;
uniform float bloomEnabled;
uniform float bloomIntensity;
uniform float sunraysEnabled;
uniform float sunraysWeight;
uniform float exposure;
uniform float gamma;
uniform int debugMode; // 0:none,1:velocity magnitude,2:divergence,3:curl,4:pressure

vec3 applyShading(vec3 baseColor) {
  vec3 dx = texture2D(uTexture, vUv + vec2(texelSize.x, 0.0)).rgb -
            texture2D(uTexture, vUv - vec2(texelSize.x, 0.0)).rgb;
  vec3 dy = texture2D(uTexture, vUv + vec2(0.0, texelSize.y)).rgb -
            texture2D(uTexture, vUv - vec2(0.0, texelSize.y)).rgb;

  vec3 normal = normalize(vec3(dx.r + dx.g + dx.b, dy.r + dy.g + dy.b, 0.35));
  float light = clamp(0.35 + 0.65 * dot(normal, normalize(vec3(-0.4, 0.6, 1.0))), 0.0, 1.4);

  float mixAmount = shadingEnabled * shadingStrength;
  return mix(baseColor, baseColor * light, mixAmount);
}

void main() {
  vec3 color = texture2D(uTexture, vUv).rgb;

  if (debugMode == 1) {
    // velocity magnitude with gentle scaling so it doesn't blow out.
    float m = length(color.xy);
    m = m / (1.0 + m); // compress large values
    gl_FragColor = vec4(vec3(m), 1.0);
    return;
  }
  if (debugMode == 2) {
    // divergence centered to 0.5 with scale
    float div = color.r;
    div = clamp(div * 0.25 + 0.5, 0.0, 1.0);
    gl_FragColor = vec4(vec3(div), 1.0);
    return;
  }
  if (debugMode == 3) {
    float c = abs(color.r);
    c = c / (1.0 + c);
    gl_FragColor = vec4(vec3(c), 1.0);
    return;
  }
  if (debugMode == 4) {
    float p = texture2D(uTexture, vUv).r;
    p = clamp(p * 0.1 + 0.5, 0.0, 1.0); // scale pressure for visibility
    gl_FragColor = vec4(vec3(p), 1.0);
    return;
  }

  if (shadingEnabled > 0.5) {
    color = applyShading(color);
  }
  if (bloomEnabled > 0.5) {
    color += texture2D(uBloom, vUv).rgb * bloomIntensity;
  }
  if (sunraysEnabled > 0.5) {
    float rays = texture2D(uSunrays, vUv).r;
    color *= mix(1.0, rays, clamp(sunraysWeight, 0.0, 1.0));
  }
  color = vec3(1.0) - exp(-color * exposure);
  color = pow(color, vec3(1.0 / gamma));
  gl_FragColor = vec4(color, 1.0);
}
