# Design Document

## Overview

This design refactors the Manage Profiles and Execution History features to use webview panels in the main editor area, following the established pattern from `AnalyticsPanelManager`. The refactoring maintains clear separation between UI (panel managers) and data layers (ProfileManager, ExecutionHistory), ensuring maintainability and testability.

The design introduces two new panel manager classes that handle webview lifecycle and message passing, while delegating all data operations to existing business logic classes. This approach provides a consistent user experience across all panel-based features in the extension.

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Extension Host                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────┐                     │
│  │  extension.ts│──────│ Dashboard    │                     │
│  │              │      │ Provider     │                     │
│  └──────────────┘      └──────────────┘                     │
│         │                      │                             │
│         │                      │                             │
│    ┌────┴──────────────────────┴────┐                       │
│    │                                 │                       │
│    ▼                                 ▼                       │
│  ┌──────────────────┐    ┌──────────────────┐              │
│  │ Profiles Panel   │    │ History Panel    │              │
│  │ Manager          │    │ Manager          │              │
│  └────────┬─────────┘    └────────┬─────────┘              │
│           │                       │                         │
│           │                       │                         │
│           ▼                       ▼                         │
│  ┌──────────────────┐    ┌──────────────────┐              │
│  │ Profile Manager  │    │ Execution        │              │
│  │ (Data Layer)     │    │ History          │              │
│  │                  │    │ (Data Layer)     │              │
│  └──────────────────┘    └──────────────────┘              │
│           │                       │                         │
│           ▼                       ▼                         │
│  ┌──────────────────┐    ┌──────────────────┐              │
│  │ File System      │    │ Workspace State  │              │
│  │ (.kiro/          │    │ (Memento API)    │              │
│  │ execution-       │    │                  │              │
│  │ profiles.json)   │    │                  │              │
│  └──────────────────┘    └──────────────────┘              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ postMessage
                           │
┌─────────────────────────────────────────────────────────────┐
│                      Webview (Browser)                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐    ┌──────────────────┐              │
│  │ profiles.html    │    │ history.html     │              │
│  │                  │    │                  │              │
│  │ - Profile List   │    │ - History List   │              │
│  │ - Create Form    │    │ - Filters        │              │
│  │ - Edit Form      │    │ - Statistics     │              │
│  │ - Delete/Reset   │    │ - Details View   │              │
│  └──────────────────┘    └──────────────────┘              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Design Patterns

1. **Panel Manager Pattern**: Each panel manager follows the same lifecycle pattern as `AnalyticsPanelManager`
   - Singleton panel instance (create once, reveal on subsequent opens)
   - Webview lifecycle management (creation, disposal, visibility)
   - Message protocol handling (bidirectional communication)
   - Resource cleanup on disposal

2. **Data Layer Separation**: Panel managers delegate all data operations to existing classes
   - `ProfilesPanelManager` → `ProfileManager` for profile CRUD
   - `HistoryPanelManager` → `ExecutionHistory` for history queries
   - No direct file system or state access in panel managers

3. **Message-Based Communication**: Webview and extension host communicate via postMessage
   - Request/response pattern for data operations
   - Success/error messages for operation feedback
   - Type-safe message definitions in `types.ts`

## Components and Interfaces

### ProfilesPanelManager

```typescript
/**
 * Manages the Profiles webview panel
 * 
 * Handles:
 * - Creating and revealing the profiles panel in the main editor area
 * - Managing panel lifecycle (creation, disposal, visibility)
 * - Handling messages from the profiles webview
 * - Delegating profile operations to ProfileManager
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.1-5.7, 7.5, 12.1
 */
export class ProfilesPanelManager {
  private panel: vscode.WebviewPanel | undefined;
  private profileManager: ProfileManager;
  private context: vscode.ExtensionContext;
  private outputChannel: vscode.OutputChannel;

  constructor(
    context: vscode.ExtensionContext,
    profileManager: ProfileManager,
    outputChannel: vscode.OutputChannel
  );

  /**
   * Open or reveal the profiles panel
   * 
   * If a panel already exists, it will be revealed.
   * Otherwise, a new panel will be created.
   * 
   * Requirements: 1.1, 1.4
   */
  public async openProfiles(): Promise<void>;

  /**
   * Create the profiles webview panel
   * 
   * Creates a new webview panel in the main editor area with:
   * - Title: "Manage Profiles - Kiro Specs Dashboard"
   * - Position: ViewColumn.One (main editor area)
   * - Options: enableScripts=true, retainContextWhenHidden=true
   * 
   * Requirements: 1.1, 1.2, 1.3, 9.1-9.5
   */
  private async createPanel(): Promise<void>;

  /**
   * Set up message handling for the profiles webview
   * 
   * Handles messages:
   * - loadProfiles: Load all profiles
   * - createProfile: Create a new profile
   * - updateProfile: Update an existing profile
   * - deleteProfile: Delete a custom profile
   * - resetProfile: Reset a built-in profile
   * 
   * Requirements: 5.1-5.7, 12.1
   */
  private setupMessageHandling(): void;

  /**
   * Handle loadProfiles message
   * Loads all profiles from all workspace folders
   * 
   * Requirements: 5.1, 12.1
   */
  private async handleLoadProfiles(): Promise<void>;

  /**
   * Handle createProfile message
   * Validates and creates a new profile
   * 
   * Requirements: 5.2, 5.6, 5.7, 11.1, 12.1
   */
  private async handleCreateProfile(profile: ExecutionProfile): Promise<void>;

  /**
   * Handle updateProfile message
   * Validates and updates an existing profile
   * 
   * Requirements: 5.3, 5.6, 5.7, 11.1, 12.1
   */
  private async handleUpdateProfile(
    profileId: string,
    updates: Partial<ExecutionProfile>
  ): Promise<void>;

  /**
   * Handle deleteProfile message
   * Deletes a custom profile (prevents deletion of built-in profiles)
   * 
   * Requirements: 5.4, 5.6, 5.7, 11.1, 12.1
   */
  private async handleDeleteProfile(profileId: string): Promise<void>;

  /**
   * Handle resetProfile message
   * Resets a built-in profile to defaults
   * 
   * Requirements: 5.5, 5.6, 5.7, 11.1, 12.1
   */
  private async handleResetProfile(profileId: string): Promise<void>;

  /**
   * Generate HTML content for the profiles webview
   * 
   * Loads the profiles.html template and replaces placeholders
   * 
   * Requirements: 1.3, 9.1-9.5, 10.1-10.5
   */
  private getHtmlContent(webview: vscode.Webview): string;

  /**
   * Generate a nonce for CSP
   * 
   * Requirements: 9.3
   */
  private getNonce(): string;

  /**
   * Dispose of the profiles panel
   * 
   * Requirements: 1.5
   */
  public dispose(): void;
}
```

### HistoryPanelManager

```typescript
/**
 * Manages the History webview panel
 * 
 * Handles:
 * - Creating and revealing the history panel in the main editor area
 * - Managing panel lifecycle (creation, disposal, visibility)
 * - Handling messages from the history webview
 * - Delegating history operations to ExecutionHistory
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.1-6.6, 7.6, 12.2
 */
export class HistoryPanelManager {
  private panel: vscode.WebviewPanel | undefined;
  private executionHistory: ExecutionHistory;
  private context: vscode.ExtensionContext;
  private outputChannel: vscode.OutputChannel;

  constructor(
    context: vscode.ExtensionContext,
    executionHistory: ExecutionHistory,
    outputChannel: vscode.OutputChannel
  );

  /**
   * Open or reveal the history panel
   * 
   * If a panel already exists, it will be revealed.
   * Otherwise, a new panel will be created.
   * 
   * Requirements: 2.1, 2.4
   */
  public async openHistory(): Promise<void>;

  /**
   * Create the history webview panel
   * 
   * Creates a new webview panel in the main editor area with:
   * - Title: "Execution History - Kiro Specs Dashboard"
   * - Position: ViewColumn.One (main editor area)
   * - Options: enableScripts=true, retainContextWhenHidden=true
   * 
   * Requirements: 2.1, 2.2, 2.3, 9.1-9.5
   */
  private async createPanel(): Promise<void>;

  /**
   * Set up message handling for the history webview
   * 
   * Handles messages:
   * - loadHistory: Load all history entries
   * - filterHistory: Filter history by criteria
   * - getStatistics: Get execution statistics
   * - clearHistory: Clear all history
   * 
   * Requirements: 6.1-6.6, 12.2
   */
  private setupMessageHandling(): void;

  /**
   * Handle loadHistory message
   * Loads all history entries sorted by date
   * 
   * Requirements: 6.1, 6.5, 12.2
   */
  private async handleLoadHistory(): Promise<void>;

  /**
   * Handle filterHistory message
   * Filters history entries by criteria
   * 
   * Requirements: 6.2, 6.5, 12.2
   */
  private async handleFilterHistory(filter: HistoryFilter): Promise<void>;

  /**
   * Handle getStatistics message
   * Calculates and returns execution statistics
   * 
   * Requirements: 6.3, 6.5, 12.2
   */
  private async handleGetStatistics(): Promise<void>;

  /**
   * Handle clearHistory message
   * Clears all history entries
   * 
   * Requirements: 6.4, 6.5, 6.6, 11.3, 12.2
   */
  private async handleClearHistory(): Promise<void>;

  /**
   * Generate HTML content for the history webview
   * 
   * Loads the history.html template and replaces placeholders
   * 
   * Requirements: 2.3, 9.1-9.5, 10.1-10.5
   */
  private getHtmlContent(webview: vscode.Webview): string;

  /**
   * Generate a nonce for CSP
   * 
   * Requirements: 9.3
   */
  private getNonce(): string;

  /**
   * Dispose of the history panel
   * 
   * Requirements: 2.5
   */
  public dispose(): void;
}
```

### Message Types

Add to `types.ts`:

```typescript
/**
 * Messages sent from profiles webview to extension
 */
export type ProfilesWebviewMessage =
  | { type: 'loadProfiles' }
  | { type: 'createProfile'; profile: ExecutionProfile }
  | { type: 'updateProfile'; profileId: string; updates: Partial<ExecutionProfile> }
  | { type: 'deleteProfile'; profileId: string }
  | { type: 'resetProfile'; profileId: string };

/**
 * Messages sent from extension to profiles webview
 */
export type ProfilesExtensionMessage =
  | { type: 'profilesLoaded'; profiles: ExecutionProfile[] }
  | { type: 'profileCreated'; profile: ExecutionProfile }
  | { type: 'profileUpdated'; profile: ExecutionProfile }
  | { type: 'profileDeleted'; profileId: string }
  | { type: 'profileReset'; profile: ExecutionProfile }
  | { type: 'error'; message: string; details?: string };

/**
 * Messages sent from history webview to extension
 */
export type HistoryWebviewMessage =
  | { type: 'loadHistory' }
  | { type: 'filterHistory'; filter: HistoryFilter }
  | { type: 'getStatistics' }
  | { type: 'clearHistory' };

/**
 * Messages sent from extension to history webview
 */
export type HistoryExtensionMessage =
  | { type: 'historyLoaded'; entries: ExecutionHistoryEntry[] }
  | { type: 'historyFiltered'; entries: ExecutionHistoryEntry[] }
  | { type: 'statisticsLoaded'; statistics: ExecutionStatistics }
  | { type: 'historyCleared' }
  | { type: 'error'; message: string; details?: string };
```

## Data Models

### Existing Models (No Changes)

The following existing types remain unchanged:

- `ExecutionProfile`: Profile definition with id, name, icon, promptTemplate, etc.
- `ExecutionHistoryEntry`: History entry with executionId, specId, profileId, status, timestamps, etc.
- `HistoryFilter`: Filter criteria for querying history
- `ExecutionStatistics`: Aggregate statistics from execution history
- `SpecExecutionStats`: Per-spec execution statistics
- `ProfileExecutionStats`: Per-profile execution statistics

### Webview State Models

```typescript
/**
 * UI state for profiles webview
 */
interface ProfilesViewState {
  selectedProfileId?: string;
  isCreating: boolean;
  isEditing: boolean;
  editingProfileId?: string;
  searchQuery: string;
  filterBuiltIn: 'all' | 'builtin' | 'custom';
}

/**
 * UI state for history webview
 */
interface HistoryViewState {
  selectedEntryId?: string;
  filter: HistoryFilter;
  sortBy: 'date' | 'spec' | 'profile' | 'status';
  sortOrder: 'asc' | 'desc';
  viewMode: 'list' | 'details';
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

After analyzing all acceptance criteria, I've identified the following consolidations:

**Redundancy Analysis:**

1. **Panel Creation Properties (1.1-1.3, 2.1-2.3)**: These are all specific configuration checks for panel creation. They can be consolidated into example tests rather than separate properties since they test specific setup behavior.

2. **Panel Idempotence (1.4, 2.4)**: These are identical properties for different managers. Can be combined into a single property about panel manager behavior.

3. **Message Protocol Success/Error (5.6-5.7, 6.5-6.6)**: These are general properties about message responses that apply to all operations. Can be combined into properties about message protocol behavior.

4. **Profile Display Properties (3.1, 3.2)**: Property 3.2 is more specific than 3.1 - if we verify all required fields are present, we've implicitly verified that profiles are displayed.

5. **History Display Properties (4.1, 4.2)**: Similar to above - 4.2 is more specific and subsumes 4.1.

6. **Statistics Properties (4.6, 4.7)**: Property 4.7 is more comprehensive and includes 4.6.

7. **Error Handling Properties (11.1-11.4)**: These can be consolidated into a general property about error handling with specific details.

8. **Data Layer Separation (12.1-12.3, 12.5)**: These are all testing the same architectural principle - can be consolidated.

**Consolidated Properties:**

After reflection, we'll focus on these unique, high-value properties:
- Panel idempotence (opening twice doesn't create two panels)
- Profile rendering completeness (all fields present)
- History rendering completeness (all fields present)
- History sorting correctness (most recent first)
- Filtering correctness (only matching entries shown)
- Message protocol round-trip (request → response)
- Error message propagation (errors reach webview)
- Built-in profile protection (cannot delete)
- Data layer delegation (panel managers use data classes)

### Correctness Properties

Property 1: Panel Idempotence
*For any* panel manager (Profiles or History), calling the open method multiple times should result in only one panel instance being created, with subsequent calls revealing the existing panel.
**Validates: Requirements 1.4, 2.4**

Property 2: Profile Rendering Completeness
*For any* execution profile (built-in or custom), when rendered in the profiles webview, the displayed HTML should contain the profile's name, icon, description (if present), and built-in status indicator.
**Validates: Requirements 3.2**

Property 3: History Rendering Completeness
*For any* execution history entry, when rendered in the history webview, the displayed HTML should contain the execution ID, spec name, profile name, status, start time, duration, and workspace folder.
**Validates: Requirements 4.2**

Property 4: History Sorting Correctness
*For any* set of execution history entries, when displayed in the history webview, the entries should be sorted by start time in descending order (most recent first).
**Validates: Requirements 4.1**

Property 5: History Filtering Correctness
*For any* filter criteria (spec, profile, status, or date range), when applied to a set of history entries, only entries matching all specified criteria should be displayed.
**Validates: Requirements 4.3**

Property 6: Statistics Calculation Correctness
*For any* set of execution history entries, the calculated statistics should accurately reflect total executions, success rate, average duration, and per-spec/per-profile breakdowns.
**Validates: Requirements 4.6, 4.7, 6.3**

Property 7: Message Protocol Round-Trip
*For any* valid message sent from a webview to its panel manager, the panel manager should respond with either a success message containing the requested data or an error message with details.
**Validates: Requirements 5.1-5.7, 6.1-6.6**

Property 8: Profile Operation Validation
*For any* profile create or update operation, if the profile data is invalid, the operation should fail with a validation error message containing specific details about what is invalid.
**Validates: Requirements 5.2, 5.3, 5.7, 11.1**

Property 9: Built-in Profile Protection
*For any* built-in profile (MVP or Full), attempting to delete the profile should fail, and the delete button should not be displayed in the UI.
**Validates: Requirements 3.8**

Property 10: Error Propagation
*For any* operation that fails in the extension host (profile CRUD, history query, etc.), an error message should be sent to the webview and logged to the output channel with detailed information.
**Validates: Requirements 5.7, 6.6, 11.1, 11.2, 11.3, 11.4**

Property 11: Data Layer Delegation
*For any* data operation (profile CRUD, history query), the panel manager should delegate to the appropriate data layer class (ProfileManager or ExecutionHistory) and not directly access file system or workspace state.
**Validates: Requirements 12.1, 12.2, 12.3**

## Error Handling

### Error Categories

1. **Validation Errors**
   - Invalid profile data (missing required fields, invalid format)
   - Invalid filter criteria
   - Handled by: Data layer validation, propagated to webview

2. **File System Errors**
   - Permission denied reading/writing profiles file
   - Disk full
   - File system read-only
   - Handled by: ProfileManager, propagated to panel manager, displayed to user

3. **State Errors**
   - Workspace state corruption
   - State quota exceeded
   - Handled by: ExecutionHistory, propagated to panel manager, displayed to user

4. **Webview Errors**
   - Failed to load HTML template
   - Message parsing errors
   - Handled by: Panel managers, fallback to error display

### Error Handling Strategy

**Graceful Degradation:**
- If profiles file cannot be read, fall back to built-in profiles
- If history cannot be loaded, display empty history with error message
- If webview HTML fails to load, display minimal error page

**User Feedback:**
- Show user-friendly error messages in webview UI
- Provide "View Output" button to see detailed logs
- Use VSCode error notification for critical errors

**Logging:**
- Log all errors to output channel with timestamps
- Include stack traces for debugging
- Log error context (operation, parameters, state)

**Recovery:**
- Retry transient errors (file locks)
- Offer to reset corrupted state
- Provide manual recovery options (reset profiles, clear history)

## Testing Strategy

### Unit Tests

Unit tests will focus on specific examples, edge cases, and error conditions:

**ProfilesPanelManager Tests:**
- Panel creation with correct configuration
- Panel reveal when already exists
- Message handling for each operation type
- Error handling for invalid profile data
- HTML content generation with CSP
- Resource cleanup on disposal

**HistoryPanelManager Tests:**
- Panel creation with correct configuration
- Panel reveal when already exists
- Message handling for each operation type
- Statistics calculation edge cases (empty history, single entry)
- HTML content generation with CSP
- Resource cleanup on disposal

**Integration Tests:**
- Extension activation creates managers
- Commands registered and callable
- Managers injected into dashboard provider
- Extension deactivation disposes managers

**UI Tests:**
- Profile form validation
- History filtering UI
- Confirmation dialogs
- Error message display

### Property-Based Tests

Property tests will verify universal properties across all inputs using fast-check library. Each test will run a minimum of 100 iterations.

**Property Test 1: Panel Idempotence**
```typescript
// Feature: webview-panels-refactor, Property 1: Panel Idempotence
fc.assert(
  fc.property(fc.integer({ min: 2, max: 10 }), async (callCount) => {
    const manager = new ProfilesPanelManager(context, profileManager, outputChannel);
    
    // Call open multiple times
    for (let i = 0; i < callCount; i++) {
      await manager.openProfiles();
    }
    
    // Verify only one panel exists
    const panelCount = getPanelCount(manager);
    expect(panelCount).toBe(1);
  }),
  { numRuns: 100 }
);
```

**Property Test 2: Profile Rendering Completeness**
```typescript
// Feature: webview-panels-refactor, Property 2: Profile Rendering Completeness
fc.assert(
  fc.property(arbitraryProfile(), (profile) => {
    const html = renderProfile(profile);
    
    // Verify all required fields are present
    expect(html).toContain(profile.name);
    expect(html).toContain(profile.icon);
    if (profile.description) {
      expect(html).toContain(profile.description);
    }
    expect(html).toContain(profile.isBuiltIn ? 'Built-in' : 'Custom');
  }),
  { numRuns: 100 }
);
```

**Property Test 3: History Rendering Completeness**
```typescript
// Feature: webview-panels-refactor, Property 3: History Rendering Completeness
fc.assert(
  fc.property(arbitraryHistoryEntry(), (entry) => {
    const html = renderHistoryEntry(entry);
    
    // Verify all required fields are present
    expect(html).toContain(entry.executionId);
    expect(html).toContain(entry.specName);
    expect(html).toContain(entry.profileName);
    expect(html).toContain(entry.status);
    expect(html).toContain(entry.startTime);
    if (entry.duration) {
      expect(html).toContain(String(entry.duration));
    }
    expect(html).toContain(entry.workspaceFolder);
  }),
  { numRuns: 100 }
);
```

**Property Test 4: History Sorting Correctness**
```typescript
// Feature: webview-panels-refactor, Property 4: History Sorting Correctness
fc.assert(
  fc.property(fc.array(arbitraryHistoryEntry(), { minLength: 2 }), (entries) => {
    const sorted = sortHistoryEntries(entries);
    
    // Verify descending order by start time
    for (let i = 0; i < sorted.length - 1; i++) {
      const currentTime = new Date(sorted[i].startTime).getTime();
      const nextTime = new Date(sorted[i + 1].startTime).getTime();
      expect(currentTime).toBeGreaterThanOrEqual(nextTime);
    }
  }),
  { numRuns: 100 }
);
```

**Property Test 5: History Filtering Correctness**
```typescript
// Feature: webview-panels-refactor, Property 5: History Filtering Correctness
fc.assert(
  fc.property(
    fc.array(arbitraryHistoryEntry()),
    arbitraryHistoryFilter(),
    (entries, filter) => {
      const filtered = filterHistoryEntries(entries, filter);
      
      // Verify all filtered entries match the criteria
      for (const entry of filtered) {
        if (filter.specId) {
          expect(entry.specId).toBe(filter.specId);
        }
        if (filter.profileId) {
          expect(entry.profileId).toBe(filter.profileId);
        }
        if (filter.status) {
          expect(entry.status).toBe(filter.status);
        }
        if (filter.startDate) {
          const entryTime = new Date(entry.startTime).getTime();
          const filterTime = new Date(filter.startDate).getTime();
          expect(entryTime).toBeGreaterThanOrEqual(filterTime);
        }
        if (filter.endDate) {
          const entryTime = new Date(entry.startTime).getTime();
          const filterTime = new Date(filter.endDate).getTime();
          expect(entryTime).toBeLessThanOrEqual(filterTime);
        }
      }
    }
  ),
  { numRuns: 100 }
);
```

**Property Test 6: Statistics Calculation Correctness**
```typescript
// Feature: webview-panels-refactor, Property 6: Statistics Calculation Correctness
fc.assert(
  fc.property(fc.array(arbitraryHistoryEntry()), (entries) => {
    const stats = calculateStatistics(entries);
    
    // Verify total executions
    expect(stats.totalExecutions).toBe(entries.length);
    
    // Verify success rate
    const successCount = entries.filter(e => e.status === 'completed').length;
    const expectedRate = entries.length > 0 ? (successCount / entries.length) * 100 : 0;
    expect(stats.successRate).toBeCloseTo(expectedRate, 2);
    
    // Verify average duration
    const withDuration = entries.filter(e => e.duration !== undefined);
    const totalDuration = withDuration.reduce((sum, e) => sum + (e.duration || 0), 0);
    const expectedAvg = withDuration.length > 0 ? totalDuration / withDuration.length : 0;
    expect(stats.averageDuration).toBeCloseTo(expectedAvg, 2);
  }),
  { numRuns: 100 }
);
```

**Property Test 7: Message Protocol Round-Trip**
```typescript
// Feature: webview-panels-refactor, Property 7: Message Protocol Round-Trip
fc.assert(
  fc.property(arbitraryProfilesMessage(), async (message) => {
    const manager = new ProfilesPanelManager(context, profileManager, outputChannel);
    await manager.openProfiles();
    
    // Send message and wait for response
    const response = await sendMessageAndWaitForResponse(manager, message);
    
    // Verify response is either success or error
    expect(response.type).toMatch(/^(profilesLoaded|profileCreated|profileUpdated|profileDeleted|profileReset|error)$/);
    
    // If error, verify it has a message
    if (response.type === 'error') {
      expect(response.message).toBeTruthy();
    }
  }),
  { numRuns: 100 }
);
```

**Property Test 8: Profile Operation Validation**
```typescript
// Feature: webview-panels-refactor, Property 8: Profile Operation Validation
fc.assert(
  fc.property(arbitraryInvalidProfile(), async (invalidProfile) => {
    const manager = new ProfilesPanelManager(context, profileManager, outputChannel);
    await manager.openProfiles();
    
    // Attempt to create invalid profile
    const response = await sendMessageAndWaitForResponse(manager, {
      type: 'createProfile',
      profile: invalidProfile
    });
    
    // Verify error response with details
    expect(response.type).toBe('error');
    expect(response.message).toBeTruthy();
    expect(response.details).toBeTruthy();
  }),
  { numRuns: 100 }
);
```

**Property Test 9: Built-in Profile Protection**
```typescript
// Feature: webview-panels-refactor, Property 9: Built-in Profile Protection
fc.assert(
  fc.property(fc.constantFrom('mvp', 'full'), async (builtInId) => {
    const manager = new ProfilesPanelManager(context, profileManager, outputChannel);
    await manager.openProfiles();
    
    // Attempt to delete built-in profile
    const response = await sendMessageAndWaitForResponse(manager, {
      type: 'deleteProfile',
      profileId: builtInId
    });
    
    // Verify error response
    expect(response.type).toBe('error');
    expect(response.message).toContain('built-in');
  }),
  { numRuns: 100 }
);
```

**Property Test 10: Error Propagation**
```typescript
// Feature: webview-panels-refactor, Property 10: Error Propagation
fc.assert(
  fc.property(arbitraryFailingOperation(), async (operation) => {
    const manager = createManagerWithFailingDependency(operation);
    await manager.openProfiles();
    
    // Perform operation that will fail
    const response = await sendMessageAndWaitForResponse(manager, operation.message);
    
    // Verify error is propagated to webview
    expect(response.type).toBe('error');
    expect(response.message).toBeTruthy();
    
    // Verify error is logged to output channel
    const logs = getOutputChannelLogs();
    expect(logs).toContain('ERROR');
    expect(logs).toContain(operation.expectedError);
  }),
  { numRuns: 100 }
);
```

**Property Test 11: Data Layer Delegation**
```typescript
// Feature: webview-panels-refactor, Property 11: Data Layer Delegation
fc.assert(
  fc.property(arbitraryProfileOperation(), async (operation) => {
    const mockProfileManager = createMockProfileManager();
    const manager = new ProfilesPanelManager(context, mockProfileManager, outputChannel);
    await manager.openProfiles();
    
    // Perform operation
    await sendMessageAndWaitForResponse(manager, operation.message);
    
    // Verify ProfileManager method was called
    expect(mockProfileManager[operation.expectedMethod]).toHaveBeenCalled();
    
    // Verify no direct file system access
    expect(fs.readFile).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  }),
  { numRuns: 100 }
);
```

### Test Configuration

- **Property tests**: Minimum 100 iterations per test
- **Test framework**: Jest with ts-jest
- **Property testing library**: fast-check
- **Coverage target**: 80% line coverage, 70% branch coverage
- **Test isolation**: Each test creates fresh instances, no shared state
- **Mocking**: Mock VSCode API, file system, and workspace state

### Arbitrary Generators

Custom fast-check arbitraries for domain objects:

```typescript
// Generate arbitrary execution profiles
function arbitraryProfile(): fc.Arbitrary<ExecutionProfile> {
  return fc.record({
    id: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'), { minLength: 3, maxLength: 20 }),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    icon: fc.constantFrom('rocket', 'star', 'checklist', 'gear', 'beaker'),
    promptTemplate: fc.string({ minLength: 10, maxLength: 500 }),
    isBuiltIn: fc.boolean(),
    description: fc.option(fc.string({ maxLength: 200 })),
    createdAt: fc.date().map(d => d.toISOString()),
    updatedAt: fc.date().map(d => d.toISOString())
  });
}

// Generate arbitrary history entries
function arbitraryHistoryEntry(): fc.Arbitrary<ExecutionHistoryEntry> {
  return fc.record({
    executionId: fc.uuid(),
    specId: fc.string({ minLength: 3, maxLength: 30 }),
    specName: fc.string({ minLength: 3, maxLength: 50 }),
    profileId: fc.string({ minLength: 3, maxLength: 20 }),
    profileName: fc.string({ minLength: 3, maxLength: 50 }),
    status: fc.constantFrom('running', 'completed', 'failed', 'cancelled'),
    startTime: fc.date().map(d => d.toISOString()),
    endTime: fc.option(fc.date().map(d => d.toISOString())),
    duration: fc.option(fc.integer({ min: 0, max: 3600000 })),
    workspaceFolder: fc.string({ minLength: 1, maxLength: 100 })
  });
}

// Generate arbitrary history filters
function arbitraryHistoryFilter(): fc.Arbitrary<HistoryFilter> {
  return fc.record({
    specId: fc.option(fc.string()),
    profileId: fc.option(fc.string()),
    status: fc.option(fc.constantFrom('running', 'completed', 'failed', 'cancelled')),
    workspaceFolder: fc.option(fc.string()),
    startDate: fc.option(fc.date().map(d => d.toISOString())),
    endDate: fc.option(fc.date().map(d => d.toISOString()))
  });
}

// Generate arbitrary invalid profiles (for validation testing)
function arbitraryInvalidProfile(): fc.Arbitrary<Partial<ExecutionProfile>> {
  return fc.oneof(
    fc.record({ id: fc.constant('') }), // Empty ID
    fc.record({ id: fc.constant('Invalid ID!') }), // Invalid characters
    fc.record({ name: fc.constant('') }), // Empty name
    fc.record({ promptTemplate: fc.constant('') }), // Empty template
    fc.record({ id: fc.string({ minLength: 51 }) }) // ID too long
  );
}
```
