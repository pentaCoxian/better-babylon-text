import type { ITextLabel } from "@bettertext/babylon-tmp-text";
import type { IDemo } from "./index";
import type { DemoScene } from "../DemoScene";

/**
 * Demo showcasing real-time text updates:
 * - Elapsed time updating every frame
 * - Counter incrementing at 10Hz
 * - FPS display
 * - Clock with seconds
 */
export class TimerCounterDemo implements IDemo {
  name = "Timer & Counters";
  description = `
Demonstrates real-time text updates:
- Elapsed time (updates every frame)
- Counter incrementing at 10Hz
- Live FPS display
- Date/time clock

Watch how only changed labels trigger GPU updates.`;

  private _elapsedLabel!: ITextLabel;
  private _counterLabel!: ITextLabel;
  private _fpsLabel!: ITextLabel;
  private _clockLabel!: ITextLabel;

  private _elapsed = 0;
  private _counter = 0;
  private _counterAccum = 0;
  private _lastSecond = -1;
  private _scene!: DemoScene;

  async setup(scene: DemoScene): Promise<void> {
    this._scene = scene;
    this._elapsed = 0;
    this._counter = 0;
    this._counterAccum = 0;
    this._lastSecond = -1;

    // Title label
    scene.createLabel({
      text: "Dynamic Text Updates",
      sizePx: 56,
      color: { r: 1, g: 1, b: 1, a: 1 },
      position: { x: 0, y: 4.5, z: 0 },
      align: "center",
      strokeWidth: 0.08,
      strokeColor: { r: 0, g: 0, b: 0, a: 1 },
    });

    // Elapsed time (updates every frame)
    this._elapsedLabel = scene.createLabel({
      text: "Elapsed: 0.000s",
      sizePx: 40,
      color: { r: 0.3, g: 1, b: 0.5, a: 1 },
      position: { x: -4, y: 2.5, z: 0 },
    });

    // Counter (updates 10 times per second)
    this._counterLabel = scene.createLabel({
      text: "Counter: 0",
      sizePx: 40,
      color: { r: 1, g: 0.8, b: 0.2, a: 1 },
      position: { x: -4, y: 1.5, z: 0 },
    });

    // FPS (updates every frame)
    this._fpsLabel = scene.createLabel({
      text: "FPS: --",
      sizePx: 36,
      color: { r: 0.5, g: 0.8, b: 1, a: 1 },
      position: { x: -4, y: 0.5, z: 0 },
    });

    // Clock (updates every second)
    this._clockLabel = scene.createLabel({
      text: this._formatTime(),
      sizePx: 48,
      color: { r: 1, g: 0.5, b: 0.8, a: 1 },
      position: { x: 3, y: 2, z: 0 },
      strokeWidth: 0.06,
      strokeColor: { r: 0.2, g: 0, b: 0.1, a: 1 },
    });
  }

  update(deltaTime: number): void {
    // Update elapsed time (every frame) - demonstrates per-frame reactivity
    this._elapsed += deltaTime;
    this._elapsedLabel.text = `Elapsed: ${this._elapsed.toFixed(3)}s`;

    // Update counter at 10Hz - demonstrates throttled updates
    this._counterAccum += deltaTime;
    if (this._counterAccum >= 0.1) {
      this._counterAccum -= 0.1;
      this._counter++;
      this._counterLabel.text = `Counter: ${this._counter}`;
    }

    // Update FPS display
    this._fpsLabel.text = `FPS: ${Math.round(this._scene.getStats().fps)}`;

    // Update clock every second
    const currentSecond = Math.floor(this._elapsed);
    if (currentSecond !== this._lastSecond) {
      this._lastSecond = currentSecond;
      this._clockLabel.text = this._formatTime();
    }
  }

  cleanup(): void {
    // Labels are auto-disposed by DemoScene
  }

  private _formatTime(): string {
    const now = new Date();
    return now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
}
