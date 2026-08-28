#version 330 compatibility
#include "lib/common.glsl"

attribute vec4 mc_Entity;

out vec2 texCoord;
out vec2 lmCoord;
out vec4 vertColor;
out vec3 viewNormal;
out float matID;

void main() {
    texCoord  = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    lmCoord   = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;
    vertColor = gl_Color;
    viewNormal = normalize(gl_NormalMatrix * gl_Normal);

    matID = 0.0;
    float entity = mc_Entity.x;

    vec4 viewPos = gl_ModelViewMatrix * gl_Vertex;

    // Waving foliage (block IDs from block.properties group 10001)
    if (entity == 10001.0) {
        matID = 0.1;
        vec3 worldPos = viewToWorld(viewPos.xyz);
        float t = frameTimeCounter;
        float wave = sin(t * 2.8 + worldPos.x * 1.7 + worldPos.z * 1.3) * 0.06
                   + sin(t * 1.9 + worldPos.z * 1.4) * 0.04;
        // Only sway upper UVs to avoid detaching from ground
        float swayFactor = clamp(1.0 - gl_MultiTexCoord0.t * 2.0, 0.0, 1.0);
        viewPos.x += wave * swayFactor;
        viewPos.z += wave * 0.5 * swayFactor;
    }

    gl_Position = gl_ProjectionMatrix * viewPos;
}
