// Common Shader Constants & Defines
#define SHADOW_MAP_SIZE 4096.0
#define SHADOW_DISTORT_FACTOR 0.85
#define PI 3.14159265359
#define TAU 6.28318530718

// ---- Iris/OptiFine Uniforms ----
uniform mat4 gbufferModelView;
uniform mat4 gbufferModelViewInverse;
uniform mat4 gbufferProjection;
uniform mat4 gbufferProjectionInverse;

uniform mat4 shadowModelView;
uniform mat4 shadowModelViewInverse;
uniform mat4 shadowProjection;
uniform mat4 shadowProjectionInverse;

uniform vec3 sunPosition;       // view-space
uniform vec3 moonPosition;      // view-space
uniform vec3 shadowLightPosition; // view-space

uniform vec3 cameraPosition;
uniform vec3 upPosition;

uniform int worldTime;
uniform int frameCounter;
uniform float frameTimeCounter;
uniform float rainStrength;
uniform float wetness;

uniform float near;
uniform float far;
uniform float aspectRatio;
uniform float viewWidth;
uniform float viewHeight;

// Samplers
uniform sampler2D gtexture;
uniform sampler2D lightmap;
uniform sampler2D colortex0;   // Albedo + Alpha
uniform sampler2D colortex1;   // World Normal (encoded) + Smoothness
uniform sampler2D colortex2;   // Lightmap UV (RG) + MaterialID (B)
uniform sampler2D colortex3;   // Bloom accumulation
uniform sampler2D depthtex0;
uniform sampler2D depthtex1;
uniform sampler2D shadowtex0;
uniform sampler2D shadowtex1;
uniform sampler2D shadowcolor0;

// ---- Hash / Noise ----
float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}

float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash12(i + vec2(0,0)), hash12(i + vec2(1,0)), u.x),
        mix(hash12(i + vec2(0,1)), hash12(i + vec2(1,1)), u.x),
        u.y
    );
}

// ---- Coordinate transforms ----
vec3 screenToView(vec3 screenPos) {
    vec4 ndc = vec4(screenPos * 2.0 - 1.0, 1.0);
    vec4 view = gbufferProjectionInverse * ndc;
    return view.xyz / view.w;
}

// viewPos is player-relative view-space; returns player-relative world-space
vec3 viewToWorld(vec3 viewPos) {
    return (gbufferModelViewInverse * vec4(viewPos, 1.0)).xyz;
}

// worldPos = player-relative world coords (viewToWorld output)
vec3 worldToShadow(vec3 worldPos) {
    // shadowModelView expects player-relative world (Iris standard)
    vec4 sv = shadowModelView * vec4(worldPos, 1.0);
    vec4 sc = shadowProjection * sv;
    vec3 ndcPos = sc.xyz / sc.w;

    // Distort to concentrate resolution near the player
    float distortFactor = length(ndcPos.xy) * (1.0 - SHADOW_DISTORT_FACTOR) + SHADOW_DISTORT_FACTOR;
    ndcPos.xy /= distortFactor;

    return ndcPos * 0.5 + 0.5;
}

// ---- Shadow distortion (vertex shader version, input: NDC.xy) ----
vec2 distortShadowNDC(vec2 ndcXY) {
    float distortFactor = length(ndcXY) * (1.0 - SHADOW_DISTORT_FACTOR) + SHADOW_DISTORT_FACTOR;
    return ndcXY / distortFactor;
}

// ---- Normal encode/decode ----
vec3 encodeNormal(vec3 n) { return n * 0.5 + 0.5; }
vec3 decodeNormal(vec3 n) { return normalize(n * 2.0 - 1.0); }

// ---- World-space sun height ----
// shadowLightPosition is view-space; convert to world-space to get actual height
float getSunHeight() {
    vec3 worldLight = normalize((gbufferModelViewInverse * vec4(shadowLightPosition, 0.0)).xyz);
    return worldLight.y;
}

// ---- Sky ambient color (sunHeight: -1 night .. 0 horizon .. 1 noon) ----
vec3 getSkyColor(float sunHeight) {
    vec3 dayCol    = vec3(0.55, 0.70, 1.00);
    vec3 sunsetCol = vec3(0.85, 0.45, 0.20);
    vec3 nightCol  = vec3(0.04, 0.06, 0.14);

    if (sunHeight >= 0.0) {
        return mix(sunsetCol, dayCol, clamp(sunHeight * 4.0, 0.0, 1.0));
    } else {
        return mix(sunsetCol, nightCol, clamp(-sunHeight * 5.0, 0.0, 1.0));
    }
}

// ---- Torch light color ----
vec3 getTorchColor(float lm) {
    return vec3(1.0, 0.55, 0.20) * pow(lm, 2.0) * 0.8;
}

// ---- ACES Filmic Tonemap ----
vec3 ACESFilm(vec3 x) {
    return clamp(
        (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14),
        0.0, 1.0
    );
}
