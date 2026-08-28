#version 330 compatibility
#include "lib/common.glsl"

in vec2 texCoord;
in vec2 lmCoord;
in vec4 vertColor;
in vec3 viewNormal;
in float matID;

/* DRAWBUFFERS:012 */
void main() {
    vec4 albedo = texture(gtexture, texCoord) * vertColor;
    if (albedo.a < 0.1) discard;

    // colortex0: albedo RGBA
    gl_FragData[0] = albedo;
    // colortex1: encoded view-space normal (RGB) + smoothness (A)
    gl_FragData[1] = vec4(encodeNormal(viewNormal), 0.05);
    // colortex2: lightmap UV (RG) + materialID (B)
    gl_FragData[2] = vec4(lmCoord, matID, 1.0);
}
