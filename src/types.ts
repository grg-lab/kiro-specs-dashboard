/**
 * Type definitions for the Specs Dashboard Extension
 */

/**
 * Represents a spec file with its content and metadata
 */
export interface SpecFile {
  // Identity
  name: string;              // Spec directory name (kebab-case)
  path: string;              // Absolute file system path
  workspaceFolder?: string;  // Workspace folder name (for multi-root)

  // Content
  tasksContent?: string;         // Raw markdown content
  requirementsContent?: string;  // Raw markdown content
  designContent?: string;        // Raw markdown content

  // Metrics
  totalTasks: number;       // Total task count
  completedTasks: number;   // Completed task count
  optionalTasks: number;    // Optional task count (marked with *)
  progress: number;         // Percentage (0-100)

  // Metadata
  lastModified?: Date;      // Last modification timestamp
}

/**
 * Represents a single task in a spec
 */
export interface Task {
  line: number;           // Line number in tasks.md
  text: string;           // Task description
  completed: boolean;     // Checkbox state
  optional: boolean;      // Has * marker
  level: number;          // Indentation level (0 = top-level)
  parent?: number;        // Parent task line number
}

/**
 * Represents a note attached to a spec
 */
export interface Note {
  id: string;             // Unique identifier
  text: string;           // Note content (plain text)
  createdAt: number;      // Unix timestamp (milliseconds) - creation date
  updatedAt: number;      // Unix timestamp (milliseconds) - last update date
}

/**
 * Dashboard state for persistence
 */
export interface DashboardState {
  filterMode: 'all' | 'in-progress' | 'completed' | 'pending';
  searchQuery: string;
  currentPage: number;
  itemsPerPage: number;
  sortBy: 'name' | 'progress';
  sortOrder: 'asc' | 'desc';
  notes?: { [specName: string]: Note[] };  // Notes per spec
}

/**
 * Message types from Extension Host to Webview
 */
export type ExtensionMessage =
  | { type: 'specsLoaded'; specs: SpecFile[]; state: DashboardState }
  | { type: 'specUpdated'; spec: SpecFile }
  | { type: 'notesUpdated'; specName: string; notes: Note[] }
  | { type: 'error'; message: string };

/**
 * Sort options for notes
 */
export type NoteSortOption = 'recently-updated' | 'recently-created' | 'oldest-first';

/**
 * Message types from Webview to Extension Host
 */
export type WebviewMessage =
  | { type: 'requestSpecs' }
  | { type: 'toggleTask'; specName: string; taskLine: number }
  | { type: 'openFile'; filePath: string }
  | { type: 'saveState'; state: DashboardState }
  | { type: 'addNote'; specName: string; text: string }
  | { type: 'updateNote'; specName: string; noteId: string; text: string }
  | { type: 'deleteNote'; specName: string; noteId: string }
  | { type: 'openNotes'; specName: string };

/**
 * Velocity data structures for analytics tracking
 */

/**
 * Weekly task completion data
 */
export interface WeeklyTaskData {
  weekStart: Date;        // Monday of the week
  weekEnd: Date;          // Sunday of the week
  completed: number;      // Tasks completed this week
  required: number;       // Required tasks completed
  optional: number;       // Optional tasks completed
}

/**
 * Weekly spec completion data
 */
export interface WeeklySpecData {
  weekStart: Date;
  weekEnd: Date;
  completed: number;      // Specs that reached 100%
  started: number;        // Specs that had first task completed
}

/**
 * Spec activity tracking data
 */
export interface SpecActivityData {
  firstTaskDate: Date | null;    // When first task was completed
  lastTaskDate: Date | null;     // When last task was completed
  completionDate: Date | null;   // When spec reached 100%
  totalTasks: number;
  completedTasks: number;
}

/**
 * Day of week task completion aggregation
 */
export interface DayOfWeekData {
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
}

/**
 * Daily task count for calendar heatmap
 * 
 * Requirements: Timeline Feature - Calendar Heatmap
 */
export interface DailyTaskCount {
  date: string;           // YYYY-MM-DD format
  completed: number;      // Tasks completed that day
  required: number;       // Required tasks
  optional: number;       // Optional tasks
}

/**
 * Task completion event for activity stream
 * 
 * Requirements: Timeline Feature - Activity Stream
 */
export interface TaskCompletionEvent {
  timestamp: Date;
  specName: string;
  taskId: string;
  taskDescription?: string;  // First 50 chars of task text
  isRequired: boolean;
}

/**
 * Spec lifecycle event for timeline
 * 
 * Requirements: Timeline Feature - Spec Timeline
 */
export interface SpecLifecycleEvent {
  specName: string;
  eventType: 'started' | 'completed' | 'milestone';
  timestamp: Date;
  progress?: number;     // For milestone events
}

/**
 * Complete velocity data structure
 */
export interface VelocityData {
  // Weekly task completion history
  weeklyTasks: WeeklyTaskData[];
  
  // Spec completion history
  weeklySpecs: WeeklySpecData[];
  
  // Spec activity tracking
  specActivity: { [specName: string]: SpecActivityData };
  
  // Day of week aggregation
  dayOfWeekTasks: DayOfWeekData;
  
  // Timeline feature data
  dailyTaskCounts: DailyTaskCount[];           // Last 90 days
  taskCompletionEvents: TaskCompletionEvent[]; // Last 100 events
  specLifecycleEvents: SpecLifecycleEvent[];   // All events
}

/**
 * Calculated velocity metrics
 */
export interface VelocityMetrics {
  // Core metrics
  tasksPerWeek: number[];              // Last 12 weeks
  currentWeekTasks: number;
  lastWeekTasks: number;
  velocityTrend: number;               // Percentage change
  averageVelocity: number;             // 4-week rolling average
  
  // Spec metrics
  specsPerWeek: number[];              // Last 8 weeks
  currentWeekSpecs: number;            // Specs completed this week
  averageSpecs: number;                // 4-week rolling average
  specsConsistencyScore: number;       // 0-100
  specsConsistencyRating: 'High' | 'Medium' | 'Low';
  averageTimeToComplete: number;       // Days
  timeDistribution: {
    fast: number;      // 0-10 days
    medium: number;    // 11-20 days
    slow: number;      // 21+ days
  };
  
  // Projections
  projectedCompletionDate: Date | null;
  remainingTasks: number;
  daysRemaining: number;
  
  // Patterns
  dayOfWeekVelocity: DayOfWeekData;
  requiredVsOptional: {
    required: number;
    optional: number;
  };
  
  // Quality metrics
  consistencyScore: number;            // 0-100
  consistencyRating: 'High' | 'Medium' | 'Low';
  
  // Timeline feature metrics
  dailyActivity: DailyTaskCount[];
  recentEvents: TaskCompletionEvent[];
  specTimelines: Array<{
    specName: string;
    startDate: Date | null;
    endDate: Date | null;
    progress: number;
    totalTasks: number;
    completedTasks: number;
  }>;
}

/**
 * Message types from Extension Host to Analytics Webview
 * 
 * Requirements: 18.3, 22.9
 */
export type AnalyticsMessage =
  | { type: 'metricsUpdated'; metrics: VelocityMetrics }
  | { type: 'dataRefreshed' }
  | { type: 'error'; message: string };

/**
 * Message types from Analytics Webview to Extension Host
 * 
 * Requirements: 18.3, 22.9, 23.1
 */
export type AnalyticsCommand =
  | { type: 'refreshMetrics' }
  | { type: 'switchTab'; tab: string }
  | { type: 'exportData'; format: 'csv' | 'json' };

/**
 * ============================================================================
 * Automated Spec Execution Types
 * ============================================================================
 */

/**
 * Execution profile with customizable prompt template
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
export interface ExecutionProfile {
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

/**
 * Execution state for tracking active executions
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 9.4
 */
export interface ExecutionState {
  executionId: string;           // Unique execution identifier
  specId: string;                // Spec being executed
  profileId: string;             // Profile used
  workspaceFolder: string;       // Workspace folder path
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: string;             // ISO 8601 timestamp
  endTime?: string;              // ISO 8601 timestamp
  completedTasks: number;        // Number of completed tasks
  totalTasks: number;            // Total number of tasks
  error?: string;                // Error message if failed
}

/**
 * Execution history entry for tracking past executions
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 9.5
 */
export interface ExecutionHistoryEntry {
  executionId: string;           // Unique execution identifier
  specId: string;                // Spec that was executed
  specName: string;              // Spec display name
  profileId: string;             // Profile used
  profileName: string;           // Profile display name
  workspaceFolder: string;       // Workspace folder path (for multi-workspace tracking)
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: string;             // ISO 8601 timestamp
  endTime?: string;              // ISO 8601 timestamp
  duration?: number;             // Duration in milliseconds
  completedTasks: number;        // Tasks completed
  totalTasks: number;            // Total tasks
  error?: string;                // Error message if failed
}

/**
 * Filter criteria for querying execution history
 * 
 * Requirements: 6.6
 */
export interface HistoryFilter {
  specId?: string;               // Filter by spec
  profileId?: string;            // Filter by profile
  status?: ExecutionState['status']; // Filter by status
  startDate?: string;            // Filter by start date (ISO 8601)
  endDate?: string;              // Filter by end date (ISO 8601)
  workspaceFolder?: string;      // Filter by workspace folder
}

/**
 * Template variables available for profile templates
 * 
 * Requirements: 2.1, 2.2
 */
export interface TemplateVariables {
  specName: string;              // Name of the spec
  specPath: string;              // Absolute path to spec folder
  totalTasks: number;            // Total number of tasks
  completedTasks: number;        // Number of completed tasks
  remainingTasks: number;        // Number of remaining tasks
  workspaceFolder: string;       // Workspace folder name
  specRelativePath: string;      // Relative path from workspace root
}

/**
 * Validation result for profile validation
 * 
 * Requirements: 1.3, 10.2
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Execution result returned from execution manager
 * 
 * Requirements: 4.2, 4.3, 4.4, 4.5
 */
export interface ExecutionResult {
  success: boolean;
  executionId?: string;
  error?: string;
}

/**
 * Execution statistics for analytics
 * 
 * Requirements: 6.6
 */
export interface ExecutionStatistics {
  totalExecutions: number;
  successRate: number;           // Percentage (0-100)
  averageDuration: number;       // Milliseconds
  bySpec: { [specId: string]: SpecExecutionStats };
  byProfile: { [profileId: string]: ProfileExecutionStats };
}

/**
 * Per-spec execution statistics
 */
export interface SpecExecutionStats {
  specName: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  averageDuration: number;
}

/**
 * Per-profile execution statistics
 */
export interface ProfileExecutionStats {
  profileName: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  averageDuration: number;
}

/**
 * Extended ExtensionMessage types for automated spec execution
 * 
 * Requirements: 1.3, 1.4, 1.5, 4.1, 4.2, 6.4, 6.6, 3.5
 */
export type AutomatedExecutionExtensionMessage =
  | { type: 'profilesUpdated'; profiles: ExecutionProfile[] }
  | { type: 'executionStateChanged'; specId: string; state: ExecutionState }
  | { type: 'executionHistoryUpdated'; entries: ExecutionHistoryEntry[] }
  | { type: 'executionStatisticsUpdated'; statistics: ExecutionStatistics };

/**
 * Extended WebviewMessage types for automated spec execution
 * 
 * Requirements: 1.3, 1.4, 1.5, 4.1, 4.2, 6.4, 6.6, 3.5
 */
export type AutomatedExecutionWebviewMessage =
  | { type: 'createProfile'; profile: ExecutionProfile }
  | { type: 'updateProfile'; profileId: string; updates: Partial<ExecutionProfile> }
  | { type: 'deleteProfile'; profileId: string }
  | { type: 'executeSpec'; specId: string; profileId: string }
  | { type: 'cancelExecution'; executionId: string }
  | { type: 'getProfiles' }
  | { type: 'getExecutionHistory'; filter?: HistoryFilter }
  | { type: 'getExecutionStatistics' }
  | { type: 'resetBuiltInProfile'; profileId: string };

/**
 * ============================================================================
 * Webview Panels Refactor Types
 * ============================================================================
 */

/**
 * Messages sent from profiles webview to extension
 * 
 * Requirements: 5.1-5.7
 */
export type ProfilesWebviewMessage =
  | { type: 'loadProfiles' }
  | { type: 'createProfile'; profile: ExecutionProfile }
  | { type: 'updateProfile'; profileId: string; updates: Partial<ExecutionProfile> }
  | { type: 'deleteProfile'; profileId: string }
  | { type: 'resetProfile'; profileId: string }
  | { type: 'confirmDelete'; profileId: string; profileName: string }
  | { type: 'confirmReset'; profileId: string; profileName: string };

/**
 * Messages sent from extension to profiles webview
 * 
 * Requirements: 5.1-5.7
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
 * 
 * Requirements: 6.1-6.6
 */
export type HistoryWebviewMessage =
  | { type: 'loadHistory' }
  | { type: 'filterHistory'; filter: HistoryFilter }
  | { type: 'getStatistics' }
  | { type: 'clearHistory' };

/**
 * Messages sent from extension to history webview
 * 
 * Requirements: 6.1-6.6
 */
export type HistoryExtensionMessage =
  | { type: 'historyLoaded'; entries: ExecutionHistoryEntry[] }
  | { type: 'historyFiltered'; entries: ExecutionHistoryEntry[] }
  | { type: 'statisticsLoaded'; statistics: ExecutionStatistics }
  | { type: 'historyCleared' }
  | { type: 'error'; message: string; details?: string };

/**
 * UI state for profiles webview
 * 
 * Requirements: 3.1-3.8
 */
export interface ProfilesViewState {
  selectedProfileId?: string;
  isCreating: boolean;
  isEditing: boolean;
  editingProfileId?: string;
  searchQuery: string;
  filterBuiltIn: 'all' | 'builtin' | 'custom';
}

/**
 * UI state for history webview
 * 
 * Requirements: 4.1-4.7
 */
export interface HistoryViewState {
  selectedEntryId?: string;
  filter: HistoryFilter;
  sortBy: 'date' | 'spec' | 'profile' | 'status';
  sortOrder: 'asc' | 'desc';
  viewMode: 'list' | 'details';
}
