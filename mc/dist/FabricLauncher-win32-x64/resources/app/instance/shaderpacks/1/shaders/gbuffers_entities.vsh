#version 330 compatibility
#include "lib/common.glsl"

out vec2 texCoord;
out vec2 lmCoord;
out vec4 vertColor;
out vec3 viewNormal;

void main() {
    texCoord   = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    lmCoord    = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;
    vertColor  = gl_Color;
    viewNormal = normalize(gl_NormalMatrix * gl_Normal);
    gl_Position = ftransform();
}
