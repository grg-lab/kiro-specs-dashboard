# Development Guidelines

## Project Setup

```bash
npm install          # Install dependencies
npm run compile      # Compile TypeScript
npm run watch        # Watch mode for development
```

## Testing the Extension

1. **Debug Mode**: Press F5 to launch Extension Development Host
2. **Package**: `npx vsce package` to create .vsix file
3. **Install**: Right-click .vsix → Install Extension VSIX

## Code Style

- **TypeScript**: Strict mode enabled
- **Naming**: camelCase for variables/functions, PascalCase for classes/types
- **Comments**: JSDoc for public APIs, inline for complex logic
- **Error Handling**: Try-catch with detailed logging to output channel

## File Organization

```
src/
├── extension.ts              # Extension activation/deactivation
├── specScanner.ts           # Spec file scanning logic
├── specsDashboardProvider.ts # Webview provider
├── stateManager.ts          # State persistence
├── types.ts                 # Type definitions
└── webview/
    └── dashboard.html       # Webview UI (all-in-one)
```

## Common Tasks

### Adding a New Command

1. Register in `package.json` contributes.commands
2. Implement handler in `extension.ts`
3. Add to context.subscriptions for disposal

### Modifying the Webview

1. Edit `src/webview/dashboard.html`
2. Recompile: `npm run compile`
3. Reload Extension Development Host

### Adding a New Message Type

1. Define type in `types.ts` (WebviewMessage or ExtensionMessage)
2. Add handler in `specsDashboardProvider.ts` handleMessage()
3. Add sender in webview JavaScript

## Debugging

- **Extension Host**: Use VSCode debugger (F5)
- **Webview**: Right-click webview → "Open Webview Developer Tools"
- **Logs**: Check "Specs Dashboard" output channel

## Performance Considerations

- Debounce file watcher events (300ms)
- Defer updates when webview is hidden
- Use efficient markdown parsing
- Minimize DOM updates in webview
