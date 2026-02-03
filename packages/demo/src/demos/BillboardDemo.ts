import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { BillboardMode, type ITextLabel } from "@bettertext/babylon-tmp-text";
import type { IDemo } from "./index";
import type { DemoScene } from "../DemoScene";

interface BillboardSetup {
  x: number;
  mode: BillboardMode;
  name: string;
  description: string;
  color: Color3;
}

/**
 * Demo comparing billboard modes:
 * - None: Fixed orientation
 * - Billboard: Always faces camera
 * - BillboardScreenProjected: Screen-space sizing
 */
export class BillboardDemo implements IDemo {
  name = "Billboard Modes";
  description = `
Compare billboard options:
- None: Fixed in 3D space
- Billboard: Always faces camera
- Screen Projected: Screen-space size

Rotate the camera to observe differences!`;

  private _meshes: Mesh[] = [];
  private _labels: ITextLabel[] = [];
  private _time = 0;
  private _scene!: DemoScene;

  async setup(scene: DemoScene): Promise<void> {
    this._scene = scene;
    this._meshes = [];
    this._labels = [];
    this._time = 0;

    const setups: BillboardSetup[] = [
      {
        x: -5,
        mode: BillboardMode.None,
        name: "No Billboard",
        description: "Fixed in 3D",
        color: new Color3(0.8, 0.3, 0.3),
      },
      {
        x: 0,
        mode: BillboardMode.Billboard,
        name: "Billboard",
        description: "Faces camera",
        color: new Color3(0.3, 0.8, 0.3),
      },
      {
        x: 5,
        mode: BillboardMode.BillboardScreenProjected,
        name: "Screen Projected",
        description: "Screen-space",
        color: new Color3(0.3, 0.3, 0.8),
      },
    ];

    for (const setup of setups) {
      // Create reference cube
      const cube = MeshBuilder.CreateBox(
        `cube-${setup.mode}`,
        { size: 1.2 },
        scene.scene
      );
      cube.position.set(setup.x, 1, 0);

      const material = new StandardMaterial(`mat-${setup.mode}`, scene.scene);
      material.diffuseColor = setup.color;
      material.specularColor = new Color3(0.3, 0.3, 0.3);
      cube.material = material;
      this._meshes.push(cube);

      // Main label above cube
      const nameLabel = scene.createLabel({
        text: setup.name,
        sizePx: 32,
        color: { r: 1, g: 1, b: 1, a: 1 },
        position: { x: setup.x, y: 2.4, z: 0 },
        billboard: setup.mode,
        align: "center",
        strokeWidth: 0.08,
        strokeColor: { r: 0, g: 0, b: 0, a: 1 },
      });
      this._labels.push(nameLabel);

      // Description label
      const descLabel = scene.createLabel({
        text: setup.description,
        sizePx: 20,
        color: { r: 0.7, g: 0.7, b: 0.7, a: 1 },
        position: { x: setup.x, y: 2.0, z: 0 },
        billboard: setup.mode,
        align: "center",
      });
      this._labels.push(descLabel);

      // Mode value label
      const modeLabel = scene.createLabel({
        text: `mode: ${setup.mode}`,
        sizePx: 16,
        color: {
          r: setup.color.r,
          g: setup.color.g,
          b: setup.color.b,
          a: 1,
        },
        position: { x: setup.x, y: -0.3, z: 0 },
        billboard: setup.mode,
        align: "center",
      });
      this._labels.push(modeLabel);
    }

    // Instruction label (uses billboard mode so it's always readable)
    const instructionLabel = scene.createLabel({
      text: "Drag to rotate camera and observe label behavior",
      sizePx: 28,
      color: { r: 1, g: 1, b: 0.6, a: 1 },
      position: { x: 0, y: 4.5, z: 0 },
      align: "center",
      billboard: BillboardMode.Billboard,
    });
    this._labels.push(instructionLabel);

    // Distance indicator
    const distanceLabel = scene.createLabel({
      text: "Move closer/further to see screen projection effect",
      sizePx: 20,
      color: { r: 0.6, g: 0.8, b: 1, a: 1 },
      position: { x: 0, y: 3.8, z: 0 },
      align: "center",
      billboard: BillboardMode.Billboard,
    });
    this._labels.push(distanceLabel);
  }

  update(deltaTime: number): void {
    this._time += deltaTime;

    // Slowly rotate cubes to emphasize 3D nature
    for (const mesh of this._meshes) {
      mesh.rotation.y = this._time * 0.4;
      mesh.rotation.x = Math.sin(this._time * 0.3) * 0.2;
    }
  }

  cleanup(): void {
    for (const mesh of this._meshes) {
      mesh.dispose();
    }
    this._meshes = [];
    this._labels = [];
  }
}
