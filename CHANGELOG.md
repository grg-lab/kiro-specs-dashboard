# Change Log

All notable changes to the "Kiro Specs Dashboard" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-02-06

### Added

- **Execution Profiles**: Create and manage custom execution profiles for automated spec execution
  - Built-in profiles: MVP (Required Tasks) and Full (All Tasks)
  - Custom profile creation with template variables ({{specName}}, {{specPath}}, {{totalTasks}}, etc.)
  - Profile management UI accessible via "Manage Profiles" button
  - Multi-workspace support with automatic profile ID conflict resolution
  - File-based profile storage in `.kiro/execution-profiles.json`
- **Direct Spec Execution**: Execute specs directly from the dashboard
  - Execute button on each spec card with profile selection dropdown
  - Real-time execution status indicators (Running, Completed, Failed, Cancelled)
  - Cancel execution button to stop running executions
  - Automatic task file watching for progress updates during execution
  - Execution state persistence across VSCode sessions
- **New Commands**:
  - `Specs Dashboard: Manage Profiles` - Open profile management panel
  - `Specs Dashboard: Show Metrics` - Open the Metrics panel

### Changed

- **Dashboard Spec Cards Redesign**: Completely redesigned spec card layout for better information hierarchy
  - Execute button moved to top-right next to spec name for quick access
  - Status badge and task statistics displayed in a single compact row
  - Enhanced progress bar with 8px height, rounded corners, and diagonal stripe pattern for unfilled portion
  - Action buttons (Requirements, Design, Tasks, Notes) moved to bottom for consistent placement
  - Improved visual spacing and alignment throughout the card
  - Removed execution status display for simplified UI (button remains consistent)
- Enhanced dashboard header with Profiles action button
- Improved spec card layout with execution controls section
- Updated dashboard UI to show execution status on spec cards
- **Profile Dropdown Improvements**: 
  - Reduced dropdown dimensions (min-width: 180px, max-width: 200px, max-height: 200px)
  - Added toggle functionality - clicking Execute button again closes the dropdown
  - Added text truncation with ellipsis for long profile names
  - Right-aligned dropdown to prevent clipping when editor panel is open
- **Command Category Update**: Changed all command categories from "Kiro" to "Specs Dashboard" for consistency
- **Removed Commands**: Removed internal and debug commands (openFile, openNotes, openHistory, listKiroCommands, testKiroMessage)

### Technical

- Added `ProfileManager` class for profile CRUD operations
- Added `ExecutionManager` class for execution lifecycle management
- Added `ProfilesPanelManager` for profile management webview
- Implemented template variable substitution engine
- Added workspace state persistence for execution states
- Implemented file system watching for task progress during execution
- Added profile validation and error handling

## [0.1.1] - 2026-02-05

### Added

- **Metrics Panel**: Comprehensive analytics dashboard accessible via "Metrics" button
- **Velocity Tab**: Performance tracking with weekly trends and consistency scoring
  - Specs Performance: Current week, average, and consistency metrics with 10-week completion chart
  - Tasks Performance: Current week, average, and consistency metrics with 10-week completion chart
  - Required vs Optional: Pie chart showing task distribution
  - Day of Week: Horizontal bar chart showing completion patterns by weekday
  - Average Time to Complete: Spec completion timeline with Fast/Medium/Slow breakdown
  - Projected Completion: Estimated completion date with progress bar
- **Mock Data Generator**: Realistic test data generation for development and testing
- **Responsive Layout**: Stats header adapts to viewport width with flexible button positioning
- **Empty State Messages**: Charts display helpful messages when no data is available yet
- **Clear Velocity Data Command**: New command to remove all velocity tracking data

### Changed

- Renamed "Analytics" button to "Metrics" for clarity
- Improved pie chart visualization by removing dividing line
- Enhanced chart styling with solid colors and consistent blue theme
- Updated section separators for better visual hierarchy
- Optimized stats header layout for better space utilization

### Fixed

- Progress bar visibility in Velocity tab
- Section separator contrast in dark themes
- Pie chart border rendering issues
- Day of Week chart bar spacing and alignment

### Technical

- Added `VelocityCalculator` for metrics computation
- Extended `VelocityMetrics` interface with specs tracking
- Implemented weekly aggregation and consistency scoring algorithms
- Added time-to-complete categorization (Fast: ≤14 days, Medium: 15-42 days, Slow: ≥43 days)
- Added `clearVelocityData` method to StateManager

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

- **0.1.2** (2026-02-06) - Fixed execution cancellation to actually stop Kiro agent
- **0.1.1** (2026-02-05) - Added Metrics panel with velocity tracking and analytics
- **0.1.0** (2026-01-31) - Initial release with core functionality
