/**
 * Tracks dirty ranges for efficient partial GPU uploads
 */

import type { DirtyRange } from "./types";

/**
 * Dirty range tracker interface
 */
export interface IDirtyRangeTracker {
    /**
     * Mark a range as dirty
     * @param start - Starting index
     * @param count - Number of elements
     */
    markDirty(start: number, count: number): void;

    /**
     * Get all dirty ranges (merged and sorted)
     */
    getDirtyRanges(): DirtyRange[];

    /**
     * Clear all dirty ranges (call after upload)
     */
    clear(): void;

    /**
     * Check if any ranges are dirty
     */
    readonly hasDirtyRanges: boolean;

    /**
     * Total number of dirty elements
     */
    readonly dirtyCount: number;
}

/**
 * Dirty range tracker implementation with automatic merging
 */
export class DirtyRangeTracker implements IDirtyRangeTracker {
    private _ranges: DirtyRange[] = [];
    private _needsMerge: boolean = false;

    public get hasDirtyRanges(): boolean {
        return this._ranges.length > 0;
    }

    public get dirtyCount(): number {
        if (this._needsMerge) {
            this._mergeRanges();
        }
        return this._ranges.reduce((sum, r) => sum + r.count, 0);
    }

    public markDirty(start: number, count: number): void {
        if (count <= 0) return;

        this._ranges.push({ start, count });
        this._needsMerge = true;
    }

    public getDirtyRanges(): DirtyRange[] {
        if (this._needsMerge) {
            this._mergeRanges();
        }
        return this._ranges.slice();
    }

    public clear(): void {
        this._ranges = [];
        this._needsMerge = false;
    }

    private _mergeRanges(): void {
        if (this._ranges.length <= 1) {
            this._needsMerge = false;
            return;
        }

        // Sort by start position
        this._ranges.sort((a, b) => a.start - b.start);

        // Merge overlapping and adjacent ranges
        const merged: DirtyRange[] = [];
        let current = this._ranges[0];

        for (let i = 1; i < this._ranges.length; i++) {
            const next = this._ranges[i];
            const currentEnd = current.start + current.count;
            const nextEnd = next.start + next.count;

            // Check if ranges overlap or are adjacent
            if (next.start <= currentEnd) {
                // Merge: extend current to include next
                const newEnd = Math.max(currentEnd, nextEnd);
                current = {
                    start: current.start,
                    count: newEnd - current.start,
                };
            } else {
                // No overlap, push current and start new
                merged.push(current);
                current = next;
            }
        }

        // Push the last range
        merged.push(current);

        this._ranges = merged;
        this._needsMerge = false;
    }
}

/**
 * Utility function to merge ranges without creating a tracker instance
 */
export function mergeRanges(ranges: DirtyRange[]): DirtyRange[] {
    if (ranges.length <= 1) {
        return ranges.slice();
    }

    // Sort by start position
    const sorted = ranges.slice().sort((a, b) => a.start - b.start);

    const merged: DirtyRange[] = [];
    let current = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
        const next = sorted[i];
        const currentEnd = current.start + current.count;
        const nextEnd = next.start + next.count;

        if (next.start <= currentEnd) {
            const newEnd = Math.max(currentEnd, nextEnd);
            current = {
                start: current.start,
                count: newEnd - current.start,
            };
        } else {
            merged.push(current);
            current = next;
        }
    }

    merged.push(current);
    return merged;
}
