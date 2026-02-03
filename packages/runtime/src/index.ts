/**
 * @bettertext/babylon-tmp-text
 *
 * TMP-like retained-mode text rendering for Babylon.js with MSDF
 */

// Core types and utilities
export * from "./core/types";
export * from "./core/constants";
export * from "./core/errors";

// Main system
export {
    TmpTextSystem,
    createTmpTextSystem,
    type ITmpTextSystem,
    type TmpTextSystemOptions,
} from "./system/TmpTextSystem";

// Text objects
export {
    TextLabel,
    type ITextLabel,
    type TextLabelOptions,
    DefaultTextLabelOptions,
} from "./objects";

// Font management
export {
    FontPack,
    type IFontPack,
    type FontPackManifest,
    type FontPackPage,
    type GlyphRange,
    FallbackChain,
    type IFallbackChain,
    type TextRun,
} from "./fonts";

// Extended renderer (for advanced usage)
export {
    TextRendererEx,
    type ITextRendererEx,
    type ParagraphHandle,
    type ParagraphRecord,
    type CreateParagraphOptions,
    type UpdateParagraphOptions,
} from "./extended";

// Allocator types (for advanced usage)
export {
    type Block,
    type DirtyRange,
    type AllocatorStats,
    FreeListAllocator,
    DirtyRangeTracker,
} from "./allocator";

// Re-export vendored types that users might need
export type { ParagraphOptions } from "./vendor/msdfText/paragraphOptions";
export { FontAsset } from "./vendor/msdfText/fontAsset";
