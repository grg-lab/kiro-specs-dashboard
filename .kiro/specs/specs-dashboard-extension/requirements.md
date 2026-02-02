# Requirements Document

## Introduction

The Specs Dashboard Extension is a native VSCode/Kiro IDE extension that provides integrated spec visualization and tracking directly within the IDE. This extension is a parallel implementation alongside the existing browser-based dashboard (index.html), offering the same core functionality but optimized for IDE integration. The extension eliminates the need for external browsers, local servers, or manual directory selection by automatically detecting and monitoring `.kiro/specs/` directories in the workspace. Both versions will coexist - the browser version for standalone use and the extension version for IDE-integrated workflows.

## Glossary

- **Extension_Host**: The Node.js process that runs extension code with access to VSCode APIs
- **Webview**: An iframe-like component within VSCode that renders HTML/CSS/JavaScript UI
- **Workspace**: The root directory opened in VSCode containing project files
- **Spec_Directory**: A folder within `.kiro/specs/` containing spec documents (tasks.md, requirements.md, design.md)
- **Global_State**: Extension storage that persists across all workspaces
- **Workspace_State**: Extension storage scoped to the current workspace
- **File_System_Watcher**: VSCode API for monitoring file system changes
- **Activation_Event**: Trigger that causes the extension to load and initialize
- **Message_Passing**: Communication protocol between Extension_Host and Webview
- **Command**: A registered action that users can invoke via command palette or UI

## Requirements

### Requirement 1: Extension Initialization and Activation

**User Story:** As a developer, I want the extension to activate automatically when I open a workspace with Kiro specs, so that I can immediately access spec tracking without manual setup.

#### Acceptance Criteria

1. WHEN a workspace is opened, THE Extension_Host SHALL scan for `.kiro/specs/` directories
2. WHEN `.kiro/specs/` directories are found, THE Extension_Host SHALL activate the extension automatically
3. WHEN no `.kiro/specs/` directories exist, THE Extension_Host SHALL remain dormant until explicitly activated
4. WHEN the extension activates, THE Extension_Host SHALL register all commands and initialize the webview provider
5. WHERE the user manually invokes the dashboard command, THE Extension_Host SHALL activate and display the dashboard regardless of directory presence

### Requirement 2: Workspace File System Integration

**User Story:** As a developer, I want the extension to automatically detect and read spec files from my workspace, so that I don't need to manually select directories or configure paths.

#### Acceptance Criteria

1. THE Extension_Host SHALL use VSCode workspace.fs API to read file contents
2. WHEN reading spec files, THE Extension_Host SHALL parse tasks.md, requirements.md, and design.md from each Spec_Directory
3. WHEN a Spec_Directory is missing optional files, THE Extension_Host SHALL handle the absence gracefully
4. WHEN file read operations fail, THE Extension_Host SHALL log errors and continue processing other specs
5. THE Extension_Host SHALL recursively scan `.kiro/specs/` for all subdirectories containing spec files

### Requirement 3: Real-Time File System Monitoring

**User Story:** As a developer, I want the dashboard to update automatically when I modify spec files, so that I always see current progress without manual refresh.

#### Acceptance Criteria

1. WHEN the extension activates, THE Extension_Host SHALL create File_System_Watcher instances for `.kiro/specs/**/*.md` files
2. WHEN a watched file is created, modified, or deleted, THE File_System_Watcher SHALL trigger a refresh event
3. WHEN a refresh event occurs, THE Extension_Host SHALL re-parse affected spec files
4. WHEN spec data changes, THE Extension_Host SHALL send updated data to the Webview via Message_Passing
5. WHEN the workspace is closed, THE Extension_Host SHALL dispose of all File_System_Watcher instances

### Requirement 4: Persistent State Management

**User Story:** As a developer, I want my dashboard preferences and view state to persist across IDE sessions, so that I don't lose my context when reopening the workspace.

#### Acceptance Criteria

1. THE Extension_Host SHALL use Workspace_State to store current workspace preferences
2. THE Extension_Host SHALL use Global_State to store cross-workspace settings
3. WHEN the dashboard view changes, THE Extension_Host SHALL persist filter state, sort preferences, and pagination position
4. WHEN the extension reactivates, THE Extension_Host SHALL restore the previous view state from Workspace_State
5. WHEN workspace state is corrupted or invalid, THE Extension_Host SHALL reset to default state and continue operation

### Requirement 5: Webview Dashboard UI

**User Story:** As a developer, I want a native IDE panel that displays spec progress and details, so that I can track my work without leaving the IDE.

#### Acceptance Criteria

1. THE Extension_Host SHALL create a Webview panel in the sidebar or editor area
2. WHEN the webview loads, THE Extension_Host SHALL inject HTML, CSS, and JavaScript for the dashboard UI
3. THE Webview SHALL render spec cards with progress bars, task counts, and status indicators
4. WHEN a user clicks on a spec card, THE Webview SHALL display full spec details in a modal or detail view
5. THE Webview SHALL support filtering, searching, and pagination of spec cards

### Requirement 6: Extension-Webview Communication

**User Story:** As a developer, I want seamless interaction between the dashboard UI and the extension backend, so that my actions trigger appropriate file operations and state updates.

#### Acceptance Criteria

1. THE Extension_Host SHALL establish Message_Passing channel with the Webview
2. WHEN the Webview requests spec data, THE Extension_Host SHALL send current spec information via messages
3. WHEN a user marks a task complete in the Webview, THE Webview SHALL send a message to the Extension_Host
4. WHEN the Extension_Host receives a task update message, THE Extension_Host SHALL modify the corresponding tasks.md file
5. WHEN file modifications complete, THE Extension_Host SHALL send confirmation messages back to the Webview

### Requirement 7: Markdown Rendering with Syntax Highlighting

**User Story:** As a developer, I want spec documents to render with proper markdown formatting and code syntax highlighting, so that I can read technical documentation clearly.

#### Acceptance Criteria

1. THE Webview SHALL use marked.js library to parse markdown content
2. THE Webview SHALL use highlight.js library to apply syntax highlighting to code blocks
3. THE Webview SHALL use mermaid.js library to render diagram blocks
4. WHEN rendering markdown, THE Webview SHALL apply GitHub Flavored Markdown rules
5. WHEN displaying code blocks, THE Webview SHALL detect language and apply appropriate syntax highlighting

### Requirement 8: Task Status Management

**User Story:** As a developer, I want to mark tasks as complete or incomplete directly from the dashboard, so that I can track progress without manually editing markdown files.

#### Acceptance Criteria

1. WHEN a user clicks a task checkbox in the Webview, THE Webview SHALL send a task toggle message to the Extension_Host
2. WHEN the Extension_Host receives a task toggle message, THE Extension_Host SHALL update the checkbox state in tasks.md
3. WHEN updating task checkboxes, THE Extension_Host SHALL preserve all other markdown formatting
4. WHEN a task status changes, THE Extension_Host SHALL recalculate progress percentages
5. WHEN file write operations complete, THE Extension_Host SHALL send updated spec data to the Webview

### Requirement 9: Extension Commands and UI Integration

**User Story:** As a developer, I want to access the dashboard through standard IDE mechanisms like command palette and sidebar icons, so that it feels like a native IDE feature.

#### Acceptance Criteria

1. THE Extension_Host SHALL register a "Show Specs Dashboard" command in the command palette
2. THE Extension_Host SHALL register a sidebar view container for the dashboard
3. WHEN the user invokes the dashboard command, THE Extension_Host SHALL reveal the Webview panel
4. THE Extension_Host SHALL provide a refresh command to manually reload spec data
5. THE Extension_Host SHALL provide a "Open Spec File" command to open spec markdown files in the editor

### Requirement 10: Content Security Policy and Resource Loading

**User Story:** As a developer, I want the extension to load external libraries securely while maintaining VSCode security standards, so that my IDE remains protected from malicious content.

#### Acceptance Criteria

1. THE Webview SHALL define a Content Security Policy that allows script execution from trusted sources
2. THE Extension_Host SHALL serve external libraries (marked.js, highlight.js, mermaid.js) from local extension resources or approved CDNs
3. WHEN loading webview content, THE Extension_Host SHALL use nonce-based script execution
4. THE Webview SHALL only accept messages from the Extension_Host with verified origin
5. THE Extension_Host SHALL sanitize all user-provided content before rendering in the Webview

### Requirement 11: Error Handling and User Feedback

**User Story:** As a developer, I want clear error messages when something goes wrong, so that I can understand and resolve issues quickly.

#### Acceptance Criteria

1. WHEN file operations fail, THE Extension_Host SHALL display error notifications with actionable messages
2. WHEN spec parsing fails, THE Extension_Host SHALL log detailed error information and continue processing other specs
3. WHEN the Webview encounters rendering errors, THE Webview SHALL display fallback content and report errors to the Extension_Host
4. WHEN no specs are found, THE Webview SHALL display a helpful message explaining how to create specs
5. IF critical errors occur during activation, THEN THE Extension_Host SHALL deactivate gracefully and notify the user

### Requirement 12: Multi-Workspace Support

**User Story:** As a developer working across multiple projects, I want each workspace to maintain its own dashboard state, so that my view preferences don't conflict between projects.

#### Acceptance Criteria

1. THE Extension_Host SHALL maintain separate Workspace_State for each opened workspace
2. WHEN switching between workspace folders, THE Extension_Host SHALL load the appropriate workspace-specific state
3. WHEN a workspace is removed from the workspace folders, THE Extension_Host SHALL clean up associated watchers and state
4. THE Extension_Host SHALL support multi-root workspaces by scanning all workspace folders for `.kiro/specs/` directories
5. WHEN displaying specs from multiple workspace folders, THE Webview SHALL indicate which workspace each spec belongs to

### Requirement 13: Performance and Resource Management

**User Story:** As a developer, I want the extension to operate efficiently without slowing down my IDE, so that I can work smoothly even with many spec files.

#### Acceptance Criteria

1. THE Extension_Host SHALL debounce file system events to avoid excessive re-parsing during rapid file changes
2. THE Extension_Host SHALL parse spec files asynchronously to avoid blocking the UI thread
3. WHEN rendering large spec documents, THE Webview SHALL implement virtual scrolling or pagination
4. THE Extension_Host SHALL dispose of all resources (watchers, webviews, event listeners) when deactivating
5. WHEN the webview is hidden, THE Extension_Host SHALL pause non-critical background operations

### Requirement 14: Filtering and Search Capabilities

**User Story:** As a developer with many specs, I want to filter and search specs by name or status, so that I can quickly find the specs I'm working on.

#### Acceptance Criteria

1. THE Webview SHALL provide a search input that filters specs by name or content
2. WHEN a user types in the search input, THE Webview SHALL update the displayed spec list in real-time
3. THE Webview SHALL provide filter buttons for "All", "In Progress", and "Completed" specs
4. WHEN a filter is applied, THE Webview SHALL persist the filter state to Workspace_State
5. WHEN the dashboard reloads, THE Webview SHALL restore the previous filter and search state

### Requirement 15: Spec Detail View

**User Story:** As a developer, I want to view full spec details including requirements, design, and tasks in a single view, so that I can understand the complete context of a feature.

#### Acceptance Criteria

1. WHEN a user clicks on a spec card, THE Webview SHALL display a detail view with tabbed sections
2. THE Webview SHALL render Requirements, Design, and Tasks tabs with full markdown content
3. WHEN a tab is missing content, THE Webview SHALL display a message indicating the file is not present
4. THE Webview SHALL provide navigation controls to move between specs without closing the detail view
5. WHEN viewing task details, THE Webview SHALL allow inline task status toggling

### Requirement 16: Native IDE Styling and Design System

**User Story:** As a developer using Kiro IDE, I want the dashboard to look and feel like a native IDE component rather than a website, so that it integrates seamlessly with my development environment.

#### Acceptance Criteria

1. THE Webview SHALL use VSCode CSS variables for all colors, fonts, and spacing to match the IDE theme
2. THE Webview SHALL NOT use website-style layouts (centered containers, max-widths, card shadows)
3. THE Webview SHALL use native IDE components and patterns (tree views, list items, inline actions)
4. THE Webview SHALL follow VSCode design guidelines for spacing, typography, and visual hierarchy
5. THE Webview SHALL use monospace fonts for code-related content and system fonts for UI text
6. THE Webview SHALL adapt to light and dark themes automatically using CSS variables
7. THE Webview SHALL use subtle borders and backgrounds that match IDE panel styling
8. THE Webview SHALL avoid decorative elements (gradients, shadows, rounded corners) common in web design
9. THE Webview SHALL use icon fonts or SVG icons consistent with VSCode icon style
10. THE Webview SHALL implement hover states and focus indicators matching IDE interaction patterns
11. THE Webview SHALL use compact, information-dense layouts typical of IDE panels
12. THE Webview SHALL align with VSCode's flat, minimalist design aesthetic

### Requirement 17: Quick File Access Actions

**User Story:** As a developer, I want quick access buttons to open the requirements.md, design.md, and tasks.md files directly in the editor, so that I can quickly view or edit spec documents without navigating the file tree.

#### Acceptance Criteria

1. WHEN viewing a spec in the dashboard, THE Webview SHALL display action buttons for opening each spec file (requirements.md, design.md, tasks.md)
2. WHEN a user clicks an "Open Requirements" button, THE Extension_Host SHALL open the requirements.md file in the editor
3. WHEN a user clicks an "Open Design" button, THE Extension_Host SHALL open the design.md file in the editor
4. WHEN a user clicks an "Open Tasks" button, THE Extension_Host SHALL open the tasks.md file in the editor
5. WHEN a spec file does not exist (e.g., no requirements.md), THE button SHALL be disabled or hidden
6. THE action buttons SHALL use Codicons for visual consistency with the IDE
7. THE action buttons SHALL be styled as inline icon buttons with hover states
8. WHEN a file is opened, THE Extension_Host SHALL focus the editor tab containing that file
9. THE action buttons SHALL be positioned near the spec name or in the tab header for easy access
10. THE action buttons SHALL include tooltips indicating which file will be opened
