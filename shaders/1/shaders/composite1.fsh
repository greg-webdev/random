#version 330 compatibility
#include "lib/common.glsl"

in vec2 texCoord;

/* DRAWBUFFERS:0 */
void main() {
    vec4  color = texture(colortex0, texCoord);
    float depth = texture(depthtex0, texCoord).r;

    float sunHeight = getSunHeight();
    vec3  lightDirView = normalize(shadowLightPosition);

    // ---- Volumetric Godrays (disabled underground, night, rain) ----
    if (sunHeight > -0.15 && depth < 1.0) {
        vec3 viewPos  = screenToView(vec3(texCoord, depth));
        vec3 worldPos = viewToWorld(viewPos); // player-relative

        // March from player (origin) toward the surface point in world space
        int   STEPS    = 12;
        float maxDist  = min(length(worldPos), 64.0);
        float stepSize = maxDist / float(STEPS);
        vec3  worldDir = normalize(worldPos);

        // Blue-noise style dither to break banding
        float dither  = hash12(gl_FragCoord.xy + float(frameCounter) * 0.61803);
        vec3  rayPos  = worldDir * stepSize * dither;

        float scatter = 0.0;
        for (int i = 0; i < STEPS; i++) {
            vec3 sPos = worldToShadow(rayPos);
            if (all(greaterThan(sPos, vec3(0.01))) && all(lessThan(sPos, vec3(0.99)))) {
                float sd = texture(shadowtex0, sPos.xy).r;
                if (sPos.z - 0.001 < sd) {
                    scatter += 1.0;
                }
            } else {
                scatter += 1.0; // Outside map = lit sky
            }
            rayPos += worldDir * stepSize;
        }
        scatter /= float(STEPS);

        // Safe Henyey-Greenstein scattering (no spike)
        vec3 worldViewDir = normalize(worldPos);
        vec3 worldLightDir = normalize((gbufferModelViewInverse * vec4(shadowLightPosition, 0.0)).xyz);
        float cosA = dot(worldViewDir, worldLightDir);
        float g    = 0.5; // reduced anisotropy, no spike
        float HG   = (1.0 - g*g) / (4.0*PI * pow(max(1.0 + g*g - 2.0*g*cosA, 0.001), 1.5));
        // Normalize HG so maximum ~0.5 at g=0.5
        HG = clamp(HG * 0.3, 0.0, 0.5);

        // Godray color tinted by time of day
        vec3 rayColor;
        if (sunHeight > 0.15) {
            rayColor = vec3(1.0, 0.90, 0.75) * 0.25;
        } else {
            rayColor = vec3(1.0, 0.40, 0.10) * 0.35;
        }

        float rainMult = 1.0 - rainStrength * 0.9;
        color.rgb += scatter * HG * rayColor * rainMult;
    }

    // ---- Atmospheric Fog ----
    if (depth < 1.0) {
        vec3  viewPos = screenToView(vec3(texCoord, depth));
        float dist    = length(viewPos);

        // Much lower fog density — only kicks in at distance
        float fogFactor = 1.0 - exp(-dist * 0.0008);
        fogFactor = clamp(fogFactor, 0.0, 0.6);

        vec3 fogColor = getSkyColor(sunHeight) * 0.6;
        color.rgb = mix(color.rgb, fogColor, fogFactor);
    }

    gl_FragData[0] = color;
}
