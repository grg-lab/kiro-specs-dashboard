# Technical Stack

## Architecture

Single-page application (SPA) with no backend dependencies. All processing happens client-side in the browser.

## Technologies

- **Vanilla JavaScript**: No frameworks, pure ES6+ JavaScript
- **HTML5 File System Access API**: For directory selection and file reading
- **Browser Storage**:
  - `localStorage`: Project metadata persistence
  - `IndexedDB`: Directory handle storage
- **External Libraries** (CDN):
  - `marked.js` (v11.1.1): GitHub Flavored Markdown parsing
  - `highlight.js` (v11.9.0): Syntax highlighting for 190+ languages
  - `mermaid.js` (v10.6.1): Diagram rendering

## Browser Requirements

- Chrome 86+
- Edge 86+
- Firefox 111+
- Safari 15.4+

File System Access API is required for directory selection.

## File Structure

```
.
├── index.html          # Main dashboard (all-in-one file)
├── readme.html         # Documentation viewer
├── serve.sh           # Quick server start script
└── README.md          # Documentation source
```

## Common Commands

### Start Local Server

```bash
# Using provided script (recommended)
./serve.sh

# Manual options
python3 -m http.server 8080
python -m SimpleHTTPServer 8080
php -S localhost:8080
npx http-server -p 8080
```

### Access Dashboard

```
http://localhost:8080
```

**Important**: Must use `http://` protocol (not `file://`) for localStorage/IndexedDB to work.

## Development Notes

- All code is in `index.html` - CSS in `<style>` tag, JavaScript in `<script>` tag
- No build process or compilation required
- No package.json or node_modules
- Changes take effect immediately on page refresh
