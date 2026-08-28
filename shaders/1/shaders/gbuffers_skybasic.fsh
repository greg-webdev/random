#version 330 compatibility
#include "lib/common.glsl"

in vec2 texCoord;
in vec4 starColor;
in vec3 viewDir;

/* DRAWBUFFERS:0 */
void main() {
    float sunHeight = getSunHeight();
    vec3  worldUp   = vec3(0,1,0);

    // World-space view direction
    vec3 worldDir = normalize((gbufferModelViewInverse * vec4(viewDir, 0.0)).xyz);
    float upCos   = clamp(worldDir.y, 0.0, 1.0);

    // Sky gradient
    vec3 zenith  = getSkyColor(sunHeight) * 0.8;
    vec3 horizon = getSkyColor(sunHeight) * 1.4;
    vec3 sky     = mix(horizon, zenith, pow(upCos, 0.6));

    // Sun disc & halo
    vec3 lightDirWorld = normalize((gbufferModelViewInverse * vec4(normalize(shadowLightPosition), 0.0)).xyz);
    float sunCos       = dot(worldDir, lightDirWorld);
    float sunDisc      = smoothstep(0.9996, 0.9999, sunCos);
    float sunHalo      = pow(max(0.0, sunCos), 16.0) * 0.15;

    vec3 sunColor = (sunHeight > 0.0)
        ? vec3(1.0, 0.95, 0.85) * 1.5
        : vec3(1.0, 0.40, 0.10) * 1.2;

    sky += sunColor * (sunDisc * 2.0 + sunHalo);

    // Fog during rain
    sky = mix(sky, vec3(0.45, 0.50, 0.55), rainStrength * 0.7);

    // Stars (only at night)
    float nightBlend = clamp(-sunHeight * 5.0, 0.0, 1.0);
    sky += starColor.rgb * starColor.a * nightBlend * (1.0 - rainStrength);

    gl_FragData[0] = vec4(sky, 1.0);
}
