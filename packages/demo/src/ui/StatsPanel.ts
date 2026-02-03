import type { DemoScene } from "../DemoScene";

export class StatsPanel {
  private _lastUpdate = 0;
  private _updateInterval = 200; // Update at 5Hz

  constructor(
    private _element: HTMLElement,
    private _scene: DemoScene
  ) {}

  update(): void {
    const now = performance.now();
    if (now - this._lastUpdate < this._updateInterval) {
      return;
    }
    this._lastUpdate = now;

    const stats = this._scene.getStats();

    // Get first allocator stats (primary renderer)
    let allocHtml = "";
    const allocStats = stats.allocatorStats.values().next().value;
    if (allocStats) {
      allocHtml = `
        <hr>
        <div><span class="label">Buffer Capacity:</span> <span class="value">${allocStats.totalCapacity}</span></div>
        <div><span class="label">Used Slots:</span> <span class="value">${allocStats.usedSlots}</span></div>
        <div><span class="label">Free Blocks:</span> <span class="value">${allocStats.freeBlockCount}</span></div>
        <div><span class="label">Fragmentation:</span> <span class="value">${(allocStats.fragmentationRatio * 100).toFixed(1)}%</span></div>
      `;
    }

    this._element.innerHTML = `
      <div><span class="label">FPS:</span> <span class="value">${Math.round(stats.fps)}</span></div>
      <div><span class="label">Labels:</span> <span class="value">${stats.labelCount}</span></div>
      ${allocHtml}
    `;
  }
}
