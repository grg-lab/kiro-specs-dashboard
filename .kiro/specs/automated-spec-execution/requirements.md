# Requirements Document

## Introduction

The Automated Spec Execution feature enables developers to execute all tasks from a spec with a single click by leveraging customizable execution profiles (prompt templates). This feature streamlines the development workflow by automating the process of sending structured prompts to Kiro's chat interface, tracking execution progress, and maintaining a history of all execution attempts.

## Glossary

- **Execution_Profile**: A named template containing a prompt pattern with variable placeholders that can be instantiated with spec-specific data
- **Profile_Manager**: The component responsible for creating, reading, updating, and deleting execution profiles
- **Execution_Manager**: The component responsible for triggering and monitoring spec executions
- **Execution_History**: A persistent log of all execution attempts with metadata including timestamps, status, and task progress
- **Template_Variable**: A placeholder in a prompt template (e.g., {{specName}}) that gets replaced with actual spec data
- **Built_In_Profile**: A pre-configured execution profile (MVP or Full) that ships with the extension
- **Custom_Profile**: A user-created execution profile with custom prompt templates
- **Kiro_Chat_Interface**: The VSCode command API endpoint for sending messages to Kiro's chat

## Requirements

### Requirement 1: Execution Profile Management

**User Story:** As a developer, I want to create and manage execution profiles with custom prompt templates, so that I can standardize how specs are executed across my team.

#### Acceptance Criteria

1. THE Profile_Manager SHALL store execution profiles in a `.kiro/execution-profiles.json` file within the workspace root
2. WHEN a workspace is opened for the first time, THE Profile_Manager SHALL create default built-in profiles (MVP and Full) if the profiles file does not exist
3. WHEN a user creates a new profile, THE Profile_Manager SHALL validate that the profile contains required fields (id, name, promptTemplate) and persist it to the profiles file
4. WHEN a user updates an existing profile, THE Profile_Manager SHALL validate the changes and persist the updated profile to the profiles file
5. WHEN a user deletes a profile, THE Profile_Manager SHALL remove it from the profiles file and prevent deletion of built-in profiles
6. WHEN reading profiles, THE Profile_Manager SHALL parse the JSON file and return all valid profiles
7. IF the profiles file is malformed, THEN THE Profile_Manager SHALL log an error and return only the built-in profiles

### Requirement 2: Profile Template System

**User Story:** As a developer, I want to use template variables in my execution profiles, so that prompts are automatically customized for each spec.

#### Acceptance Criteria

1. THE Profile_Manager SHALL support template variables in the format {{variableName}}
2. THE Profile_Manager SHALL provide these standard variables: {{specName}}, {{specPath}}, {{totalTasks}}, {{completedTasks}}, {{remainingTasks}}, {{workspaceFolder}}
3. WHEN instantiating a profile template, THE Profile_Manager SHALL replace all template variables with corresponding spec data
4. WHEN a template variable is not recognized, THE Profile_Manager SHALL leave it unchanged in the output
5. THE Profile_Manager SHALL escape special characters in variable values to prevent injection attacks

### Requirement 3: Built-In Execution Profiles

**User Story:** As a developer, I want pre-configured execution profiles for common scenarios, so that I can start using the feature immediately without configuration.

#### Acceptance Criteria

1. THE Profile_Manager SHALL provide an "MVP" built-in profile that instructs Kiro to execute only required tasks
2. THE Profile_Manager SHALL provide a "Full" built-in profile that instructs Kiro to execute all tasks including optional ones
3. WHEN built-in profiles are edited by the user, THE Profile_Manager SHALL persist the changes to the profiles file
4. WHEN built-in profiles are deleted, THE Profile_Manager SHALL prevent deletion and display an error message
5. THE Profile_Manager SHALL allow users to reset built-in profiles to their default templates

### Requirement 4: Execution Triggering

**User Story:** As a developer, I want to trigger spec execution from the dashboard UI, so that I can start automated task execution with a single click.

#### Acceptance Criteria

1. WHEN a user clicks the execution button on a spec card, THE Dashboard SHALL display a dropdown menu with all available execution profiles
2. WHEN a user selects a profile from the dropdown, THE Execution_Manager SHALL instantiate the profile template with the spec's data
3. WHEN the template is instantiated, THE Execution_Manager SHALL send the resulting prompt to Kiro via the `vscode.commands.executeCommand('workbench.action.chat.open', { query: prompt })` API
4. WHEN execution is triggered, THE Execution_Manager SHALL create an execution history entry with status "running"
5. IF the Kiro command fails, THEN THE Execution_Manager SHALL update the execution status to "failed" and log the error

### Requirement 5: Execution State Management

**User Story:** As a developer, I want to see the current execution state of my specs, so that I know which specs are actively being executed.

#### Acceptance Criteria

1. WHEN an execution starts, THE Execution_Manager SHALL update the spec card UI to display "Running..." status
2. WHEN an execution completes, THE Execution_Manager SHALL update the spec card UI to display "Completed" status
3. WHEN an execution fails, THE Execution_Manager SHALL update the spec card UI to display "Failed" status with error details
4. WHEN a user cancels an execution, THE Execution_Manager SHALL update the status to "Cancelled"
5. THE Execution_Manager SHALL persist execution state in workspace state to survive VSCode restarts
6. WHEN the dashboard is reopened, THE Execution_Manager SHALL restore execution states from workspace state

### Requirement 6: Execution History Tracking

**User Story:** As a developer, I want to view a history of all spec executions, so that I can track progress and debug issues.

#### Acceptance Criteria

1. WHEN an execution is triggered, THE Execution_History SHALL create a new history entry with timestamp, spec name, profile name, and initial status
2. WHEN an execution completes, THE Execution_History SHALL update the entry with end timestamp and final status
3. THE Execution_History SHALL persist all history entries in workspace state using VSCode Memento API
4. WHEN a user opens the history panel, THE Execution_History SHALL display all entries sorted by timestamp (most recent first)
5. WHEN a user clicks on a history entry, THE Execution_History SHALL display detailed information including duration, profile used, and status
6. THE Execution_History SHALL support filtering entries by spec name, profile name, status, and date range

### Requirement 7: Execution Cancellation

**User Story:** As a developer, I want to cancel a running execution, so that I can stop automated task execution if needed.

#### Acceptance Criteria

1. WHEN an execution is running, THE Dashboard SHALL display a "Cancel" button on the spec card
2. WHEN a user clicks the cancel button, THE Execution_Manager SHALL update the execution status to "Cancelled"
3. WHEN an execution is cancelled, THE Execution_Manager SHALL update the history entry with cancellation timestamp and status
4. THE Execution_Manager SHALL not attempt to stop Kiro's ongoing task execution (as this is outside the extension's control)
5. WHEN an execution is cancelled, THE Dashboard SHALL remove the "Running..." indicator from the spec card

### Requirement 8: Profile Settings UI

**User Story:** As a developer, I want a user interface for managing execution profiles, so that I can create, edit, and delete profiles without manually editing JSON files.

#### Acceptance Criteria

1. WHEN a user opens the profile settings, THE Dashboard SHALL display a list of all available profiles with their names and icons
2. WHEN a user clicks "Create New Profile", THE Dashboard SHALL display a form with fields for name, icon, and prompt template
3. WHEN a user submits the create form, THE Profile_Manager SHALL validate the input and create the new profile
4. WHEN a user clicks "Edit" on a profile, THE Dashboard SHALL display a form pre-filled with the profile's current values
5. WHEN a user submits the edit form, THE Profile_Manager SHALL validate the input and update the profile
6. WHEN a user clicks "Delete" on a custom profile, THE Profile_Manager SHALL remove the profile after confirmation
7. THE Dashboard SHALL display template variable documentation to help users create effective templates

### Requirement 9: Multi-Workspace Support

**User Story:** As a developer working with multiple workspace folders, I want execution profiles to be workspace-specific, so that different projects can have different execution strategies.

#### Acceptance Criteria

1. THE Profile_Manager SHALL store execution profiles in each workspace folder's `.kiro/execution-profiles.json` file
2. WHEN multiple workspace folders are open, THE Profile_Manager SHALL load profiles from all workspace folders
3. WHEN displaying profiles in the execution dropdown, THE Dashboard SHALL indicate which workspace folder each profile belongs to
4. WHEN a spec is executed, THE Execution_Manager SHALL use profiles from the spec's workspace folder
5. THE Execution_History SHALL track which workspace folder each execution belongs to

### Requirement 10: Error Handling and Validation

**User Story:** As a developer, I want clear error messages when something goes wrong, so that I can quickly diagnose and fix issues.

#### Acceptance Criteria

1. WHEN a profile file cannot be read, THE Profile_Manager SHALL log a detailed error and fall back to built-in profiles
2. WHEN a profile template is invalid, THE Profile_Manager SHALL display a validation error with specific details
3. WHEN the Kiro command API is unavailable, THE Execution_Manager SHALL display an error message and prevent execution
4. WHEN template variable substitution fails, THE Profile_Manager SHALL log the error and use the original template text
5. WHEN execution history cannot be persisted, THE Execution_History SHALL log the error but continue operation
6. THE Extension SHALL display user-friendly error messages in the dashboard UI for all error conditions

### Requirement 11: Profile Sharing and Version Control

**User Story:** As a team lead, I want to commit execution profiles to version control, so that my team can share standardized execution strategies.

#### Acceptance Criteria

1. THE Profile_Manager SHALL store profiles in a plain JSON file that is suitable for version control
2. THE Profile_Manager SHALL include comments in the default profiles file explaining the structure and available variables
3. WHEN profiles are modified through the UI, THE Profile_Manager SHALL preserve JSON formatting for readability
4. THE Profile_Manager SHALL detect external changes to the profiles file and reload profiles automatically
5. WHEN merge conflicts occur in the profiles file, THE Profile_Manager SHALL handle them gracefully and notify the user

### Requirement 12: Execution Progress Monitoring

**User Story:** As a developer, I want to see which tasks have been completed during execution, so that I can monitor progress in real-time.

#### Acceptance Criteria

1. WHEN tasks are marked as completed in the spec file, THE Execution_Manager SHALL detect the changes via file watcher
2. WHEN task completion is detected during an active execution, THE Execution_Manager SHALL update the execution history entry with task progress
3. THE Dashboard SHALL display a progress indicator showing completed vs total tasks during execution
4. WHEN an execution completes, THE Execution_History SHALL store the final task completion count
5. THE Dashboard SHALL update the progress indicator in real-time as tasks are completed
