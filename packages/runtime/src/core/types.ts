/**
 * Core type definitions for babylon-tmp-text
 */

import type { IColor4Like } from "@babylonjs/core/Maths/math.like";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";

/**
 * Unique identifier for a paragraph handle
 */
export type ParagraphId = number;

/**
 * Reference to a parent node for transform inheritance
 */
export type ParentNode = AbstractMesh | TransformNode | null;

/**
 * Text alignment options
 */
export type TextAlign = "left" | "center" | "right";

/**
 * Billboard mode for text rendering
 */
export enum BillboardMode {
    /** No billboarding */
    None = 0,
    /** Face camera */
    Billboard = 1,
    /** Face camera with screen-space projection */
    BillboardScreenProjected = 2,
}

/**
 * Material style identifier for batching
 */
export interface MaterialStyle {
    /** Stroke inset width */
    strokeInsetWidth: number;
    /** Stroke outset width */
    strokeOutsetWidth: number;
    /** Thickness control */
    thicknessControl: number;
}

/**
 * Batch key for grouping renderable items
 */
export interface BatchKey {
    /** Font pack identifier */
    fontPackId: string;
    /** Atlas page index */
    atlasPage: number;
    /** Material style hash */
    materialStyleHash: string;
}

/**
 * Position in 3D space
 */
export interface Position3 {
    x: number;
    y: number;
    z: number;
}

/**
 * Euler rotation in 3D space
 */
export interface Rotation3 {
    x: number;
    y: number;
    z: number;
}

/**
 * Scale in 3D space
 */
export interface Scale3 {
    x: number;
    y: number;
    z: number;
}

/**
 * Color with alpha
 */
export interface Color4 extends IColor4Like {
    r: number;
    g: number;
    b: number;
    a: number;
}

/**
 * Create a default white color
 */
export function createDefaultColor(): Color4 {
    return { r: 1, g: 1, b: 1, a: 1 };
}

/**
 * Create a default black color
 */
export function createBlackColor(): Color4 {
    return { r: 0, g: 0, b: 0, a: 1 };
}

/**
 * Hash a material style for batch key comparison
 */
export function hashMaterialStyle(style: MaterialStyle): string {
    return `${style.strokeInsetWidth.toFixed(3)}_${style.strokeOutsetWidth.toFixed(3)}_${style.thicknessControl.toFixed(3)}`;
}

/**
 * Compare two material styles for equality
 */
export function materialStylesEqual(a: MaterialStyle, b: MaterialStyle): boolean {
    return (
        a.strokeInsetWidth === b.strokeInsetWidth &&
        a.strokeOutsetWidth === b.strokeOutsetWidth &&
        a.thicknessControl === b.thicknessControl
    );
}
