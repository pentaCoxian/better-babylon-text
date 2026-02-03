/**
 * Vendored from @babylonjs/addons/msdfText
 * Apache License 2.0 - Babylon.js
 */

import type { IColor4Like } from "@babylonjs/core/Maths/math.like";

/**
 * Options for configuring a text paragraph
 */
export interface ParagraphOptions {
    /** Font size in pixels */
    fontSize: number;
    /** Maximum width before line wrapping (0 = no wrap) */
    maxWidth: number;
    /** Line height multiplier */
    lineHeight: number;
    /** Letter spacing in pixels */
    letterSpacing: number;
    /** Text alignment */
    textAlign: "left" | "center" | "right";
    /** Text color */
    color: IColor4Like;
    /** Whether to enable word wrapping */
    wordWrap: boolean;
}

/**
 * Default paragraph options
 */
export const DefaultParagraphOptions: ParagraphOptions = {
    fontSize: 32,
    maxWidth: 0,
    lineHeight: 1.2,
    letterSpacing: 0,
    textAlign: "left",
    color: { r: 1, g: 1, b: 1, a: 1 },
    wordWrap: true,
};

/**
 * Merge partial options with defaults
 */
export function mergeParagraphOptions(
    partial: Partial<ParagraphOptions> | undefined
): ParagraphOptions {
    return {
        ...DefaultParagraphOptions,
        ...partial,
    };
}
