import type { ITextLabel } from "@bettertext/babylon-tmp-text";
import type { IDemo } from "./index";
import type { DemoScene } from "../DemoScene";
import { hslToRgb } from "../utils/colors";

/**
 * Interactive demo with user controls:
 * - Text input field
 * - Size slider
 * - Color hue slider
 * - Animation buttons
 */
export class InteractiveDemo implements IDemo {
  name = "Interactive Controls";
  description = `
User-driven text updates:
- Type in the input to change text
- Adjust size with slider (12-72px)
- Change color with hue slider
- Try the animation buttons!

Demonstrates immediate reactive updates.`;

  private _mainLabel!: ITextLabel;
  private _uiContainer: HTMLDivElement | null = null;

  private _currentText = "Hello World!";
  private _currentSize = 48;
  private _currentHue = 200;

  async setup(scene: DemoScene): Promise<void> {
    this._currentText = "Hello World!";
    this._currentSize = 48;
    this._currentHue = 200;

    // Main interactive label
    const rgb = hslToRgb(this._currentHue, 0.9, 0.6);
    this._mainLabel = scene.createLabel({
      text: this._currentText,
      sizePx: this._currentSize,
      color: { r: rgb.r, g: rgb.g, b: rgb.b, a: 1 },
      position: { x: 0, y: 2.5, z: 0 },
      align: "center",
      maxWidth: 12,
    });

    // Instruction label
    scene.createLabel({
      text: "Use the controls below",
      sizePx: 24,
      color: { r: 0.6, g: 0.6, b: 0.6, a: 1 },
      position: { x: 0, y: 4.5, z: 0 },
      align: "center",
    });

    // Create HTML controls overlay
    this._createControls();
  }

  update(_deltaTime: number): void {
    // No continuous updates - driven by user input
  }

  cleanup(): void {
    if (this._uiContainer && this._uiContainer.parentNode) {
      this._uiContainer.remove();
    }
    this._uiContainer = null;
  }

  private _createControls(): void {
    this._uiContainer = document.createElement("div");
    this._uiContainer.id = "interactive-controls";
    this._uiContainer.innerHTML = `
      <style>
        #interactive-controls {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.9);
          padding: 20px 25px;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          z-index: 200;
          min-width: 340px;
          backdrop-filter: blur(10px);
          box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);
        }
        #interactive-controls .control-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        #interactive-controls label {
          color: #aaa;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        #interactive-controls input[type="text"] {
          padding: 12px;
          font-size: 16px;
          border: none;
          border-radius: 8px;
          background: #2a2a4a;
          color: white;
          outline: none;
        }
        #interactive-controls input[type="text"]:focus {
          box-shadow: 0 0 0 2px #4a90d9;
        }
        #interactive-controls input[type="range"] {
          width: 100%;
          height: 8px;
          border-radius: 4px;
          background: #2a2a4a;
          outline: none;
          -webkit-appearance: none;
        }
        #interactive-controls input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #4a90d9;
          cursor: pointer;
        }
        #interactive-controls .value-display {
          color: #4a90d9;
          font-weight: bold;
          margin-left: 8px;
        }
        #interactive-controls .button-row {
          display: flex;
          gap: 10px;
          margin-top: 4px;
        }
        #interactive-controls button {
          flex: 1;
          padding: 12px 16px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          border-radius: 8px;
          background: linear-gradient(135deg, #4a90d9, #357abd);
          color: white;
          transition: transform 0.1s, box-shadow 0.1s;
        }
        #interactive-controls button:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(74, 144, 217, 0.4);
        }
        #interactive-controls button:active {
          transform: translateY(0);
        }
      </style>

      <div class="control-row">
        <label>Text Content</label>
        <input type="text" id="text-input" value="${this._currentText}" placeholder="Enter text...">
      </div>

      <div class="control-row">
        <label>Font Size <span class="value-display" id="size-value">${this._currentSize}px</span></label>
        <input type="range" id="size-slider" min="12" max="72" value="${this._currentSize}">
      </div>

      <div class="control-row">
        <label>Color Hue <span class="value-display" id="hue-value">${this._currentHue}°</span></label>
        <input type="range" id="hue-slider" min="0" max="360" value="${this._currentHue}">
      </div>

      <div class="button-row">
        <button id="btn-rainbow">Rainbow</button>
        <button id="btn-pulse">Pulse</button>
        <button id="btn-random">Random</button>
      </div>
    `;
    document.body.appendChild(this._uiContainer);

    // Wire up event listeners
    const textInput = document.getElementById(
      "text-input"
    ) as HTMLInputElement;
    const sizeSlider = document.getElementById(
      "size-slider"
    ) as HTMLInputElement;
    const hueSlider = document.getElementById(
      "hue-slider"
    ) as HTMLInputElement;
    const sizeValue = document.getElementById("size-value")!;
    const hueValue = document.getElementById("hue-value")!;

    // Text input
    textInput.addEventListener("input", () => {
      this._currentText = textInput.value || " ";
      this._mainLabel.text = this._currentText;
    });

    // Size slider
    sizeSlider.addEventListener("input", () => {
      this._currentSize = parseInt(sizeSlider.value);
      this._mainLabel.sizePx = this._currentSize;
      sizeValue.textContent = `${this._currentSize}px`;
    });

    // Hue slider
    hueSlider.addEventListener("input", () => {
      this._currentHue = parseInt(hueSlider.value);
      this._updateColor();
      hueValue.textContent = `${this._currentHue}°`;
    });

    // Rainbow button
    document.getElementById("btn-rainbow")!.addEventListener("click", () => {
      this._animateRainbow();
    });

    // Pulse button
    document.getElementById("btn-pulse")!.addEventListener("click", () => {
      this._animatePulse();
    });

    // Random button
    document.getElementById("btn-random")!.addEventListener("click", () => {
      const words = [
        "Dynamic",
        "Text",
        "Babylon",
        "MSDF",
        "Demo",
        "Fast",
        "GPU",
        "Render",
      ];
      const count = 2 + Math.floor(Math.random() * 2);
      const randomText = Array.from(
        { length: count },
        () => words[Math.floor(Math.random() * words.length)]
      ).join(" ");
      this._currentText = randomText;
      this._mainLabel.text = randomText;
      textInput.value = randomText;
    });
  }

  private _updateColor(): void {
    const rgb = hslToRgb(this._currentHue, 0.9, 0.6);
    this._mainLabel.color = { r: rgb.r, g: rgb.g, b: rgb.b, a: 1 };
  }

  private _animateRainbow(): void {
    let frame = 0;
    const duration = 60;
    const startHue = this._currentHue;

    const animate = () => {
      if (frame >= duration) {
        this._currentHue = startHue;
        this._updateColor();
        return;
      }

      const hue = (startHue + (frame / duration) * 360) % 360;
      const rgb = hslToRgb(hue, 1, 0.6);
      this._mainLabel.color = { r: rgb.r, g: rgb.g, b: rgb.b, a: 1 };

      frame++;
      requestAnimationFrame(animate);
    };
    animate();
  }

  private _animatePulse(): void {
    let frame = 0;
    const duration = 30;
    const baseSize = this._currentSize;

    const animate = () => {
      if (frame >= duration) {
        this._mainLabel.sizePx = baseSize;
        return;
      }

      const t = frame / duration;
      const scale = 1 + Math.sin(t * Math.PI) * 0.5;
      this._mainLabel.sizePx = baseSize * scale;

      frame++;
      requestAnimationFrame(animate);
    };
    animate();
  }
}
