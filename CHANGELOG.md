# Change Log

All notable changes to the "Kiro Specs Dashboard" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-31

### Added

- Initial release of Kiro Specs Dashboard extension
- Automatic spec discovery in `.kiro/specs/` directories
- Real-time file system monitoring with debouncing
- Interactive dashboard with progress tracking
- Multi-workspace support with state isolation
- Native IDE styling using VSCode design system
- Quick file access buttons for requirements.md, design.md, and tasks.md
- Notes feature for adding custom annotations to specs
- Search and filtering capabilities
- Persistent dashboard state per workspace
- Comprehensive error handling and user feedback
- Content Security Policy for webview security
- Property-based testing for correctness validation
- Unit tests for core functionality

### Features

#### Core Functionality
- Workspace scanning for `.kiro/specs/` directories
- Parsing of tasks.md (required), requirements.md (optional), and design.md (optional)
- Task statistics extraction (total, completed, optional, progress)
- File system watcher for automatic updates
- Debounced refresh to optimize performance

#### User Interface
- Sidebar view container in activity bar
- Spec cards with progress bars and task counts
- Search input for filtering by name or content
- Status filter buttons (All, Active, Done, Todo)
- Quick access buttons to open spec files in editor
- Notes feature for adding custom annotations and context to specs
- Empty state message when no specs found
- Error notifications with actionable messages

#### State Management
- Workspace-scoped state persistence
- Global preferences for cross-workspace settings
- Per-workspace-folder state isolation in multi-root workspaces
- Automatic state cleanup when workspace folders are removed

#### Performance Optimizations
- Debounced file system events (300ms delay)
- Deferred refresh when webview is hidden
- Asynchronous spec parsing
- Resource disposal on deactivation

#### Security
- Content Security Policy for webview
- Nonce-based script execution
- Input sanitization to prevent path traversal
- Message origin validation

#### Testing
- 21 property-based tests validating universal correctness properties
- Unit tests for core components and edge cases
- Integration tests for end-to-end workflows
- 100+ iterations per property test for comprehensive coverage

### Commands

- `specs-dashboard.show` - Show Specs Dashboard
- `specs-dashboard.refresh` - Refresh Specs Dashboard
- `specs-dashboard.openFile` - Open Spec File

### Activation Events

- `onView:specs-dashboard.view` - When dashboard view is opened
- `onCommand:specs-dashboard.show` - When show command is invoked
- `workspaceContains:**/.kiro/specs/**/tasks.md` - When workspace contains spec files

## [Unreleased]

### Planned Features

- Sorting options for spec list
- Export functionality for specs and notes
- Keyboard shortcuts for common actions

---

## Version History

- **0.1.0** (2026-01-31) - Initial release with core functionality
