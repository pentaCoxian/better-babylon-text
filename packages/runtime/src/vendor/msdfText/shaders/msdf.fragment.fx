// MSDF Text Fragment Shader
// Vendored from @babylonjs/addons/msdfText
// Apache License 2.0 - Babylon.js

precision highp float;

// Uniforms
uniform sampler2D atlas;
uniform float pxRange;
uniform vec4 strokeColor;
uniform float strokeInsetWidth;
uniform float strokeOutsetWidth;
uniform float thicknessControl;

// Varyings
varying vec2 vUV;
varying vec4 vColor;

float median(float r, float g, float b) {
    return max(min(r, g), min(max(r, g), b));
}

float screenPxRange() {
    vec2 unitRange = vec2(pxRange) / vec2(textureSize(atlas, 0));
    vec2 screenTexSize = vec2(1.0) / fwidth(vUV);
    return max(0.5 * dot(unitRange, screenTexSize), 1.0);
}

void main() {
    vec4 msdf = texture2D(atlas, vUV);
    float sd = median(msdf.r, msdf.g, msdf.b);

    float screenPxDistance = screenPxRange() * (sd - 0.5 + thicknessControl);

    // Fill
    float fillOpacity = clamp(screenPxDistance + 0.5, 0.0, 1.0);

    // Stroke
    float strokeOpacity = 0.0;
    if (strokeOutsetWidth > 0.0 || strokeInsetWidth > 0.0) {
        float strokeDistance = screenPxDistance;
        if (strokeOutsetWidth > 0.0) {
            strokeDistance = screenPxDistance + strokeOutsetWidth * screenPxRange();
        }
        float strokeInner = 1.0;
        if (strokeInsetWidth > 0.0) {
            float innerDistance = screenPxDistance - strokeInsetWidth * screenPxRange();
            strokeInner = 1.0 - clamp(innerDistance + 0.5, 0.0, 1.0);
        }
        strokeOpacity = clamp(strokeDistance + 0.5, 0.0, 1.0) * strokeInner;
    }

    // Composite fill and stroke
    vec4 fill = vColor * fillOpacity;
    vec4 stroke = strokeColor * strokeOpacity;

    // Stroke under fill
    gl_FragColor = vec4(
        mix(stroke.rgb, fill.rgb, fill.a),
        max(stroke.a, fill.a)
    );

    if (gl_FragColor.a < 0.01) {
        discard;
    }
}
