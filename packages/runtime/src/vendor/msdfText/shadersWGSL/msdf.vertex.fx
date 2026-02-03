// MSDF Text Vertex Shader (WGSL)
// Vendored from @babylonjs/addons/msdfText
// Apache License 2.0 - Babylon.js

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) uv: vec2<f32>,
    @location(2) world0: vec4<f32>,
    @location(3) world1: vec4<f32>,
    @location(4) world2: vec4<f32>,
    @location(5) world3: vec4<f32>,
    @location(6) uvRect: vec4<f32>,
    @location(7) color: vec4<f32>,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) vUV: vec2<f32>,
    @location(1) vColor: vec4<f32>,
};

struct Uniforms {
    view: mat4x4<f32>,
    projection: mat4x4<f32>,
    atlasSize: vec2<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    // Reconstruct world matrix from instance attributes
    let world = mat4x4<f32>(
        input.world0,
        input.world1,
        input.world2,
        input.world3
    );

    // Transform position
    let worldPos = world * vec4<f32>(input.position, 1.0);
    output.position = uniforms.projection * uniforms.view * worldPos;

    // Calculate UV from atlas rect
    output.vUV = input.uvRect.xy + input.uv * input.uvRect.zw;

    // Pass through color
    output.vColor = input.color;

    return output;
}
