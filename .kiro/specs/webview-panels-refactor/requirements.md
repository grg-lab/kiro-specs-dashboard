# Requirements Document

## Introduction

This specification defines the requirements for refactoring the Kiro Specs Dashboard extension to open "Manage Profiles" and "Execution History" features in webview panels within the main editor area, following the same pattern as the existing Analytics panel. This refactoring will provide a more consistent user experience and better utilize the IDE's editor space for these management interfaces.

## Glossary

- **Extension**: The Kiro Specs Dashboard VSCode extension
- **Webview_Panel**: A VSCode webview panel displayed in the main editor area (ViewColumn.One)
- **Profile_Manager**: The existing class that manages execution profile CRUD operations via file I/O
- **Execution_History**: The existing class that manages execution history via workspace state (Memento API)
- **Analytics_Panel_Manager**: The existing class that manages the analytics webview panel (reference implementation)
- **Profiles_Panel_Manager**: New class to manage the profiles webview panel
- **History_Panel_Manager**: New class to manage the history webview panel
- **Dashboard_Provider**: The SpecsDashboardProvider class that manages the dashboard webview
- **Message_Protocol**: The postMessage-based communication between webview and extension host

## Requirements

### Requirement 1: Profiles Panel Manager

**User Story:** As a developer, I want to manage execution profiles in a dedicated webview panel, so that I can view, create, edit, and delete profiles in a user-friendly interface.

#### Acceptance Criteria

1. THE Profiles_Panel_Manager SHALL create a webview panel in ViewColumn.One when opened
2. WHEN the profiles panel is created, THE Profiles_Panel_Manager SHALL set retainContextWhenHidden to true
3. WHEN the profiles panel is created, THE Profiles_Panel_Manager SHALL load profiles.html as the webview content
4. WHEN the profiles panel already exists, THE Profiles_Panel_Manager SHALL reveal the existing panel instead of creating a new one
5. WHEN the profiles panel is disposed, THE Profiles_Panel_Manager SHALL clean up resources and set the panel reference to undefined

### Requirement 2: History Panel Manager

**User Story:** As a developer, I want to view execution history in a dedicated webview panel, so that I can analyze past executions and track execution patterns.

#### Acceptance Criteria

1. THE History_Panel_Manager SHALL create a webview panel in ViewColumn.One when opened
2. WHEN the history panel is created, THE History_Panel_Manager SHALL set retainContextWhenHidden to true
3. WHEN the history panel is created, THE History_Panel_Manager SHALL load history.html as the webview content
4. WHEN the history panel already exists, THE History_Panel_Manager SHALL reveal the existing panel instead of creating a new one
5. WHEN the history panel is disposed, THE History_Panel_Manager SHALL clean up resources and set the panel reference to undefined

### Requirement 3: Profiles Webview UI

**User Story:** As a developer, I want a comprehensive profiles management interface, so that I can perform all profile operations in one place.

#### Acceptance Criteria

1. WHEN the profiles webview loads, THE System SHALL display all execution profiles (built-in and custom)
2. WHEN displaying profiles, THE System SHALL show profile name, icon, description, and built-in status
3. WHEN a user clicks "Create Profile", THE System SHALL display a form to create a new profile
4. WHEN a user clicks "Edit" on a profile, THE System SHALL display a form to edit that profile
5. WHEN a user clicks "Delete" on a custom profile, THE System SHALL prompt for confirmation and delete the profile
6. WHEN a user clicks "Reset" on a built-in profile, THE System SHALL prompt for confirmation and reset the profile to defaults
7. WHEN a user views a profile, THE System SHALL display the full prompt template with syntax highlighting
8. THE System SHALL prevent deletion of built-in profiles (MVP and Full)

### Requirement 4: History Webview UI

**User Story:** As a developer, I want a comprehensive execution history interface, so that I can review past executions and analyze execution patterns.

#### Acceptance Criteria

1. WHEN the history webview loads, THE System SHALL display all execution history entries sorted by date (most recent first)
2. WHEN displaying history entries, THE System SHALL show execution ID, spec name, profile name, status, start time, duration, and workspace folder
3. WHEN a user applies filters, THE System SHALL filter history entries by spec, profile, status, or date range
4. WHEN a user clicks "View Details" on an entry, THE System SHALL display detailed execution information
5. WHEN a user clicks "Clear History", THE System SHALL prompt for confirmation and clear all history
6. WHEN the history webview loads, THE System SHALL display execution statistics (total executions, success rate, average duration)
7. THE System SHALL display per-spec and per-profile statistics

### Requirement 5: Message Protocol for Profiles Panel

**User Story:** As a developer, I want reliable communication between the profiles webview and extension host, so that profile operations are executed correctly.

#### Acceptance Criteria

1. WHEN the profiles webview sends a "loadProfiles" message, THE Profiles_Panel_Manager SHALL respond with all profiles
2. WHEN the profiles webview sends a "createProfile" message, THE Profiles_Panel_Manager SHALL validate and create the profile
3. WHEN the profiles webview sends an "updateProfile" message, THE Profiles_Panel_Manager SHALL validate and update the profile
4. WHEN the profiles webview sends a "deleteProfile" message, THE Profiles_Panel_Manager SHALL delete the profile
5. WHEN the profiles webview sends a "resetProfile" message, THE Profiles_Panel_Manager SHALL reset the built-in profile
6. WHEN a profile operation succeeds, THE Profiles_Panel_Manager SHALL send a success message to the webview
7. WHEN a profile operation fails, THE Profiles_Panel_Manager SHALL send an error message with details to the webview

### Requirement 6: Message Protocol for History Panel

**User Story:** As a developer, I want reliable communication between the history webview and extension host, so that history data is displayed and managed correctly.

#### Acceptance Criteria

1. WHEN the history webview sends a "loadHistory" message, THE History_Panel_Manager SHALL respond with all history entries
2. WHEN the history webview sends a "filterHistory" message, THE History_Panel_Manager SHALL respond with filtered entries
3. WHEN the history webview sends a "getStatistics" message, THE History_Panel_Manager SHALL respond with execution statistics
4. WHEN the history webview sends a "clearHistory" message, THE History_Panel_Manager SHALL clear all history
5. WHEN a history operation succeeds, THE History_Panel_Manager SHALL send a success message to the webview
6. WHEN a history operation fails, THE History_Panel_Manager SHALL send an error message with details to the webview

### Requirement 7: Extension Integration

**User Story:** As a developer, I want the new panels to integrate seamlessly with the existing extension, so that the user experience is consistent.

#### Acceptance Criteria

1. WHEN the extension activates, THE Extension SHALL create instances of Profiles_Panel_Manager and History_Panel_Manager
2. WHEN the extension activates, THE Extension SHALL register commands to open the profiles and history panels
3. WHEN the extension activates, THE Extension SHALL inject the panel managers into Dashboard_Provider
4. WHEN the extension deactivates, THE Extension SHALL dispose of the panel managers
5. THE Extension SHALL pass the Profile_Manager instance to Profiles_Panel_Manager for data operations
6. THE Extension SHALL pass the Execution_History instance to History_Panel_Manager for data operations

### Requirement 8: Command Registration

**User Story:** As a developer, I want commands to open the profiles and history panels, so that I can access these features easily.

#### Acceptance Criteria

1. THE Extension SHALL register a "specs-dashboard.openProfiles" command
2. WHEN the "specs-dashboard.openProfiles" command is invoked, THE Extension SHALL open or reveal the profiles panel
3. THE Extension SHALL register a "specs-dashboard.openHistory" command
4. WHEN the "specs-dashboard.openHistory" command is invoked, THE Extension SHALL open or reveal the history panel
5. THE Extension SHALL add these commands to package.json contributes.commands

### Requirement 9: Content Security Policy

**User Story:** As a developer, I want secure webview panels, so that the extension follows VSCode security best practices.

#### Acceptance Criteria

1. WHEN creating webview panels, THE System SHALL apply Content Security Policy (CSP)
2. THE CSP SHALL allow styles from cspSource and unsafe-inline
3. THE CSP SHALL allow scripts only with nonce
4. THE CSP SHALL allow fonts from cspSource
5. THE CSP SHALL set default-src to 'none'

### Requirement 10: VSCode Design System Compliance

**User Story:** As a developer, I want the webview panels to match VSCode's native design, so that the interface feels integrated and familiar.

#### Acceptance Criteria

1. WHEN rendering webview content, THE System SHALL use VSCode CSS variables for colors
2. WHEN rendering webview content, THE System SHALL use VSCode font family and sizes
3. WHEN rendering buttons and inputs, THE System SHALL use VSCode button and input styles
4. WHEN rendering icons, THE System SHALL use VSCode codicons
5. THE System SHALL follow VSCode spacing and layout conventions

### Requirement 11: Error Handling

**User Story:** As a developer, I want clear error messages when operations fail, so that I can understand and resolve issues.

#### Acceptance Criteria

1. WHEN a profile validation fails, THE System SHALL display specific validation errors
2. WHEN a file operation fails, THE System SHALL display a user-friendly error message
3. WHEN a history operation fails, THE System SHALL display a user-friendly error message
4. WHEN an error occurs, THE System SHALL log detailed error information to the output channel
5. THE System SHALL handle network and permission errors gracefully

### Requirement 12: Data Layer Separation

**User Story:** As a developer, I want clear separation between UI and data layers, so that the code is maintainable and testable.

#### Acceptance Criteria

1. THE Profiles_Panel_Manager SHALL use Profile_Manager for all profile data operations
2. THE History_Panel_Manager SHALL use Execution_History for all history data operations
3. THE panel managers SHALL NOT directly access file system or workspace state
4. THE panel managers SHALL handle UI concerns (webview lifecycle, message passing)
5. THE data layer classes SHALL remain unchanged and continue to handle business logic
