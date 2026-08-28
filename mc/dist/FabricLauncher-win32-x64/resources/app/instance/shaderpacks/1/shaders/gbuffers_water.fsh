#version 330 compatibility
#include "lib/common.glsl"

in vec2 texCoord;
in vec2 lmCoord;
in vec4 vertColor;
in vec3 viewNormal;
in float isWater;

/* DRAWBUFFERS:012 */
void main() {
    vec4 albedo = texture(gtexture, texCoord) * vertColor;

    // materialID: 0.5 for water, 0.3 for other translucents (glass etc.)
    float matID = (isWater > 0.5) ? 0.5 : 0.3;
    float smoothness = (isWater > 0.5) ? 0.95 : 0.7;

    gl_FragData[0] = albedo;
    gl_FragData[1] = vec4(encodeNormal(viewNormal), smoothness);
    gl_FragData[2] = vec4(lmCoord, matID, 1.0);
}
