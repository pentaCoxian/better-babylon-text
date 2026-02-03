/**
 * Free list allocator for GPU buffer slot management
 */

import type {
    Block,
    FreeBlock,
    AllocationResult,
    AllocatorStats,
} from "./types";
import { createBlock, createFreeBlock, blocksAdjacent, mergeBlocks } from "./types";
import {
    DEFAULT_INITIAL_CAPACITY,
    MIN_PARAGRAPH_CAPACITY,
    CAPACITY_GROWTH_FACTOR,
} from "../core/constants";

/**
 * Free list allocator interface
 */
export interface IFreeListAllocator {
    /**
     * Allocate a block with at least the requested capacity
     * @param minCapacity - Minimum number of slots needed
     * @param capacityHint - Preferred capacity (for over-allocation)
     * @returns Allocation result
     */
    allocate(minCapacity: number, capacityHint?: number): AllocationResult;

    /**
     * Free a block back to the free list
     * @param block - Block to free
     */
    free(block: Block): void;

    /**
     * Attempt to reallocate a block with new capacity
     * Returns the same block if it fits, otherwise allocates new and frees old
     * @param block - Current block
     * @param newCapacity - Required capacity
     * @returns New allocation result
     */
    reallocate(block: Block, newCapacity: number): AllocationResult;

    /**
     * Get current statistics
     */
    getStats(): AllocatorStats;

    /**
     * Compact the allocator, returning a remapping of old start indices to new
     * @param getBlocksInUse - Function that returns all blocks currently in use
     * @returns Map from old start index to new start index
     */
    compact(getBlocksInUse: () => Block[]): Map<number, number>;

    /**
     * Reset the allocator to initial state
     */
    reset(): void;

    /**
     * Current total capacity
     */
    readonly totalCapacity: number;

    /**
     * Current used capacity
     */
    readonly usedCapacity: number;
}

/**
 * Free list allocator implementation using first-fit strategy
 */
export class FreeListAllocator implements IFreeListAllocator {
    private _totalCapacity: number;
    private _usedCapacity: number = 0;
    private _freeList: FreeBlock | null = null;
    private _freeBlockCount: number = 0;
    private _freeSlots: number = 0;

    constructor(initialCapacity: number = DEFAULT_INITIAL_CAPACITY) {
        this._totalCapacity = Math.max(initialCapacity, MIN_PARAGRAPH_CAPACITY);
        // Start with entire buffer as one free block
        this._freeList = createFreeBlock(0, this._totalCapacity);
        this._freeBlockCount = 1;
        this._freeSlots = this._totalCapacity;
    }

    public get totalCapacity(): number {
        return this._totalCapacity;
    }

    public get usedCapacity(): number {
        return this._usedCapacity;
    }

    public allocate(minCapacity: number, capacityHint?: number): AllocationResult {
        const requestedCapacity = Math.max(
            minCapacity,
            capacityHint ?? minCapacity,
            MIN_PARAGRAPH_CAPACITY
        );

        // Try to find a suitable free block (first-fit)
        let prev: FreeBlock | null = null;
        let current = this._freeList;

        while (current !== null) {
            if (current.capacity >= requestedCapacity) {
                // Found a suitable block
                return this._allocateFromFreeBlock(current, prev, requestedCapacity);
            }
            prev = current;
            current = current.next;
        }

        // No suitable block found, need to grow
        return this._growAndAllocate(requestedCapacity);
    }

    public free(block: Block): void {
        // Create a free block
        const freeBlock = createFreeBlock(block.start, block.capacity);

        // Insert into free list maintaining sorted order by start position
        if (this._freeList === null || block.start < this._freeList.start) {
            freeBlock.next = this._freeList;
            this._freeList = freeBlock;
        } else {
            let current = this._freeList;
            while (current.next !== null && current.next.start < block.start) {
                current = current.next;
            }
            freeBlock.next = current.next;
            current.next = freeBlock;
        }

        this._freeBlockCount++;
        this._freeSlots += block.capacity;
        this._usedCapacity -= block.capacity;

        // Coalesce adjacent blocks
        this._coalesce();
    }

    public reallocate(block: Block, newCapacity: number): AllocationResult {
        // Fast path: block already has sufficient capacity
        if (newCapacity <= block.capacity) {
            return {
                block,
                didGrow: false,
                previousBlock: null,
            };
        }

        // Check if we can extend into adjacent free block
        const extendedBlock = this._tryExtend(block, newCapacity);
        if (extendedBlock) {
            return {
                block: extendedBlock,
                didGrow: false,
                previousBlock: null,
            };
        }

        // Need to allocate new block and free old
        const result = this.allocate(newCapacity, Math.ceil(newCapacity * CAPACITY_GROWTH_FACTOR));
        result.previousBlock = block;

        // Free the old block
        this.free(block);

        return result;
    }

    public getStats(): AllocatorStats {
        const fragmentationRatio =
            this._totalCapacity > 0
                ? this._freeSlots / this._totalCapacity
                : 0;

        return {
            totalCapacity: this._totalCapacity,
            usedSlots: this._usedCapacity,
            freeBlockCount: this._freeBlockCount,
            freeSlots: this._freeSlots,
            fragmentationRatio,
        };
    }

    public compact(getBlocksInUse: () => Block[]): Map<number, number> {
        const blocks = getBlocksInUse();
        const remapping = new Map<number, number>();

        if (blocks.length === 0) {
            // Reset to initial state
            this._freeList = createFreeBlock(0, this._totalCapacity);
            this._freeBlockCount = 1;
            this._freeSlots = this._totalCapacity;
            this._usedCapacity = 0;
            return remapping;
        }

        // Sort blocks by current start position
        blocks.sort((a, b) => a.start - b.start);

        // Repack contiguously
        let newStart = 0;
        for (const block of blocks) {
            if (block.start !== newStart) {
                remapping.set(block.start, newStart);
            }
            newStart += block.capacity;
        }

        // Update allocator state
        this._usedCapacity = newStart;
        this._freeSlots = this._totalCapacity - newStart;

        if (this._freeSlots > 0) {
            this._freeList = createFreeBlock(newStart, this._freeSlots);
            this._freeBlockCount = 1;
        } else {
            this._freeList = null;
            this._freeBlockCount = 0;
        }

        return remapping;
    }

    public reset(): void {
        this._usedCapacity = 0;
        this._freeList = createFreeBlock(0, this._totalCapacity);
        this._freeBlockCount = 1;
        this._freeSlots = this._totalCapacity;
    }

    private _allocateFromFreeBlock(
        freeBlock: FreeBlock,
        prev: FreeBlock | null,
        requestedCapacity: number
    ): AllocationResult {
        const block = createBlock(freeBlock.start, requestedCapacity);

        if (freeBlock.capacity === requestedCapacity) {
            // Exact fit, remove from free list
            if (prev === null) {
                this._freeList = freeBlock.next;
            } else {
                prev.next = freeBlock.next;
            }
            this._freeBlockCount--;
            this._freeSlots -= requestedCapacity;
        } else {
            // Split the block
            freeBlock.start += requestedCapacity;
            freeBlock.capacity -= requestedCapacity;
            this._freeSlots -= requestedCapacity;
        }

        this._usedCapacity += requestedCapacity;

        return {
            block,
            didGrow: false,
            previousBlock: null,
        };
    }

    private _growAndAllocate(requestedCapacity: number): AllocationResult {
        // Calculate new capacity
        const minNewCapacity = this._totalCapacity + requestedCapacity;
        const growthCapacity = Math.ceil(this._totalCapacity * CAPACITY_GROWTH_FACTOR);
        const newTotalCapacity = Math.max(minNewCapacity, growthCapacity);

        // Allocate at the end of current capacity
        const block = createBlock(this._totalCapacity, requestedCapacity);

        // Add remaining space to free list
        const remainingSpace = newTotalCapacity - this._totalCapacity - requestedCapacity;
        if (remainingSpace > 0) {
            const newFreeBlock = createFreeBlock(
                this._totalCapacity + requestedCapacity,
                remainingSpace
            );

            // Append to end of free list
            if (this._freeList === null) {
                this._freeList = newFreeBlock;
            } else {
                let current = this._freeList;
                while (current.next !== null) {
                    current = current.next;
                }
                current.next = newFreeBlock;
            }
            this._freeBlockCount++;
            this._freeSlots += remainingSpace;
        }

        this._totalCapacity = newTotalCapacity;
        this._usedCapacity += requestedCapacity;

        return {
            block,
            didGrow: true,
            previousBlock: null,
        };
    }

    private _tryExtend(block: Block, newCapacity: number): Block | null {
        const blockEnd = block.start + block.capacity;
        const additionalNeeded = newCapacity - block.capacity;

        // Look for adjacent free block after this one
        let prev: FreeBlock | null = null;
        let current = this._freeList;

        while (current !== null) {
            if (current.start === blockEnd) {
                // Found adjacent free block
                if (current.capacity >= additionalNeeded) {
                    // Can extend into this block
                    const extendedBlock = createBlock(block.start, newCapacity);

                    if (current.capacity === additionalNeeded) {
                        // Consume entire free block
                        if (prev === null) {
                            this._freeList = current.next;
                        } else {
                            prev.next = current.next;
                        }
                        this._freeBlockCount--;
                    } else {
                        // Shrink free block
                        current.start += additionalNeeded;
                        current.capacity -= additionalNeeded;
                    }

                    this._freeSlots -= additionalNeeded;
                    this._usedCapacity += additionalNeeded;

                    return extendedBlock;
                }
                break;
            }
            prev = current;
            current = current.next;
        }

        return null;
    }

    private _coalesce(): void {
        if (this._freeList === null) return;

        let current = this._freeList;
        while (current.next !== null) {
            if (blocksAdjacent(current, current.next)) {
                // Merge with next block
                const merged = mergeBlocks(current, current.next);
                current.start = merged.start;
                current.capacity = merged.capacity;
                current.next = current.next.next;
                this._freeBlockCount--;
            } else {
                current = current.next;
            }
        }
    }
}
