#version 330 compatibility
#include "lib/common.glsl"

out vec2 texCoord;
out vec4 starColor;
out vec3 viewDir;

void main() {
    texCoord  = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    starColor = gl_Color;

    vec4 viewPos = gl_ModelViewMatrix * gl_Vertex;
    viewDir = normalize(viewPos.xyz);

    gl_Position = gl_ProjectionMatrix * viewPos;
}
