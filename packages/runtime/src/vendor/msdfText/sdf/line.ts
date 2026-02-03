/**
 * Vendored from @babylonjs/addons/msdfText
 * Apache License 2.0 - Babylon.js
 */

import type { SdfGlyph } from "./glyph";

/**
 * Positioned glyph within a line
 */
export interface PositionedGlyph {
    /** The glyph data */
    glyph: SdfGlyph;
    /** X position relative to line start */
    x: number;
    /** Y position relative to line baseline */
    y: number;
    /** Scaled width */
    width: number;
    /** Scaled height */
    height: number;
    /** Character index in original text */
    charIndex: number;
}

/**
 * A line of text with positioned glyphs
 */
export interface SdfTextLine {
    /** Glyphs in this line */
    glyphs: PositionedGlyph[];
    /** Line width in pixels */
    width: number;
    /** Line height in pixels */
    height: number;
    /** Baseline Y offset from line top */
    baseline: number;
    /** Starting character index */
    startIndex: number;
    /** Ending character index (exclusive) */
    endIndex: number;
}

/**
 * Create an empty line
 */
export function createLine(startIndex: number): SdfTextLine {
    return {
        glyphs: [],
        width: 0,
        height: 0,
        baseline: 0,
        startIndex,
        endIndex: startIndex,
    };
}

/**
 * Add a glyph to a line
 */
export function addGlyphToLine(
    line: SdfTextLine,
    glyph: SdfGlyph,
    x: number,
    y: number,
    scale: number,
    charIndex: number
): void {
    line.glyphs.push({
        glyph,
        x,
        y,
        width: glyph.pixelWidth * scale,
        height: glyph.pixelHeight * scale,
        charIndex,
    });
}
