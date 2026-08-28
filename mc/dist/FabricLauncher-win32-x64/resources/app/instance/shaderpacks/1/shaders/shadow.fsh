#version 330 compatibility
#include "lib/common.glsl"

in vec2 texCoord;
in vec4 vertColor;

/* DRAWBUFFERS:0 */
void main() {
    vec4 albedo = texture(gtexture, texCoord) * vertColor;
    if (albedo.a < 0.5) discard;
    gl_FragData[0] = albedo;
}
