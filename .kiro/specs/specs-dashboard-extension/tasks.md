# Implementation Plan: Specs Dashboard Extension

## Overview

This implementation plan creates a native VSCode extension for spec visualization and tracking. The approach follows VSCode's extension architecture with TypeScript, separating concerns between the Extension Host (Node.js with VSCode APIs) and the Webview (sandboxed UI). The UI is designed from the ground up to match VSCode's native design language, using IDE-standard components, layouts, and styling patterns rather than adapting web-based designs.

## Tasks

- [x] 1. Set up extension project structure and configuration
  - Initialize TypeScript VSCode extension project with proper package.json
  - Configure tsconfig.json for VSCode extension compilation
  - Set up extension manifest (package.json) with activation events, commands, and views
  - Install dependencies: @types/vscode, @types/node, @vscode/test-electron
  - Create directory structure: src/, media/, test/
  - _Requirements: 1.4, 9.1, 9.2_

- [x] 2. Implement core spec scanning and parsing
  - [x] 2.1 Create SpecScanner class with workspace scanning logic
    - Implement scanWorkspace() to find all .kiro/specs directories
    - Implement parseSpecDirectory() to read tasks.md, requirements.md, design.md
    - Implement parseTaskStats() to extract task counts and progress
    - Handle missing optional files gracefully
    - _Requirements: 1.1, 2.2, 2.3, 2.5_
  
  - [x] 2.2 Write property test for spec scanning completeness
    - **Property 1: Workspace Scanning Completeness**
    - **Validates: Requirements 1.1, 2.2, 2.5**
  
  - [x] 2.3 Write property test for error recovery
    - **Property 2: Graceful Error Recovery**
    - **Validates: Requirements 2.4, 11.2**
  
  - [x] 2.4 Write unit tests for task parsing edge cases
    - Test empty files, malformed checkboxes, optional task markers
    - Test progress calculation with various task combinations
    - _Requirements: 2.2, 2.3_

- [x] 3. Implement file system watching and change detection
  - [x] 3.1 Create FileSystemWatcher for .kiro/specs/**/*.md files
    - Set up watcher in extension activation
    - Implement debouncing logic for rapid file changes
    - Handle watcher disposal on deactivation
    - _Requirements: 3.1, 3.5, 13.1_
  
  - [x] 3.2 Implement refresh logic on file changes
    - Connect watcher events to spec re-parsing
    - Update internal state when specs change
    - Trigger webview updates via message passing
    - _Requirements: 3.2, 3.3, 3.4_
  
  - [x] 3.3 Write property test for file change propagation
    - **Property 3: File Change Propagation**
    - **Validates: Requirements 3.2, 3.3, 3.4**
  
  - [x] 3.4 Write property test for debouncing behavior
    - **Property 17: File System Event Debouncing**
    - **Validates: Requirements 13.1**

- [x] 4. Checkpoint - Ensure core scanning and watching works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement state management with VSCode APIs
  - [x] 5.1 Create StateManager class for workspace and global state
    - Implement getDashboardState() and saveDashboardState()
    - Implement getGlobalPreferences() and saveGlobalPreferences()
    - Handle corrupted state with defaults and error logging
    - _Requirements: 4.1, 4.2, 4.5_
  
  - [x] 5.2 Implement state persistence on view changes
    - Save filter state, search query, pagination, sort preferences
    - Restore state on extension reactivation
    - _Requirements: 4.3, 4.4_
  
  - [x] 5.3 Write property test for state persistence round-trip
    - **Property 4: State Persistence Round-Trip**
    - **Validates: Requirements 4.3, 4.4, 14.4, 14.5**
  
  - [x] 5.4 Write unit tests for corrupted state recovery
    - Test invalid JSON, missing fields, wrong types
    - Verify defaults are used and errors are logged
    - _Requirements: 4.5_

- [x] 6. Implement webview provider and HTML generation
  - [x] 6.1 Create SpecsDashboardProvider class implementing WebviewViewProvider
    - Implement resolveWebviewView() to initialize webview
    - Generate HTML content with CSP and nonce-based scripts
    - Set up webview options and resource roots
    - _Requirements: 5.1, 5.2, 10.1, 10.3_
  
  - [x] 6.2 Create native IDE-styled dashboard HTML
    - Build HTML structure using VSCode design patterns
    - Implement list-based layout (not card-based)
    - Use VSCode CSS variables exclusively
    - Create compact, information-dense UI
    - Implement message passing integration
    - _Requirements: 5.3, 5.4, 5.5, 16.1-16.12_
  
  - [x] 6.3 Bundle external libraries (marked.js, highlight.js, mermaid.js)
    - Download libraries to media/ directory
    - Update HTML to reference local resources via webview URIs
    - Configure CSP to allow local script execution
    - _Requirements: 7.1, 7.2, 7.3, 10.2_
  
  - [x] 6.4 Write property test for spec card rendering completeness
    - **Property 7: Spec Card Rendering Completeness**
    - **Validates: Requirements 5.3**

- [x] 7. Implement message passing protocol
  - [x] 7.1 Set up bidirectional message handling
    - Implement onDidReceiveMessage handler in provider
    - Implement postMessage sender in webview JavaScript
    - Define message types and payloads (TypeScript interfaces)
    - _Requirements: 6.1_
  
  - [x] 7.2 Implement webview → extension message handlers
    - Handle 'requestSpecs' message to send spec data
    - Handle 'toggleTask' message to update tasks.md
    - Handle 'openFile' message to open files in editor
    - Handle 'saveState' message to persist dashboard state
    - _Requirements: 6.2, 6.3, 6.4, 8.1_
  
  - [x] 7.3 Implement extension → webview message senders
    - Send 'specsLoaded' message with spec data
    - Send 'specUpdated' message on file changes
    - Send 'error' message on operation failures
    - _Requirements: 6.5, 11.1_
  
  - [x] 7.4 Write property test for request-response protocol
    - **Property 8: Request-Response Message Protocol**
    - **Validates: Requirements 6.2**
  
  - [x] 7.5 Write property test for message origin validation
    - **Property 11: Message Origin Validation**
    - **Validates: Requirements 10.4**

- [x] 8. Checkpoint - Ensure webview and messaging works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement task toggling functionality
  - [x] 9.1 Implement toggleTask() method in provider
    - Parse tasks.md to find target task line
    - Toggle checkbox state ([ ] ↔ [x])
    - Preserve all other markdown formatting
    - Write updated content back to file
    - _Requirements: 8.2, 8.3_
  
  - [x] 9.2 Implement progress recalculation on task changes
    - Recalculate task counts and progress percentage
    - Update internal spec state
    - Trigger webview update via message
    - _Requirements: 8.4, 8.5_
  
  - [x] 9.3 Write property test for task toggle round-trip
    - **Property 5: Task Toggle Round-Trip**
    - **Validates: Requirements 6.3, 6.4, 8.1, 8.2, 8.4, 8.5**
  
  - [x] 9.4 Write property test for markdown formatting preservation
    - **Property 6: Markdown Formatting Preservation**
    - **Validates: Requirements 8.3**
  
  - [x] 9.5 Write unit tests for task toggling edge cases
    - Test toggling first/last task, nested tasks, optional tasks
    - Test tasks with special characters in descriptions
    - _Requirements: 8.2, 8.3_

- [x] 10. Implement markdown rendering in webview with IDE styling
  - [x] 10.1 Set up marked.js for GitHub Flavored Markdown
    - Configure marked with GFM options
    - Implement custom renderer for task lists
    - Handle tables, strikethrough, autolinks
    - _Requirements: 7.4_
  
  - [x] 10.2 Set up highlight.js for syntax highlighting
    - Configure highlight.js with language detection
    - Apply highlighting to all code blocks
    - Use VSCode editor theme colors for syntax highlighting
    - _Requirements: 7.5_
  
  - [x] 10.3 Set up mermaid.js for diagram rendering
    - Initialize mermaid with configuration
    - Render mermaid code blocks as diagrams
    - Handle rendering errors gracefully
    - Style diagrams to match IDE theme
    - _Requirements: 7.3_
  
  - [x] 10.4 Style markdown content for IDE integration
    - Use VSCode CSS variables for all markdown styling
    - Style code blocks with editor-style backgrounds
    - Use monospace fonts for code content
    - Implement compact spacing for markdown elements
    - Remove website-style markdown decorations
    - _Requirements: 16.1, 16.5, 16.7_
  
  - [x] 10.5 Write property test for GFM rendering
    - **Property 9: GitHub Flavored Markdown Rendering**
    - **Validates: Requirements 7.4**
  
  - [x] 10.6 Write property test for syntax highlighting
    - **Property 10: Syntax Highlighting Application**
    - **Validates: Requirements 7.5**

- [x] 11. Implement filtering and search functionality with native IDE styling
  - [x] 11.1 Implement search input filtering in webview
    - Add VSCode-style search input to UI
    - Filter specs by name or content (case-insensitive)
    - Update displayed spec list in real-time
    - Use native input styling with VSCode CSS variables
    - _Requirements: 14.1, 14.2, 16.3, 16.4_
  
  - [x] 11.2 Implement filter buttons (All, In Progress, Completed)
    - Add VSCode-style button group for filters
    - Filter specs by progress status
    - Persist filter state via message passing
    - Use flat, minimal button styling
    - _Requirements: 14.3, 14.4, 16.3, 16.4_
  
  - [x] 11.3 Write property test for search filtering
    - **Property 19: Search Filtering Behavior**
    - **Validates: Requirements 14.2**

- [ ] 12. Implement spec detail view with native IDE styling
  - [ ] 12.1 Create detail view with inline expansion or side panel
    - Implement inline expansion (not modal overlay)
    - Add VSCode-style tabs for Requirements, Design, Tasks
    - Render markdown content in each tab
    - Handle missing files with helpful messages
    - Use flat, minimal tab styling
    - _Requirements: 15.1, 15.2, 15.3, 16.3, 16.4, 16.7, 16.8_
  
  - [ ] 12.2 Implement navigation controls in detail view
    - Add previous/next buttons with Codicons
    - Navigate between specs without closing detail view
    - Maintain current tab selection
    - Use subtle, native-style navigation controls
    - _Requirements: 15.4, 16.9_
  
  - [ ] 12.3 Implement inline task toggling in detail view
    - Make task checkboxes clickable in Tasks tab
    - Send toggle messages to extension
    - Update UI immediately on confirmation
    - Use native checkbox styling
    - _Requirements: 15.5_
  
  - [ ] 12.4 Write property test for detail view navigation
    - **Property 20: Detail View Navigation**
    - **Validates: Requirements 15.4**
  
  - [ ] 12.5 Write property test for inline task toggling
    - **Property 21: Inline Task Toggling**
    - **Validates: Requirements 15.5**

- [ ] 13. Checkpoint - Ensure UI features work end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Implement extension commands and activation
  - [x] 14.1 Register extension commands in package.json and activation
    - Register 'specs-dashboard.show' command
    - Register 'specs-dashboard.refresh' command
    - Register 'specs-dashboard.openFile' command
    - Configure activation events (onView, onCommand)
    - _Requirements: 1.4, 9.1, 9.3, 9.4, 9.5_
  
  - [x] 14.2 Implement sidebar view container registration
    - Add view container to package.json contributions
    - Register SpecsDashboardProvider as view provider
    - Configure view icon and title
    - _Requirements: 9.2_
  
  - [x] 14.3 Write unit tests for command registration
    - Verify commands are registered on activation
    - Verify commands execute expected actions
    - _Requirements: 9.1, 9.3, 9.4, 9.5_

- [x] 15. Implement multi-workspace support
  - [x] 15.1 Handle multi-root workspaces
    - Scan all workspace folders for .kiro/specs
    - Add workspace folder indicators to spec list items
    - Maintain separate state per workspace folder
    - _Requirements: 12.4, 12.5_
  
  - [x] 15.2 Implement workspace state isolation
    - Ensure state changes in one workspace don't affect others
    - Clean up watchers and state when workspaces are removed
    - _Requirements: 12.1, 12.2, 12.3_
  
  - [x] 15.3 Write property test for workspace state isolation
    - **Property 15: Workspace State Isolation**
    - **Validates: Requirements 12.1, 12.2**
  
  - [x] 15.4 Write property test for multi-root scanning
    - **Property 16: Multi-Root Workspace Scanning**
    - **Validates: Requirements 12.4, 12.5**

- [x] 16. Implement error handling and user feedback
  - [x] 16.1 Add error notifications for file operations
    - Show VSCode error notifications on file read/write failures
    - Include actionable error messages
    - Log detailed errors to Output panel
    - _Requirements: 11.1_
  
  - [x] 16.2 Implement rendering error fallback in webview
    - Catch JavaScript errors in webview
    - Display fallback content on errors
    - Report errors to extension via messages
    - _Requirements: 11.3_
  
  - [x] 16.3 Add empty state UI when no specs found
    - Display helpful message explaining how to create specs
    - Include link to documentation
    - Use native IDE styling for empty state
    - _Requirements: 11.4_
  
  - [x] 16.4 Write property test for error notifications
    - **Property 13: Error Notification Display**
    - **Validates: Requirements 11.1**
  
  - [x] 16.5 Write property test for rendering error fallback
    - **Property 14: Rendering Error Fallback**
    - **Validates: Requirements 11.3**

- [x] 17. Implement security measures
  - [x] 17.1 Configure Content Security Policy for webview
    - Define strict CSP in HTML meta tag
    - Allow scripts only from extension resources
    - Use nonce-based script execution
    - _Requirements: 10.1, 10.3_
  
  - [x] 17.2 Implement content sanitization
    - Sanitize user-provided content before rendering
    - Escape HTML special characters
    - Prevent XSS attacks
    - _Requirements: 10.5_
  
  - [x] 17.3 Write property test for content sanitization
    - **Property 12: Content Sanitization**
    - **Validates: Requirements 10.5**

- [x] 18. Implement performance optimizations
  - [x] 18.1 Add resource disposal on deactivation
    - Dispose file system watchers
    - Dispose webview panels
    - Dispose event listeners and subscriptions
    - _Requirements: 13.4_
  
  - [x] 18.2 Implement webview pause on hide
    - Detect when webview is hidden
    - Pause non-critical background operations
    - Resume operations when webview is shown
    - _Requirements: 13.5_
  
  - [x] 18.3 Write property test for webview pause behavior
    - **Property 18: Webview Pause on Hide**
    - **Validates: Requirements 13.5**

- [x] 19. Set up testing infrastructure
  - [x] 19.1 Configure Jest for unit testing
    - Install jest, ts-jest, @types/jest
    - Configure jest.config.js for TypeScript
    - Set up test scripts in package.json
    - _Testing Strategy_
  
  - [x] 19.2 Configure fast-check for property-based testing
    - Install fast-check library
    - Create property test helpers and generators
    - Configure test tagging format
    - Set minimum 100 iterations per property test
    - _Testing Strategy_
  
  - [x] 19.3 Set up VSCode extension testing framework
    - Install @vscode/test-electron
    - Configure integration test runner
    - Create mock VSCode API helpers
    - _Testing Strategy_

- [x] 20. Final integration and polish
  - [x] 20.1 Wire all components together
    - Connect scanner → watcher → provider → webview
    - Ensure all message flows work end-to-end
    - Test complete user workflows
    - _Requirements: All_
  
  - [x] 20.2 Add extension metadata and documentation
    - Write README.md for extension
    - Add CHANGELOG.md
    - Configure package.json metadata (description, keywords, icon)
    - Add LICENSE file
  
  - [x] 20.3 Create extension icon and branding
    - Design extension icon (128x128 PNG)
    - Add icon to package.json
    - Configure theme colors

- [x] 21. Final checkpoint - Ensure all tests pass and extension works
  - Run full test suite (unit + property + integration)
  - Test extension in VSCode manually
  - Verify all requirements are met
  - Ask the user if questions arise.

- [x] 22. Redesign dashboard UI for native IDE look and feel
  - [x] 22.1 Replace website-style CSS with VSCode CSS variables
    - Remove all custom color definitions (hex codes, rgb values)
    - Replace with VSCode CSS variables (--vscode-foreground, --vscode-background, etc.)
    - Use --vscode-font-family for UI text
    - Use --vscode-editor-font-family for code/monospace content
    - Remove custom spacing values, use VSCode standard spacing (4px, 8px, 12px, 16px, 20px)
    - _Requirements: 16.1, 16.5, 16.6_
  
  - [x] 22.2 Remove website-style layout patterns
    - Remove centered containers with max-width
    - Remove card-style layouts with shadows and rounded corners
    - Remove gradient backgrounds and decorative elements
    - Use full-width layouts that fill the sidebar panel
    - Implement flat, edge-to-edge designs
    - _Requirements: 16.2, 16.7, 16.8, 16.12_
  
  - [x] 22.3 Implement native IDE component patterns
    - Replace spec cards with list items (similar to file explorer)
    - Use tree view patterns for hierarchical content
    - Implement inline action buttons (hover-revealed icons)
    - Use VSCode-style badges for status indicators
    - Add subtle separators between list items (1px borders)
    - _Requirements: 16.3, 16.4, 16.7_
  
  - [x] 22.4 Redesign spec list items
    - Create compact list item layout (no padding/margin excess)
    - Show spec name with folder path in subdued color
    - Display progress bar as thin inline bar (2-3px height)
    - Show task counts as inline text (not badges)
    - Add expand/collapse icon for detail view
    - Use monospace font for task counts
    - _Requirements: 16.3, 16.4, 16.11_
  
  - [x] 22.5 Redesign statistics header
    - Remove large number displays with decorative styling
    - Create compact, inline statistics bar
    - Use small labels with values in monospace font
    - Align statistics horizontally in a single row
    - Use subtle background color from VSCode variables
    - Add thin border separator below header
    - _Requirements: 16.4, 16.7, 16.11_
  
  - [x] 22.6 Redesign filter and search controls
    - Use VSCode-style input fields (no custom styling)
    - Make search input full-width with subtle border
    - Replace dropdown with inline button group for status filter
    - Use icon buttons for filter actions
    - Implement compact, single-row control layout
    - _Requirements: 16.3, 16.4, 16.10_
  
  - [x] 22.7 Redesign detail view modal
    - Replace modal overlay with inline expansion or side panel
    - Use VSCode-style tabs (flat, minimal, no borders)
    - Implement markdown rendering with IDE-appropriate styling
    - Use editor-style background for code blocks
    - Add subtle borders for content sections
    - Remove modal animations and transitions
    - _Requirements: 16.3, 16.4, 16.7, 16.8_
  
  - [x] 22.8 Implement VSCode icon integration
    - Use Codicons (VSCode's icon font) for all icons
    - Replace custom icons with standard VSCode icons
    - Add icons for: expand/collapse, refresh, filter, status
    - Ensure icons match IDE icon size and color
    - _Requirements: 16.9_
  
  - [x] 22.9 Refine interaction patterns
    - Implement VSCode-style hover states (subtle background change)
    - Add focus indicators using VSCode focus border color
    - Use cursor: pointer only for clickable items
    - Implement keyboard navigation (arrow keys, enter, escape)
    - Add ripple-free, instant feedback for clicks
    - _Requirements: 16.10_
  
  - [x] 22.10 Test theme compatibility
    - Test with VSCode Dark+ theme
    - Test with VSCode Light+ theme
    - Test with high contrast themes
    - Verify all colors adapt automatically
    - Ensure readability in all themes
    - _Requirements: 16.6_
  
  - [x] 22.11 Optimize for information density
    - Reduce vertical spacing between list items
    - Use compact font sizes (12px-14px for UI, 11px for metadata)
    - Show more specs per screen without scrolling
    - Align content to maximize visible information
    - Remove unnecessary whitespace
    - _Requirements: 16.11_
  
  - [x] 22.12 Final polish and consistency check
    - Ensure all spacing uses 4px increments
    - Verify all colors come from CSS variables
    - Check alignment and visual hierarchy
    - Test responsive behavior in narrow sidebars
    - Validate against VSCode design guidelines
    - _Requirements: 16.1-16.12_

- [ ] 23. Implement quick file access buttons
  - [ ] 23.1 Add file access buttons to spec list items
    - Add inline icon buttons for requirements.md, design.md, tasks.md
    - Use Codicons: $(file), $(edit), $(list-unordered)
    - Position buttons below spec name or in action row
    - Style as subtle, compact icon buttons (16x16px)
    - _Requirements: 17.1, 17.6, 17.7, 17.9_
  
  - [ ] 23.2 Implement button visibility logic
    - Show button only if corresponding file exists
    - Disable or hide button if file is missing
    - Update button state when spec data changes
    - _Requirements: 17.5_
  
  - [ ] 23.3 Add tooltips to file access buttons
    - Show tooltip on hover: "Open requirements.md", "Open design.md", "Open tasks.md"
    - Use VSCode-style tooltip styling
    - Position tooltip above or below button
    - _Requirements: 17.10_
  
  - [ ] 23.4 Implement click handlers for file access buttons
    - Send 'openFile' message to Extension Host with file path
    - Pass full file path (spec.path + '/requirements.md', etc.)
    - Handle click events without propagating to parent elements
    - _Requirements: 17.2, 17.3, 17.4_
  
  - [ ] 23.5 Enhance Extension Host openFile handler
    - Receive 'openFile' message from webview
    - Open file in editor using vscode.window.showTextDocument()
    - Focus the editor tab after opening
    - Handle errors if file doesn't exist or can't be opened
    - _Requirements: 17.2, 17.3, 17.4, 17.8_
  
  - [ ] 23.6 Add file access buttons to detail view
    - Add buttons to tab header or near spec title
    - Use same icon buttons with tooltips
    - Position for easy access while viewing spec details
    - Maintain consistency with list item buttons
    - _Requirements: 17.1, 17.9_
  
  - [ ] 23.7 Style file access buttons for native IDE look
    - Use --vscode-button-foreground for icon color
    - Use --vscode-button-hoverBackground for hover state
    - Implement subtle hover effect (no animations)
    - Ensure buttons are keyboard accessible
    - Add focus indicators using --vscode-focusBorder
    - _Requirements: 16.9, 16.10, 17.7_
  
  - [ ] 23.8 Test file access functionality
    - Test opening each file type (requirements, design, tasks)
    - Test with missing files (buttons hidden/disabled)
    - Test with multiple specs
    - Test keyboard navigation to buttons
    - Verify editor focus after opening file
    - _Requirements: 17.1-17.10_

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties with 100+ iterations
- Unit tests validate specific examples, edge cases, and error conditions
- TypeScript is used throughout for type safety and VSCode API compatibility
- The UI is designed from scratch to match VSCode's native design language, not adapted from web designs
- All styling uses VSCode CSS variables exclusively for automatic theme adaptation
- Component patterns follow VSCode design guidelines (flat, minimal, information-dense)
- Task 22 focuses on implementing the native IDE look and feel throughout the dashboard


- [ ] 24. Implement Analytics feature foundation
  - [ ] 24.1 Create velocity data tracking infrastructure
    - Create VelocityData interface and data structures
    - Implement VelocityCalculator class with core calculation methods
    - Add velocity data storage to StateManager
    - Implement recordTaskCompletion() to track task events
    - _Requirements: 19.1, 19.2_
  
  - [ ] 24.2 Integrate velocity tracking with task toggle
    - Hook into toggleTask() to record completion events
    - Extract task metadata (required vs optional, timestamp)
    - Update weekly task counts and day-of-week aggregations
    - Persist velocity data to workspace state
    - _Requirements: 19.2, 19.6_
  
  - [ ] 24.3 Implement velocity metrics calculations
    - Implement getTasksPerWeek() for historical data
    - Implement calculateTrend() for week-over-week comparison
    - Implement calculateRollingAverage() for 4-week average
    - Implement calculateConsistencyScore() using standard deviation
    - Implement calculateRequiredVsOptional() for task type split
    - _Requirements: 21.1, 21.2, 21.3, 21.8, 21.9, 21.10_
  
  - [ ] 24.4 Implement spec completion tracking
    - Track when specs reach 100% completion
    - Calculate average time from first to last task
    - Implement time distribution bucketing (fast/medium/slow)
    - _Requirements: 21.4, 21.5, 21.6_
  
  - [ ] 24.5 Implement projection calculations
    - Calculate projected completion date based on velocity
    - Calculate remaining tasks and days remaining
    - Handle edge cases (no velocity data, zero remaining tasks)
    - _Requirements: 21.6, 21.10_

- [ ] 25. Implement Analytics panel UI
  - [ ] 25.1 Add Analytics button to dashboard
    - Add button next to stats summary (specs, done, todo, total)
    - Use Codicon graph icon with "Analytics" label
    - Style button to match VSCode button styling
    - Implement click handler to open analytics panel
    - _Requirements: 18.1, 18.2_
  
  - [ ] 25.2 Create Analytics panel manager
    - Create AnalyticsPanelManager class
    - Implement openAnalytics() to create or reveal panel
    - Create webview panel in main editor area (ViewColumn.One)
    - Set retainContextWhenHidden to true
    - Handle panel disposal and cleanup
    - _Requirements: 18.2, 18.3, 18.4_
  
  - [ ] 25.3 Create Analytics panel HTML structure
    - Create analytics.html template with tab navigation
    - Implement tab structure: Velocity, Timeline, Forecasts, Overview
    - Add tab switching logic with active state management
    - Style tabs using VSCode CSS variables
    - _Requirements: 18.3, 22.1, 22.2, 22.5_
  
  - [ ] 25.4 Implement Velocity tab layout
    - Create hero stats section with 3 stat cards
    - Add main chart container for tasks per week
    - Create metrics grid for secondary metrics
    - Add projection section with progress bar
    - Use VSCode-native styling throughout
    - _Requirements: 20.1-20.12, 22.6_
  
  - [ ] 25.5 Implement placeholder tabs
    - Create Timeline tab with "Coming soon" message
    - Create Forecasts tab with "Coming soon" message
    - Create Overview tab with "Coming soon" message
    - Style placeholders consistently with IDE theme
    - _Requirements: 24.1, 24.2, 24.3_

- [ ] 26. Implement Analytics charts and visualizations
  - [ ] 26.1 Implement CSS-based bar chart for tasks per week
    - Create bar chart container with flex layout
    - Generate bars dynamically from weekly data
    - Calculate bar heights as percentages of max value
    - Add hover effects and tooltips
    - Highlight current week with different color
    - _Requirements: 20.1, 20.11, 20.12_
  
  - [ ] 26.2 Implement velocity trend indicator
    - Display percentage change with up/down/stable icon
    - Color-code: green for positive, red for negative, gray for stable
    - Position next to current week stat
    - _Requirements: 20.2, 20.12_
  
  - [ ] 26.3 Implement average velocity display with trend line
    - Display large number for 4-week rolling average
    - Add small line chart showing average over time
    - Add dotted line to main chart showing average
    - _Requirements: 20.3, 20.12_
  
  - [ ] 26.4 Implement specs completed bar chart
    - Create smaller bar chart for specs per week
    - Use similar styling to tasks chart
    - Show last 8 weeks of data
    - _Requirements: 20.5, 20.12_
  
  - [ ] 26.5 Implement day of week horizontal bars
    - Create horizontal bar chart for 7 days
    - Show task count for each day
    - Use full-width bars with labels
    - _Requirements: 20.8, 20.12_
  
  - [ ] 26.6 Implement required vs optional visualization
    - Create stacked bar showing proportion
    - Display percentages for each segment
    - Color-code: blue for required, gray for optional
    - _Requirements: 20.9, 20.12_
  
  - [ ] 26.7 Implement consistency score gauge
    - Display score as percentage with rating (High/Medium/Low)
    - Add visual gauge or meter representation
    - Color-code based on rating
    - _Requirements: 20.10, 20.12_
  
  - [ ] 26.8 Implement projection progress bar
    - Display projected completion date
    - Show progress bar with percentage complete
    - Calculate and display days/weeks remaining
    - _Requirements: 20.7, 20.12_

- [ ] 27. Implement Analytics message protocol
  - [ ] 27.1 Define Analytics message types
    - Add AnalyticsMessage and AnalyticsCommand types to types.ts
    - Define metricsUpdated, dataRefreshed messages
    - Define refreshMetrics, switchTab, exportData commands
    - _Requirements: 18.3, 22.9_
  
  - [ ] 27.2 Implement Extension Host → Analytics Webview messages
    - Send metricsUpdated message with calculated metrics
    - Send dataRefreshed message when velocity data changes
    - Handle message sending in AnalyticsPanelManager
    - _Requirements: 18.3, 22.9_
  
  - [ ] 27.3 Implement Analytics Webview → Extension Host messages
    - Handle refreshMetrics command to recalculate on demand
    - Handle switchTab command to track active tab
    - Handle exportData command for future CSV/JSON export
    - _Requirements: 22.9, 23.1_
  
  - [ ] 27.4 Implement analytics panel refresh logic
    - Add refresh button to analytics panel
    - Recalculate metrics on demand
    - Update webview with new data
    - _Requirements: 22.9_

- [ ] 28. Implement Analytics state persistence
  - [ ] 28.1 Persist velocity data in workspace state
    - Save VelocityData to workspace state on changes
    - Load VelocityData on extension activation
    - Handle missing or corrupted data gracefully
    - _Requirements: 19.6, 23.3, 23.5_
  
  - [ ] 28.2 Persist last active analytics tab
    - Save active tab name to workspace state
    - Restore active tab when reopening analytics panel
    - Default to Velocity tab if no saved state
    - _Requirements: 23.1, 23.2_
  
  - [ ] 28.3 Implement workspace-specific analytics data
    - Maintain separate velocity data per workspace
    - Load correct data when switching workspaces
    - Clean up data when workspace is removed
    - _Requirements: 23.4_

- [ ] 29. Test and polish Analytics feature
  - [ ] 29.1 Test velocity tracking accuracy
    - Verify task completions are recorded correctly
    - Test with various task types (required, optional)
    - Test with multiple specs and workspaces
    - Verify weekly aggregations are correct
    - _Requirements: 19.1-19.6, 21.1-21.10_
  
  - [ ] 29.2 Test analytics calculations
    - Verify all 10 metrics calculate correctly
    - Test edge cases (no data, single data point, zero division)
    - Test with various time ranges
    - Verify consistency score algorithm
    - _Requirements: 21.1-21.10_
  
  - [ ] 29.3 Test analytics UI and interactions
    - Test tab switching and navigation
    - Test chart rendering with various data sets
    - Test responsive behavior in different editor widths
    - Test theme compatibility (light/dark/high contrast)
    - _Requirements: 20.1-20.12, 22.1-22.10_
  
  - [ ] 29.4 Test analytics state persistence
    - Test velocity data persists across sessions
    - Test active tab restoration
    - Test workspace-specific data isolation
    - Test corrupted data recovery
    - _Requirements: 23.1-23.5_
  
  - [ ] 29.5 Polish analytics UI
    - Refine chart styling and spacing
    - Optimize for information density
    - Ensure consistent VSCode styling
    - Add keyboard navigation support
    - Test accessibility
    - _Requirements: 20.11, 20.12, 22.6, 22.7_

- [ ] 30. Final Analytics checkpoint
  - Ensure all Analytics tests pass
  - Test complete Analytics workflow end-to-end
  - Verify all Analytics requirements are met
  - Ask the user if questions arise
