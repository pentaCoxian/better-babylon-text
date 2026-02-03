/**
 * Retained-mode text label object (TMP-like API)
 */

import type { IColor4Like, IMatrixLike } from "@babylonjs/core/Maths/math.like";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { IDisposable } from "@babylonjs/core/scene";
import type { ParentNode, TextAlign, Position3, Rotation3, Scale3, Color4 } from "../core/types";
import { BillboardMode, createDefaultColor, createBlackColor } from "../core/types";
import type { ParagraphHandle } from "../extended/ParagraphHandle";
import type { ITextRendererEx } from "../extended/TextRendererEx";
import type { TextLabelOptions } from "./TextLabelOptions";
import { DefaultTextLabelOptions } from "./TextLabelOptions";
import { DisposedError } from "../core/errors";

/**
 * TextLabel interface
 */
export interface ITextLabel extends IDisposable {
    // Core Properties
    text: string;
    color: IColor4Like;
    sizePx: number;
    parent: ParentNode;
    billboard: BillboardMode;
    maxWidth: number;
    align: TextAlign;

    // Stroke Properties
    strokeColor: IColor4Like;
    strokeWidth: number;
    strokeInsetWidth: number;

    // Layout Properties
    lineHeight: number;
    letterSpacing: number;

    // Transform
    position: Position3;
    rotation: Rotation3;
    scale: Scale3;
    readonly worldMatrix: IMatrixLike;

    // State
    visible: boolean;
    readonly isDirty: boolean;
    readonly characterCount: number;

    // Methods
    forceUpdate(): void;
    getBounds(): { width: number; height: number };
}

/**
 * Internal interface for system communication
 */
export interface ITextLabelInternal extends ITextLabel {
    /** Get the paragraph handle */
    readonly handle: ParagraphHandle | null;
    /** Set the paragraph handle */
    setHandle(handle: ParagraphHandle): void;
    /** Get the renderer this label belongs to */
    readonly renderer: ITextRendererEx | null;
    /** Set the renderer */
    setRenderer(renderer: ITextRendererEx): void;
    /** Mark label as needing update */
    markDirty(): void;
    /** Clear dirty flag after update */
    clearDirty(): void;
    /** Get paragraph options for the renderer */
    getParagraphOptions(): {
        fontSize: number;
        maxWidth: number;
        lineHeight: number;
        letterSpacing: number;
        textAlign: TextAlign;
        color: IColor4Like;
        wordWrap: boolean;
    };
    /** Update character count (called by system after layout) */
    setCharacterCount(count: number): void;
    /** Callback when system updates the label */
    onSystemUpdate?: () => void;
}

/**
 * Retained-mode text label implementation
 */
export class TextLabel implements ITextLabelInternal {
    // Internal state
    private _handle: ParagraphHandle | null = null;
    private _renderer: ITextRendererEx | null = null;
    private _isDirty: boolean = true;
    private _isDisposed: boolean = false;

    // Cached values
    private _text: string;
    private _color: Color4;
    private _sizePx: number;
    private _parent: ParentNode;
    private _billboard: BillboardMode;
    private _maxWidth: number;
    private _align: TextAlign;
    private _strokeColor: Color4;
    private _strokeWidth: number;
    private _strokeInsetWidth: number;
    private _lineHeight: number;
    private _letterSpacing: number;
    private _position: Position3;
    private _rotation: Rotation3;
    private _scale: Scale3;
    private _visible: boolean;

    // Computed
    private _localMatrix: Matrix = Matrix.Identity();
    private _worldMatrix: Matrix = Matrix.Identity();
    private _worldMatrixDirty: boolean = true;
    private _characterCount: number = 0;

    // System callback
    public onSystemUpdate?: () => void;

    constructor(options: TextLabelOptions = {}) {
        // Initialize from options with defaults
        this._text = options.text ?? DefaultTextLabelOptions.text;
        this._color = (options.color as Color4) ?? createDefaultColor();
        this._sizePx = options.sizePx ?? DefaultTextLabelOptions.sizePx;
        this._parent = options.parent ?? DefaultTextLabelOptions.parent;
        this._billboard = options.billboard ?? DefaultTextLabelOptions.billboard;
        this._maxWidth = options.maxWidth ?? DefaultTextLabelOptions.maxWidth;
        this._align = options.align ?? DefaultTextLabelOptions.align;
        this._strokeColor = (options.strokeColor as Color4) ?? createBlackColor();
        this._strokeWidth = options.strokeWidth ?? DefaultTextLabelOptions.strokeWidth;
        this._strokeInsetWidth = options.strokeInsetWidth ?? DefaultTextLabelOptions.strokeInsetWidth;
        this._lineHeight = options.lineHeight ?? DefaultTextLabelOptions.lineHeight;
        this._letterSpacing = options.letterSpacing ?? DefaultTextLabelOptions.letterSpacing;
        this._position = options.position ?? { ...DefaultTextLabelOptions.position };
        this._rotation = options.rotation ?? { ...DefaultTextLabelOptions.rotation };
        this._scale = options.scale ?? { ...DefaultTextLabelOptions.scale };
        this._visible = options.visible ?? DefaultTextLabelOptions.visible;
    }

    // ============ Core Properties ============

    public get text(): string {
        return this._text;
    }

    public set text(value: string) {
        if (this._text === value) return;
        this._checkDisposed();
        this._text = value;
        this._markDirtyAndNotify();
    }

    public get color(): IColor4Like {
        return this._color;
    }

    public set color(value: IColor4Like) {
        this._checkDisposed();
        this._color = value as Color4;
        this._markDirtyAndNotify();
    }

    public get sizePx(): number {
        return this._sizePx;
    }

    public set sizePx(value: number) {
        if (this._sizePx === value) return;
        this._checkDisposed();
        this._sizePx = value;
        this._markDirtyAndNotify();
    }

    public get parent(): ParentNode {
        return this._parent;
    }

    public set parent(value: ParentNode) {
        if (this._parent === value) return;
        this._checkDisposed();
        this._parent = value;
        this._worldMatrixDirty = true;
        this._markDirtyAndNotify();
    }

    public get billboard(): BillboardMode {
        return this._billboard;
    }

    public set billboard(value: BillboardMode) {
        if (this._billboard === value) return;
        this._checkDisposed();
        this._billboard = value;
        this._markDirtyAndNotify();
    }

    public get maxWidth(): number {
        return this._maxWidth;
    }

    public set maxWidth(value: number) {
        if (this._maxWidth === value) return;
        this._checkDisposed();
        this._maxWidth = value;
        this._markDirtyAndNotify();
    }

    public get align(): TextAlign {
        return this._align;
    }

    public set align(value: TextAlign) {
        if (this._align === value) return;
        this._checkDisposed();
        this._align = value;
        this._markDirtyAndNotify();
    }

    // ============ Stroke Properties ============

    public get strokeColor(): IColor4Like {
        return this._strokeColor;
    }

    public set strokeColor(value: IColor4Like) {
        this._checkDisposed();
        this._strokeColor = value as Color4;
        this._markDirtyAndNotify();
    }

    public get strokeWidth(): number {
        return this._strokeWidth;
    }

    public set strokeWidth(value: number) {
        if (this._strokeWidth === value) return;
        this._checkDisposed();
        this._strokeWidth = value;
        this._markDirtyAndNotify();
    }

    public get strokeInsetWidth(): number {
        return this._strokeInsetWidth;
    }

    public set strokeInsetWidth(value: number) {
        if (this._strokeInsetWidth === value) return;
        this._checkDisposed();
        this._strokeInsetWidth = value;
        this._markDirtyAndNotify();
    }

    // ============ Layout Properties ============

    public get lineHeight(): number {
        return this._lineHeight;
    }

    public set lineHeight(value: number) {
        if (this._lineHeight === value) return;
        this._checkDisposed();
        this._lineHeight = value;
        this._markDirtyAndNotify();
    }

    public get letterSpacing(): number {
        return this._letterSpacing;
    }

    public set letterSpacing(value: number) {
        if (this._letterSpacing === value) return;
        this._checkDisposed();
        this._letterSpacing = value;
        this._markDirtyAndNotify();
    }

    // ============ Transform ============

    public get position(): Position3 {
        return { ...this._position };
    }

    public set position(value: Position3) {
        this._checkDisposed();
        this._position = { ...value };
        this._worldMatrixDirty = true;
        this._markDirtyAndNotify();
    }

    public get rotation(): Rotation3 {
        return { ...this._rotation };
    }

    public set rotation(value: Rotation3) {
        this._checkDisposed();
        this._rotation = { ...value };
        this._worldMatrixDirty = true;
        this._markDirtyAndNotify();
    }

    public get scale(): Scale3 {
        return { ...this._scale };
    }

    public set scale(value: Scale3) {
        this._checkDisposed();
        this._scale = { ...value };
        this._worldMatrixDirty = true;
        this._markDirtyAndNotify();
    }

    public get worldMatrix(): IMatrixLike {
        this._updateWorldMatrix();
        return this._worldMatrix;
    }

    // ============ State ============

    public get visible(): boolean {
        return this._visible;
    }

    public set visible(value: boolean) {
        if (this._visible === value) return;
        this._checkDisposed();
        this._visible = value;
        this._markDirtyAndNotify();
    }

    public get isDirty(): boolean {
        return this._isDirty;
    }

    public get characterCount(): number {
        return this._characterCount;
    }

    // ============ Internal Properties ============

    public get handle(): ParagraphHandle | null {
        return this._handle;
    }

    public setHandle(handle: ParagraphHandle): void {
        this._handle = handle;
    }

    public get renderer(): ITextRendererEx | null {
        return this._renderer;
    }

    public setRenderer(renderer: ITextRendererEx): void {
        this._renderer = renderer;
    }

    public markDirty(): void {
        this._isDirty = true;
    }

    public clearDirty(): void {
        this._isDirty = false;
    }

    // ============ Methods ============

    public forceUpdate(): void {
        this._checkDisposed();
        if (this.onSystemUpdate) {
            this.onSystemUpdate();
        }
    }

    public getBounds(): { width: number; height: number } {
        // This would require access to the paragraph layout
        // For now, return an estimate based on text length
        const avgCharWidth = this._sizePx * 0.6;
        const estimatedWidth = this._text.length * avgCharWidth;
        const lines = Math.ceil(
            this._maxWidth > 0 ? estimatedWidth / this._maxWidth : 1
        );
        const height = lines * this._sizePx * this._lineHeight;
        const width = this._maxWidth > 0 ? Math.min(estimatedWidth, this._maxWidth) : estimatedWidth;

        return { width, height };
    }

    public dispose(): void {
        if (this._isDisposed) return;

        // Remove from renderer if attached
        if (this._renderer && this._handle) {
            this._renderer.removeParagraph(this._handle);
        }

        this._handle = null;
        this._renderer = null;
        this._parent = null;
        this._isDisposed = true;
    }

    // ============ Internal Methods ============

    /**
     * Get paragraph options for the renderer
     */
    public getParagraphOptions() {
        return {
            fontSize: this._sizePx,
            maxWidth: this._maxWidth,
            lineHeight: this._lineHeight,
            letterSpacing: this._letterSpacing,
            textAlign: this._align,
            color: this._color,
            wordWrap: this._maxWidth > 0,
        };
    }

    /**
     * Update character count (called by system after layout)
     */
    public setCharacterCount(count: number): void {
        this._characterCount = count;
    }

    private _checkDisposed(): void {
        if (this._isDisposed) {
            throw new DisposedError("TextLabel");
        }
    }

    private _markDirtyAndNotify(): void {
        this._isDirty = true;
        if (this.onSystemUpdate) {
            this.onSystemUpdate();
        }
    }

    private _updateWorldMatrix(): void {
        if (!this._worldMatrixDirty) return;

        // Build local matrix from position, rotation, scale
        const rotationQuat = Quaternion.FromEulerAngles(
            this._rotation.x,
            this._rotation.y,
            this._rotation.z
        );

        this._localMatrix = Matrix.Compose(
            new Vector3(this._scale.x, this._scale.y, this._scale.z),
            rotationQuat,
            new Vector3(this._position.x, this._position.y, this._position.z)
        );

        // Multiply by parent world matrix if present
        if (this._parent) {
            const parentMatrix = this._parent.getWorldMatrix();
            this._worldMatrix = this._localMatrix.multiply(parentMatrix as Matrix);
        } else {
            this._worldMatrix = this._localMatrix.clone();
        }

        this._worldMatrixDirty = false;
    }
}
