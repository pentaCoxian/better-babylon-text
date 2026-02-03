# Font Assets

This directory should contain MSDF font files for the demo.

## Required Files

- `BitcountPropSingle.json` - BMFont JSON metrics (included as template)
- `BitcountPropSingle.png` - MSDF texture atlas (**YOU NEED TO GENERATE THIS**)

## Generating via CLI

You can also generate MSDF fonts using `msdf-bmfont-xml`:

```bash
# Install the tool globally
npm install -g msdf-bmfont-xml

# Download Roboto font
curl -o Roboto-Regular.ttf "https://github.com/google/fonts/raw/main/ofl/roboto/Roboto-Regular.ttf"

# Generate MSDF font
msdf-bmfont -f json -m 256,256 --font-size 42 -o roboto-msdf Roboto-Regular.ttf
```

This creates:
- `roboto-msdf.json` - Glyph metrics and atlas layout
- `roboto-msdf.png` - Multi-channel signed distance field texture

## Font Format

The JSON file follows BMFont format with these key fields:
- `pages` - Array of texture filenames
- `chars` - Array of character metrics (id, x, y, width, height, xoffset, yoffset, xadvance)
- `common` - Common font metrics (lineHeight, base, scaleW, scaleH)
- `distanceField` - MSDF-specific settings (fieldType: "msdf", distanceRange: 4)
