/**
 * Extended TextRenderer with retained-mode paragraph management
 */

import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { IColor4Like, IMatrixLike } from "@babylonjs/core/Maths/math.like";
import { Matrix, Vector3, Quaternion } from "@babylonjs/core/Maths/math.vector";
import type { IDisposable } from "@babylonjs/core/scene";
import type { FontAsset } from "../vendor/msdfText/fontAsset";
import { mergeParagraphOptions } from "../vendor/msdfText/paragraphOptions";
import { SdfTextParagraph } from "../vendor/msdfText/sdf/paragraph";
import type { PositionedGlyph } from "../vendor/msdfText/sdf/line";
import type {
    ParagraphHandle,
    ParagraphRecord,
    CreateParagraphOptions,
    UpdateParagraphOptions,
} from "./ParagraphHandle";
import { createParagraphHandle } from "./ParagraphHandle";
import { FreeListAllocator, type IFreeListAllocator } from "../allocator/FreeListAllocator";
import { DirtyRangeTracker, type IDirtyRangeTracker } from "../allocator/DirtyRangeTracker";
import type { AllocatorStats } from "../allocator/types";
import type { Color4, ParagraphId } from "../core/types";
import { createDefaultColor } from "../core/types";
import {
    DEFAULT_INITIAL_CAPACITY,
    DEFAULT_COMPACTION_THRESHOLD,
    FLOATS_PER_MATRIX,
    FLOATS_PER_UV,
    FLOATS_PER_COLOR,
    CAPACITY_GROWTH_FACTOR,
} from "../core/constants";
import { InvalidHandleError, DisposedError } from "../core/errors";
import { Effect } from "@babylonjs/core/Materials/effect";
import { Buffer } from "@babylonjs/core/Buffers/buffer";
import type { DataBuffer } from "@babylonjs/core/Buffers/dataBuffer";

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
#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
#endif
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
    vec4 texel = texture2D(atlas, vUV);
    float sd = median(texel.r, texel.g, texel.b);

    // Calculate screen-space distance using derivatives for proper scaling
    vec2 unitRange = vec2(pxRange) / vec2(textureSize(atlas, 0));
    vec2 screenTexSize = vec2(1.0) / fwidth(vUV);
    float screenPxRange = max(0.5 * dot(unitRange, screenTexSize), 1.0);

    float screenPxDistance = screenPxRange * (sd - 0.5);
    float opacity = clamp(screenPxDistance + 0.5, 0.0, 1.0);

    // Discard fully transparent pixels
    if (opacity < 0.01) discard;

    // Apply color with computed opacity
    gl_FragColor = vec4(vColor.rgb, vColor.a * opacity);
}
`;

/**
 * Extended TextRenderer interface with retained-mode API
 */
export interface ITextRendererEx extends IDisposable {
    // Properties
    color: IColor4Like;
    strokeColor: IColor4Like;
    strokeInsetWidth: number;
    strokeOutsetWidth: number;
    thicknessControl: number;
    isBillboard: boolean;
    isBillboardScreenProjected: boolean;
    ignoreDepthBuffer: boolean;
    transformMatrix: IMatrixLike;
    readonly characterCount: number;
    readonly paragraphCount: number;
    readonly isReady: boolean;

    // Retained-mode API
    createParagraph(text: string, options?: CreateParagraphOptions): ParagraphHandle;
    updateParagraph(handle: ParagraphHandle, updates: UpdateParagraphOptions): void;
    removeParagraph(handle: ParagraphHandle): void;
    clear(): void;
    compact(): void;
    getStats(): AllocatorStats;
    render(viewMatrix: IMatrixLike, projectionMatrix: IMatrixLike): void;

    // Advanced API
    getParagraphRecord(handle: ParagraphHandle): ParagraphRecord | undefined;
    flushBuffers(): void;
}

/**
 * Extended TextRenderer with retained-mode paragraph management
 */
export class TextRendererEx implements ITextRendererEx {
    // Public properties
    public color: IColor4Like = { r: 1, g: 1, b: 1, a: 1 };
    public strokeColor: IColor4Like = { r: 0, g: 0, b: 0, a: 1 };
    public strokeInsetWidth: number = 0;
    public strokeOutsetWidth: number = 0;
    public thicknessControl: number = 0;
    public isBillboard: boolean = false;
    public isBillboardScreenProjected: boolean = false;
    public ignoreDepthBuffer: boolean = false;
    public transformMatrix: IMatrixLike = Matrix.Identity();

    // Private state
    private _engine: AbstractEngine;
    private _font: FontAsset;
    private _effect: Effect | null = null;
    private _isReady: boolean = false;
    private _isDisposed: boolean = false;

    // Retained-mode state
    private _paragraphs: Map<ParagraphId, ParagraphRecord> = new Map();
    private _allocator: IFreeListAllocator;
    private _dirtyTracker: IDirtyRangeTracker;
    private _nextId: ParagraphId = 1;
    private _compactionThreshold: number;

    // Character data arrays (parallel arrays for GPU)
    private _charMatrices: number[] = [];
    private _charUvs: number[] = [];
    private _charColors: number[] = [];
    private _characterCount: number = 0;

    // Geometry buffers
    private _vertexBuffer: Buffer | null = null;
    private _indexBuffer: DataBuffer | null = null;
    private _vao: WebGLVertexArrayObject | null = null;

    // Instance buffers
    private _world0Buffer: Buffer | null = null;
    private _world1Buffer: Buffer | null = null;
    private _world2Buffer: Buffer | null = null;
    private _world3Buffer: Buffer | null = null;
    private _uvRectBuffer: Buffer | null = null;
    private _colorBuffer: Buffer | null = null;

    private _buffersNeedRebuild: boolean = false;

    private constructor(
        engine: AbstractEngine,
        font: FontAsset,
        initialCapacity: number = DEFAULT_INITIAL_CAPACITY,
        compactionThreshold: number = DEFAULT_COMPACTION_THRESHOLD
    ) {
        this._engine = engine;
        this._font = font;
        this._allocator = new FreeListAllocator(initialCapacity);
        this._dirtyTracker = new DirtyRangeTracker();
        this._compactionThreshold = compactionThreshold;

        // Pre-allocate arrays
        this._charMatrices = new Array(initialCapacity * FLOATS_PER_MATRIX).fill(0);
        this._charUvs = new Array(initialCapacity * FLOATS_PER_UV).fill(0);
        this._charColors = new Array(initialCapacity * FLOATS_PER_COLOR).fill(0);
    }

    /**
     * Create a new TextRendererEx
     */
    public static async CreateAsync(
        font: FontAsset,
        engine: AbstractEngine,
        initialCapacity: number = DEFAULT_INITIAL_CAPACITY,
        compactionThreshold: number = DEFAULT_COMPACTION_THRESHOLD
    ): Promise<TextRendererEx> {
        const renderer = new TextRendererEx(engine, font, initialCapacity, compactionThreshold);
        await renderer._initialize();
        return renderer;
    }

    // ============ Properties ============

    public get characterCount(): number {
        return this._characterCount;
    }

    public get paragraphCount(): number {
        return this._paragraphs.size;
    }

    public get isReady(): boolean {
        return this._isReady;
    }

    // ============ Retained-mode API ============

    public createParagraph(text: string, options?: CreateParagraphOptions): ParagraphHandle {
        this._checkDisposed();

        const id = this._nextId++;
        const mergedOptions = mergeParagraphOptions(options);
        const worldMatrix = options?.worldMatrix ?? Matrix.Identity();
        const color = mergedOptions.color as Color4;

        // Layout the text to get glyph count
        const paragraph = new SdfTextParagraph(text, this._font.font, mergedOptions);
        const glyphCount = paragraph.glyphCount;

        // Allocate buffer space
        const capacityHint = options?.capacityHint ?? Math.ceil(glyphCount * CAPACITY_GROWTH_FACTOR);
        const result = this._allocator.allocate(glyphCount, capacityHint);

        // Ensure arrays are large enough
        this._ensureCapacity(result.block.start + result.block.capacity);

        // Create paragraph record
        const record: ParagraphRecord = {
            id,
            block: result.block,
            length: glyphCount,
            text,
            options: mergedOptions,
            worldMatrix,
            parent: options?.parent ?? null,
            transformDirty: false,
            color: color ?? createDefaultColor(),
            lastUpdateTime: Date.now(),
        };

        this._paragraphs.set(id, record);

        // Write glyph data
        this._writeGlyphData(record, paragraph);

        // Mark dirty
        this._dirtyTracker.markDirty(record.block.start, record.length);
        this._buffersNeedRebuild = true;

        // Update character count
        this._updateCharacterCount();

        return createParagraphHandle(id);
    }

    public updateParagraph(handle: ParagraphHandle, updates: UpdateParagraphOptions): void {
        this._checkDisposed();

        const record = this._paragraphs.get(handle.id);
        if (!record) {
            throw new InvalidHandleError(handle.id);
        }

        const textChanged = updates.text !== undefined && updates.text !== record.text;
        const optionsChanged = updates.options !== undefined;
        const matrixChanged = updates.worldMatrix !== undefined;
        const colorChanged = updates.color !== undefined;

        // Update record fields
        if (updates.options) {
            record.options = { ...record.options, ...updates.options };
        }
        if (updates.worldMatrix) {
            record.worldMatrix = updates.worldMatrix;
        }
        if (updates.color) {
            record.color = updates.color;
        }
        record.lastUpdateTime = Date.now();

        if (textChanged || optionsChanged) {
            // Need to re-layout text
            const newText = updates.text ?? record.text;
            record.text = newText;

            const paragraph = new SdfTextParagraph(newText, this._font.font, record.options);
            const newGlyphCount = paragraph.glyphCount;

            if (newGlyphCount <= record.block.capacity) {
                // Fast path: fits in current block
                // Clear old data
                this._clearBlockData(record.block.start, record.length);

                record.length = newGlyphCount;
                this._writeGlyphData(record, paragraph);
                this._dirtyTracker.markDirty(record.block.start, Math.max(record.length, newGlyphCount));
            } else {
                // Slow path: need to reallocate
                const result = this._allocator.reallocate(
                    record.block,
                    Math.ceil(newGlyphCount * CAPACITY_GROWTH_FACTOR)
                );

                if (result.previousBlock) {
                    // Clear old location
                    this._clearBlockData(result.previousBlock.start, record.length);
                    this._dirtyTracker.markDirty(result.previousBlock.start, record.length);
                }

                record.block = result.block;
                record.length = newGlyphCount;

                // Ensure arrays are large enough
                this._ensureCapacity(record.block.start + record.block.capacity);

                this._writeGlyphData(record, paragraph);
                this._dirtyTracker.markDirty(record.block.start, record.length);
            }

            this._buffersNeedRebuild = true;
            this._updateCharacterCount();
        } else if (matrixChanged || colorChanged) {
            // Only transform/color changed, update in place
            const paragraph = new SdfTextParagraph(record.text, this._font.font, record.options);
            this._writeGlyphData(record, paragraph);
            this._dirtyTracker.markDirty(record.block.start, record.length);
            this._buffersNeedRebuild = true;
        }

        // Check if compaction is needed
        this._maybeCompact();
    }

    public removeParagraph(handle: ParagraphHandle): void {
        this._checkDisposed();

        const record = this._paragraphs.get(handle.id);
        if (!record) {
            throw new InvalidHandleError(handle.id);
        }

        // Clear the glyph data
        this._clearBlockData(record.block.start, record.length);
        this._dirtyTracker.markDirty(record.block.start, record.length);

        // Free the block
        this._allocator.free(record.block);

        // Remove from map
        this._paragraphs.delete(handle.id);

        this._buffersNeedRebuild = true;
        this._updateCharacterCount();

        // Check if compaction is needed
        this._maybeCompact();
    }

    public clear(): void {
        this._checkDisposed();

        // Clear all data
        this._charMatrices.fill(0);
        this._charUvs.fill(0);
        this._charColors.fill(0);

        // Reset allocator
        this._allocator.reset();

        // Clear paragraphs
        this._paragraphs.clear();

        // Reset state
        this._characterCount = 0;
        this._dirtyTracker.clear();
        this._buffersNeedRebuild = true;
    }

    public compact(): void {
        this._checkDisposed();

        const remapping = this._allocator.compact(() => {
            return Array.from(this._paragraphs.values()).map((r) => r.block);
        });

        if (remapping.size === 0) {
            return;
        }

        // Create new arrays
        const newMatrices = new Array(this._charMatrices.length).fill(0);
        const newUvs = new Array(this._charUvs.length).fill(0);
        const newColors = new Array(this._charColors.length).fill(0);

        // Copy data to new positions
        for (const record of this._paragraphs.values()) {
            const oldStart = record.block.start;
            const newStart = remapping.get(oldStart);

            if (newStart !== undefined && newStart !== oldStart) {
                // Copy data
                for (let i = 0; i < record.length; i++) {
                    const oldMatrixOffset = (oldStart + i) * FLOATS_PER_MATRIX;
                    const newMatrixOffset = (newStart + i) * FLOATS_PER_MATRIX;
                    for (let j = 0; j < FLOATS_PER_MATRIX; j++) {
                        newMatrices[newMatrixOffset + j] = this._charMatrices[oldMatrixOffset + j];
                    }

                    const oldUvOffset = (oldStart + i) * FLOATS_PER_UV;
                    const newUvOffset = (newStart + i) * FLOATS_PER_UV;
                    for (let j = 0; j < FLOATS_PER_UV; j++) {
                        newUvs[newUvOffset + j] = this._charUvs[oldUvOffset + j];
                    }

                    const oldColorOffset = (oldStart + i) * FLOATS_PER_COLOR;
                    const newColorOffset = (newStart + i) * FLOATS_PER_COLOR;
                    for (let j = 0; j < FLOATS_PER_COLOR; j++) {
                        newColors[newColorOffset + j] = this._charColors[oldColorOffset + j];
                    }
                }

                // Update record
                record.block = { start: newStart, capacity: record.block.capacity };
            } else {
                // Copy in place (no move needed)
                for (let i = 0; i < record.length; i++) {
                    const offset = (oldStart + i) * FLOATS_PER_MATRIX;
                    for (let j = 0; j < FLOATS_PER_MATRIX; j++) {
                        newMatrices[offset + j] = this._charMatrices[offset + j];
                    }

                    const uvOffset = (oldStart + i) * FLOATS_PER_UV;
                    for (let j = 0; j < FLOATS_PER_UV; j++) {
                        newUvs[uvOffset + j] = this._charUvs[uvOffset + j];
                    }

                    const colorOffset = (oldStart + i) * FLOATS_PER_COLOR;
                    for (let j = 0; j < FLOATS_PER_COLOR; j++) {
                        newColors[colorOffset + j] = this._charColors[colorOffset + j];
                    }
                }
            }
        }

        this._charMatrices = newMatrices;
        this._charUvs = newUvs;
        this._charColors = newColors;

        // Mark entire used region as dirty
        this._dirtyTracker.clear();
        this._dirtyTracker.markDirty(0, this._characterCount);
        this._buffersNeedRebuild = true;
    }

    public getStats(): AllocatorStats {
        return this._allocator.getStats();
    }

    public render(viewMatrix: IMatrixLike, projectionMatrix: IMatrixLike): void {
        this._checkDisposed();

        if (!this._isReady || this._characterCount === 0) {
            return;
        }

        if (this._buffersNeedRebuild) {
            this._updateBuffers();
            this._buffersNeedRebuild = false;
            this._dirtyTracker.clear();
        }

        const effect = this._effect!;
        const engine = this._engine;
        const gl = (engine as any)._gl as WebGL2RenderingContext;

        // Bind effect
        engine.enableEffect(effect);

        // Enable alpha blending and disable depth write for text
        engine.setAlphaMode(2); // ALPHA_COMBINE
        engine.setDepthWrite(false);

        // Disable backface culling and depth test for debugging
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.DEPTH_TEST);

        // Set uniforms
        effect.setMatrix("view", viewMatrix as Matrix);
        effect.setMatrix("projection", projectionMatrix as Matrix);
        effect.setFloat("pxRange", this._font.pxRange);
        effect.setColor4("strokeColor", this.strokeColor, this.strokeColor.a ?? 1);
        effect.setFloat("strokeInsetWidth", this.strokeInsetWidth);
        effect.setFloat("strokeOutsetWidth", this.strokeOutsetWidth);
        effect.setFloat("thicknessControl", this.thicknessControl);

        // Bind texture
        effect.setTexture("atlas", this._font.texture);

        // Manual WebGL setup for instanced rendering
        const pipelineContext = effect.getPipelineContext() as { program?: WebGLProgram } | null;
        const program = pipelineContext?.program;
        if (!program) {
            console.error("TextRendererEx: No program!");
            return;
        }

        // Explicitly use the program
        gl.useProgram(program);

        // Set uniforms via direct WebGL calls (after useProgram)
        const viewLoc = gl.getUniformLocation(program, "view");
        const projLoc = gl.getUniformLocation(program, "projection");
        const pxRangeLoc = gl.getUniformLocation(program, "pxRange");

        if (viewLoc) gl.uniformMatrix4fv(viewLoc, false, (viewMatrix as Matrix).toArray());
        if (projLoc) gl.uniformMatrix4fv(projLoc, false, (projectionMatrix as Matrix).toArray());
        if (pxRangeLoc) gl.uniform1f(pxRangeLoc, this._font.pxRange);

        // Create VAO if needed
        if (!this._vao) {
            this._vao = gl.createVertexArray();
        }

        // Bind our VAO
        gl.bindVertexArray(this._vao);

        // Bind quad vertex buffer (position + uv interleaved)
        const quadBuffer = this._vertexBuffer!.getBuffer();
        if (!quadBuffer) {
            console.error("TextRendererEx: No quad buffer!");
            gl.bindVertexArray(null);
            return;
        }
        const quadGlBuffer = quadBuffer.underlyingResource as WebGLBuffer;
        gl.bindBuffer(gl.ARRAY_BUFFER, quadGlBuffer);

        // Setup position attribute (vec3 at offset 0)
        const posLoc = gl.getAttribLocation(program, "position");
        if (posLoc >= 0) {
            gl.enableVertexAttribArray(posLoc);
            gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 20, 0);
            gl.vertexAttribDivisor(posLoc, 0); // Per-vertex
        }

        // Setup uv attribute (vec2 at offset 12)
        const uvLoc = gl.getAttribLocation(program, "uv");
        if (uvLoc >= 0) {
            gl.enableVertexAttribArray(uvLoc);
            gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 20, 12);
            gl.vertexAttribDivisor(uvLoc, 0); // Per-vertex
        }

        // Setup instanced attributes
        const setupInstancedAttrib = (name: string, buffer: Buffer | null, components: number) => {
            if (!buffer) return;
            const loc = gl.getAttribLocation(program, name);
            if (loc < 0) return;
            const glBuffer = buffer.getBuffer();
            if (!glBuffer) return;
            gl.bindBuffer(gl.ARRAY_BUFFER, glBuffer.underlyingResource);
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, components, gl.FLOAT, false, 0, 0);
            gl.vertexAttribDivisor(loc, 1); // Per-instance
        };

        setupInstancedAttrib("world0", this._world0Buffer, 4);
        setupInstancedAttrib("world1", this._world1Buffer, 4);
        setupInstancedAttrib("world2", this._world2Buffer, 4);
        setupInstancedAttrib("world3", this._world3Buffer, 4);
        setupInstancedAttrib("uvRect", this._uvRectBuffer, 4);
        setupInstancedAttrib("color", this._colorBuffer, 4);

        // Bind index buffer
        const indexGlBuffer = this._indexBuffer!.underlyingResource as WebGLBuffer;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexGlBuffer);

        // Draw instanced
        gl.drawElementsInstanced(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0, this._characterCount);

        // Unbind our VAO before restoring Babylon state
        gl.bindVertexArray(null);

        // Restore state
        engine.setAlphaMode(0); // ALPHA_DISABLE
        engine.setDepthWrite(true);
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
    }

    // ============ Advanced API ============

    public getParagraphRecord(handle: ParagraphHandle): ParagraphRecord | undefined {
        return this._paragraphs.get(handle.id);
    }

    public flushBuffers(): void {
        this._checkDisposed();
        if (this._buffersNeedRebuild) {
            this._updateBuffers();
            this._buffersNeedRebuild = false;
            this._dirtyTracker.clear();
        }
    }

    public dispose(): void {
        if (this._isDisposed) return;

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

        if (this._vao) {
            const gl = (this._engine as any)._gl as WebGL2RenderingContext;
            gl.deleteVertexArray(this._vao);
            this._vao = null;
        }

        this._effect?.dispose();

        this._paragraphs.clear();
        this._charMatrices = [];
        this._charUvs = [];
        this._charColors = [];

        this._isDisposed = true;
    }

    // ============ Private Methods ============

    private _checkDisposed(): void {
        if (this._isDisposed) {
            throw new DisposedError("TextRendererEx");
        }
    }

    private async _initialize(): Promise<void> {
        // Register shaders
        Effect.ShadersStore["msdfTextExVertexShader"] = vertexShaderSource;
        Effect.ShadersStore["msdfTextExFragmentShader"] = fragmentShaderSource;

        // Create shader effect
        this._effect = new Effect(
            "msdfTextEx",
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

        // Wait for effect to be ready
        await new Promise<void>((resolve) => {
            if (this._effect!.isReady()) {
                resolve();
            } else {
                this._effect!.onCompiled = () => resolve();
            }
        });

        // Create quad geometry
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

    private _ensureCapacity(requiredCapacity: number): void {
        const currentCapacity = this._charMatrices.length / FLOATS_PER_MATRIX;
        if (requiredCapacity <= currentCapacity) {
            return;
        }

        const newCapacity = Math.max(
            requiredCapacity,
            Math.ceil(currentCapacity * CAPACITY_GROWTH_FACTOR)
        );

        // Grow arrays
        const newMatrices = new Array(newCapacity * FLOATS_PER_MATRIX).fill(0);
        const newUvs = new Array(newCapacity * FLOATS_PER_UV).fill(0);
        const newColors = new Array(newCapacity * FLOATS_PER_COLOR).fill(0);

        // Copy existing data
        for (let i = 0; i < this._charMatrices.length; i++) {
            newMatrices[i] = this._charMatrices[i];
        }
        for (let i = 0; i < this._charUvs.length; i++) {
            newUvs[i] = this._charUvs[i];
        }
        for (let i = 0; i < this._charColors.length; i++) {
            newColors[i] = this._charColors[i];
        }

        this._charMatrices = newMatrices;
        this._charUvs = newUvs;
        this._charColors = newColors;
    }

    private _writeGlyphData(record: ParagraphRecord, paragraph: SdfTextParagraph): void {
        const scale = record.options.fontSize / this._font.font.size;
        let glyphIndex = 0;

        for (const positioned of paragraph.iterateGlyphs()) {
            const bufferIndex = record.block.start + glyphIndex;
            this._writeGlyph(bufferIndex, positioned, record.worldMatrix, scale, record.color);
            glyphIndex++;
        }
    }

    private _writeGlyph(
        index: number,
        positioned: PositionedGlyph & { lineIndex: number; lineY: number },
        worldMatrix: IMatrixLike,
        _scale: number,
        color: Color4
    ): void {
        const glyph = positioned.glyph;

        // Convert from pixel coordinates to world coordinates
        const pixelsPerUnit = 50; // 50 pixels = 1 world unit
        const worldScale = 1 / pixelsPerUnit;

        // Following the original textRenderer.ts implementation:
        // Y position is negated and includes lineY + y (yoffset) + height
        // This positions the quad bottom correctly in world space
        const glyphMatrix = Matrix.Compose(
            new Vector3(positioned.width * worldScale, positioned.height * worldScale, 1),
            Quaternion.Identity(),
            new Vector3(
                positioned.x * worldScale,
                -(positioned.lineY + positioned.y + positioned.height) * worldScale,
                0
            )
        );

        // IMPORTANT: Matrix multiplication order from original: glyphMatrix * worldMatrix
        // This applies the world transform AFTER the local glyph transform
        const finalMatrix = glyphMatrix.multiply(worldMatrix as Matrix);

        // Write matrix (column-major)
        const matrixOffset = index * FLOATS_PER_MATRIX;
        const m = finalMatrix.m;
        for (let i = 0; i < 16; i++) {
            this._charMatrices[matrixOffset + i] = m[i];
        }

        // Write UV rect
        // Note: glyph.v is from top of texture, but we flipped the texture on load
        // So we need to flip the V coordinate: v' = 1 - v - height
        const uvOffset = index * FLOATS_PER_UV;
        this._charUvs[uvOffset + 0] = glyph.u;
        this._charUvs[uvOffset + 1] = 1.0 - glyph.v - glyph.height; // Flip V
        this._charUvs[uvOffset + 2] = glyph.width;
        this._charUvs[uvOffset + 3] = glyph.height;

        // Write color
        const colorOffset = index * FLOATS_PER_COLOR;
        this._charColors[colorOffset + 0] = color.r;
        this._charColors[colorOffset + 1] = color.g;
        this._charColors[colorOffset + 2] = color.b;
        this._charColors[colorOffset + 3] = color.a;
    }

    private _clearBlockData(start: number, length: number): void {
        for (let i = 0; i < length; i++) {
            const index = start + i;

            const matrixOffset = index * FLOATS_PER_MATRIX;
            for (let j = 0; j < FLOATS_PER_MATRIX; j++) {
                this._charMatrices[matrixOffset + j] = 0;
            }

            const uvOffset = index * FLOATS_PER_UV;
            for (let j = 0; j < FLOATS_PER_UV; j++) {
                this._charUvs[uvOffset + j] = 0;
            }

            const colorOffset = index * FLOATS_PER_COLOR;
            for (let j = 0; j < FLOATS_PER_COLOR; j++) {
                this._charColors[colorOffset + j] = 0;
            }
        }
    }

    private _updateCharacterCount(): void {
        let count = 0;
        for (const record of this._paragraphs.values()) {
            count += record.length;
        }
        this._characterCount = count;
    }

    private _maybeCompact(): void {
        const stats = this._allocator.getStats();
        if (stats.fragmentationRatio > this._compactionThreshold) {
            this.compact();
        }
    }

    private _updateBuffers(): void {
        const engine = this._engine;

        // Dispose old buffers
        this._world0Buffer?.dispose();
        this._world1Buffer?.dispose();
        this._world2Buffer?.dispose();
        this._world3Buffer?.dispose();
        this._uvRectBuffer?.dispose();
        this._colorBuffer?.dispose();

        if (this._characterCount === 0) {
            return;
        }

        // Build contiguous arrays for GPU
        // We need to pack only the active glyphs (from all paragraphs)
        const world0: number[] = [];
        const world1: number[] = [];
        const world2: number[] = [];
        const world3: number[] = [];
        const uvs: number[] = [];
        const colors: number[] = [];

        for (const record of this._paragraphs.values()) {
            for (let i = 0; i < record.length; i++) {
                const index = record.block.start + i;
                const matrixOffset = index * FLOATS_PER_MATRIX;

                world0.push(
                    this._charMatrices[matrixOffset + 0],
                    this._charMatrices[matrixOffset + 1],
                    this._charMatrices[matrixOffset + 2],
                    this._charMatrices[matrixOffset + 3]
                );
                world1.push(
                    this._charMatrices[matrixOffset + 4],
                    this._charMatrices[matrixOffset + 5],
                    this._charMatrices[matrixOffset + 6],
                    this._charMatrices[matrixOffset + 7]
                );
                world2.push(
                    this._charMatrices[matrixOffset + 8],
                    this._charMatrices[matrixOffset + 9],
                    this._charMatrices[matrixOffset + 10],
                    this._charMatrices[matrixOffset + 11]
                );
                world3.push(
                    this._charMatrices[matrixOffset + 12],
                    this._charMatrices[matrixOffset + 13],
                    this._charMatrices[matrixOffset + 14],
                    this._charMatrices[matrixOffset + 15]
                );

                const uvOffset = index * FLOATS_PER_UV;
                uvs.push(
                    this._charUvs[uvOffset + 0],
                    this._charUvs[uvOffset + 1],
                    this._charUvs[uvOffset + 2],
                    this._charUvs[uvOffset + 3]
                );

                const colorOffset = index * FLOATS_PER_COLOR;
                colors.push(
                    this._charColors[colorOffset + 0],
                    this._charColors[colorOffset + 1],
                    this._charColors[colorOffset + 2],
                    this._charColors[colorOffset + 3]
                );
            }
        }

        // Create instance buffers
        this._world0Buffer = new Buffer(engine, new Float32Array(world0), false, 4, false, true);
        this._world1Buffer = new Buffer(engine, new Float32Array(world1), false, 4, false, true);
        this._world2Buffer = new Buffer(engine, new Float32Array(world2), false, 4, false, true);
        this._world3Buffer = new Buffer(engine, new Float32Array(world3), false, 4, false, true);
        this._uvRectBuffer = new Buffer(engine, new Float32Array(uvs), false, 4, false, true);
        this._colorBuffer = new Buffer(engine, new Float32Array(colors), false, 4, false, true);
    }

}
