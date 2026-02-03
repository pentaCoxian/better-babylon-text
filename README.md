# betterText

**TMP-like retained-mode text rendering for Babylon.js with GPU-accelerated MSDF rendering.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

betterText provides crisp, scalable text rendering in Babylon.js 3D scenes using Multi-channel Signed Distance Field (MSDF) technology. It offers an intuitive API inspired by Unity's TextMeshPro, with a retained-mode architecture optimized for performance.

## Features

- **Retained-mode API** - Simply set `label.text = "Hello"` and only that label updates efficiently
- **GPU MSDF Rendering** - Crisp text at any scale with minimal draw calls
- **Efficient Updates** - Dirty tracking ensures only changed labels trigger CPU/GPU work
- **Font Fallback Chains** - Support for multiple fonts with automatic fallback
- **CJK Ready** - Architecture supports large character sets (Japanese, Chinese, Korean)
- **Billboard Modes** - Screen-facing text with multiple projection options
- **TypeScript First** - Full type definitions included

## Installation

```bash
npm install https://github.com/pentaCoxian/better-babylon-text/releases/download/v0.1.2/bettertext-babylon-tmp-text-v0.1.2.tgz
```

**Peer Dependencies:**
- `@babylonjs/core` ^7.0.0 or ^8.0.0

## Quick Start

```typescript
import { TmpTextSystem } from '@bettertext/babylon-tmp-text';
import { Scene } from '@babylonjs/core';

// Initialize the text system
const textSystem = new TmpTextSystem(scene);

// Load a font pack
await textSystem.loadFontPack('fonts/roboto/manifest.json');

// Create a text label
const label = textSystem.createLabel({
  text: 'Hello, World!',
  sizePx: 48,
  color: [1, 1, 1, 1], // RGBA
  position: [0, 2, 0],
});

// Update text reactively
label.text = 'Updated text!';
label.color = [1, 0, 0, 1]; // Change to red
```

## API Reference

### TmpTextSystem

The main entry point for the text rendering system.

```typescript
const textSystem = new TmpTextSystem(scene: Scene);
```

**Methods:**

| Method | Description |
|--------|-------------|
| `loadFontPack(url: string)` | Load a font pack from a manifest URL |
| `createLabel(options: LabelOptions)` | Create a new text label |
| `removeLabel(label: TextLabel)` | Remove a label from the scene |
| `getStats()` | Get performance statistics |
| `dispose()` | Clean up all resources |

### TextLabel

Individual text labels created by the system.

**Core Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `text` | `string` | The text content to display |
| `color` | `[r, g, b, a]` | Text color (0-1 range) |
| `sizePx` | `number` | Font size in pixels |
| `maxWidth` | `number` | Maximum width before wrapping |
| `align` | `'left' \| 'center' \| 'right'` | Text alignment |
| `visible` | `boolean` | Show/hide the label |

**Transform Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `position` | `[x, y, z]` | World position |
| `rotation` | `[x, y, z]` | Euler rotation (radians) |
| `scale` | `[x, y, z]` | Scale factor |
| `parent` | `TransformNode \| null` | Parent node for hierarchy |
| `worldMatrix` | `Matrix` | Computed world transformation |

**Stroke Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `strokeColor` | `[r, g, b, a]` | Outline color |
| `strokeWidth` | `number` | Outline thickness |
| `strokeInsetWidth` | `number` | Inset outline thickness |

**Layout Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `lineHeight` | `number` | Line height multiplier |
| `letterSpacing` | `number` | Character spacing |

**Billboard Modes:**

```typescript
import { BillboardMode } from '@bettertext/babylon-tmp-text';

label.billboardMode = BillboardMode.None;              // No billboarding
label.billboardMode = BillboardMode.Billboard;         // Face camera
label.billboardMode = BillboardMode.BillboardScreenProjected; // Screen-space projection
```

## Font Preparation

betterText uses MSDF fonts for rendering. You can generate these from TTF/OTF files using [msdf-bmfont-xml](https://github.com/soimy/msdf-bmfont-xml):

```bash
npx msdf-bmfont-xml -f json -m 512,512 -s 48 --smart-size ./fonts/MyFont.ttf
```

This generates:
- `MyFont.json` - Font metrics and glyph data
- `MyFont.png` - MSDF texture atlas

### Font Pack Manifest

For multiple fonts or fallback chains, create a manifest:

```json
{
  "fonts": [
    {
      "name": "primary",
      "json": "roboto.json",
      "atlas": "roboto.png"
    },
    {
      "name": "cjk-fallback",
      "json": "noto-cjk.json",
      "atlas": "noto-cjk.png",
      "coverage": [[0x4E00, 0x9FFF]]
    }
  ]
}
```

## Performance

betterText is designed for high-performance scenarios:

- **Target:** 1,000+ labels with 10% updating per frame at 60fps
- **Free-list allocator** for efficient GPU buffer reuse
- **Dirty range tracking** for minimal GPU uploads
- **Auto-compaction** to prevent buffer fragmentation

### Performance Tips

1. **Batch creation** - Create multiple labels before the first render when possible
2. **Reuse labels** - Update `text` instead of destroying/recreating labels
3. **Limit updates** - Only modify properties that actually change
4. **Use visibility** - Set `visible = false` instead of removing labels you'll reuse

## Project Structure

```
betterText/
├── packages/
│   ├── runtime/          # Main library (@bettertext/babylon-tmp-text)
│   │   ├── src/
│   │   │   ├── system/   # TmpTextSystem
│   │   │   ├── objects/  # TextLabel
│   │   │   ├── core/     # Types, constants
│   │   │   ├── fonts/    # Font loading & management
│   │   │   ├── extended/ # Retained-mode renderer
│   │   │   └── allocator/# Buffer management
│   │   └── tests/
│   └── demo/             # Interactive demos
└── .github/workflows/    # CI/CD
```

## Development

### Prerequisites

- Node.js >= 18.0.0
- npm

### Setup

```bash
# Clone the repository
git clone https://github.com/pentaCoxian/better-babylon-text.git
cd betterText

# Install dependencies
npm ci

# Build the runtime library
npm run build:runtime

# Run tests
npm test --workspace=@bettertext/babylon-tmp-text

# Type checking
npm run typecheck --workspace=@bettertext/babylon-tmp-text
```

### Running the Demo

```bash
# Start development server
npm run dev:demo

# Build for production
npm run build:demo
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build all packages |
| `npm run build:runtime` | Build the runtime library |
| `npm run build:demo` | Build the demo application |
| `npm run dev:demo` | Start demo dev server |
| `npm test` | Run all tests |
| `npm run typecheck` | Run TypeScript type checking |

## Demos

The demo package includes several examples:

| Demo | Description |
|------|-------------|
| **BillboardDemo** | Compare different billboard rendering modes |
| **InteractiveDemo** | Interactive text manipulation |
| **MassUpdateDemo** | Performance test with many labels |
| **PropertyAnimationDemo** | Animate text properties |
| **TimerCounterDemo** | Dynamic text updates |

## Architecture

```
TmpTextSystem
  ├── Manages TextLabel instances
  ├── Handles FontPack loading and FallbackChain
  ├── One TextRendererEx per font pack
  │   ├── FreeListAllocator (buffer management)
  │   ├── DirtyRangeTracker (partial GPU updates)
  │   └── Retained-mode paragraph storage
  └── Integrates with Babylon.js render loop

TextLabel
  └── Reactive properties trigger efficient updates
  └── Linked to renderer via ParagraphHandle
  └── Automatic dirty flag management
```

## Browser Support

betterText supports all browsers that support WebGL 2.0 or WebGPU:

- Chrome 56+
- Firefox 51+
- Safari 15+
- Edge 79+

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- MSDF text rendering vendored from [@babylonjs/addons](https://github.com/BabylonJS/Babylon.js) (Apache License 2.0)
- Inspired by [TextMeshPro](https://docs.unity3d.com/Packages/com.unity.textmeshpro@latest) for Unity
