/**
 * Vendored from @babylonjs/addons/msdfText
 * Apache License 2.0 - Babylon.js
 */

import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import type { Scene } from "@babylonjs/core/scene";
import type { BmFont } from "./sdf/bmFont";
import { SdfFont } from "./sdf/font";

/**
 * Options for loading a font asset
 */
export interface FontAssetOptions {
    /** Base URL for resolving relative paths */
    baseUrl?: string;
    /** Pre-loaded texture (optional) */
    texture?: Texture;
}

/**
 * A loaded MSDF font asset
 */
export class FontAsset {
    /** The parsed SDF font data */
    public readonly font: SdfFont;
    /** The atlas texture */
    public readonly texture: Texture;
    /** The engine */
    public readonly engine: AbstractEngine;
    /** MSDF pixel range */
    public readonly pxRange: number;

    private constructor(
        font: SdfFont,
        texture: Texture,
        engine: AbstractEngine,
        pxRange: number
    ) {
        this.font = font;
        this.texture = texture;
        this.engine = engine;
        this.pxRange = pxRange;
    }

    /**
     * Create a FontAsset from BMFont JSON and texture
     */
    public static async CreateAsync(
        bmFontJson: BmFont,
        textureUrl: string,
        engine: AbstractEngine,
        options: FontAssetOptions = {}
    ): Promise<FontAsset> {
        const font = new SdfFont(bmFontJson);

        // Resolve texture URL
        const baseUrl = options.baseUrl ?? "";
        const fullTextureUrl = baseUrl ? `${baseUrl}/${textureUrl}` : textureUrl;

        // Load texture
        const texture =
            options.texture ??
            (await FontAsset._loadTexture(fullTextureUrl, engine));

        const pxRange = bmFontJson.distanceField?.distanceRange ?? 4;

        return new FontAsset(font, texture, engine, pxRange);
    }

    /**
     * Create a FontAsset from a font manifest URL
     */
    public static async CreateFromUrlAsync(
        manifestUrl: string,
        engine: AbstractEngine
    ): Promise<FontAsset> {
        // Extract base URL
        const lastSlash = manifestUrl.lastIndexOf("/");
        const baseUrl = lastSlash >= 0 ? manifestUrl.substring(0, lastSlash) : "";

        // Fetch manifest
        const response = await fetch(manifestUrl);
        if (!response.ok) {
            throw new Error(`Failed to load font manifest: ${manifestUrl}`);
        }
        const bmFontJson: BmFont = await response.json();

        // Get texture URL from pages
        const textureUrl = bmFontJson.pages[0];
        if (!textureUrl) {
            throw new Error("Font manifest has no pages");
        }

        return FontAsset.CreateAsync(bmFontJson, textureUrl, engine, { baseUrl });
    }

    private static async _loadTexture(
        url: string,
        engine: AbstractEngine
    ): Promise<Texture> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                // Create canvas to extract pixel data
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    reject(new Error("Failed to get canvas context"));
                    return;
                }
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, img.width, img.height);

                // Convert to Uint8Array for WebGL compatibility
                const data = new Uint8Array(imageData.data.buffer);

                // Create raw texture with proper type
                // invertY=true because BMFont atlases have Y=0 at top, but WebGL expects Y=0 at bottom
                const texture = RawTexture.CreateRGBATexture(
                    data,
                    img.width,
                    img.height,
                    null as unknown as Scene,
                    false, // generateMipMaps
                    true, // invertY - flip for WebGL
                    1, // samplingMode: BILINEAR
                    0 // type: TEXTURETYPE_UNSIGNED_BYTE
                );
                texture._texture = engine.createRawTexture(
                    data,
                    img.width,
                    img.height,
                    5, // TEXTUREFORMAT_RGBA
                    false, // generateMipMaps
                    true, // invertY - flip for WebGL
                    1, // samplingMode
                    null, // compression
                    0 // type: TEXTURETYPE_UNSIGNED_BYTE (0, not 1)
                );

                resolve(texture);
            };
            img.onerror = () => {
                reject(new Error(`Failed to load texture: ${url}`));
            };
            img.src = url;
        });
    }

    /**
     * Check if a codepoint is available in this font
     */
    public hasGlyph(codepoint: number): boolean {
        return this.font.hasGlyph(codepoint);
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this.texture.dispose();
    }
}
