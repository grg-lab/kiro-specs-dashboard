# Design Document: Automated Spec Execution

## Overview

The Automated Spec Execution feature extends the Kiro Specs Dashboard Extension with the ability to execute all tasks from a spec automatically using customizable execution profiles. The feature consists of three main subsystems:

1. **Profile Management System**: Handles CRUD operations for execution profiles stored in `.kiro/execution-profiles.json`
2. **Execution System**: Manages the execution lifecycle, communicates with Kiro's chat interface, and tracks execution state
3. **History System**: Persists and displays execution history with detailed progress tracking

The design follows the existing extension architecture, using message passing between the webview and extension host, and leveraging VSCode's file system and state management APIs.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Webview (Browser)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Profile      │  │ Execution    │  │ History      │     │
│  │ Settings UI  │  │ Controls UI  │  │ Panel UI     │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │ postMessage                     │
└────────────────────────────┼─────────────────────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────┐
│                   Extension Host (Node.js)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Profile      │  │ Execution    │  │ Execution    │     │
│  │ Manager      │  │ Manager      │  │ History      │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
│         │                  │                  │              │
│  ┌──────┴──────────────────┴──────────────────┴───────┐    │
│  │           File System & State Manager              │    │
│  └────────────────────────────────────────────────────┘    │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    │  Kiro Chat API  │
                    └─────────────────┘
```

### Component Interaction Flow

**Profile Creation Flow:**
1. User clicks "Create Profile" in webview
2. Webview sends `createProfile` message to extension host
3. ProfileManager validates and persists profile to JSON file
4. ProfileManager sends confirmation back to webview
5. Webview updates UI with new profile

**Execution Flow:**
1. User selects profile from dropdown in webview
2. Webview sends `executeSpec` message with spec ID and profile ID
3. ExecutionManager loads profile and spec data
4. ExecutionManager instantiates template with spec variables
5. ExecutionManager sends prompt to Kiro via `vscode.commands.executeCommand`
6. ExecutionManager creates history entry and updates state
7. ExecutionManager sends state update to webview
8. Webview displays "Running..." indicator
9. File watcher detects task completions and updates progress
10. User or system marks execution as complete/failed/cancelled

## Components and Interfaces

### ProfileManager

**Responsibilities:**
- Load, validate, and persist execution profiles
- Provide built-in profiles (MVP, Full)
- Instantiate profile templates with spec data
- Handle profile CRUD operations

**Interface:**
```typescript
interface ProfileManager {
  // Load all profiles from workspace
  loadProfiles(workspaceFolder: vscode.WorkspaceFolder): Promise<ExecutionProfile[]>;
  
  // Get a specific profile by ID
  getProfile(profileId: string, workspaceFolder: vscode.WorkspaceFolder): Promise<ExecutionProfile | undefined>;
  
  // Create a new profile
  createProfile(profile: ExecutionProfile, workspaceFolder: vscode.WorkspaceFolder): Promise<void>;
  
  // Update an existing profile
  updateProfile(profileId: string, updates: Partial<ExecutionProfile>, workspaceFolder: vscode.WorkspaceFolder): Promise<void>;
  
  // Delete a profile (prevents deletion of built-in profiles)
  deleteProfile(profileId: string, workspaceFolder: vscode.WorkspaceFolder): Promise<void>;
  
  // Instantiate a profile template with spec data
  instantiateTemplate(profile: ExecutionProfile, spec: SpecFile): string;
  
  // Get built-in profiles
  getBuiltInProfiles(): ExecutionProfile[];
  
  // Reset a built-in profile to default
  resetBuiltInProfile(profileId: string, workspaceFolder: vscode.WorkspaceFolder): Promise<void>;
  
  // Validate profile structure
  validateProfile(profile: ExecutionProfile): ValidationResult;
}
```

**Built-In Profiles:**

```typescript
const MVP_PROFILE: ExecutionProfile = {
  id: 'mvp',
  name: 'MVP (Required Tasks Only)',
  icon: 'rocket',
  promptTemplate: `Execute the spec "{{specName}}" located at {{specPath}}.

Focus on required tasks only (skip optional tasks marked with *).

Workspace: {{workspaceFolder}}
Total tasks: {{totalTasks}}
Completed: {{completedTasks}}
Remaining: {{remainingTasks}}

Please execute all remaining required tasks in order.`,
  isBuiltIn: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const FULL_PROFILE: ExecutionProfile = {
  id: 'full',
  name: 'Full (All Tasks)',
  icon: 'checklist',
  promptTemplate: `Execute the spec "{{specName}}" located at {{specPath}}.

Execute ALL tasks including optional ones.

Workspace: {{workspaceFolder}}
Total tasks: {{totalTasks}}
Completed: {{completedTasks}}
Remaining: {{remainingTasks}}

Please execute all remaining tasks in order, including optional tasks.`,
  isBuiltIn: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};
```

### ExecutionManager

**Responsibilities:**
- Trigger spec execution by sending prompts to Kiro
- Track execution state (running, completed, failed, cancelled)
- Monitor task progress via file watcher
- Handle execution cancellation

**Interface:**
```typescript
interface ExecutionManager {
  // Execute a spec with a given profile
  executeSpec(specId: string, profileId: string, workspaceFolder: vscode.WorkspaceFolder): Promise<ExecutionResult>;
  
  // Cancel a running execution
  cancelExecution(executionId: string): Promise<void>;
  
  // Get current execution state for a spec
  getExecutionState(specId: string): ExecutionState | undefined;
  
  // Get all active executions
  getActiveExecutions(): Map<string, ExecutionState>;
  
  // Mark execution as completed
  completeExecution(executionId: string, status: 'completed' | 'failed', error?: string): Promise<void>;
  
  // Update task progress for an execution
  updateTaskProgress(executionId: string, completedTasks: number, totalTasks: number): void;
}
```

**Execution State Machine:**

```
┌─────────┐
│  Idle   │
└────┬────┘
     │ executeSpec()
     ▼
┌─────────┐
│ Running │◄──────────────┐
└────┬────┘               │
     │                    │
     ├─ completeExecution(completed) ──► ┌───────────┐
     │                                    │ Completed │
     ├─ completeExecution(failed) ──────► ├───────────┤
     │                                    │  Failed   │
     └─ cancelExecution() ──────────────► ├───────────┤
                                          │ Cancelled │
                                          └───────────┘
```

### ExecutionHistory

**Responsibilities:**
- Persist execution history in workspace state
- Provide query interface for history entries
- Track task-level progress for each execution

**Interface:**
```typescript
interface ExecutionHistory {
  // Add a new history entry
  addEntry(entry: ExecutionHistoryEntry): Promise<void>;
  
  // Update an existing entry
  updateEntry(executionId: string, updates: Partial<ExecutionHistoryEntry>): Promise<void>;
  
  // Get all history entries
  getAllEntries(): Promise<ExecutionHistoryEntry[]>;
  
  // Get entries for a specific spec
  getEntriesForSpec(specId: string): Promise<ExecutionHistoryEntry[]>;
  
  // Get entries filtered by criteria
  queryEntries(filter: HistoryFilter): Promise<ExecutionHistoryEntry[]>;
  
  // Clear all history
  clearHistory(): Promise<void>;
  
  // Get execution statistics
  getStatistics(): Promise<ExecutionStatistics>;
}
```

### Message Protocol

**Webview → Extension Host:**

```typescript
type WebviewMessage =
  | { type: 'createProfile'; profile: ExecutionProfile }
  | { type: 'updateProfile'; profileId: string; updates: Partial<ExecutionProfile> }
  | { type: 'deleteProfile'; profileId: string }
  | { type: 'executeSpec'; specId: string; profileId: string }
  | { type: 'cancelExecution'; executionId: string }
  | { type: 'getProfiles' }
  | { type: 'getExecutionHistory'; filter?: HistoryFilter }
  | { type: 'resetBuiltInProfile'; profileId: string };
```

**Extension Host → Webview:**

```typescript
type ExtensionMessage =
  | { type: 'profilesUpdated'; profiles: ExecutionProfile[] }
  | { type: 'executionStateChanged'; specId: string; state: ExecutionState }
  | { type: 'executionHistoryUpdated'; entries: ExecutionHistoryEntry[] }
  | { type: 'error'; message: string; details?: string };
```

## Data Models

### ExecutionProfile

```typescript
interface ExecutionProfile {
  id: string;                    // Unique identifier (kebab-case)
  name: string;                  // Display name
  icon: string;                  // VSCode codicon name
  promptTemplate: string;        // Template with {{variables}}
  isBuiltIn: boolean;            // True for MVP and Full profiles
  createdAt: string;             // ISO 8601 timestamp
  updatedAt: string;             // ISO 8601 timestamp
  description?: string;          // Optional description
  metadata?: Record<string, any>; // Optional custom metadata
}
```

### ExecutionState

```typescript
interface ExecutionState {
  executionId: string;           // Unique execution identifier
  specId: string;                // Spec being executed
  profileId: string;             // Profile used
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: string;             // ISO 8601 timestamp
  endTime?: string;              // ISO 8601 timestamp
  completedTasks: number;        // Number of completed tasks
  totalTasks: number;            // Total number of tasks
  error?: string;                // Error message if failed
}
```

### ExecutionHistoryEntry

```typescript
interface ExecutionHistoryEntry {
  executionId: string;           // Unique execution identifier
  specId: string;                // Spec that was executed
  specName: string;              // Spec display name
  profileId: string;             // Profile used
  profileName: string;           // Profile display name
  workspaceFolder: string;       // Workspace folder path
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: string;             // ISO 8601 timestamp
  endTime?: string;              // ISO 8601 timestamp
  duration?: number;             // Duration in milliseconds
  completedTasks: number;        // Tasks completed
  totalTasks: number;            // Total tasks
  error?: string;                // Error message if failed
}
```

### HistoryFilter

```typescript
interface HistoryFilter {
  specId?: string;               // Filter by spec
  profileId?: string;            // Filter by profile
  status?: ExecutionState['status']; // Filter by status
  startDate?: string;            // Filter by start date (ISO 8601)
  endDate?: string;              // Filter by end date (ISO 8601)
  workspaceFolder?: string;      // Filter by workspace folder
}
```

### ValidationResult

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

### Template Variables

```typescript
interface TemplateVariables {
  specName: string;              // Name of the spec
  specPath: string;              // Absolute path to spec folder
  totalTasks: number;            // Total number of tasks
  completedTasks: number;        // Number of completed tasks
  remainingTasks: number;        // Number of remaining tasks
  workspaceFolder: string;       // Workspace folder name
  specRelativePath: string;      // Relative path from workspace root
}
```

### File Format: execution-profiles.json

```json
{
  "$schema": "https://example.com/execution-profiles-schema.json",
  "version": "1.0.0",
  "profiles": [
    {
      "id": "mvp",
      "name": "MVP (Required Tasks Only)",
      "icon": "rocket",
      "promptTemplate": "Execute the spec \"{{specName}}\"...",
      "isBuiltIn": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "custom-profile",
      "name": "My Custom Profile",
      "icon": "star",
      "promptTemplate": "Custom prompt for {{specName}}...",
      "isBuiltIn": false,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "description": "A custom profile for specific use cases"
    }
  ]
}
```

## Correctness Properties


*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Profile Persistence Round-Trip

*For any* valid execution profile, writing it to the profiles file and then reading it back should produce an equivalent profile with all fields preserved.

**Validates: Requirements 1.6**

### Property 2: Profile Validation Rejects Invalid Profiles

*For any* profile object missing required fields (id, name, or promptTemplate), the ProfileManager validation should reject it and return validation errors.

**Validates: Requirements 1.3**

### Property 3: Built-In Profile Deletion Prevention

*For any* built-in profile (MVP or Full), attempting to delete it should fail and return an error, while the profile remains in the profiles list.

**Validates: Requirements 1.5, 3.4**

### Property 4: Custom Profile Deletion Success

*For any* custom (non-built-in) profile, deleting it should remove it from the profiles list, and subsequent reads should not include the deleted profile.

**Validates: Requirements 1.5**

### Property 5: Profile Update Persistence

*For any* existing profile and valid updates, updating the profile should persist the changes such that reading the profile returns the updated values.

**Validates: Requirements 1.4**

### Property 6: Template Variable Substitution

*For any* profile template containing standard variables ({{specName}}, {{specPath}}, etc.) and any spec data, instantiating the template should replace all standard variables with their corresponding values from the spec data.

**Validates: Requirements 2.3**

### Property 7: Unknown Variable Preservation

*For any* profile template containing unrecognized variables (not in the standard set), instantiating the template should leave those variables unchanged in the output.

**Validates: Requirements 2.4**

### Property 8: Special Character Escaping

*For any* spec data containing special characters (quotes, brackets, newlines), instantiating a template with that data should produce output where special characters are properly escaped to prevent injection.

**Validates: Requirements 2.5**

### Property 9: Built-In Profile Reset Round-Trip

*For any* built-in profile that has been edited, resetting it should restore the profile to its original default template and metadata.

**Validates: Requirements 3.5**

### Property 10: Execution State Transitions

*For any* execution, the state should transition correctly: idle → running (on execute) → completed/failed/cancelled (on completion), and each transition should trigger the appropriate UI update message.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 11: Execution History Entry Creation

*For any* execution trigger, a history entry should be created with all required fields (executionId, specId, profileId, status, startTime, completedTasks, totalTasks) and initial status "running".

**Validates: Requirements 4.4, 6.1**

### Property 12: Execution History Entry Completion

*For any* execution that completes (successfully or with failure), the history entry should be updated with endTime, final status, and duration calculated correctly.

**Validates: Requirements 6.2**

### Property 13: Execution History Persistence Round-Trip

*For any* set of execution history entries, persisting them to workspace state and then retrieving them should produce equivalent entries with all fields preserved.

**Validates: Requirements 6.3**

### Property 14: Execution History Sorting

*For any* set of history entries with different timestamps, retrieving all entries should return them sorted by startTime in descending order (most recent first).

**Validates: Requirements 6.4**

### Property 15: Execution History Filtering

*For any* history filter criteria (specId, profileId, status, date range, workspaceFolder) and any set of history entries, querying with the filter should return only entries that match all specified criteria.

**Validates: Requirements 6.6**

### Property 16: Execution State Persistence Round-Trip

*For any* active execution state, persisting it to workspace state and then restoring it should produce an equivalent state with all fields preserved.

**Validates: Requirements 5.5**

### Property 17: Kiro Command Invocation

*For any* spec and profile, triggering execution should result in calling `vscode.commands.executeCommand` with the command name 'workbench.action.chat.open' and an options object containing the instantiated prompt as the query.

**Validates: Requirements 4.3**

### Property 18: Task Progress Updates

*For any* active execution, when tasks are marked as completed in the spec file, the execution state should be updated with the new completedTasks count, and a UI update message should be sent.

**Validates: Requirements 12.1, 12.2, 12.5**

### Property 19: Multi-Workspace Profile Loading

*For any* set of workspace folders each containing a profiles file, loading profiles should return profiles from all workspace folders, with each profile tagged with its source workspace folder.

**Validates: Requirements 9.2**

### Property 20: Workspace-Specific Profile Usage

*For any* spec execution, the profiles available for selection should be those from the spec's workspace folder, not from other workspace folders.

**Validates: Requirements 9.4**

### Property 21: History Entry Workspace Tracking

*For any* execution, the history entry should include the workspaceFolder field identifying which workspace folder the spec belongs to.

**Validates: Requirements 9.5**

### Property 22: Profile Validation Error Messages

*For any* invalid profile (missing required fields, invalid format), validation should return a ValidationResult with valid=false and a non-empty errors array containing specific error messages.

**Validates: Requirements 10.2**

### Property 23: External Profile File Changes Detection

*For any* external modification to the profiles file (simulated by direct file write), the ProfileManager should detect the change and reload profiles within a reasonable time window.

**Validates: Requirements 11.4**

### Property 24: Execution Cancellation State Update

*For any* running execution, cancelling it should transition the state to "cancelled", update the history entry with cancellation timestamp, and send a UI update message.

**Validates: Requirements 7.3**

### Property 25: Profile Dropdown Contains All Profiles

*For any* set of loaded profiles, the execution dropdown UI should include all profiles with their names and icons.

**Validates: Requirements 4.1, 8.1**

## Error Handling

### Profile Management Errors

**Malformed Profile File:**
- When the profiles JSON file cannot be parsed, log detailed error with file path and parse error
- Fall back to built-in profiles only
- Display user-friendly error in UI: "Profile file is malformed. Using default profiles."

**Missing Profile File:**
- Create new profiles file with built-in profiles
- No error displayed to user (transparent initialization)

**Profile Validation Errors:**
- Return ValidationResult with specific error messages
- Display errors in profile settings UI
- Prevent saving invalid profiles

**File System Errors:**
- Log detailed error with file path and system error
- Display user-friendly error: "Could not save profiles. Check file permissions."
- Continue operation with in-memory profiles

### Execution Errors

**Kiro Command API Unavailable:**
- Check if command exists before execution
- Display error: "Kiro chat interface is not available. Please ensure Kiro extension is installed and activated."
- Do not create history entry

**Kiro Command Execution Failure:**
- Catch command execution errors
- Update execution state to "failed" with error message
- Update history entry with failure details
- Display error in spec card UI

**Template Instantiation Errors:**
- Catch template processing errors
- Log error with template and spec data
- Fall back to original template text
- Display warning: "Template processing failed. Using template as-is."

### History Errors

**Workspace State Persistence Failure:**
- Log error with details
- Continue operation (history remains in memory)
- Display warning: "Could not save execution history. History will be lost on restart."

**History Query Errors:**
- Log error with filter criteria
- Return empty array
- Display error: "Could not load execution history."

### Multi-Workspace Errors

**Workspace Folder Not Found:**
- Log warning with folder path
- Skip that workspace folder
- Continue loading profiles from other folders

**Profile ID Conflicts:**
- When profiles from different workspace folders have the same ID
- Prefix profile IDs with workspace folder name
- Display workspace folder in profile dropdown

## Testing Strategy

### Unit Testing

Unit tests will focus on specific examples, edge cases, and error conditions:

**ProfileManager Unit Tests:**
- Test built-in profile initialization
- Test profile validation with specific invalid inputs
- Test malformed JSON handling
- Test file system error handling
- Test template variable documentation generation

**ExecutionManager Unit Tests:**
- Test execution state machine transitions with specific sequences
- Test Kiro command API error handling
- Test cancellation of specific execution states
- Test task progress calculation with specific task counts

**ExecutionHistory Unit Tests:**
- Test history entry creation with specific data
- Test duration calculation with specific timestamps
- Test filtering with specific filter combinations
- Test statistics calculation with specific history sets

**Integration Tests:**
- Test complete execution flow from trigger to completion
- Test profile creation → execution → history recording
- Test multi-workspace profile loading and execution
- Test file watcher integration with task completion

### Property-Based Testing

Property tests will verify universal properties across all inputs using **fast-check** library (minimum 100 iterations per test):

**Profile Management Properties:**
- Property 1: Profile Persistence Round-Trip
- Property 2: Profile Validation Rejects Invalid Profiles
- Property 3: Built-In Profile Deletion Prevention
- Property 4: Custom Profile Deletion Success
- Property 5: Profile Update Persistence
- Property 9: Built-In Profile Reset Round-Trip
- Property 22: Profile Validation Error Messages
- Property 23: External Profile File Changes Detection
- Property 25: Profile Dropdown Contains All Profiles

**Template System Properties:**
- Property 6: Template Variable Substitution
- Property 7: Unknown Variable Preservation
- Property 8: Special Character Escaping

**Execution Management Properties:**
- Property 10: Execution State Transitions
- Property 17: Kiro Command Invocation
- Property 18: Task Progress Updates
- Property 24: Execution Cancellation State Update

**History Management Properties:**
- Property 11: Execution History Entry Creation
- Property 12: Execution History Entry Completion
- Property 13: Execution History Persistence Round-Trip
- Property 14: Execution History Sorting
- Property 15: Execution History Filtering
- Property 21: History Entry Workspace Tracking

**State Persistence Properties:**
- Property 16: Execution State Persistence Round-Trip

**Multi-Workspace Properties:**
- Property 19: Multi-Workspace Profile Loading
- Property 20: Workspace-Specific Profile Usage

**Test Configuration:**
Each property test will:
- Run minimum 100 iterations with randomized inputs
- Use fast-check generators for profiles, specs, history entries, and states
- Include a comment tag: `// Feature: automated-spec-execution, Property N: [property title]`
- Reference the design document property number

**Example Property Test Structure:**
```typescript
// Feature: automated-spec-execution, Property 1: Profile Persistence Round-Trip
test('profile persistence round-trip', async () => {
  await fc.assert(
    fc.asyncProperty(
      profileGenerator(),
      async (profile) => {
        await profileManager.createProfile(profile, workspaceFolder);
        const retrieved = await profileManager.getProfile(profile.id, workspaceFolder);
        expect(retrieved).toEqual(profile);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Test Data Generators

**Profile Generator:**
```typescript
const profileGenerator = (): fc.Arbitrary<ExecutionProfile> =>
  fc.record({
    id: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz-'), { minLength: 3, maxLength: 20 }),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    icon: fc.constantFrom('rocket', 'star', 'checklist', 'gear', 'zap'),
    promptTemplate: fc.string({ minLength: 10, maxLength: 500 }),
    isBuiltIn: fc.boolean(),
    createdAt: fc.date().map(d => d.toISOString()),
    updatedAt: fc.date().map(d => d.toISOString()),
    description: fc.option(fc.string({ maxLength: 200 })),
  });
```

**Spec Data Generator:**
```typescript
const specDataGenerator = (): fc.Arbitrary<SpecFile> =>
  fc.record({
    id: fc.string({ minLength: 3, maxLength: 30 }),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    path: fc.string({ minLength: 5, maxLength: 100 }),
    tasksFile: fc.string(),
    totalTasks: fc.nat({ max: 100 }),
    completedTasks: fc.nat({ max: 100 }),
    workspaceFolder: fc.string({ minLength: 1, maxLength: 50 }),
  });
```

**History Entry Generator:**
```typescript
const historyEntryGenerator = (): fc.Arbitrary<ExecutionHistoryEntry> =>
  fc.record({
    executionId: fc.uuid(),
    specId: fc.string({ minLength: 3, maxLength: 30 }),
    specName: fc.string({ minLength: 1, maxLength: 50 }),
    profileId: fc.string({ minLength: 3, maxLength: 20 }),
    profileName: fc.string({ minLength: 1, maxLength: 50 }),
    workspaceFolder: fc.string({ minLength: 1, maxLength: 50 }),
    status: fc.constantFrom('running', 'completed', 'failed', 'cancelled'),
    startTime: fc.date().map(d => d.toISOString()),
    endTime: fc.option(fc.date().map(d => d.toISOString())),
    completedTasks: fc.nat({ max: 100 }),
    totalTasks: fc.nat({ max: 100 }),
    error: fc.option(fc.string({ maxLength: 200 })),
  });
```

### Edge Cases to Test

1. **Empty profiles file** - Should initialize with built-in profiles
2. **Malformed JSON** - Should fall back to built-in profiles
3. **Profile with missing required fields** - Should reject with validation error
4. **Template with only unknown variables** - Should leave template unchanged
5. **Spec data with special characters** - Should escape properly
6. **Execution cancellation immediately after start** - Should transition to cancelled
7. **Multiple simultaneous executions** - Should track each independently
8. **History with thousands of entries** - Should filter and sort efficiently
9. **Workspace folder removed during execution** - Should handle gracefully
10. **Profile file modified externally during execution** - Should reload without disrupting execution

### Testing Tools

- **Jest**: Primary test framework
- **fast-check**: Property-based testing library
- **@vscode/test-electron**: VSCode extension testing utilities
- **Mock file system**: For testing file operations without actual I/O
- **Mock VSCode API**: For testing command execution and state management

### Continuous Integration

- Run all tests on every commit
- Enforce minimum 80% code coverage
- Run property tests with 100 iterations in CI
- Run extended property tests (1000 iterations) nightly
- Fail build on any test failure or coverage drop
