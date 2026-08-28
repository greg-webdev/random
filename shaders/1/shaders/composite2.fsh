#version 330 compatibility
#include "lib/common.glsl"

in vec2 texCoord;

/* DRAWBUFFERS:03 */
void main() {
    vec4 color = texture(colortex0, texCoord);

    // Bloom: extract overbright pixels only
    float lum = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 bloom = vec3(0.0);
    if (lum > 0.85) {
        float excess = (lum - 0.85) / 0.15;
        bloom = color.rgb * excess * excess * 0.3;
    }

    // 5-tap Gaussian blur on bloom source
    vec2 texel = 1.5 / vec2(viewWidth, viewHeight);
    vec3 blurred = bloom * 0.4;
    blurred += texture(colortex0, texCoord + vec2( texel.x, 0.0)).rgb * 0.15;
    blurred += texture(colortex0, texCoord - vec2( texel.x, 0.0)).rgb * 0.15;
    blurred += texture(colortex0, texCoord + vec2(0.0,  texel.y)).rgb * 0.15;
    blurred += texture(colortex0, texCoord - vec2(0.0,  texel.y)).rgb * 0.15;

    // Only emit bloom from bright neighbors
    float blurLum = dot(blurred, vec3(0.2126, 0.7152, 0.0722));
    vec3 bloomOut = (blurLum > 0.7) ? blurred : vec3(0.0);

    gl_FragData[0] = color;       // colortex0 pass-through
    gl_FragData[1] = vec4(bloomOut, 1.0); // colortex3 bloom
}
