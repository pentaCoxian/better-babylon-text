/**
 * TextLabel options
 */

import type { IColor4Like } from "@babylonjs/core/Maths/math.like";
import type { ParentNode, TextAlign, BillboardMode } from "../core/types";

/**
 * Options for creating a TextLabel
 */
export interface TextLabelOptions {
    /** Initial text content */
    text?: string;

    /** Parent node for transform inheritance */
    parent?: ParentNode;

    /** Font pack identifier */
    font?: string;

    /** Font size in pixels */
    sizePx?: number;

    /** Text color */
    color?: IColor4Like;

    /** Stroke/outline color */
    strokeColor?: IColor4Like;

    /** Stroke width (outset) */
    strokeWidth?: number;

    /** Stroke inset width */
    strokeInsetWidth?: number;

    /** Billboard mode */
    billboard?: BillboardMode;

    /** Maximum width for text wrapping */
    maxWidth?: number;

    /** Text alignment */
    align?: TextAlign;

    /** Line height multiplier */
    lineHeight?: number;

    /** Letter spacing */
    letterSpacing?: number;

    /** Whether to ignore depth buffer */
    ignoreDepth?: boolean;

    /** Capacity hint for pre-allocation */
    capacityHint?: number;

    /** Initial position */
    position?: { x: number; y: number; z: number };

    /** Initial rotation (euler angles) */
    rotation?: { x: number; y: number; z: number };

    /** Initial scale */
    scale?: { x: number; y: number; z: number };

    /** Visibility */
    visible?: boolean;
}

/**
 * Default label options
 */
export const DefaultTextLabelOptions: Required<
    Omit<TextLabelOptions, "parent" | "font" | "capacityHint">
> & { parent: null; font: null; capacityHint: undefined } = {
    text: "",
    parent: null,
    font: null,
    sizePx: 32,
    color: { r: 1, g: 1, b: 1, a: 1 },
    strokeColor: { r: 0, g: 0, b: 0, a: 1 },
    strokeWidth: 0,
    strokeInsetWidth: 0,
    billboard: 0, // BillboardMode.None
    maxWidth: 0,
    align: "left",
    lineHeight: 1.2,
    letterSpacing: 0,
    ignoreDepth: false,
    capacityHint: undefined,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    visible: true,
};
