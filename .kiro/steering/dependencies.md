# Dependencies

## Production Dependencies

### @vscode/codicons (^0.0.35)
- VSCode icon font for consistent UI
- Used in webview for file type icons
- Loaded via webview URI

## Development Dependencies

### Core Build Tools

- **typescript (^5.0.0)**: TypeScript compiler
- **@types/node (^18.x)**: Node.js type definitions
- **@types/vscode (^1.74.0)**: VSCode API type definitions

### Testing

- **jest (^29.5.0)**: Test framework
- **ts-jest (^29.1.0)**: TypeScript support for Jest
- **fast-check (^3.15.0)**: Property-based testing library
- **mocha (^10.2.0)**: Alternative test framework
- **@vscode/test-electron (^2.3.0)**: VSCode extension testing

### Linting

- **eslint (^8.0.0)**: JavaScript/TypeScript linter
- **@typescript-eslint/eslint-plugin (^6.0.0)**: TypeScript ESLint rules
- **@typescript-eslint/parser (^6.0.0)**: TypeScript parser for ESLint

### Utilities

- **glob (^8.1.0)**: File pattern matching
- **@types/glob (^8.1.0)**: Type definitions for glob
- **@types/jest (^29.5.0)**: Type definitions for Jest
- **@types/mocha (^10.0.0)**: Type definitions for Mocha

## Webview Libraries (CDN)

These are loaded in the webview via CDN, not npm:

- **marked.js (v11.1.1)**: Markdown parsing
- **highlight.js (v11.9.0)**: Syntax highlighting
- **mermaid.js (v10.6.1)**: Diagram rendering

## Version Requirements

- **Node.js**: 18.x or higher
- **VSCode**: 1.74.0 or higher
- **npm**: 8.x or higher

## Updating Dependencies

```bash
# Check for outdated packages
npm outdated

# Update all dependencies
npm update

# Update specific package
npm install <package>@latest --save-dev

# Audit for vulnerabilities
npm audit
npm audit fix
```

## Dependency Management

- Keep dependencies minimal
- Prefer VSCode built-in APIs over external libraries
- Use exact versions for critical dependencies
- Regular security audits
- Document why each dependency is needed
