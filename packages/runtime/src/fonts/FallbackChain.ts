/**
 * Fallback chain for resolving glyphs across multiple font packs
 */

import type { IFontPack } from "./FontPack";

/**
 * A run of text using a single font pack
 */
export interface TextRun {
    /** Text content */
    text: string;
    /** Starting index in original string */
    start: number;
    /** Ending index in original string (exclusive) */
    end: number;
    /** Font pack to use */
    fontPack: IFontPack;
}

/**
 * Fallback chain interface
 */
export interface IFallbackChain {
    /** Ordered list of font pack IDs */
    readonly packIds: ReadonlyArray<string>;
    /** Resolve a codepoint to a font pack */
    resolve(codepoint: number): IFontPack | null;
    /** Segment text into runs by font pack */
    segmentText(text: string): TextRun[];
    /** Add a font pack to the chain */
    addPack(pack: IFontPack): void;
    /** Remove a font pack from the chain */
    removePack(packId: string): void;
    /** Set the fallback order */
    setOrder(packIds: string[]): void;
}

/**
 * Fallback chain implementation
 */
export class FallbackChain implements IFallbackChain {
    private _packs: Map<string, IFontPack> = new Map();
    private _order: string[] = [];

    constructor(packs: IFontPack[] = [], order?: string[]) {
        for (const pack of packs) {
            this._packs.set(pack.manifest.id, pack);
        }
        this._order = order ?? packs.map((p) => p.manifest.id);
    }

    public get packIds(): ReadonlyArray<string> {
        return this._order;
    }

    public resolve(codepoint: number): IFontPack | null {
        // Try each pack in order
        for (const packId of this._order) {
            const pack = this._packs.get(packId);
            if (pack && pack.hasGlyph(codepoint)) {
                return pack;
            }
        }
        return null;
    }

    public segmentText(text: string): TextRun[] {
        if (text.length === 0) {
            return [];
        }

        const runs: TextRun[] = [];
        let currentRun: TextRun | null = null;

        for (let i = 0; i < text.length; i++) {
            const codepoint = text.codePointAt(i)!;

            // Handle surrogate pairs
            const charLength = codepoint > 0xffff ? 2 : 1;

            // Find font pack for this codepoint
            const pack = this.resolve(codepoint);

            if (pack === null) {
                // No font can render this character
                // Still need to include it somewhere - use first pack as fallback
                const fallbackPack = this._getFirstPack();
                if (fallbackPack) {
                    if (currentRun && currentRun.fontPack === fallbackPack) {
                        // Extend current run
                        currentRun.text += text.substring(i, i + charLength);
                        currentRun.end = i + charLength;
                    } else {
                        // Start new run
                        if (currentRun) {
                            runs.push(currentRun);
                        }
                        currentRun = {
                            text: text.substring(i, i + charLength),
                            start: i,
                            end: i + charLength,
                            fontPack: fallbackPack,
                        };
                    }
                }
            } else {
                if (currentRun && currentRun.fontPack === pack) {
                    // Extend current run
                    currentRun.text += text.substring(i, i + charLength);
                    currentRun.end = i + charLength;
                } else {
                    // Start new run
                    if (currentRun) {
                        runs.push(currentRun);
                    }
                    currentRun = {
                        text: text.substring(i, i + charLength),
                        start: i,
                        end: i + charLength,
                        fontPack: pack,
                    };
                }
            }

            // Skip low surrogate of surrogate pair
            if (charLength === 2) {
                i++;
            }
        }

        // Push final run
        if (currentRun) {
            runs.push(currentRun);
        }

        return runs;
    }

    public addPack(pack: IFontPack): void {
        const packId = pack.manifest.id;
        this._packs.set(packId, pack);
        if (!this._order.includes(packId)) {
            this._order.push(packId);
        }
    }

    public removePack(packId: string): void {
        this._packs.delete(packId);
        this._order = this._order.filter((id) => id !== packId);
    }

    public setOrder(packIds: string[]): void {
        // Only include packs that exist
        this._order = packIds.filter((id) => this._packs.has(id));
        // Append any packs not in the new order
        for (const packId of this._packs.keys()) {
            if (!this._order.includes(packId)) {
                this._order.push(packId);
            }
        }
    }

    private _getFirstPack(): IFontPack | null {
        if (this._order.length === 0) {
            return null;
        }
        return this._packs.get(this._order[0]) ?? null;
    }
}
