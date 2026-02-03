/**
 * Package constants
 */

/**
 * Default font size in pixels
 */
export const DEFAULT_FONT_SIZE = 32;

/**
 * Default line height multiplier
 */
export const DEFAULT_LINE_HEIGHT = 1.2;

/**
 * Default letter spacing
 */
export const DEFAULT_LETTER_SPACING = 0;

/**
 * Default max width (0 = no limit)
 */
export const DEFAULT_MAX_WIDTH = 0;

/**
 * Default allocator initial capacity (characters)
 */
export const DEFAULT_INITIAL_CAPACITY = 128;

/**
 * Default compaction threshold (0.0-1.0)
 * When fragmentation exceeds this ratio, auto-compact is triggered
 */
export const DEFAULT_COMPACTION_THRESHOLD = 0.3;

/**
 * Minimum capacity to allocate for a paragraph
 */
export const MIN_PARAGRAPH_CAPACITY = 16;

/**
 * Capacity growth factor when reallocating
 */
export const CAPACITY_GROWTH_FACTOR = 1.5;

/**
 * Number of floats per character matrix (4x4 matrix)
 */
export const FLOATS_PER_MATRIX = 16;

/**
 * Number of floats per character UV rect
 */
export const FLOATS_PER_UV = 4;

/**
 * Number of floats per character color
 */
export const FLOATS_PER_COLOR = 4;
