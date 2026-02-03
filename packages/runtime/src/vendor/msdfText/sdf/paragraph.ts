/**
 * Vendored from @babylonjs/addons/msdfText
 * Apache License 2.0 - Babylon.js
 */

import type { SdfFont } from "./font";
import type { SdfTextLine, PositionedGlyph } from "./line";
import { createLine, addGlyphToLine } from "./line";
import type { ParagraphOptions } from "../paragraphOptions";
import { DefaultParagraphOptions } from "../paragraphOptions";

/**
 * A laid-out paragraph of text
 */
export class SdfTextParagraph {
    /** Lines of text */
    public readonly lines: SdfTextLine[] = [];
    /** Total width in pixels */
    public width: number = 0;
    /** Total height in pixels */
    public height: number = 0;
    /** Original text */
    public readonly text: string;
    /** Font used */
    public readonly font: SdfFont;
    /** Layout options */
    public readonly options: ParagraphOptions;

    private _totalGlyphCount: number = 0;

    constructor(
        text: string,
        font: SdfFont,
        options: Partial<ParagraphOptions> = {}
    ) {
        this.text = text;
        this.font = font;
        this.options = { ...DefaultParagraphOptions, ...options };
        this._layout();
    }

    /**
     * Total number of glyphs in the paragraph
     */
    public get glyphCount(): number {
        return this._totalGlyphCount;
    }

    /**
     * Iterate over all positioned glyphs
     */
    public *iterateGlyphs(): Generator<PositionedGlyph & { lineIndex: number; lineY: number }> {
        let lineY = 0;
        for (let lineIndex = 0; lineIndex < this.lines.length; lineIndex++) {
            const line = this.lines[lineIndex];
            for (const glyph of line.glyphs) {
                yield {
                    ...glyph,
                    lineIndex,
                    lineY,
                };
            }
            lineY += line.height;
        }
    }

    private _layout(): void {
        const { fontSize, maxWidth, lineHeight, letterSpacing, textAlign, wordWrap } = this.options;
        const scale = fontSize / this.font.size;
        const scaledLineHeight = this.font.lineHeight * scale * lineHeight;
        const scaledBase = this.font.base * scale;

        let currentLine = createLine(0);
        let cursorX = 0;
        let wordStartIndex = 0;
        let wordStartX = 0;
        let prevCodepoint = 0;

        const finishLine = () => {
            if (currentLine.glyphs.length > 0) {
                currentLine.width = cursorX;
                currentLine.height = scaledLineHeight;
                currentLine.baseline = scaledBase;
                this._applyAlignment(currentLine, textAlign, maxWidth);
                this.lines.push(currentLine);
            }
            currentLine = createLine(currentLine.endIndex);
            cursorX = 0;
            wordStartX = 0;
            prevCodepoint = 0;
        };

        for (let i = 0; i < this.text.length; i++) {
            const char = this.text[i];
            const codepoint = char.codePointAt(0)!;

            // Handle newline
            if (codepoint === 10) { // \n
                currentLine.endIndex = i + 1;
                finishLine();
                continue;
            }

            // Skip carriage return
            if (codepoint === 13) { // \r
                continue;
            }

            // Track word boundaries for wrapping
            if (char === " " || char === "\t") {
                wordStartIndex = i + 1;
                wordStartX = cursorX;
            }

            const glyph = this.font.getGlyph(codepoint);
            if (!glyph) {
                // Try fallback to space or continue
                const spaceGlyph = this.font.getGlyph(32);
                if (spaceGlyph) {
                    cursorX += spaceGlyph.xadvance * scale + letterSpacing;
                }
                continue;
            }

            // Apply kerning
            if (prevCodepoint !== 0) {
                cursorX += this.font.getKerning(prevCodepoint, codepoint) * scale;
            }

            const glyphWidth = glyph.xadvance * scale + letterSpacing;
            const glyphX = cursorX + glyph.xoffset * scale;
            const glyphY = glyph.yoffset * scale;

            // Check for line wrap
            if (maxWidth > 0 && wordWrap && cursorX + glyphWidth > maxWidth && currentLine.glyphs.length > 0) {
                // Try to wrap at word boundary
                if (wordStartIndex > currentLine.startIndex && char !== " ") {
                    // Remove glyphs from current word
                    const glyphsToMove: PositionedGlyph[] = [];
                    while (
                        currentLine.glyphs.length > 0 &&
                        currentLine.glyphs[currentLine.glyphs.length - 1].charIndex >= wordStartIndex
                    ) {
                        glyphsToMove.unshift(currentLine.glyphs.pop()!);
                    }

                    currentLine.endIndex = wordStartIndex;
                    currentLine.width = wordStartX;
                    finishLine();

                    // Re-add word glyphs to new line
                    for (const movedGlyph of glyphsToMove) {
                        const newX = movedGlyph.x - wordStartX;
                        currentLine.glyphs.push({
                            ...movedGlyph,
                            x: newX,
                        });
                        cursorX = newX + (movedGlyph.glyph.xadvance * scale + letterSpacing);
                    }
                } else {
                    // No word boundary, force break
                    currentLine.endIndex = i;
                    finishLine();
                }
                wordStartIndex = currentLine.startIndex;
                wordStartX = 0;
            }

            addGlyphToLine(currentLine, glyph, glyphX, glyphY, scale, i);
            cursorX += glyphWidth;
            currentLine.endIndex = i + 1;
            prevCodepoint = codepoint;
            this._totalGlyphCount++;
        }

        // Finish last line
        finishLine();

        // Calculate total dimensions
        this.width = Math.max(...this.lines.map(l => l.width), 0);
        this.height = this.lines.length * scaledLineHeight;
    }

    private _applyAlignment(
        line: SdfTextLine,
        align: "left" | "center" | "right",
        maxWidth: number
    ): void {
        if (align === "left" || maxWidth <= 0) return;

        const containerWidth = maxWidth > 0 ? maxWidth : line.width;
        let offset = 0;

        if (align === "center") {
            offset = (containerWidth - line.width) / 2;
        } else if (align === "right") {
            offset = containerWidth - line.width;
        }

        if (offset !== 0) {
            for (const glyph of line.glyphs) {
                glyph.x += offset;
            }
        }
    }
}
