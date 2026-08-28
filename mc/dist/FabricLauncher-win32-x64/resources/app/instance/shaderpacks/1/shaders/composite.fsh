#version 330 compatibility
#include "lib/common.glsl"

in vec2 texCoord;

/* DRAWBUFFERS:0 */
void main() {
    float depth  = texture(depthtex0, texCoord).r;
    vec4  albedo = texture(colortex0, texCoord);

    // Sky pixels — pass through unmodified
    if (depth >= 1.0) {
        gl_FragData[0] = albedo;
        return;
    }

    vec4  normalData  = texture(colortex1, texCoord);
    vec3  viewNormal  = decodeNormal(normalData.rgb);
    float smoothness  = normalData.a;

    vec4  lmData  = texture(colortex2, texCoord);
    vec2  lmCoord = lmData.rg;
    float matID   = lmData.b;

    // Reconstruct positions
    vec3 viewPos  = screenToView(vec3(texCoord, depth));
    vec3 worldPos = viewToWorld(viewPos);  // player-relative

    // Light direction (view-space from Iris)
    vec3 lightDirView  = normalize(shadowLightPosition);
    float NdotL        = clamp(dot(viewNormal, lightDirView), 0.0, 1.0);
    float sunHeight    = getSunHeight();

    // ---- Shadow sampling (PCF 3x3) ----
    vec3  shadowCoord = worldToShadow(worldPos);
    float shadowFactor = 0.0;

    // Only sample if within shadow map bounds
    if (all(greaterThan(shadowCoord, vec3(0.01))) && all(lessThan(shadowCoord, vec3(0.99)))) {
        // Adaptive bias: larger on grazing angles, scaled for 4096 map + distortion
        float bias = 0.0008 + 0.004 * (1.0 - NdotL);
        float shadowZ = shadowCoord.z - bias;

        // 3x3 PCF
        float acc = 0.0;
        vec2 texel = 1.0 / vec2(SHADOW_MAP_SIZE);
        for (int x = -1; x <= 1; x++) {
            for (int y = -1; y <= 1; y++) {
                float s = texture(shadowtex0, shadowCoord.xy + vec2(x,y) * texel).r;
                acc += step(shadowZ, s);  // 1 = lit, 0 = shadowed
            }
        }
        shadowFactor = acc / 9.0;
    } else {
        shadowFactor = 1.0; // Outside shadow map = fully lit
    }

    // ---- Sun/Moon direct light color ----
    vec3 directColor;
    if (sunHeight > 0.1) {
        directColor = vec3(1.00, 0.92, 0.78) * 0.9;
    } else if (sunHeight > -0.1) {
        // Sunrise / Sunset
        float t = (sunHeight + 0.1) / 0.2;
        directColor = mix(vec3(0.9, 0.35, 0.10) * 0.7, vec3(1.0, 0.92, 0.78) * 0.9, t);
    } else {
        directColor = vec3(0.20, 0.30, 0.50) * 0.15; // Moonlight
    }

    // Clamp NdotL so shaded sides still have some ambient from direct
    float diffuse = mix(0.1, 1.0, NdotL) * shadowFactor;
    vec3 directLight = directColor * diffuse;

    // ---- Ambient (lightmap-driven) ----
    // skyLight uses lmCoord.y (0=dim..1=bright)
    float skyLM   = pow(lmCoord.y, 1.5);
    float torchLM = lmCoord.x;

    vec3 skyAmbient   = getSkyColor(sunHeight) * skyLM * 0.4;
    vec3 torchAmbient = getTorchColor(torchLM);
    // Small constant so dark areas never go pure black
    vec3 ambient = skyAmbient + torchAmbient + vec3(0.02);

    // ---- Water special case ----
    if (abs(matID - 0.5) < 0.05) {
        vec3 viewDir   = normalize(-viewPos);
        vec3 wPos      = worldPos;
        vec2 waveUV1   = wPos.xz * 0.15 + vec2(frameTimeCounter * 0.08, frameTimeCounter * 0.06);
        vec2 waveUV2   = wPos.xz * 0.25 - vec2(frameTimeCounter * 0.05, frameTimeCounter * 0.07);
        float w1 = noise2D(waveUV1);
        float w2 = noise2D(waveUV2);
        vec3 waterNorm = normalize(vec3((w1-0.5)*0.25, 1.0, (w2-0.5)*0.25));

        // Fresnel
        float VdotN  = max(0.0, dot(viewDir, waterNorm));
        float fresnel = 0.02 + 0.98 * pow(1.0 - VdotN, 4.0);

        vec3 skyRef  = getSkyColor(sunHeight) * (skyLM * 0.8 + 0.2);
        vec3 waterBase = albedo.rgb * (directLight + ambient);
        vec3 final    = mix(waterBase, skyRef, clamp(fresnel, 0.0, 0.85));

        // Sun specular on water
        vec3 reflDir  = reflect(-lightDirView, waterNorm);
        float spec    = pow(max(0.0, dot(reflDir, normalize(-viewPos))), 64.0) * shadowFactor * 0.4;
        final += directColor * spec;

        gl_FragData[0] = vec4(final, albedo.a);
        return;
    }

    // ---- Standard surface ----
    vec3 finalColor = albedo.rgb * (directLight + ambient);

    gl_FragData[0] = vec4(finalColor, albedo.a);
}
