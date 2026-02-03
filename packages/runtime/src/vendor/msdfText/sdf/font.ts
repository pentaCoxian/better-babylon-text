/**
 * Vendored from @babylonjs/addons/msdfText
 * Apache License 2.0 - Babylon.js
 */

import type { BmFont } from "./bmFont";
import type { SdfGlyph } from "./glyph";
import { createGlyph, getKerning } from "./glyph";

/**
 * Parsed SDF font with glyph lookup
 */
export class SdfFont {
    /** Font face name */
    public readonly face: string;
    /** Font size (in font units) */
    public readonly size: number;
    /** Line height (in font units) */
    public readonly lineHeight: number;
    /** Baseline position (in font units) */
    public readonly base: number;
    /** Atlas width in pixels */
    public readonly atlasWidth: number;
    /** Atlas height in pixels */
    public readonly atlasHeight: number;
    /** MSDF distance range */
    public readonly distanceRange: number;
    /** Page file names */
    public readonly pages: string[];

    private readonly _glyphs: Map<number, SdfGlyph> = new Map();
    private readonly _kernings: Map<number, Map<number, number>> = new Map();

    constructor(bmFont: BmFont) {
        this.face = bmFont.info.face;
        this.size = bmFont.info.size;
        this.lineHeight = bmFont.common.lineHeight;
        this.base = bmFont.common.base;
        this.atlasWidth = bmFont.common.scaleW;
        this.atlasHeight = bmFont.common.scaleH;
        this.distanceRange = bmFont.distanceField?.distanceRange ?? 4;
        this.pages = bmFont.pages;

        // Build glyph map
        for (const char of bmFont.chars) {
            const glyph = createGlyph(char, this.atlasWidth, this.atlasHeight);
            this._glyphs.set(char.id, glyph);
        }

        // Build kerning map
        if (bmFont.kernings) {
            for (const kern of bmFont.kernings) {
                let firstMap = this._kernings.get(kern.first);
                if (!firstMap) {
                    firstMap = new Map();
                    this._kernings.set(kern.first, firstMap);
                }
                firstMap.set(kern.second, kern.amount);
            }
        }
    }

    /**
     * Get a glyph by codepoint
     */
    public getGlyph(codepoint: number): SdfGlyph | undefined {
        return this._glyphs.get(codepoint);
    }

    /**
     * Check if a codepoint is available
     */
    public hasGlyph(codepoint: number): boolean {
        return this._glyphs.has(codepoint);
    }

    /**
     * Get kerning between two codepoints
     */
    public getKerning(first: number, second: number): number {
        return getKerning(this._kernings, first, second);
    }

    /**
     * Get all glyph codepoints
     */
    public getCodepoints(): number[] {
        return Array.from(this._glyphs.keys());
    }

    /**
     * Number of glyphs in the font
     */
    public get glyphCount(): number {
        return this._glyphs.size;
    }
}
