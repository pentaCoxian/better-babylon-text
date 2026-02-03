/**
 * Paragraph handle types for retained-mode text management
 */

import type { IMatrixLike } from "@babylonjs/core/Maths/math.like";
import type { ParagraphId, ParentNode, Color4 } from "../core/types";
import type { Block } from "../allocator/types";
import type { ParagraphOptions } from "../vendor/msdfText/paragraphOptions";

/**
 * Opaque handle returned to users for paragraph management
 */
export interface ParagraphHandle {
    /** Unique identifier for this paragraph */
    readonly id: ParagraphId;
}

/**
 * Internal record storing paragraph state
 */
export interface ParagraphRecord {
    /** Unique identifier */
    id: ParagraphId;

    /** Allocated block in GPU buffers */
    block: Block;

    /** Current number of characters (glyphs) used */
    length: number;

    /** The current text content */
    text: string;

    /** Paragraph layout options */
    options: ParagraphOptions;

    /** World matrix for positioning */
    worldMatrix: IMatrixLike;

    /** Optional parent node for transform inheritance */
    parent: ParentNode;

    /** Whether this paragraph's transform needs recalculation */
    transformDirty: boolean;

    /** Per-character color (if different from default) */
    color: Color4;

    /** Timestamp of last update (for LRU tracking) */
    lastUpdateTime: number;
}

/**
 * Options for creating a paragraph
 */
export interface CreateParagraphOptions extends Partial<ParagraphOptions> {
    /** Parent node for transform inheritance */
    parent?: ParentNode;
    /** Initial world matrix */
    worldMatrix?: IMatrixLike;
    /** Capacity hint for pre-allocation */
    capacityHint?: number;
}

/**
 * Options for updating a paragraph
 */
export interface UpdateParagraphOptions {
    /** New text content */
    text?: string;
    /** New paragraph options */
    options?: Partial<ParagraphOptions>;
    /** New world matrix */
    worldMatrix?: IMatrixLike;
    /** New color */
    color?: Color4;
}

/**
 * Create a paragraph handle
 */
export function createParagraphHandle(id: ParagraphId): ParagraphHandle {
    return { id };
}

/**
 * Check if two handles refer to the same paragraph
 */
export function handlesEqual(a: ParagraphHandle, b: ParagraphHandle): boolean {
    return a.id === b.id;
}
