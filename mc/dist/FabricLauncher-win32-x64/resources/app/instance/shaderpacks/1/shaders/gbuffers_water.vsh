#version 330 compatibility
#include "lib/common.glsl"

attribute vec4 mc_Entity;

out vec2 texCoord;
out vec2 lmCoord;
out vec4 vertColor;
out vec3 viewNormal;
out float isWater;

void main() {
    texCoord   = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    lmCoord    = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;
    vertColor  = gl_Color;
    viewNormal = normalize(gl_NormalMatrix * gl_Normal);
    isWater    = (mc_Entity.x == 10002.0) ? 1.0 : 0.0;

    gl_Position = ftransform();
}
