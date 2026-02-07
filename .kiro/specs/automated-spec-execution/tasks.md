# Implementation Plan: Automated Spec Execution

## Overview

This implementation plan breaks down the Automated Spec Execution feature into discrete coding tasks. The approach follows the existing extension architecture, adding three new managers (ProfileManager, ExecutionManager, ExecutionHistory) and extending the webview UI with execution controls, profile settings, and history panels.

## Tasks

- [x] 1. Set up core types and data models
  - Add ExecutionProfile, ExecutionState, ExecutionHistoryEntry, and related types to `src/types.ts`
  - Define message types for profile management, execution, and history
  - Define template variable types and validation result types
  - _Requirements: 1.1, 2.1, 4.1, 5.1, 6.1_

- [x] 2. Implement ProfileManager
  - [x] 2.1 Create ProfileManager class with file I/O operations
    - Implement loadProfiles() to read from `.kiro/execution-profiles.json`
    - Implement createProfile(), updateProfile(), deleteProfile() with validation
    - Implement getBuiltInProfiles() returning MVP and Full profiles
    - Handle file system errors with fallback to built-in profiles
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2_

  - [ ] 2.2 Write property test for profile persistence round-trip
    - **Property 1: Profile Persistence Round-Trip**
    - **Validates: Requirements 1.6**

  - [x] 2.3 Write property test for profile validation
    - **Property 2: Profile Validation Rejects Invalid Profiles**
    - **Validates: Requirements 1.3**

  - [ ]* 2.4 Write property test for built-in profile deletion prevention
    - **Property 3: Built-In Profile Deletion Prevention**
    - **Validates: Requirements 1.5, 3.4**

  - [ ]* 2.5 Write property test for custom profile deletion
    - **Property 4: Custom Profile Deletion Success**
    - **Validates: Requirements 1.5**

  - [ ]* 2.6 Write property test for profile updates
    - **Property 5: Profile Update Persistence**
    - **Validates: Requirements 1.4**

  - [ ]* 2.7 Write unit tests for malformed JSON handling
    - Test malformed profiles file returns built-in profiles only
    - Test missing profiles file creates default file
    - _Requirements: 1.7, 10.1_

- [x] 3. Implement template system
  - [x] 3.1 Add template instantiation to ProfileManager
    - Implement instantiateTemplate() with variable substitution
    - Support standard variables: {{specName}}, {{specPath}}, {{totalTasks}}, {{completedTasks}}, {{remainingTasks}}, {{workspaceFolder}}
    - Escape special characters in variable values
    - Leave unknown variables unchanged
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 3.2 Write property test for template variable substitution
    - **Property 6: Template Variable Substitution**
    - **Validates: Requirements 2.3**

  - [ ]* 3.3 Write property test for unknown variable preservation
    - **Property 7: Unknown Variable Preservation**
    - **Validates: Requirements 2.4**

  - [ ]* 3.4 Write property test for special character escaping
    - **Property 8: Special Character Escaping**
    - **Validates: Requirements 2.5**

  - [ ]* 3.5 Write unit test for standard variables
    - Test all standard variables are replaced correctly
    - _Requirements: 2.2_

- [x] 4. Implement ExecutionManager
  - [x] 4.1 Create ExecutionManager class with state management
    - Implement executeSpec() to trigger execution via Kiro command API
    - Implement state machine: idle → running → completed/failed/cancelled
    - Implement cancelExecution() to transition to cancelled state
    - Track active executions in Map<specId, ExecutionState>
    - Persist execution state to workspace state
    - _Requirements: 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 7.2_

  - [ ]* 4.2 Write property test for execution state transitions
    - **Property 10: Execution State Transitions**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

  - [ ]* 4.3 Write property test for Kiro command invocation
    - **Property 17: Kiro Command Invocation**
    - **Validates: Requirements 4.3**

  - [ ]* 4.4 Write property test for execution state persistence
    - **Property 16: Execution State Persistence Round-Trip**
    - **Validates: Requirements 5.5**

  - [ ]* 4.5 Write unit tests for error handling
    - Test Kiro command API unavailable
    - Test Kiro command execution failure
    - _Requirements: 4.5, 10.3_

- [x] 5. Checkpoint - Ensure core managers compile and basic tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement ExecutionHistory
  - [x] 6.1 Create ExecutionHistory class with workspace state persistence
    - Implement addEntry() to create new history entries
    - Implement updateEntry() to update existing entries
    - Implement getAllEntries() with sorting by timestamp (descending)
    - Implement queryEntries() with filtering support
    - Persist history to workspace state using Memento API
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6_

  - [ ]* 6.2 Write property test for history entry creation
    - **Property 11: Execution History Entry Creation**
    - **Validates: Requirements 4.4, 6.1**

  - [ ]* 6.3 Write property test for history entry completion
    - **Property 12: Execution History Entry Completion**
    - **Validates: Requirements 6.2**

  - [ ]* 6.4 Write property test for history persistence round-trip
    - **Property 13: Execution History Persistence Round-Trip**
    - **Validates: Requirements 6.3**

  - [ ]* 6.5 Write property test for history sorting
    - **Property 14: Execution History Sorting**
    - **Validates: Requirements 6.4**

  - [ ]* 6.6 Write property test for history filtering
    - **Property 15: Execution History Filtering**
    - **Validates: Requirements 6.6**

  - [ ]* 6.7 Write unit tests for history edge cases
    - Test empty history
    - Test history with thousands of entries
    - _Requirements: 6.3_

- [x] 7. Integrate managers with extension host
  - [x] 7.1 Initialize managers in extension.ts
    - Create ProfileManager, ExecutionManager, ExecutionHistory instances
    - Pass StateManager and workspace folders to managers
    - Set up file watcher for execution-profiles.json
    - Register cleanup in context.subscriptions
    - _Requirements: 1.1, 11.4_

  - [x] 7.2 Add message handlers to SpecsDashboardProvider
    - Handle createProfile, updateProfile, deleteProfile messages
    - Handle executeSpec, cancelExecution messages
    - Handle getProfiles, getExecutionHistory messages
    - Handle resetBuiltInProfile message
    - Send profilesUpdated, executionStateChanged, executionHistoryUpdated messages to webview
    - _Requirements: 1.3, 1.4, 1.5, 4.1, 4.2, 6.4, 3.5_

  - [ ]* 7.3 Write property test for external profile file changes detection
    - **Property 23: External Profile File Changes Detection**
    - **Validates: Requirements 11.4**

- [x] 8. Implement task progress monitoring
  - [x] 8.1 Add file watcher for tasks.md changes during execution
    - Watch tasks.md files for active executions
    - Parse task completion status on file change
    - Update ExecutionState with new completedTasks count
    - Send executionStateChanged message to webview
    - Update ExecutionHistory entry with progress
    - _Requirements: 12.1, 12.2, 12.5_

  - [ ]* 8.2 Write property test for task progress updates
    - **Property 18: Task Progress Updates**
    - **Validates: Requirements 12.1, 12.2, 12.5**

  - [ ]* 8.3 Write unit tests for task parsing
    - Test parsing various task formats
    - Test counting completed vs total tasks
    - _Requirements: 12.1_

- [x] 9. Checkpoint - Ensure extension host integration works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement webview UI for execution controls
  - [x] 10.1 Add execution button and profile dropdown to spec cards
    - Add execution button with dropdown icon to each spec card
    - Populate dropdown with available profiles (name + icon)
    - Send executeSpec message when profile is selected
    - Display execution status indicator (Running/Completed/Failed/Cancelled)
    - Display progress indicator (X/Y tasks completed)
    - Add cancel button when execution is running
    - _Requirements: 4.1, 5.1, 5.2, 5.3, 7.1, 12.3_

  - [ ]* 10.2 Write property test for profile dropdown contents
    - **Property 25: Profile Dropdown Contains All Profiles**
    - **Validates: Requirements 4.1, 8.1**

  - [ ]* 10.3 Write unit tests for execution UI states
    - Test UI rendering for each execution state
    - Test cancel button visibility
    - _Requirements: 5.1, 5.2, 5.3, 7.1_

- [x] 11. Implement profile settings UI in webview
  - [x] 11.1 Create profile settings panel
    - Add "Manage Profiles" button to dashboard header
    - Display list of all profiles with name, icon, and actions
    - Add "Create New Profile" button
    - Show edit and delete buttons for each profile
    - Prevent deletion of built-in profiles (disable button)
    - _Requirements: 8.1, 8.6_

  - [x] 11.2 Create profile create/edit form
    - Add modal form with fields: name, icon (dropdown), promptTemplate (textarea)
    - Display template variable documentation below form
    - Validate required fields before submission
    - Send createProfile or updateProfile message on submit
    - Pre-fill form when editing existing profile
    - _Requirements: 8.2, 8.4, 8.7_

  - [ ]* 11.3 Write property test for profile form pre-fill
    - **Property 24: Profile Edit Form Pre-Fill** (custom property for UI)
    - Test form is populated with correct profile data
    - _Requirements: 8.4_

  - [ ]* 11.4 Write unit tests for profile settings UI
    - Test profile list rendering
    - Test built-in profile delete button disabled
    - Test template variable documentation display
    - _Requirements: 8.1, 8.7_

- [x] 12. Implement execution history panel in webview
  - [x] 12.1 Create history panel UI
    - Add "Execution History" button to dashboard header
    - Display list of history entries sorted by timestamp (most recent first)
    - Show: spec name, profile name, status, start time, duration
    - Add filter controls: spec dropdown, profile dropdown, status dropdown, date range
    - Implement click handler to show entry details
    - _Requirements: 6.4, 6.5, 6.6_

  - [x] 12.2 Create history entry detail view
    - Display full entry information: spec, profile, workspace folder, timestamps, duration, task progress, error (if failed)
    - Add close button to return to history list
    - _Requirements: 6.5_

  - [ ]* 12.3 Write property test for history entry details
    - **Property 26: History Entry Contains Required Fields** (custom property)
    - Test entry contains all required fields
    - _Requirements: 6.5_

  - [ ]* 12.4 Write unit tests for history filtering UI
    - Test filter controls update displayed entries
    - Test multiple filter criteria combined
    - _Requirements: 6.6_

- [x] 13. Implement multi-workspace support
  - [x] 13.1 Add workspace folder handling to ProfileManager
    - Load profiles from all workspace folders
    - Tag each profile with source workspace folder
    - Handle profile ID conflicts by prefixing with workspace folder name
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 13.2 Add workspace folder filtering to ExecutionManager
    - Filter available profiles by spec's workspace folder
    - Track workspace folder in execution state
    - _Requirements: 9.4_

  - [x] 13.3 Add workspace folder tracking to ExecutionHistory
    - Include workspaceFolder field in all history entries
    - Support filtering by workspace folder
    - _Requirements: 9.5_

  - [ ]* 13.4 Write property test for multi-workspace profile loading
    - **Property 19: Multi-Workspace Profile Loading**
    - **Validates: Requirements 9.2**

  - [ ]* 13.5 Write property test for workspace-specific profile usage
    - **Property 20: Workspace-Specific Profile Usage**
    - **Validates: Requirements 9.4**

  - [ ]* 13.6 Write property test for history workspace tracking
    - **Property 21: History Entry Workspace Tracking**
    - **Validates: Requirements 9.5**

- [x] 14. Implement built-in profile features
  - [x] 14.1 Add built-in profile reset functionality
    - Implement resetBuiltInProfile() in ProfileManager
    - Add "Reset to Default" button for built-in profiles in UI
    - Handle resetBuiltInProfile message in extension host
    - _Requirements: 3.5_

  - [x] 14.2 Add built-in profile edit persistence
    - Allow editing built-in profile templates
    - Persist edits to profiles file
    - Maintain isBuiltIn flag after edits
    - _Requirements: 3.3_

  - [ ]* 14.3 Write property test for built-in profile reset
    - **Property 9: Built-In Profile Reset Round-Trip**
    - **Validates: Requirements 3.5**

  - [ ]* 14.4 Write property test for built-in profile edit persistence
    - **Property 27: Built-In Profile Edit Persistence** (custom property)
    - Test edits to built-in profiles are persisted
    - _Requirements: 3.3_

- [x] 15. Implement error handling and validation
  - [x] 15.1 Add comprehensive error handling to ProfileManager
    - Handle file read/write errors with user-friendly messages
    - Validate profile structure and return detailed validation errors
    - Handle malformed JSON with fallback to built-in profiles
    - _Requirements: 1.7, 10.1, 10.2_

  - [x] 15.2 Add error handling to ExecutionManager
    - Check Kiro command availability before execution
    - Handle command execution failures gracefully
    - Display error messages in webview UI
    - _Requirements: 4.5, 10.3_

  - [x] 15.3 Add error handling to ExecutionHistory
    - Handle workspace state persistence failures
    - Continue operation with in-memory history on errors
    - Log errors with detailed context
    - _Requirements: 10.5_

  - [ ]* 15.4 Write property test for profile validation error messages
    - **Property 22: Profile Validation Error Messages**
    - **Validates: Requirements 10.2**

  - [ ]* 15.5 Write unit tests for all error conditions
    - Test file system errors
    - Test Kiro API unavailable
    - Test workspace state persistence failure
    - Test merge conflicts in profiles file
    - _Requirements: 10.1, 10.3, 10.4, 10.5, 11.5_

- [x] 16. Implement execution cancellation
  - [x] 16.1 Add cancellation support to ExecutionManager
    - Implement cancelExecution() to update state to "cancelled"
    - Update history entry with cancellation timestamp
    - Send state update to webview
    - Remove cancel button from UI after cancellation
    - _Requirements: 7.2, 7.3, 7.5_

  - [ ]* 16.2 Write property test for execution cancellation
    - **Property 24: Execution Cancellation State Update**
    - **Validates: Requirements 7.3**

  - [ ]* 16.3 Write unit tests for cancellation edge cases
    - Test cancellation immediately after start
    - Test cancellation of already completed execution
    - _Requirements: 7.2_

- [x] 17. Checkpoint - Ensure all features work end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Add profile sharing and version control support
  - [x] 18.1 Add JSON formatting preservation to ProfileManager
    - Use pretty-printed JSON when writing profiles file
    - Add comments to default profiles file explaining structure
    - Document available template variables in file header
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 18.2 Add file watcher for external profile changes
    - Watch execution-profiles.json for external modifications
    - Reload profiles automatically when file changes
    - Handle merge conflicts gracefully
    - _Requirements: 11.4, 11.5_

  - [ ]* 18.3 Write unit test for profile file documentation
    - Test default profiles file contains documentation comments
    - _Requirements: 11.2_

- [x] 19. Add execution statistics and analytics
  - [x] 19.1 Implement getStatistics() in ExecutionHistory
    - Calculate total executions, success rate, average duration
    - Group statistics by spec and profile
    - Return ExecutionStatistics object
    - _Requirements: 6.6_

  - [x] 19.2 Add statistics display to history panel
    - Show summary statistics at top of history panel
    - Display per-spec and per-profile statistics
    - _Requirements: 6.6_

  - [ ]* 19.3 Write unit tests for statistics calculation
    - Test statistics with various history sets
    - Test edge cases (empty history, all failed, etc.)
    - _Requirements: 6.6_

- [x] 20. Final integration and polish
  - [x] 20.1 Wire all components together
    - Ensure all message handlers are connected
    - Verify file watchers are properly disposed
    - Test complete flow: create profile → execute spec → view history
    - _Requirements: All_

  - [x] 20.2 Add logging and diagnostics
    - Add detailed logging to output channel for debugging
    - Log all profile operations, executions, and errors
    - Include timestamps and context in log messages
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 20.3 Write integration tests
    - Test complete execution flow from UI to Kiro command
    - Test profile creation → execution → history recording
    - Test multi-workspace scenarios
    - _Requirements: All_

- [x] 21. Final checkpoint - Ensure all tests pass and feature is complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties (minimum 100 iterations)
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end workflows
- All property tests must include comment tag: `// Feature: automated-spec-execution, Property N: [property title]`
