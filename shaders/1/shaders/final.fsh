#version 330 compatibility
#include "lib/common.glsl"

in vec2 texCoord;

/* DRAWBUFFERS:0 */
void main() {
    vec3 color = texture(colortex0, texCoord).rgb;
    vec3 bloom = texture(colortex3, texCoord).rgb;

    // 1. Add bloom (subtle)
    color += bloom * 0.12;

    // 2. ACES Filmic Tonemapping
    color = ACESFilm(color);

    // 3. Subtle contrast + saturation tweak
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(vec3(luma), color, 1.1);         // slight saturation
    color = (color - 0.5) * 1.05 + 0.5;         // slight contrast
    color = clamp(color, 0.0, 1.0);

    // 4. Vignette
    vec2 uv = texCoord * 2.0 - 1.0;
    color  *= 1.0 - dot(uv, uv) * 0.15;

    // 5. Gamma (ACES output is linear, we need sRGB)
    color = pow(max(color, vec3(0.0)), vec3(1.0 / 2.2));

    gl_FragData[0] = vec4(color, 1.0);
}
