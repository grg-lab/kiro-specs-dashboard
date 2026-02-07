# Implementation Plan: Webview Panels Refactor

## Overview

This implementation refactors the Manage Profiles and Execution History features to use webview panels in the main editor area, following the established pattern from `AnalyticsPanelManager`. The implementation will be done incrementally, with testing integrated throughout to ensure correctness.

## Tasks

- [x] 1. Set up type definitions and message protocols
  - Add ProfilesWebviewMessage and ProfilesExtensionMessage types to types.ts
  - Add HistoryWebviewMessage and HistoryExtensionMessage types to types.ts
  - Add ProfilesViewState and HistoryViewState interfaces to types.ts
  - _Requirements: 5.1-5.7, 6.1-6.6_

- [x] 2. Implement ProfilesPanelManager
  - [x] 2.1 Create ProfilesPanelManager class with constructor and basic structure
    - Implement constructor accepting context, profileManager, and outputChannel
    - Add private fields for panel, profileManager, context, and outputChannel
    - Follow the same pattern as AnalyticsPanelManager
    - _Requirements: 1.1, 7.5, 12.1_

  - [x] 2.2 Implement openProfiles method
    - Check if panel exists and reveal it, or create new panel
    - Call createPanel if panel doesn't exist
    - _Requirements: 1.1, 1.4_

  - [x] 2.3 Implement createPanel method
    - Create webview panel with ViewColumn.One
    - Set retainContextWhenHidden to true
    - Load profiles.html content via getHtmlContent
    - Set up message handling via setupMessageHandling
    - Handle panel disposal
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 9.1-9.5_

  - [x] 2.4 Implement setupMessageHandling method
    - Handle loadProfiles message → call handleLoadProfiles
    - Handle createProfile message → call handleCreateProfile
    - Handle updateProfile message → call handleUpdateProfile
    - Handle deleteProfile message → call handleDeleteProfile
    - Handle resetProfile message → call handleResetProfile
    - _Requirements: 5.1-5.7_

  - [x] 2.5 Implement message handler methods
    - Implement handleLoadProfiles: load all profiles and send to webview
    - Implement handleCreateProfile: validate and create profile, send response
    - Implement handleUpdateProfile: validate and update profile, send response
    - Implement handleDeleteProfile: delete profile, send response
    - Implement handleResetProfile: reset built-in profile, send response
    - All handlers should catch errors and send error messages
    - _Requirements: 5.1-5.7, 11.1, 11.4, 12.1_

  - [x] 2.6 Implement getHtmlContent method
    - Load profiles.html from src/webview/profiles.html
    - Replace placeholders: cspSource, nonce, codiconsUri
    - Generate nonce via getNonce method
    - Include fallback HTML if file load fails
    - _Requirements: 1.3, 9.1-9.5_

  - [x] 2.7 Implement getNonce and dispose methods
    - Implement getNonce: generate random 32-character string
    - Implement dispose: dispose panel and set to undefined
    - _Requirements: 1.5, 9.3_

  - [ ]* 2.8 Write unit tests for ProfilesPanelManager
    - Test panel creation with correct configuration
    - Test panel reveal when already exists
    - Test message handling for each operation type
    - Test error handling for invalid profile data
    - Test resource cleanup on disposal
    - _Requirements: 1.1-1.5, 5.1-5.7_

  - [ ]* 2.9 Write property test for panel idempotence
    - **Property 1: Panel Idempotence**
    - **Validates: Requirements 1.4**

- [x] 3. Implement HistoryPanelManager
  - [x] 3.1 Create HistoryPanelManager class with constructor and basic structure
    - Implement constructor accepting context, executionHistory, and outputChannel
    - Add private fields for panel, executionHistory, context, and outputChannel
    - Follow the same pattern as ProfilesPanelManager
    - _Requirements: 2.1, 7.6, 12.2_

  - [x] 3.2 Implement openHistory method
    - Check if panel exists and reveal it, or create new panel
    - Call createPanel if panel doesn't exist
    - _Requirements: 2.1, 2.4_

  - [x] 3.3 Implement createPanel method
    - Create webview panel with ViewColumn.One
    - Set retainContextWhenHidden to true
    - Load history.html content via getHtmlContent
    - Set up message handling via setupMessageHandling
    - Handle panel disposal
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 9.1-9.5_

  - [x] 3.4 Implement setupMessageHandling method
    - Handle loadHistory message → call handleLoadHistory
    - Handle filterHistory message → call handleFilterHistory
    - Handle getStatistics message → call handleGetStatistics
    - Handle clearHistory message → call handleClearHistory
    - _Requirements: 6.1-6.6_

  - [x] 3.5 Implement message handler methods
    - Implement handleLoadHistory: load all entries and send to webview
    - Implement handleFilterHistory: filter entries and send to webview
    - Implement handleGetStatistics: calculate stats and send to webview
    - Implement handleClearHistory: clear history and send confirmation
    - All handlers should catch errors and send error messages
    - _Requirements: 6.1-6.6, 11.3, 11.4, 12.2_

  - [x] 3.6 Implement getHtmlContent method
    - Load history.html from src/webview/history.html
    - Replace placeholders: cspSource, nonce, codiconsUri
    - Generate nonce via getNonce method
    - Include fallback HTML if file load fails
    - _Requirements: 2.3, 9.1-9.5_

  - [x] 3.7 Implement getNonce and dispose methods
    - Implement getNonce: generate random 32-character string
    - Implement dispose: dispose panel and set to undefined
    - _Requirements: 2.5, 9.3_

  - [ ]* 3.8 Write unit tests for HistoryPanelManager
    - Test panel creation with correct configuration
    - Test panel reveal when already exists
    - Test message handling for each operation type
    - Test statistics calculation edge cases
    - Test resource cleanup on disposal
    - _Requirements: 2.1-2.5, 6.1-6.6_

  - [ ]* 3.9 Write property test for panel idempotence
    - **Property 1: Panel Idempotence (History)**
    - **Validates: Requirements 2.4**

- [x] 4. Create profiles.html webview
  - [x] 4.1 Create HTML structure with VSCode design system
    - Create src/webview/profiles.html
    - Add CSP meta tag with placeholders
    - Add VSCode codicons stylesheet link
    - Create container with profile list, create form, and edit form sections
    - Use VSCode CSS variables for all styling
    - _Requirements: 3.1-3.8, 9.1-9.5, 10.1-10.4_

  - [x] 4.2 Implement profile list rendering
    - Create JavaScript function to render profile cards
    - Display profile name, icon (codicon), description, and built-in badge
    - Add Edit button for all profiles
    - Add Delete button only for custom profiles
    - Add Reset button only for built-in profiles
    - _Requirements: 3.1, 3.2, 3.8_

  - [x] 4.3 Implement create profile form
    - Create form with fields: id, name, icon, promptTemplate, description
    - Add validation for required fields
    - Add "Create" and "Cancel" buttons
    - Show/hide form based on user action
    - _Requirements: 3.3_

  - [x] 4.4 Implement edit profile form
    - Create form pre-populated with profile data
    - Disable ID field (cannot change)
    - Add "Save" and "Cancel" buttons
    - Show/hide form based on user action
    - _Requirements: 3.4_

  - [x] 4.5 Implement profile detail view
    - Display full prompt template with syntax highlighting
    - Show all profile metadata
    - Use highlight.js for template syntax highlighting
    - _Requirements: 3.7_

  - [x] 4.6 Implement message protocol (webview side)
    - Send loadProfiles message on load
    - Send createProfile message on form submit
    - Send updateProfile message on edit form submit
    - Send deleteProfile message on delete button click (with confirmation)
    - Send resetProfile message on reset button click (with confirmation)
    - Handle response messages and update UI
    - _Requirements: 5.1-5.7_

  - [ ]* 4.7 Write property test for profile rendering completeness
    - **Property 2: Profile Rendering Completeness**
    - **Validates: Requirements 3.2**

  - [ ]* 4.8 Write property test for built-in profile protection
    - **Property 9: Built-in Profile Protection**
    - **Validates: Requirements 3.8**

- [x] 5. Create history.html webview
  - [x] 5.1 Create HTML structure with VSCode design system
    - Create src/webview/history.html
    - Add CSP meta tag with placeholders
    - Add VSCode codicons stylesheet link
    - Create container with history list, filters, and statistics sections
    - Use VSCode CSS variables for all styling
    - _Requirements: 4.1-4.7, 9.1-9.5, 10.1-10.4_

  - [x] 5.2 Implement history list rendering
    - Create JavaScript function to render history entries
    - Display execution ID, spec name, profile name, status, start time, duration, workspace folder
    - Add status badges with color coding
    - Add "View Details" button for each entry
    - Sort entries by date (most recent first)
    - _Requirements: 4.1, 4.2_

  - [x] 5.3 Implement filter controls
    - Create filter form with fields: spec, profile, status, date range
    - Add "Apply Filters" and "Clear Filters" buttons
    - Update history list when filters change
    - _Requirements: 4.3_

  - [x] 5.4 Implement statistics display
    - Display total executions, success rate, average duration
    - Display per-spec statistics table
    - Display per-profile statistics table
    - Update statistics when history changes
    - _Requirements: 4.6, 4.7_

  - [x] 5.5 Implement detail view
    - Show detailed execution information in modal or expanded view
    - Display all entry fields including error messages if failed
    - Add "Close" button to return to list
    - _Requirements: 4.4_

  - [x] 5.6 Implement clear history action
    - Add "Clear History" button
    - Show confirmation dialog before clearing
    - Send clearHistory message on confirmation
    - _Requirements: 4.5_

  - [x] 5.7 Implement message protocol (webview side)
    - Send loadHistory message on load
    - Send filterHistory message when filters applied
    - Send getStatistics message on load and after changes
    - Send clearHistory message on clear button click (with confirmation)
    - Handle response messages and update UI
    - _Requirements: 6.1-6.6_

  - [ ]* 5.8 Write property test for history rendering completeness
    - **Property 3: History Rendering Completeness**
    - **Validates: Requirements 4.2**

  - [ ]* 5.9 Write property test for history sorting correctness
    - **Property 4: History Sorting Correctness**
    - **Validates: Requirements 4.1**

  - [ ]* 5.10 Write property test for history filtering correctness
    - **Property 5: History Filtering Correctness**
    - **Validates: Requirements 4.3**

  - [ ]* 5.11 Write property test for statistics calculation correctness
    - **Property 6: Statistics Calculation Correctness**
    - **Validates: Requirements 4.6, 4.7, 6.3**

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Integrate panel managers into extension
  - [x] 7.1 Update extension.ts to create panel managers
    - Import ProfilesPanelManager and HistoryPanelManager
    - Create instances in activate function
    - Pass profileManager to ProfilesPanelManager
    - Pass executionHistory to HistoryPanelManager
    - Add managers to context.subscriptions for disposal
    - _Requirements: 7.1, 7.3, 7.4, 7.5, 7.6_

  - [x] 7.2 Register commands in extension.ts
    - Register specs-dashboard.openProfiles command
    - Register specs-dashboard.openHistory command
    - Wire commands to panel manager open methods
    - Add commands to context.subscriptions
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 7.3 Update package.json with new commands
    - Add specs-dashboard.openProfiles to contributes.commands
    - Add specs-dashboard.openHistory to contributes.commands
    - Set appropriate titles and icons
    - _Requirements: 8.5_

  - [x] 7.4 Inject panel managers into SpecsDashboardProvider
    - Add setProfilesPanelManager method to SpecsDashboardProvider
    - Add setHistoryPanelManager method to SpecsDashboardProvider
    - Call these methods from extension.ts after creating managers
    - _Requirements: 7.3_

  - [ ]* 7.5 Write integration tests for extension activation
    - Test that managers are created during activation
    - Test that commands are registered
    - Test that managers are injected into dashboard provider
    - Test that managers are disposed on deactivation
    - _Requirements: 7.1-7.6, 8.1-8.4_

- [x] 8. Add dashboard UI integration
  - [x] 8.1 Add "Manage Profiles" button to dashboard
    - Add button to dashboard.html
    - Send message to extension to open profiles panel
    - Use codicon for button icon
    - _Requirements: 8.2_

  - [x] 8.2 Add "View History" button to dashboard
    - Add button to dashboard.html
    - Send message to extension to open history panel
    - Use codicon for button icon
    - _Requirements: 8.4_

  - [x] 8.3 Handle dashboard messages in SpecsDashboardProvider
    - Add handler for openProfiles message
    - Add handler for openHistory message
    - Call appropriate panel manager methods
    - _Requirements: 7.3_

- [x] 9. Write comprehensive property tests
  - [x]* 9.1 Write property test for message protocol round-trip
    - **Property 7: Message Protocol Round-Trip**
    - **Validates: Requirements 5.1-5.7, 6.1-6.6**

  - [x]* 9.2 Write property test for profile operation validation
    - **Property 8: Profile Operation Validation**
    - **Validates: Requirements 5.2, 5.3, 5.7, 11.1**

  - [x]* 9.3 Write property test for error propagation
    - **Property 10: Error Propagation**
    - **Validates: Requirements 5.7, 6.6, 11.1, 11.2, 11.3, 11.4**

  - [x] 9.4 Write property test for data layer delegation
    - **Property 11: Data Layer Delegation**
    - **Validates: Requirements 12.1, 12.2, 12.3**

- [ ] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Follow the AnalyticsPanelManager pattern for consistency
- Use VSCode design system for all UI elements
- Maintain clear separation between UI (panel managers) and data layers
