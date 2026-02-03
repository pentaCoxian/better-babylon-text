import { describe, it, expect, beforeEach } from "vitest";
import { DirtyRangeTracker, mergeRanges } from "../../src/allocator/DirtyRangeTracker";

describe("DirtyRangeTracker", () => {
    let tracker: DirtyRangeTracker;

    beforeEach(() => {
        tracker = new DirtyRangeTracker();
    });

    describe("markDirty", () => {
        it("should track single dirty range", () => {
            tracker.markDirty(10, 20);

            expect(tracker.hasDirtyRanges).toBe(true);
            expect(tracker.dirtyCount).toBe(20);

            const ranges = tracker.getDirtyRanges();
            expect(ranges).toHaveLength(1);
            expect(ranges[0]).toEqual({ start: 10, count: 20 });
        });

        it("should ignore zero count", () => {
            tracker.markDirty(10, 0);

            expect(tracker.hasDirtyRanges).toBe(false);
        });

        it("should ignore negative count", () => {
            tracker.markDirty(10, -5);

            expect(tracker.hasDirtyRanges).toBe(false);
        });
    });

    describe("getDirtyRanges", () => {
        it("should merge overlapping ranges", () => {
            tracker.markDirty(10, 20); // 10-30
            tracker.markDirty(25, 20); // 25-45 (overlaps)

            const ranges = tracker.getDirtyRanges();
            expect(ranges).toHaveLength(1);
            expect(ranges[0]).toEqual({ start: 10, count: 35 }); // 10-45
        });

        it("should merge adjacent ranges", () => {
            tracker.markDirty(10, 10); // 10-20
            tracker.markDirty(20, 10); // 20-30 (adjacent)

            const ranges = tracker.getDirtyRanges();
            expect(ranges).toHaveLength(1);
            expect(ranges[0]).toEqual({ start: 10, count: 20 }); // 10-30
        });

        it("should sort ranges by start position", () => {
            tracker.markDirty(50, 10);
            tracker.markDirty(10, 10);
            tracker.markDirty(30, 10);

            const ranges = tracker.getDirtyRanges();
            expect(ranges).toHaveLength(3);
            expect(ranges[0].start).toBe(10);
            expect(ranges[1].start).toBe(30);
            expect(ranges[2].start).toBe(50);
        });

        it("should handle complex merge scenarios", () => {
            tracker.markDirty(0, 10);   // 0-10
            tracker.markDirty(20, 10);  // 20-30
            tracker.markDirty(5, 20);   // 5-25 (bridges first two)

            const ranges = tracker.getDirtyRanges();
            expect(ranges).toHaveLength(1);
            expect(ranges[0]).toEqual({ start: 0, count: 30 }); // 0-30
        });

        it("should keep non-overlapping ranges separate", () => {
            tracker.markDirty(0, 10);   // 0-10
            tracker.markDirty(20, 10);  // 20-30

            const ranges = tracker.getDirtyRanges();
            expect(ranges).toHaveLength(2);
            expect(ranges[0]).toEqual({ start: 0, count: 10 });
            expect(ranges[1]).toEqual({ start: 20, count: 10 });
        });
    });

    describe("clear", () => {
        it("should clear all dirty ranges", () => {
            tracker.markDirty(10, 20);
            tracker.markDirty(50, 30);

            expect(tracker.hasDirtyRanges).toBe(true);

            tracker.clear();

            expect(tracker.hasDirtyRanges).toBe(false);
            expect(tracker.dirtyCount).toBe(0);
            expect(tracker.getDirtyRanges()).toHaveLength(0);
        });
    });

    describe("hasDirtyRanges", () => {
        it("should return false when empty", () => {
            expect(tracker.hasDirtyRanges).toBe(false);
        });

        it("should return true when has ranges", () => {
            tracker.markDirty(0, 10);
            expect(tracker.hasDirtyRanges).toBe(true);
        });
    });

    describe("dirtyCount", () => {
        it("should return total dirty elements", () => {
            tracker.markDirty(0, 10);
            tracker.markDirty(20, 15);

            expect(tracker.dirtyCount).toBe(25);
        });

        it("should account for merged ranges", () => {
            tracker.markDirty(0, 20);  // 0-20
            tracker.markDirty(10, 20); // 10-30 (overlaps)

            // Merged: 0-30 = 30 elements
            expect(tracker.dirtyCount).toBe(30);
        });
    });
});

describe("mergeRanges utility", () => {
    it("should return empty array for empty input", () => {
        expect(mergeRanges([])).toEqual([]);
    });

    it("should return single range unchanged", () => {
        const result = mergeRanges([{ start: 10, count: 20 }]);
        expect(result).toEqual([{ start: 10, count: 20 }]);
    });

    it("should merge overlapping ranges", () => {
        const result = mergeRanges([
            { start: 0, count: 15 },
            { start: 10, count: 15 },
        ]);
        expect(result).toEqual([{ start: 0, count: 25 }]);
    });

    it("should not modify original array", () => {
        const original = [
            { start: 20, count: 10 },
            { start: 0, count: 10 },
        ];
        const originalCopy = JSON.parse(JSON.stringify(original));

        mergeRanges(original);

        expect(original).toEqual(originalCopy);
    });
});
