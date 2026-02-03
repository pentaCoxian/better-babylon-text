/**
 * Font pack loader and management
 */

import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { FontAsset } from "../vendor/msdfText/fontAsset";
import { FontLoadError, FontManifestError } from "../core/errors";

/**
 * Glyph coverage range
 */
export interface GlyphRange {
    /** Starting codepoint (inclusive) */
    start: number;
    /** Ending codepoint (inclusive) */
    end: number;
}

/**
 * Font pack manifest format
 */
export interface FontPackManifest {
    /** Pack identifier */
    id: string;
    /** Human-readable name */
    name: string;
    /** Version string */
    version: string;
    /** Font family name */
    family: string;
    /** Font style */
    style: "normal" | "bold" | "italic" | "bold-italic";
    /** Atlas page definitions */
    pages: FontPackPage[];
    /** Codepoint coverage */
    coverage: GlyphRange[];
    /** Recommended fallback fonts */
    fallbacks: string[];
    /** Base URL for resolving relative paths */
    baseUrl?: string;
}

/**
 * Single atlas page in a font pack
 */
export interface FontPackPage {
    /** Page index */
    index: number;
    /** URL to atlas texture */
    textureUrl: string;
    /** URL to glyph metrics JSON (BMFont format) */
    metricsUrl: string;
    /** Texture width */
    width: number;
    /** Texture height */
    height: number;
}

/**
 * Loaded font pack interface
 */
export interface IFontPack {
    /** Pack manifest */
    readonly manifest: FontPackManifest;
    /** Babylon FontAsset instances (one per page) */
    readonly assets: ReadonlyArray<FontAsset>;
    /** Check if a codepoint is covered */
    hasGlyph(codepoint: number): boolean;
    /** Get the FontAsset for a specific codepoint */
    getAssetForGlyph(codepoint: number): FontAsset | null;
    /** Get the primary FontAsset (first page) */
    getPrimaryAsset(): FontAsset;
    /** Dispose all resources */
    dispose(): void;
}

/**
 * Loaded font pack implementation
 */
export class FontPack implements IFontPack {
    private _manifest: FontPackManifest;
    private _assets: FontAsset[];
    private _coverageSet: Set<number>;
    private _isDisposed: boolean = false;

    private constructor(
        manifest: FontPackManifest,
        assets: FontAsset[]
    ) {
        this._manifest = manifest;
        this._assets = assets;

        // Build coverage set for fast lookup
        this._coverageSet = new Set<number>();
        for (const range of manifest.coverage) {
            for (let cp = range.start; cp <= range.end; cp++) {
                this._coverageSet.add(cp);
            }
        }
    }

    /**
     * Load a font pack from a manifest URL
     */
    public static async LoadAsync(
        manifestUrl: string,
        engine: AbstractEngine
    ): Promise<FontPack> {
        // Extract base URL
        const lastSlash = manifestUrl.lastIndexOf("/");
        const baseUrl = lastSlash >= 0 ? manifestUrl.substring(0, lastSlash) : "";

        // Fetch manifest
        let manifest: FontPackManifest;
        try {
            const response = await fetch(manifestUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            manifest = await response.json();
        } catch (error) {
            throw new FontLoadError(manifestUrl, error as Error);
        }

        // Validate manifest
        if (!manifest.id || !manifest.pages || manifest.pages.length === 0) {
            throw new FontManifestError(manifestUrl, "Missing required fields");
        }

        // Set base URL
        manifest.baseUrl = baseUrl;

        // Load font assets for each page
        const assets: FontAsset[] = [];
        for (const page of manifest.pages) {
            const metricsUrl = page.metricsUrl.startsWith("http")
                ? page.metricsUrl
                : `${baseUrl}/${page.metricsUrl}`;

            try {
                const asset = await FontAsset.CreateFromUrlAsync(metricsUrl, engine);
                assets.push(asset);
            } catch (error) {
                // Clean up already loaded assets
                for (const loadedAsset of assets) {
                    loadedAsset.dispose();
                }
                throw new FontLoadError(metricsUrl, error as Error);
            }
        }

        return new FontPack(manifest, assets);
    }

    /**
     * Create a font pack from a single BMFont JSON file
     * Convenience method for simple cases
     */
    public static async LoadFromBmFontAsync(
        bmFontUrl: string,
        engine: AbstractEngine,
        packId: string = "default"
    ): Promise<FontPack> {
        // Extract base URL
        const lastSlash = bmFontUrl.lastIndexOf("/");
        const baseUrl = lastSlash >= 0 ? bmFontUrl.substring(0, lastSlash) : "";

        // Load the font asset
        const asset = await FontAsset.CreateFromUrlAsync(bmFontUrl, engine);

        // Build coverage from font glyphs
        const codepoints = asset.font.getCodepoints();
        const coverage = FontPack._buildCoverageRanges(codepoints);

        // Create manifest
        const manifest: FontPackManifest = {
            id: packId,
            name: asset.font.face,
            version: "1.0.0",
            family: asset.font.face,
            style: "normal",
            pages: [
                {
                    index: 0,
                    textureUrl: asset.font.pages[0] || "",
                    metricsUrl: bmFontUrl,
                    width: asset.font.atlasWidth,
                    height: asset.font.atlasHeight,
                },
            ],
            coverage,
            fallbacks: [],
            baseUrl,
        };

        return new FontPack(manifest, [asset]);
    }

    private static _buildCoverageRanges(codepoints: number[]): GlyphRange[] {
        if (codepoints.length === 0) {
            return [];
        }

        const sorted = codepoints.slice().sort((a, b) => a - b);
        const ranges: GlyphRange[] = [];
        let rangeStart = sorted[0];
        let rangeEnd = sorted[0];

        for (let i = 1; i < sorted.length; i++) {
            const cp = sorted[i];
            if (cp === rangeEnd + 1) {
                // Extend current range
                rangeEnd = cp;
            } else {
                // End current range and start new
                ranges.push({ start: rangeStart, end: rangeEnd });
                rangeStart = cp;
                rangeEnd = cp;
            }
        }

        // Push final range
        ranges.push({ start: rangeStart, end: rangeEnd });

        return ranges;
    }

    public get manifest(): FontPackManifest {
        return this._manifest;
    }

    public get assets(): ReadonlyArray<FontAsset> {
        return this._assets;
    }

    public hasGlyph(codepoint: number): boolean {
        // First check coverage set for fast lookup
        if (!this._coverageSet.has(codepoint)) {
            return false;
        }

        // Then verify asset actually has the glyph
        for (const asset of this._assets) {
            if (asset.hasGlyph(codepoint)) {
                return true;
            }
        }

        return false;
    }

    public getAssetForGlyph(codepoint: number): FontAsset | null {
        for (const asset of this._assets) {
            if (asset.hasGlyph(codepoint)) {
                return asset;
            }
        }
        return null;
    }

    public getPrimaryAsset(): FontAsset {
        return this._assets[0];
    }

    public dispose(): void {
        if (this._isDisposed) return;

        for (const asset of this._assets) {
            asset.dispose();
        }

        this._assets = [];
        this._coverageSet.clear();
        this._isDisposed = true;
    }
}
