# Architecture

## Extension Architecture

This is a native VSCode extension built with TypeScript that provides a webview-based dashboard for visualizing Kiro specs.

### Core Components

1. **Extension Host (Node.js)**
   - `extension.ts` - Entry point, command registration, file watchers
   - `specScanner.ts` - File system scanning and markdown parsing
   - `stateManager.ts` - Persistent state management
   - `specsDashboardProvider.ts` - Webview lifecycle and message handling
   - `types.ts` - TypeScript type definitions

2. **Webview (Browser)**
   - `dashboard.html` - Single-file webview UI with embedded CSS/JS
   - Markdown rendering (marked.js)
   - Syntax highlighting (highlight.js)
   - Diagram rendering (mermaid.js)

### Communication Flow

```
User Action → Webview → Message → Extension Host → File System
                ↓                        ↓
            Update UI ← Message ← Process Result
```

### Key Design Patterns

- **Message Passing**: Webview and extension host communicate via postMessage API
- **File System Watcher**: Debounced file watching for real-time updates
- **State Persistence**: VSCode Memento API for workspace-scoped state
- **Resource Disposal**: Proper cleanup via context.subscriptions

### Security Model

- Content Security Policy (CSP) for webview
- Input sanitization for file paths and user data
- Path traversal prevention
- Message origin validation

## Multi-Root Workspace Support

- Scans all workspace folders independently
- Per-workspace-folder state isolation
- Automatic cleanup when folders are removed
- Workspace folder name displayed in spec cards
