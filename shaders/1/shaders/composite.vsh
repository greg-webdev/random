#version 330 compatibility

out vec2 texCoord;

void main() {
    texCoord    = gl_MultiTexCoord0.xy;
    gl_Position = ftransform();
}
