# Conventions

## Spec File Structure

### Directory Layout

```
.kiro/specs/
└── feature-name/           # kebab-case
    ├── tasks.md           # Required
    ├── requirements.md    # Optional
    └── design.md          # Optional
```

### Task Format

**Checkbox States**:
- `- [ ]` - Not started
- `- [x]` - Completed
- `- [~]` - In progress (counts as incomplete)
- `- [-]` - Queued (counts as incomplete)

**Optional Tasks**:
- `- [ ]*` - Optional not started
- `- [x]*` - Optional completed

**Example**:
```markdown
# Tasks

- [x] 1. Setup project
- [ ] 2. Implement feature
  - [x] 2.1 Create component
  - [ ] 2.2 Add tests
- [ ]* 3. Optional: Add documentation
```

## Naming Conventions

- **Spec folders**: kebab-case (e.g., `user-authentication`)
- **TypeScript files**: camelCase (e.g., `specScanner.ts`)
- **Classes**: PascalCase (e.g., `SpecScanner`)
- **Interfaces**: PascalCase (e.g., `SpecFile`)
- **Variables/Functions**: camelCase (e.g., `scanWorkspace`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `DEBOUNCE_DELAY_MS`)

## Git Workflow

### Commit Messages

Format: `<type>: <description>`

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Build/tooling changes

Examples:
- `feat: Add notes panel to spec cards`
- `fix: Resolve task toggle race condition`
- `docs: Update README with installation steps`

### Branch Strategy

- `main` - Production-ready code
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates

## Code Documentation

### JSDoc Comments

```typescript
/**
 * Brief description of function
 * 
 * Detailed explanation if needed.
 * 
 * @param paramName Description of parameter
 * @returns Description of return value
 * 
 * Requirements: 1.1, 2.3 (reference spec requirements)
 */
```

### Inline Comments

- Explain "why", not "what"
- Document complex algorithms
- Note security considerations
- Reference requirement IDs when relevant
