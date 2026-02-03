import type { IDemo } from "../demos";
import type { DemoScene } from "../DemoScene";

export class DemoSelector {
  constructor(
    private _select: HTMLSelectElement,
    private _description: HTMLElement,
    private _demos: IDemo[],
    private _scene: DemoScene
  ) {
    // Populate dropdown
    _demos.forEach((demo, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = demo.name;
      _select.appendChild(option);
    });

    // Wire up change event
    _select.addEventListener("change", async () => {
      await this.selectDemo(parseInt(_select.value));
    });
  }

  async selectDemo(index: number): Promise<void> {
    const demo = this._demos[index];
    if (!demo) return;

    this._select.value = String(index);
    this._description.innerHTML = `<strong>${demo.name}</strong>${demo.description}`;

    await this._scene.setDemo(demo);
  }
}
