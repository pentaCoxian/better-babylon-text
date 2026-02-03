/**
 * Vendored from @babylonjs/addons/msdfText
 * Apache License 2.0 - Babylon.js
 */

import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { IColor4Like, IMatrixLike } from "@babylonjs/core/Maths/math.like";
import { Matrix, Vector3, Quaternion } from "@babylonjs/core/Maths/math.vector";
import type { IDisposable } from "@babylonjs/core/scene";
import { Effect } from "@babylonjs/core/Materials/effect";
import { VertexBuffer, Buffer } from "@babylonjs/core/Buffers/buffer";
import type { DataBuffer } from "@babylonjs/core/Buffers/dataBuffer";
import type { FontAsset } from "./fontAsset";
import type { ParagraphOptions } from "./paragraphOptions";
import { mergeParagraphOptions } from "./paragraphOptions";
import { SdfTextParagraph } from "./sdf/paragraph";
import type { PositionedGlyph } from "./sdf/line";

// Shader source code (inlined)
const vertexShaderSource = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
attribute vec4 world0;
attribute vec4 world1;
attribute vec4 world2;
attribute vec4 world3;
attribute vec4 uvRect;
attribute vec4 color;
uniform mat4 view;
uniform mat4 projection;
varying vec2 vUV;
varying vec4 vColor;
void main() {
    mat4 world = mat4(world0, world1, world2, world3);
    vec4 worldPos = world * vec4(position, 1.0);
    gl_Position = projection * view * worldPos;
    vUV = uvRect.xy + uv * uvRect.zw;
    vColor = color;
}
`;

const fragmentShaderSource = `
precision highp float;
uniform sampler2D atlas;
uniform float pxRange;
uniform vec4 strokeColor;
uniform float strokeInsetWidth;
uniform float strokeOutsetWidth;
uniform float thicknessControl;
varying vec2 vUV;
varying vec4 vColor;
float median(float r, float g, float b) {
    return max(min(r, g), min(max(r, g), b));
}
void main() {
    vec4 msdf = texture2D(atlas, vUV);
    float sd = median(msdf.r, msdf.g, msdf.b);
    float screenPxDistance = pxRange * (sd - 0.5 + thicknessControl);
    float fillOpacity = clamp(screenPxDistance + 0.5, 0.0, 1.0);
    float strokeOpacity = 0.0;
    if (strokeOutsetWidth > 0.0 || strokeInsetWidth > 0.0) {
        float strokeDistance = screenPxDistance;
        if (strokeOutsetWidth > 0.0) {
            strokeDistance = screenPxDistance + strokeOutsetWidth * pxRange;
        }
        float strokeInner = 1.0;
        if (strokeInsetWidth > 0.0) {
            float innerDistance = screenPxDistance - strokeInsetWidth * pxRange;
            strokeInner = 1.0 - clamp(innerDistance + 0.5, 0.0, 1.0);
        }
        strokeOpacity = clamp(strokeDistance + 0.5, 0.0, 1.0) * strokeInner;
    }
    vec4 fill = vColor * fillOpacity;
    vec4 stroke = strokeColor * strokeOpacity;
    gl_FragColor = vec4(mix(stroke.rgb, fill.rgb, fill.a), max(stroke.a, fill.a));
    if (gl_FragColor.a < 0.01) { discard; }
}
`;

/**
 * Node-like interface for transform support
 */
export interface INodeLike {
    getWorldMatrix(): IMatrixLike;
}

/**
 * Text renderer using MSDF (Multi-channel Signed Distance Field) technique
 */
export class TextRenderer implements IDisposable {
    /** Text color */
    public color: IColor4Like = { r: 1, g: 1, b: 1, a: 1 };
    /** Stroke color */
    public strokeColor: IColor4Like = { r: 0, g: 0, b: 0, a: 1 };
    /** Stroke inset width */
    public strokeInsetWidth: number = 0;
    /** Stroke outset width */
    public strokeOutsetWidth: number = 0;
    /** Thickness control (-0.5 to 0.5) */
    public thicknessControl: number = 0;
    /** Billboard mode */
    public isBillboard: boolean = false;
    /** Screen-projected billboard */
    public isBillboardScreenProjected: boolean = false;
    /** Ignore depth buffer */
    public ignoreDepthBuffer: boolean = false;
    /** Transform matrix */
    public transformMatrix: IMatrixLike = Matrix.Identity();

    private _engine: AbstractEngine;
    private _font: FontAsset;
    private _effect: Effect | null = null;
    private _isReady: boolean = false;

    // Geometry buffers
    private _vertexBuffer: Buffer | null = null;
    private _indexBuffer: DataBuffer | null = null;

    // Instance data arrays
    private _charMatrices: number[] = [];
    private _charUvs: number[] = [];
    private _charColors: number[] = [];
    private _characterCount: number = 0;

    // Instance buffers
    private _world0Buffer: Buffer | null = null;
    private _world1Buffer: Buffer | null = null;
    private _world2Buffer: Buffer | null = null;
    private _world3Buffer: Buffer | null = null;
    private _uvRectBuffer: Buffer | null = null;
    private _colorBuffer: Buffer | null = null;

    private _isDirty: boolean = true;

    private constructor(engine: AbstractEngine, font: FontAsset) {
        this._engine = engine;
        this._font = font;
    }

    /**
     * Create a new TextRenderer
     */
    public static async CreateAsync(
        font: FontAsset,
        engine: AbstractEngine
    ): Promise<TextRenderer> {
        const renderer = new TextRenderer(engine, font);
        await renderer._initialize();
        return renderer;
    }

    /**
     * Number of characters currently in the renderer
     */
    public get characterCount(): number {
        return this._characterCount;
    }

    /**
     * Whether the renderer is ready to render
     */
    public get isReady(): boolean {
        return this._isReady;
    }

    /**
     * Add a paragraph of text
     */
    public addParagraph(
        text: string,
        options?: Partial<ParagraphOptions>,
        worldMatrix?: IMatrixLike
    ): number {
        const startIndex = this._characterCount;
        const mergedOptions = mergeParagraphOptions(options);
        const paragraph = new SdfTextParagraph(text, this._font.font, mergedOptions);

        const matrix = worldMatrix ?? Matrix.Identity();
        const fontScale = mergedOptions.fontSize / this._font.font.size;

        for (const positioned of paragraph.iterateGlyphs()) {
            this._addGlyph(positioned, matrix, fontScale, mergedOptions.color);
        }

        this._isDirty = true;
        return startIndex;
    }

    /**
     * Clear all text
     */
    public clear(): void {
        this._charMatrices = [];
        this._charUvs = [];
        this._charColors = [];
        this._characterCount = 0;
        this._isDirty = true;
    }

    /**
     * Render the text
     */
    public render(viewMatrix: IMatrixLike, projectionMatrix: IMatrixLike): void {
        if (!this._isReady || this._characterCount === 0) {
            return;
        }

        if (this._isDirty) {
            this._updateBuffers();
            this._isDirty = false;
        }

        const effect = this._effect!;
        const engine = this._engine;

        engine.enableEffect(effect);

        effect.setMatrix("view", viewMatrix as Matrix);
        effect.setMatrix("projection", projectionMatrix as Matrix);
        effect.setFloat("pxRange", this._font.pxRange);
        effect.setColor4("strokeColor", this.strokeColor, this.strokeColor.a ?? 1);
        effect.setFloat("strokeInsetWidth", this.strokeInsetWidth);
        effect.setFloat("strokeOutsetWidth", this.strokeOutsetWidth);
        effect.setFloat("thicknessControl", this.thicknessControl);
        effect.setTexture("atlas", this._font.texture);

        engine.bindBuffers(
            this._getVertexBuffers(),
            this._indexBuffer,
            effect
        );

        engine.drawElementsType(0, 0, 6, this._characterCount);
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this._vertexBuffer?.dispose();
        this._world0Buffer?.dispose();
        this._world1Buffer?.dispose();
        this._world2Buffer?.dispose();
        this._world3Buffer?.dispose();
        this._uvRectBuffer?.dispose();
        this._colorBuffer?.dispose();

        if (this._indexBuffer) {
            this._engine._releaseBuffer(this._indexBuffer);
        }

        this._effect?.dispose();
    }

    private async _initialize(): Promise<void> {
        // Register shaders
        Effect.ShadersStore["msdfTextVertexShader"] = vertexShaderSource;
        Effect.ShadersStore["msdfTextFragmentShader"] = fragmentShaderSource;

        this._effect = new Effect(
            "msdfText",
            [
                "position",
                "uv",
                "world0",
                "world1",
                "world2",
                "world3",
                "uvRect",
                "color",
            ],
            [
                "view",
                "projection",
                "pxRange",
                "strokeColor",
                "strokeInsetWidth",
                "strokeOutsetWidth",
                "thicknessControl",
            ],
            ["atlas"],
            this._engine
        );

        await new Promise<void>((resolve) => {
            if (this._effect!.isReady()) {
                resolve();
            } else {
                this._effect!.onCompiled = () => resolve();
            }
        });

        this._createQuadGeometry();
        this._isReady = true;
    }

    private _createQuadGeometry(): void {
        const vertices = new Float32Array([
            0, 0, 0, 0, 0,
            1, 0, 0, 1, 0,
            1, 1, 0, 1, 1,
            0, 1, 0, 0, 1,
        ]);

        const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

        this._vertexBuffer = new Buffer(this._engine, vertices, false, 5);
        this._indexBuffer = this._engine.createIndexBuffer(indices);
    }

    private _addGlyph(
        positioned: PositionedGlyph & { lineIndex: number; lineY: number },
        worldMatrix: IMatrixLike,
        _fontScale: number,
        color: IColor4Like
    ): void {
        const glyph = positioned.glyph;

        const glyphMatrix = Matrix.Compose(
            new Vector3(positioned.width, positioned.height, 1),
            Quaternion.Identity(),
            new Vector3(positioned.x, -(positioned.lineY + positioned.y + positioned.height), 0)
        );

        const finalMatrix = glyphMatrix.multiply(worldMatrix as Matrix);

        const m = finalMatrix.m;
        this._charMatrices.push(
            m[0], m[1], m[2], m[3],
            m[4], m[5], m[6], m[7],
            m[8], m[9], m[10], m[11],
            m[12], m[13], m[14], m[15]
        );

        this._charUvs.push(glyph.u, glyph.v, glyph.width, glyph.height);
        this._charColors.push(color.r, color.g, color.b, color.a ?? 1);

        this._characterCount++;
    }

    private _updateBuffers(): void {
        const engine = this._engine;

        this._world0Buffer?.dispose();
        this._world1Buffer?.dispose();
        this._world2Buffer?.dispose();
        this._world3Buffer?.dispose();
        this._uvRectBuffer?.dispose();
        this._colorBuffer?.dispose();

        if (this._characterCount === 0) {
            return;
        }

        const world0: number[] = [];
        const world1: number[] = [];
        const world2: number[] = [];
        const world3: number[] = [];

        for (let i = 0; i < this._characterCount; i++) {
            const offset = i * 16;
            world0.push(
                this._charMatrices[offset + 0],
                this._charMatrices[offset + 1],
                this._charMatrices[offset + 2],
                this._charMatrices[offset + 3]
            );
            world1.push(
                this._charMatrices[offset + 4],
                this._charMatrices[offset + 5],
                this._charMatrices[offset + 6],
                this._charMatrices[offset + 7]
            );
            world2.push(
                this._charMatrices[offset + 8],
                this._charMatrices[offset + 9],
                this._charMatrices[offset + 10],
                this._charMatrices[offset + 11]
            );
            world3.push(
                this._charMatrices[offset + 12],
                this._charMatrices[offset + 13],
                this._charMatrices[offset + 14],
                this._charMatrices[offset + 15]
            );
        }

        this._world0Buffer = new Buffer(engine, new Float32Array(world0), false, 4, false, true);
        this._world1Buffer = new Buffer(engine, new Float32Array(world1), false, 4, false, true);
        this._world2Buffer = new Buffer(engine, new Float32Array(world2), false, 4, false, true);
        this._world3Buffer = new Buffer(engine, new Float32Array(world3), false, 4, false, true);
        this._uvRectBuffer = new Buffer(engine, new Float32Array(this._charUvs), false, 4, false, true);
        this._colorBuffer = new Buffer(engine, new Float32Array(this._charColors), false, 4, false, true);
    }

    private _getVertexBuffers(): { [key: string]: VertexBuffer } {
        const vertexBuffers: { [key: string]: VertexBuffer } = {};

        vertexBuffers["position"] = new VertexBuffer(this._engine, this._vertexBuffer!, "position", false, false, 5, false, 0, 3);
        vertexBuffers["uv"] = new VertexBuffer(this._engine, this._vertexBuffer!, "uv", false, false, 5, false, 3, 2);

        if (this._world0Buffer) {
            vertexBuffers["world0"] = new VertexBuffer(this._engine, this._world0Buffer, "world0", false, false, 4, true, 0, 4);
            vertexBuffers["world1"] = new VertexBuffer(this._engine, this._world1Buffer!, "world1", false, false, 4, true, 0, 4);
            vertexBuffers["world2"] = new VertexBuffer(this._engine, this._world2Buffer!, "world2", false, false, 4, true, 0, 4);
            vertexBuffers["world3"] = new VertexBuffer(this._engine, this._world3Buffer!, "world3", false, false, 4, true, 0, 4);
            vertexBuffers["uvRect"] = new VertexBuffer(this._engine, this._uvRectBuffer!, "uvRect", false, false, 4, true, 0, 4);
            vertexBuffers["color"] = new VertexBuffer(this._engine, this._colorBuffer!, "color", false, false, 4, true, 0, 4);
        }

        return vertexBuffers;
    }
}
