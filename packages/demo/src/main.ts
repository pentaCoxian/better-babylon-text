import { Engine } from "@babylonjs/core/Engines/engine";
import { DemoScene } from "./DemoScene";
import { DemoSelector } from "./ui/DemoSelector";
import { StatsPanel } from "./ui/StatsPanel";
import { demos } from "./demos";

async function main() {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
  });

  // Create demo scene
  const demoScene = new DemoScene(engine, canvas);
  await demoScene.initialize();

  // Create UI components
  const statsPanel = new StatsPanel(
    document.getElementById("stats-panel")!,
    demoScene
  );

  const demoSelector = new DemoSelector(
    document.getElementById("demo-select") as HTMLSelectElement,
    document.getElementById("description")!,
    demos,
    demoScene
  );

  // Start with first demo
  await demoSelector.selectDemo(0);

  // Render loop
  engine.runRenderLoop(() => {
    demoScene.update();
    demoScene.scene.render();
    statsPanel.update();
  });

  // Handle resize
  window.addEventListener("resize", () => {
    engine.resize();
  });
}

main().catch((err) => {
  console.error("Failed to initialize demo:", err);
  document.body.innerHTML = `
    <div style="color: red; padding: 20px; font-family: monospace;">
      <h2>Failed to initialize demo</h2>
      <pre>${err.message}</pre>
    </div>
  `;
});
