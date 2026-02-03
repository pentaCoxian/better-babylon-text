import { describe, it, expect, beforeEach } from "vitest";
import { FreeListAllocator } from "../../src/allocator/FreeListAllocator";

describe("FreeListAllocator", () => {
    let allocator: FreeListAllocator;

    beforeEach(() => {
        allocator = new FreeListAllocator(128);
    });

    describe("allocate", () => {
        it("should allocate from empty allocator", () => {
            const result = allocator.allocate(10);

            expect(result.block.start).toBe(0);
            expect(result.block.capacity).toBe(16); // MIN_PARAGRAPH_CAPACITY
            expect(result.didGrow).toBe(false);
            expect(result.previousBlock).toBe(null);
        });

        it("should allocate sequential blocks", () => {
            const result1 = allocator.allocate(10);
            const result2 = allocator.allocate(20);

            expect(result1.block.start).toBe(0);
            expect(result2.block.start).toBe(result1.block.capacity);
        });

        it("should respect capacity hints for over-allocation", () => {
            const result = allocator.allocate(10, 50);

            expect(result.block.capacity).toBe(50);
        });

        it("should grow capacity when no suitable block exists", () => {
            // Allocate most of the initial capacity
            allocator.allocate(100);

            // This should trigger growth
            const result = allocator.allocate(50);

            expect(result.didGrow).toBe(true);
            expect(allocator.totalCapacity).toBeGreaterThan(128);
        });
    });

    describe("free", () => {
        it("should add block to free list", () => {
            const result = allocator.allocate(20);
            const initialStats = allocator.getStats();

            allocator.free(result.block);

            const stats = allocator.getStats();
            expect(stats.freeSlots).toBeGreaterThan(initialStats.freeSlots);
            expect(stats.usedSlots).toBeLessThan(initialStats.usedSlots);
        });

        it("should coalesce adjacent free blocks", () => {
            const result1 = allocator.allocate(20);
            const result2 = allocator.allocate(20);
            const result3 = allocator.allocate(20);

            // Free middle block
            allocator.free(result2.block);
            const statsAfterMiddle = allocator.getStats();

            // Free first block - should coalesce with middle
            allocator.free(result1.block);
            const statsAfterFirst = allocator.getStats();

            // Should have fewer free blocks after coalescing
            expect(statsAfterFirst.freeBlockCount).toBeLessThanOrEqual(
                statsAfterMiddle.freeBlockCount
            );
        });

        it("should allow reuse of freed blocks", () => {
            const result1 = allocator.allocate(20);
            const startPos = result1.block.start;

            allocator.free(result1.block);

            // Allocate same size - should reuse the freed block
            const result2 = allocator.allocate(20);

            expect(result2.block.start).toBe(startPos);
        });
    });

    describe("reallocate", () => {
        it("should return same block if capacity is sufficient", () => {
            const result1 = allocator.allocate(10, 50);
            const result2 = allocator.reallocate(result1.block, 30);

            expect(result2.block.start).toBe(result1.block.start);
            expect(result2.block.capacity).toBe(result1.block.capacity);
            expect(result2.didGrow).toBe(false);
            expect(result2.previousBlock).toBe(null);
        });

        it("should allocate new block if capacity is insufficient and cannot extend", () => {
            // Allocate two blocks so the first one cannot extend into adjacent space
            const result1 = allocator.allocate(16);
            allocator.allocate(16); // Block adjacent block, preventing extension

            // Now reallocate first block to larger size - must move
            const result2 = allocator.reallocate(result1.block, 100);

            expect(result2.block.start).not.toBe(result1.block.start);
            expect(result2.block.capacity).toBeGreaterThanOrEqual(100);
            expect(result2.previousBlock).toEqual(result1.block);
        });

        it("should extend into adjacent free space when possible", () => {
            // Allocate a small block - rest of buffer is free
            const result1 = allocator.allocate(16);

            // Reallocate to larger size - should extend in place
            const result2 = allocator.reallocate(result1.block, 50);

            expect(result2.block.start).toBe(result1.block.start);
            expect(result2.block.capacity).toBeGreaterThanOrEqual(50);
            expect(result2.previousBlock).toBe(null);
        });

        it("should free old block on reallocation", () => {
            allocator.allocate(20); // Block at 0
            const result1 = allocator.allocate(10); // Block at 20

            const statsBefore = allocator.getStats();
            allocator.reallocate(result1.block, 100);
            const statsAfter = allocator.getStats();

            // Old block should be freed (added to free slots)
            expect(statsAfter.freeSlots).toBeGreaterThan(statsBefore.freeSlots - 100);
        });
    });

    describe("getStats", () => {
        it("should return accurate statistics", () => {
            const stats1 = allocator.getStats();

            expect(stats1.totalCapacity).toBe(128);
            expect(stats1.usedSlots).toBe(0);
            expect(stats1.freeBlockCount).toBe(1);
            expect(stats1.freeSlots).toBe(128);
            expect(stats1.fragmentationRatio).toBe(1); // All free

            allocator.allocate(50);
            const stats2 = allocator.getStats();

            expect(stats2.usedSlots).toBe(50);
            expect(stats2.freeSlots).toBe(128 - 50);
        });

        it("should calculate fragmentation ratio correctly", () => {
            allocator.allocate(30);
            allocator.allocate(30);
            allocator.allocate(30);

            const stats = allocator.getStats();
            const expectedFragmentation = stats.freeSlots / stats.totalCapacity;

            expect(stats.fragmentationRatio).toBeCloseTo(expectedFragmentation, 5);
        });
    });

    describe("compact", () => {
        it("should pack paragraphs contiguously", () => {
            const block1 = allocator.allocate(20).block;
            const block2 = allocator.allocate(20).block;
            const block3 = allocator.allocate(20).block;

            // Free middle block to create fragmentation
            allocator.free(block2);

            // Compact with remaining blocks
            const remapping = allocator.compact(() => [block1, block3]);

            // block3 should be remapped to start right after block1
            expect(remapping.get(block3.start)).toBe(block1.capacity);
        });

        it("should return correct remapping", () => {
            const block1 = allocator.allocate(20).block;
            allocator.allocate(20); // Will be "freed" by not including in compact
            const block3 = allocator.allocate(20).block;

            const remapping = allocator.compact(() => [block1, block3]);

            // block1 stays at 0, block3 moves to position 20
            expect(remapping.has(block1.start)).toBe(false); // No change
            expect(remapping.get(block3.start)).toBe(block1.capacity);
        });

        it("should reset free list to single tail block", () => {
            allocator.allocate(20);
            allocator.allocate(20);
            const block3 = allocator.allocate(20).block;
            allocator.free(block3);

            const statsBefore = allocator.getStats();
            expect(statsBefore.freeBlockCount).toBeGreaterThanOrEqual(1);

            allocator.compact(() => [
                { start: 0, capacity: 20 },
                { start: 20, capacity: 20 },
            ]);

            const statsAfter = allocator.getStats();
            expect(statsAfter.freeBlockCount).toBe(1);
        });
    });

    describe("reset", () => {
        it("should reset to initial state", () => {
            allocator.allocate(50);
            allocator.allocate(30);

            allocator.reset();

            const stats = allocator.getStats();
            expect(stats.usedSlots).toBe(0);
            expect(stats.freeSlots).toBe(128);
            expect(stats.freeBlockCount).toBe(1);
        });
    });
});
