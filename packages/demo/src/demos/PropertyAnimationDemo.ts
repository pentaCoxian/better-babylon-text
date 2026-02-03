import type { ITextLabel } from "@bettertext/babylon-tmp-text";
import type { IDemo } from "./index";
import type { DemoScene } from "../DemoScene";
import { hslToRgb } from "../utils/colors";
import { easeInOutSine } from "../utils/easing";

/**
 * Demo showcasing animated property changes:
 * - Color cycling
 * - Size pulsing
 * - Position orbiting
 * - Rotation spinning
 * - Scale breathing
 * - Stroke animation
 */
export class PropertyAnimationDemo implements IDemo {
  name = "Property Animations";
  description = `
Demonstrates reactive property changes:
- Color cycling (hue animation)
- Size pulsing (sizePx 24-48px)
- Position orbiting (3D path)
- Rotation spinning (Z-axis)
- Scale breathing
- Stroke width + color animation

All properties use reactive setters.`;

  private _colorLabel!: ITextLabel;
  private _sizeLabel!: ITextLabel;
  private _positionLabel!: ITextLabel;
  private _rotationLabel!: ITextLabel;
  private _scaleLabel!: ITextLabel;
  private _strokeLabel!: ITextLabel;

  private _time = 0;

  async setup(scene: DemoScene): Promise<void> {
    this._time = 0;

    // Color animation label
    this._colorLabel = scene.createLabel({
      text: "Color Cycling",
      sizePx: 44,
      color: { r: 1, g: 0, b: 0, a: 1 },
      position: { x: -4.5, y: 3.5, z: 0 },
    });

    // Size animation label
    this._sizeLabel = scene.createLabel({
      text: "Size Pulsing",
      sizePx: 32,
      color: { r: 1, g: 1, b: 1, a: 1 },
      position: { x: 4, y: 3.5, z: 0 },
    });

    // Position animation label
    this._positionLabel = scene.createLabel({
      text: "Orbiting",
      sizePx: 40,
      color: { r: 0.8, g: 1, b: 0.3, a: 1 },
      position: { x: 0, y: 1.5, z: 0 },
      align: "center",
    });

    // Rotation animation label
    this._rotationLabel = scene.createLabel({
      text: "Spinning",
      sizePx: 40,
      color: { r: 0.3, g: 0.8, b: 1, a: 1 },
      position: { x: -4.5, y: 0.5, z: 0 },
      align: "center",
    });

    // Scale animation label
    this._scaleLabel = scene.createLabel({
      text: "Breathing",
      sizePx: 40,
      color: { r: 1, g: 0.6, b: 0.8, a: 1 },
      position: { x: 4.5, y: 0.5, z: 0 },
      align: "center",
    });

    // Stroke animation label
    this._strokeLabel = scene.createLabel({
      text: "Stroke Pulse",
      sizePx: 52,
      color: { r: 1, g: 1, b: 1, a: 1 },
      strokeColor: { r: 0, g: 0.5, b: 1, a: 1 },
      strokeWidth: 0.05,
      position: { x: 0, y: -1, z: 0 },
      align: "center",
    });
  }

  update(deltaTime: number): void {
    this._time += deltaTime;

    // Color cycling - HSL hue animation
    const hue = (this._time * 60) % 360;
    const rgb = hslToRgb(hue, 1, 0.55);
    this._colorLabel.color = { r: rgb.r, g: rgb.g, b: rgb.b, a: 1 };

    // Size pulsing - oscillates between 24 and 48 pixels
    const sizeT = easeInOutSine((Math.sin(this._time * 2) + 1) / 2);
    this._sizeLabel.sizePx = 24 + sizeT * 24;

    // Position orbiting - circular path in XZ plane with vertical bob
    const orbitRadius = 2.5;
    const orbitSpeed = 0.8;
    this._positionLabel.position = {
      x: Math.cos(this._time * orbitSpeed) * orbitRadius,
      y: 1.5 + Math.sin(this._time * orbitSpeed * 2) * 0.5,
      z: Math.sin(this._time * orbitSpeed) * orbitRadius,
    };

    // Rotation spinning - continuous Z-axis rotation
    this._rotationLabel.rotation = {
      x: 0,
      y: 0,
      z: this._time * 0.5,
    };

    // Scale breathing - uniform scale oscillation
    const scaleT = (Math.sin(this._time * 1.5) + 1) / 2;
    const scaleFactor = 0.7 + scaleT * 0.6;
    this._scaleLabel.scale = {
      x: scaleFactor,
      y: scaleFactor,
      z: 1,
    };

    // Stroke animation - width and color
    const strokeWidth = 0.02 + Math.abs(Math.sin(this._time * 1.2)) * 0.12;
    this._strokeLabel.strokeWidth = strokeWidth;

    // Complementary stroke color
    const strokeHue = (hue + 180) % 360;
    const strokeRgb = hslToRgb(strokeHue, 1, 0.5);
    this._strokeLabel.strokeColor = {
      r: strokeRgb.r,
      g: strokeRgb.g,
      b: strokeRgb.b,
      a: 1,
    };
  }

  cleanup(): void {
    // Labels auto-disposed
  }
}
