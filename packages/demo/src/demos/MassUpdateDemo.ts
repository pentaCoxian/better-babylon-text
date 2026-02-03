import { BillboardMode, type ITextLabel } from "@bettertext/babylon-tmp-text";
import type { IDemo } from "./index";
import type { DemoScene } from "../DemoScene";
import { hslToRgb } from "../utils/colors";

interface LabelData {
  label: ITextLabel;
  baseX: number;
  baseY: number;
  baseZ: number;
  phase: number;
  updateChance: number;
}

/**
 * Performance test with 500 labels demonstrating:
 * - Mass label management
 * - Selective updates (10% text, 30% position)
 * - Dirty range tracking efficiency
 */
export class MassUpdateDemo implements IDemo {
  name = "Mass Updates (500 labels)";
  description = `
Performance test with 500 labels:
- ~10% update text each frame
- ~30% animate position continuously
- Demonstrates dirty range tracking

Watch allocator stats for buffer efficiency.`;

  private _labels: LabelData[] = [];
  private _time = 0;
  private _updateCount = 0;
  private _frameCount = 0;
  private _statsLabel!: ITextLabel;
  private _scene!: DemoScene;

  async setup(scene: DemoScene): Promise<void> {
    this._scene = scene;
    this._time = 0;
    this._labels = [];
    this._updateCount = 0;
    this._frameCount = 0;

    const targetCount = 500;
    const gridSize = Math.ceil(Math.sqrt(targetCount));
    const spacing = 0.7;
    const startX = -((gridSize - 1) * spacing) / 2;
    const startZ = -((gridSize - 1) * spacing) / 2;

    for (let i = 0; i < targetCount; i++) {
      const row = Math.floor(i / gridSize);
      const col = i % gridSize;

      const x = startX + col * spacing;
      const z = startZ + row * spacing;

      // Color based on position
      const hue = (row * 15 + col * 12) % 360;
      const rgb = hslToRgb(hue, 0.7, 0.55);

      const label = scene.createLabel({
        text: `${i}`,
        sizePx: 14,
        color: { r: rgb.r, g: rgb.g, b: rgb.b, a: 1 },
        position: { x, y: 0.3, z },
        billboard: BillboardMode.Billboard,
      });

      this._labels.push({
        label,
        baseX: x,
        baseY: 0.3,
        baseZ: z,
        phase: Math.random() * Math.PI * 2,
        updateChance: Math.random(),
      });
    }

    // Stats display label
    this._statsLabel = scene.createLabel({
      text: "Initializing...",
      sizePx: 32,
      color: { r: 1, g: 1, b: 0.3, a: 1 },
      position: { x: 0, y: 6, z: 0 },
      align: "center",
      billboard: BillboardMode.Billboard,
    });
  }

  update(deltaTime: number): void {
    this._time += deltaTime;
    this._frameCount++;

    let textUpdates = 0;
    let posUpdates = 0;

    for (const data of this._labels) {
      // ~10% update their text content (random number display)
      if (data.updateChance < 0.1) {
        const newValue = Math.floor(Math.random() * 1000);
        data.label.text = `${newValue}`;
        textUpdates++;
      }

      // ~30% continuously animate position (wave effect)
      if (data.updateChance < 0.3) {
        const wave = Math.sin(this._time * 2 + data.phase) * 0.25;
        data.label.position = {
          x: data.baseX,
          y: data.baseY + wave,
          z: data.baseZ,
        };
        posUpdates++;
      }
    }

    this._updateCount += textUpdates + posUpdates;

    // Update stats display every 30 frames
    if (this._frameCount % 30 === 0) {
      const avgUpdates = Math.round(this._updateCount / 30);
      const fps = Math.round(this._scene.getStats().fps);
      this._statsLabel.text = `${this._labels.length} labels | ~${avgUpdates} updates/frame | ${fps} FPS`;
      this._updateCount = 0;
    }
  }

  cleanup(): void {
    this._labels = [];
  }
}
