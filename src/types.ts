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
