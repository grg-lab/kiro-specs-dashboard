# Extension Icon

## Current Icon

The extension uses `icon.svg` for the activity bar view container.

## Marketplace Icon

For the VSCode marketplace, a PNG icon is required at `media/icon.png` (128x128 pixels).

### Generating the PNG Icon

To generate the PNG from the SVG, you can use one of these methods:

#### Method 1: Using ImageMagick (Command Line)
```bash
convert -background none -size 128x128 media/icon.svg media/icon.png
```

#### Method 2: Using Inkscape (Command Line)
```bash
inkscape media/icon.svg --export-type=png --export-filename=media/icon.png --export-width=128 --export-height=128
```

#### Method 3: Using Online Tools
1. Open https://cloudconvert.com/svg-to-png
2. Upload `media/icon.svg`
3. Set dimensions to 128x128
4. Download as `icon.png` and place in `media/` directory

#### Method 4: Using VSCode Extension
1. Install "SVG to PNG Converter" extension
2. Right-click on `icon.svg`
3. Select "Convert SVG to PNG"
4. Rename output to `icon.png`

## Icon Design

The icon features:
- Blue background (#007ACC) matching VSCode's brand color
- Four white rounded squares representing a dashboard grid
- Green progress bars (#4CAF50) indicating task tracking
- Simple, clean design that scales well at different sizes

## Theme Colors

The extension uses VSCode's native theme colors and doesn't define custom theme colors. This ensures the extension adapts to any VSCode theme automatically.
