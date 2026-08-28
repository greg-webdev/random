#version 330 compatibility
#include "lib/common.glsl"

out vec2 texCoord;
out vec4 vertColor;

void main() {
    texCoord  = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    vertColor = gl_Color;

    // In Iris shadow pass: gl_ModelViewMatrix = shadowModelView * modelMatrix
    // gl_ProjectionMatrix = shadowProjection
    // Using these automatically handles entity transforms correctly
    vec4 pos  = gl_ProjectionMatrix * (gl_ModelViewMatrix * gl_Vertex);
    vec3 ndc  = pos.xyz / pos.w;

    // Apply distortion matching worldToShadow() in common.glsl
    ndc.xy = distortShadowNDC(ndc.xy);

    pos.xyz = ndc * pos.w;
    gl_Position = pos;
}
