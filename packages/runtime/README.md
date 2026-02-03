# @bettertext/babylon-tmp-text

TMP (Text Mesh Pro)-like retained-mode text rendering for Babylon.js with GPU MSDF (Multi-channel Signed Distance Field) rendering.

## Features

- **Retained-mode API**: TMP-like API where `label.text = "..."` updates only that label
- **GPU MSDF rendering**: Crisp, scalable text with minimal draw calls
- **Efficient updates**: Only CPU/GPU work for changed labels
- **Font pack system**: Support for multiple fonts with fallback chains
- **Japanese/CJK ready**: Architecture supports large character sets via font packing

## Installation

```bash
npm install @bettertext/babylon-tmp-text @babylonjs/core
```

## Quick Start

```typescript
import { createTmpTextSystem } from "@bettertext/babylon-tmp-text";
import { Scene, Engine, ArcRotateCamera } from "@babylonjs/core";

// Create Babylon scene
const engine = new Engine(canvas);
const scene = new Scene(engine);
const camera = new ArcRotateCamera("camera", 0, 0, 10, Vector3.Zero(), scene);

// Create text system
const textSystem = await createTmpTextSystem(scene, {
  fonts: ["/fonts/roboto.json"], // BMFont JSON URL
});

// Create a text label
const label = textSystem.createLabel({
  text: "Hello, Babylon!",
  sizePx: 48,
  color: { r: 1, g: 1, b: 1, a: 1 },
  position: { x: 0, y: 2, z: 0 },
});

// Update text dynamically (efficient - only updates this label)
label.text = "Updated text!";
label.color = { r: 1, g: 0.5, b: 0, a: 1 };

// Render loop
engine.runRenderLoop(() => {
  scene.render();
});
```

## API Reference

### TmpTextSystem

Main entry point for text rendering.

```typescript
const system = await createTmpTextSystem(scene, {
  fonts: string[];           // Font manifest URLs
  fallback?: string[];       // Fallback order (font IDs)
  initialCapacity?: number;  // Initial buffer size (default: 128)
  compactionThreshold?: number; // Auto-compact threshold (default: 0.3)
  autoAttach?: boolean;      // Auto-attach to render loop (default: true)
});
```

### TextLabel

Individual text object with TMP-like properties.

```typescript
const label = system.createLabel({
  text?: string;             // Text content
  sizePx?: number;           // Font size in pixels
  color?: IColor4Like;       // Text color
  strokeColor?: IColor4Like; // Stroke/outline color
  strokeWidth?: number;      // Stroke width
  maxWidth?: number;         // Max width for wrapping
  align?: "left" | "center" | "right";
  lineHeight?: number;       // Line height multiplier
  position?: { x, y, z };    // World position
  rotation?: { x, y, z };    // Euler rotation
  scale?: { x, y, z };       // Scale
  billboard?: BillboardMode; // Billboard mode
  parent?: TransformNode;    // Parent for transform inheritance
});

// Properties are reactive
label.text = "New text";     // Triggers efficient update
label.sizePx = 64;
label.dispose();             // Clean up
```

### FontPack

Load fonts from BMFont JSON or custom font pack manifests.

```typescript
// Simple: Single BMFont JSON
const system = await createTmpTextSystem(scene, {
  fonts: ["/fonts/roboto.json"],
});

// Advanced: Multiple font packs with fallback
const system = await createTmpTextSystem(scene, {
  fonts: [
    "/fonts/latin.pack/manifest.json",
    "/fonts/jp-common.pack/manifest.json",
  ],
  fallback: ["latin", "jp-common"],
});
```

## Font Preparation

This package expects fonts in BMFont JSON format with MSDF atlas textures. Use tools like:

- [msdf-bmfont-xml](https://github.com/soimy/msdf-bmfont-xml) - Generate MSDF fonts from TTF/OTF
- [msdfgen](https://github.com/Chlumsky/msdfgen) - Low-level MSDF generator

Example command:
```bash
msdf-bmfont -f json -m 2048,2048 -o ./fonts/roboto roboto.ttf
```

## Performance

- Designed for 1,000+ labels with 10% updating per frame at 60fps
- Uses free-list allocator for efficient buffer reuse
- Dirty range tracking for minimal GPU uploads
- Auto-compaction to prevent fragmentation

## Architecture

```
TmpTextSystem
  └── TextLabel (user-facing, reactive properties)
        └── TextRendererEx (retained-mode paragraph management)
              └── FreeListAllocator (buffer slot management)
              └── DirtyRangeTracker (partial upload tracking)
```

## License

MIT
