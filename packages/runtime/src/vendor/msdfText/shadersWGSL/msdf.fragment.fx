// MSDF Text Fragment Shader (WGSL)
// Vendored from @babylonjs/addons/msdfText
// Apache License 2.0 - Babylon.js

struct FragmentInput {
    @location(0) vUV: vec2<f32>,
    @location(1) vColor: vec4<f32>,
};

struct FragmentUniforms {
    pxRange: f32,
    strokeInsetWidth: f32,
    strokeOutsetWidth: f32,
    thicknessControl: f32,
    strokeColor: vec4<f32>,
};

@group(0) @binding(1) var<uniform> fragUniforms: FragmentUniforms;
@group(0) @binding(2) var atlas: texture_2d<f32>;
@group(0) @binding(3) var atlasSampler: sampler;

fn median(r: f32, g: f32, b: f32) -> f32 {
    return max(min(r, g), min(max(r, g), b));
}

fn screenPxRange(uv: vec2<f32>) -> f32 {
    let texSize = vec2<f32>(textureDimensions(atlas));
    let unitRange = vec2<f32>(fragUniforms.pxRange) / texSize;
    let screenTexSize = 1.0 / fwidth(uv);
    return max(0.5 * dot(unitRange, screenTexSize), 1.0);
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    let msdf = textureSample(atlas, atlasSampler, input.vUV);
    let sd = median(msdf.r, msdf.g, msdf.b);

    let pxRange = screenPxRange(input.vUV);
    let screenPxDistance = pxRange * (sd - 0.5 + fragUniforms.thicknessControl);

    // Fill
    let fillOpacity = clamp(screenPxDistance + 0.5, 0.0, 1.0);

    // Stroke
    var strokeOpacity: f32 = 0.0;
    if (fragUniforms.strokeOutsetWidth > 0.0 || fragUniforms.strokeInsetWidth > 0.0) {
        var strokeDistance = screenPxDistance;
        if (fragUniforms.strokeOutsetWidth > 0.0) {
            strokeDistance = screenPxDistance + fragUniforms.strokeOutsetWidth * pxRange;
        }
        var strokeInner: f32 = 1.0;
        if (fragUniforms.strokeInsetWidth > 0.0) {
            let innerDistance = screenPxDistance - fragUniforms.strokeInsetWidth * pxRange;
            strokeInner = 1.0 - clamp(innerDistance + 0.5, 0.0, 1.0);
        }
        strokeOpacity = clamp(strokeDistance + 0.5, 0.0, 1.0) * strokeInner;
    }

    // Composite fill and stroke
    let fill = input.vColor * fillOpacity;
    let stroke = fragUniforms.strokeColor * strokeOpacity;

    // Stroke under fill
    let result = vec4<f32>(
        mix(stroke.rgb, fill.rgb, fill.a),
        max(stroke.a, fill.a)
    );

    if (result.a < 0.01) {
        discard;
    }

    return result;
}
