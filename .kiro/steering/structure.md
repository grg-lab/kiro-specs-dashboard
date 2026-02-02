# Project Structure

## Repository Layout

```
.
├── .git/                      # Git repository
├── .kiro/                     # Kiro IDE configuration
│   ├── specs/                 # Spec examples/demos
│   │   └── kiro-specs-dashboard/
│   └── steering/              # AI assistant guidance (this folder)
├── index.html                 # Main dashboard application
├── readme.html                # Documentation viewer
├── serve.sh                   # Server startup script
└── README.md                  # Project documentation
```

## Key Files

### index.html
Single-file application containing:
- Complete HTML structure
- All CSS styles (in `<style>` tag)
- All JavaScript logic (in `<script>` tag)
- External CDN library imports

Self-contained and portable - can be copied anywhere and run independently.

### readme.html
Standalone documentation viewer that renders README.md with:
- Markdown parsing
- Syntax highlighting
- Responsive layout

### serve.sh
Bash script that auto-detects and starts a local web server using Python 3, Python 2, or PHP.

### README.md
Comprehensive documentation covering:
- Features and capabilities
- Quick start guide
- Usage instructions
- Browser compatibility
- Troubleshooting

## Expected Spec Directory Structure

The dashboard expects to read from `.kiro/specs/` directories with this format:

```
.kiro/specs/
├── feature-name-1/
│   ├── tasks.md           # Required
│   ├── requirements.md    # Optional
│   └── design.md          # Optional
├── feature-name-2/
│   └── tasks.md
└── feature-name-3/
    ├── tasks.md
    ├── requirements.md
    └── design.md
```

## Code Organization (within index.html)

### CSS Structure
- CSS variables for theming
- Component-based styling (cards, modals, buttons, etc.)
- Responsive design with media queries
- Markdown content styling
- Syntax highlighting theme overrides

### JavaScript Structure
- Global state management (allSpecs, currentDirHandle, filteredSpecs)
- File System Access API functions
- Storage functions (localStorage, IndexedDB)
- Spec parsing and display logic
- Modal and tab management
- Filtering and pagination
- Markdown rendering with Mermaid support

## Conventions

- **Naming**: kebab-case for spec folder names (e.g., `user-authentication`)
- **Task Format**: Markdown checkboxes (`- [ ]` pending, `- [x]` completed, `- [ ]*` optional)
- **No Build Process**: Direct file editing, no transpilation or bundling
- **Browser-First**: All features designed for modern browser APIs
