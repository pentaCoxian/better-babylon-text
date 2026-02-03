/**
 * Vendored from @babylonjs/addons/msdfText
 * Apache License 2.0 - Babylon.js
 */

import type { BmFontChar } from "./bmFont";

/**
 * Represents a single glyph with computed metrics
 */
export interface SdfGlyph {
    /** Character ID (Unicode codepoint) */
    id: number;
    /** Character as string */
    char: string;
    /** X position in atlas (normalized 0-1) */
    u: number;
    /** Y position in atlas (normalized 0-1) */
    v: number;
    /** Width in atlas (normalized 0-1) */
    width: number;
    /** Height in atlas (normalized 0-1) */
    height: number;
    /** X offset when rendering (in font units) */
    xoffset: number;
    /** Y offset when rendering (in font units) */
    yoffset: number;
    /** Advance width (cursor movement in font units) */
    xadvance: number;
    /** Atlas page index */
    page: number;
    /** Original pixel width in atlas */
    pixelWidth: number;
    /** Original pixel height in atlas */
    pixelHeight: number;
}

/**
 * Create a glyph from BMFont character data
 */
export function createGlyph(
    char: BmFontChar,
    atlasWidth: number,
    atlasHeight: number
): SdfGlyph {
    return {
        id: char.id,
        char: String.fromCodePoint(char.id),
        u: char.x / atlasWidth,
        v: char.y / atlasHeight,
        width: char.width / atlasWidth,
        height: char.height / atlasHeight,
        xoffset: char.xoffset,
        yoffset: char.yoffset,
        xadvance: char.xadvance,
        page: char.page,
        pixelWidth: char.width,
        pixelHeight: char.height,
    };
}

/**
 * Get kerning amount between two glyphs
 */
export function getKerning(
    kerningMap: Map<number, Map<number, number>>,
    first: number,
    second: number
): number {
    const firstMap = kerningMap.get(first);
    if (!firstMap) return 0;
    return firstMap.get(second) ?? 0;
}
