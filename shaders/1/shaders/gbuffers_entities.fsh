#version 330 compatibility
#include "lib/common.glsl"

in vec2 texCoord;
in vec2 lmCoord;
in vec4 vertColor;
in vec3 viewNormal;

uniform vec4 entityColor;

/* DRAWBUFFERS:012 */
void main() {
    vec4 albedo = texture(gtexture, texCoord) * vertColor;
    albedo.rgb  = mix(albedo.rgb, entityColor.rgb, entityColor.a);
    if (albedo.a < 0.1) discard;

    gl_FragData[0] = albedo;
    gl_FragData[1] = vec4(encodeNormal(viewNormal), 0.1);
    gl_FragData[2] = vec4(lmCoord, 0.0, 1.0);
}
