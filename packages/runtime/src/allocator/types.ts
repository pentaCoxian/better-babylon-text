/**
 * Allocator type definitions
 */

/**
 * Represents a contiguous block of character slots in the GPU buffer
 */
export interface Block {
    /** Starting index in the character arrays */
    start: number;
    /** Number of character slots allocated */
    capacity: number;
}

/**
 * A free block available for reuse
 */
export interface FreeBlock extends Block {
    /** Next free block in the free list (for linked list implementation) */
    next: FreeBlock | null;
}

/**
 * Represents a dirty range that needs GPU upload
 */
export interface DirtyRange {
    /** Starting index */
    start: number;
    /** Number of elements */
    count: number;
}

/**
 * Allocation result from the free list allocator
 */
export interface AllocationResult {
    /** The allocated block */
    block: Block;
    /** Whether the allocation required growing the buffer */
    didGrow: boolean;
    /** Previous block if this was a reallocation */
    previousBlock: Block | null;
}

/**
 * Statistics for monitoring allocator health
 */
export interface AllocatorStats {
    /** Total capacity in character slots */
    totalCapacity: number;
    /** Currently used character slots */
    usedSlots: number;
    /** Number of free blocks in free list */
    freeBlockCount: number;
    /** Total slots in free list */
    freeSlots: number;
    /** Fragmentation ratio (0.0 - 1.0) */
    fragmentationRatio: number;
}

/**
 * Create a block
 */
export function createBlock(start: number, capacity: number): Block {
    return { start, capacity };
}

/**
 * Create a free block
 */
export function createFreeBlock(start: number, capacity: number, next: FreeBlock | null = null): FreeBlock {
    return { start, capacity, next };
}

/**
 * Check if two blocks are adjacent
 */
export function blocksAdjacent(a: Block, b: Block): boolean {
    return a.start + a.capacity === b.start || b.start + b.capacity === a.start;
}

/**
 * Merge two adjacent blocks
 */
export function mergeBlocks(a: Block, b: Block): Block {
    const start = Math.min(a.start, b.start);
    const end = Math.max(a.start + a.capacity, b.start + b.capacity);
    return { start, capacity: end - start };
}
