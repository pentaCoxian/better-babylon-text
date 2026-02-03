/**
 * Vendored from @babylonjs/addons/msdfText
 * Apache License 2.0 - Babylon.js
 */

/**
 * BMFont character data
 */
export interface BmFontChar {
    /** Character ID (Unicode codepoint) */
    id: number;
    /** X position in atlas */
    x: number;
    /** Y position in atlas */
    y: number;
    /** Width in atlas */
    width: number;
    /** Height in atlas */
    height: number;
    /** X offset when rendering */
    xoffset: number;
    /** Y offset when rendering */
    yoffset: number;
    /** Advance width (cursor movement) */
    xadvance: number;
    /** Atlas page index */
    page: number;
    /** Channel (for multi-channel fonts) */
    chnl: number;
}

/**
 * BMFont kerning pair
 */
export interface BmFontKerning {
    /** First character ID */
    first: number;
    /** Second character ID */
    second: number;
    /** Kerning amount */
    amount: number;
}

/**
 * BMFont common info
 */
export interface BmFontCommon {
    /** Line height */
    lineHeight: number;
    /** Base line */
    base: number;
    /** Scale width */
    scaleW: number;
    /** Scale height */
    scaleH: number;
    /** Number of pages */
    pages: number;
    /** Packed flag */
    packed: number;
    /** Alpha channel */
    alphaChnl: number;
    /** Red channel */
    redChnl: number;
    /** Green channel */
    greenChnl: number;
    /** Blue channel */
    blueChnl: number;
}

/**
 * BMFont info block
 */
export interface BmFontInfo {
    /** Font face name */
    face: string;
    /** Font size */
    size: number;
    /** Bold flag */
    bold: number;
    /** Italic flag */
    italic: number;
    /** Character set */
    charset: string;
    /** Unicode flag */
    unicode: number;
    /** Stretch height */
    stretchH: number;
    /** Smooth flag */
    smooth: number;
    /** Anti-aliasing level */
    aa: number;
    /** Padding */
    padding: [number, number, number, number];
    /** Spacing */
    spacing: [number, number];
    /** Outline */
    outline: number;
}

/**
 * BMFont page definition
 */
export interface BmFontPage {
    /** Page ID */
    id: number;
    /** Page file name */
    file: string;
}

/**
 * MSDF-specific distance field info
 */
export interface BmFontDistanceField {
    /** Field type (msdf, sdf, psdf) */
    fieldType: string;
    /** Distance range */
    distanceRange: number;
}

/**
 * Complete BMFont data structure
 */
export interface BmFont {
    /** Font pages */
    pages: string[];
    /** Character definitions */
    chars: BmFontChar[];
    /** Kerning pairs */
    kernings?: BmFontKerning[];
    /** Common info */
    common: BmFontCommon;
    /** Font info */
    info: BmFontInfo;
    /** Distance field info (MSDF specific) */
    distanceField?: BmFontDistanceField;
}
