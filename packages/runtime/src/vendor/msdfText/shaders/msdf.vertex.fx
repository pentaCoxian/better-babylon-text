// MSDF Text Vertex Shader
// Vendored from @babylonjs/addons/msdfText
// Apache License 2.0 - Babylon.js

precision highp float;

// Attributes
attribute vec3 position;
attribute vec2 uv;
attribute vec4 world0;
attribute vec4 world1;
attribute vec4 world2;
attribute vec4 world3;
attribute vec4 uvRect;
attribute vec4 color;

// Uniforms
uniform mat4 view;
uniform mat4 projection;
uniform vec2 atlasSize;

// Varyings
varying vec2 vUV;
varying vec4 vColor;

void main() {
    // Reconstruct world matrix from instance attributes
    mat4 world = mat4(world0, world1, world2, world3);

    // Transform position
    vec4 worldPos = world * vec4(position, 1.0);
    gl_Position = projection * view * worldPos;

    // Calculate UV from atlas rect
    // uvRect = (u, v, width, height) in normalized coordinates
    vUV = uvRect.xy + uv * uvRect.zw;

    // Pass through color
    vColor = color;
}
