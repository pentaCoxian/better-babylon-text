import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import {
  createTmpTextSystem,
  type ITmpTextSystem,
  type ITextLabel,
  type TextLabelOptions,
} from "@bettertext/babylon-tmp-text";
import type { IDemo } from "./demos";

export class DemoScene {
  public scene: Scene;
  public camera: ArcRotateCamera;
  public textSystem!: ITmpTextSystem;

  private _currentDemo: IDemo | null = null;
  private _labels: ITextLabel[] = [];

  constructor(
    public engine: Engine,
    private _canvas: HTMLCanvasElement
  ) {
    this.scene = new Scene(engine);
    this.scene.clearColor.set(0.1, 0.1, 0.15, 1);

    // Setup arc rotate camera
    this.camera = new ArcRotateCamera(
      "camera",
      -Math.PI / 2,
      Math.PI / 3,
      15,
      Vector3.Zero(),
      this.scene
    );
    this.camera.attachControl(this._canvas, true);
    this.camera.wheelPrecision = 50;
    this.camera.lowerRadiusLimit = 3;
    this.camera.upperRadiusLimit = 50;
    this.camera.minZ = 0.1;

    // Setup lighting
    const light = new HemisphericLight(
      "light",
      new Vector3(0, 1, 0),
      this.scene
    );
    light.intensity = 0.9;
    light.groundColor = new Color3(0.2, 0.2, 0.3);

    // Create ground plane for reference
    this._createGround();
  }

  async initialize(): Promise<void> {
    this.textSystem = await createTmpTextSystem(this.scene, {
      fonts: ["/fonts/BitcountPropSingle.json"],
      initialCapacity: 2048,
      compactionThreshold: 0.3,
      autoAttach: true,
    });
    console.log("Text system initialized, loaded fonts:", this.textSystem.loadedFonts);
  }

  async setDemo(demo: IDemo): Promise<void> {
    // Cleanup previous demo
    if (this._currentDemo) {
      this._currentDemo.cleanup();
    }

    // Dispose all labels
    for (const label of this._labels) {
      label.dispose();
    }
    this._labels = [];

    // Initialize new demo
    this._currentDemo = demo;
    await demo.setup(this);
  }

  createLabel(options?: TextLabelOptions): ITextLabel {
    const label = this.textSystem.createLabel(options);
    this._labels.push(label);
    console.log("Created label:", options?.text, "Total labels:", this._labels.length, "System count:", this.textSystem.labelCount);
    return label;
  }

  removeLabel(label: ITextLabel): void {
    const index = this._labels.indexOf(label);
    if (index !== -1) {
      this._labels.splice(index, 1);
      label.dispose();
    }
  }

  update(): void {
    const deltaTime = this.engine.getDeltaTime() / 1000;
    this._currentDemo?.update(deltaTime);
  }

  getStats() {
    return {
      labelCount: this.textSystem.labelCount,
      allocatorStats: this.textSystem.getStats(),
      fps: this.engine.getFps(),
    };
  }

  private _createGround(): void {
    const ground = MeshBuilder.CreateGround(
      "ground",
      { width: 30, height: 30, subdivisions: 1 },
      this.scene
    );
    const material = new StandardMaterial("groundMat", this.scene);
    material.diffuseColor = new Color3(0.12, 0.12, 0.18);
    material.specularColor = new Color3(0, 0, 0);
    ground.material = material;
    ground.position.y = -0.01;
  }
}
