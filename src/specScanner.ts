import * as vscode from 'vscode';
import { SpecFile } from './types';

/**
 * Scanner for finding and parsing spec files in the workspace.
 * 
 * This class is responsible for:
 * - Recursively scanning .kiro/specs directories in all workspace folders
 * - Reading and parsing tasks.md (required), requirements.md (optional), and design.md (optional)
 * - Extracting task statistics (total, completed, optional, progress)
 * - Handling missing files and errors gracefully
 * 
 * Requirements: 1.1, 2.2, 2.3, 2.4, 2.5, 11.2
 */
export class SpecScanner {
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Specs Dashboard Scanner');
  }
  /**
   * Scan all workspace folders for .kiro/specs directories and parse all spec files.
   * 
   * This method:
   * - Iterates through all workspace folders
   * - Looks for .kiro/specs directory in each folder
   * - Scans each subdirectory within .kiro/specs
   * - Parses spec files and extracts metadata
   * - Handles missing directories gracefully (logs and continues)
   * 
   * @returns Promise resolving to an array of parsed SpecFile objects
   * 
   * Requirements: 1.1, 2.2, 2.4, 2.5, 11.2
   */
  async scanWorkspace(): Promise<SpecFile[]> {
    const specs: SpecFile[] = [];
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders) {
      this.outputChannel.appendLine(`[${new Date().toISOString()}] No workspace folders found`);
      return specs;
    }

    this.outputChannel.appendLine(`[${new Date().toISOString()}] Scanning ${workspaceFolders.length} workspace folder(s)`);

    for (const folder of workspaceFolders) {
      const specsPath = vscode.Uri.joinPath(folder.uri, '.kiro', 'specs');

      try {
        const entries = await vscode.workspace.fs.readDirectory(specsPath);
        this.outputChannel.appendLine(`[${new Date().toISOString()}] Found ${entries.length} entries in ${folder.name}/.kiro/specs`);

        for (const [name, type] of entries) {
          if (type === vscode.FileType.Directory) {
            try {
              const spec = await this.parseSpecDirectory(specsPath, name, folder.name);
              if (spec) {
                specs.push(spec);
                this.outputChannel.appendLine(`[${new Date().toISOString()}] Successfully parsed spec: ${name}`);
              }
            } catch (parseError) {
              // Log error but continue processing other specs (Requirement 2.4, 11.2)
              const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
              this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: Failed to parse spec ${name}: ${errorMsg}`);
              if (parseError instanceof Error && parseError.stack) {
                this.outputChannel.appendLine(`Stack trace: ${parseError.stack}`);
              }
              // Continue with next spec
              continue;
            }
          }
        }
      } catch (error) {
        // .kiro/specs doesn't exist in this workspace folder (Requirement 2.4, 11.2)
        this.outputChannel.appendLine(`[${new Date().toISOString()}] No .kiro/specs directory found in ${folder.name}`);
        continue;
      }
    }

    this.outputChannel.appendLine(`[${new Date().toISOString()}] Scan complete: ${specs.length} spec(s) found`);
    return specs;
  }

  /**
   * Parse a single spec directory and extract all spec files and metadata.
   * 
   * This method:
   * - Reads tasks.md (required) - returns null if missing
   * - Reads requirements.md (optional) - sets to undefined if missing
   * - Reads design.md (optional) - sets to undefined if missing
   * - Extracts last modified timestamp from tasks.md
   * - Parses task statistics from tasks.md content
   * - Handles errors gracefully by logging and returning null
   * 
   * @param basePath The base .kiro/specs directory URI
   * @param name The spec directory name
   * @param workspaceFolder The workspace folder name (for multi-root workspaces)
   * @returns Promise resolving to SpecFile object, or null if parsing fails or tasks.md is missing
   * 
   * Requirements: 2.2, 2.3, 2.4, 11.2 (graceful error handling)
   */
  private async parseSpecDirectory(
    basePath: vscode.Uri,
    name: string,
    workspaceFolder: string
  ): Promise<SpecFile | null> {
    const specPath = vscode.Uri.joinPath(basePath, name);
    const tasksUri = vscode.Uri.joinPath(specPath, 'tasks.md');

    try {
      // tasks.md is required
      const tasksContent = await this.readFile(tasksUri);
      if (!tasksContent) {
        this.outputChannel.appendLine(`[${new Date().toISOString()}] WARNING: Skipping spec ${name}: tasks.md is missing or empty`);
        return null;
      }

      // requirements.md and design.md are optional
      const requirementsContent = await this.readFile(
        vscode.Uri.joinPath(specPath, 'requirements.md')
      );
      const designContent = await this.readFile(
        vscode.Uri.joinPath(specPath, 'design.md')
      );

      // Get last modified timestamp from tasks.md
      let lastModified: Date | undefined;
      try {
        const stat = await vscode.workspace.fs.stat(tasksUri);
        lastModified = new Date(stat.mtime);
      } catch (error) {
        // If we can't get the timestamp, continue without it
        this.outputChannel.appendLine(`[${new Date().toISOString()}] WARNING: Could not get last modified time for ${name}/tasks.md`);
      }

      // Parse task statistics
      const taskStats = this.parseTaskStats(tasksContent);

      return {
        name,
        path: specPath.fsPath,
        workspaceFolder,
        tasksContent,
        requirementsContent,
        designContent,
        lastModified,
        ...taskStats
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: Failed to parse spec directory ${name}: ${errorMsg}`);
      if (error instanceof Error && error.stack) {
        this.outputChannel.appendLine(`Stack trace: ${error.stack}`);
      }
      return null;
    }
  }

  /**
   * Read a file and return its content as a string.
   * 
   * This method handles file read errors gracefully by returning undefined
   * instead of throwing, allowing the caller to handle missing optional files.
   * 
   * @param uri The URI of the file to read
   * @returns Promise resolving to file content as string, or undefined if file doesn't exist or can't be read
   * 
   * Requirements: 2.3 (handle missing optional files gracefully)
   */
  private async readFile(uri: vscode.Uri): Promise<string | undefined> {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(bytes).toString('utf8');
    } catch {
      return undefined;
    }
  }

  /**
   * Parse task statistics from tasks.md content
   * 
   * Supports the following task formats:
   * - [ ] - Pending task
   * - [x] - Completed task
   * - [~] - In progress task (counts as not completed)
   * - [-] - Queued task (counts as not completed)
   * - [ ]* - Optional pending task
   * - [x]* - Optional completed task
   * 
   * @param content The raw markdown content from tasks.md
   * @returns Task statistics including counts and progress percentage
   */
  private parseTaskStats(content: string): {
    totalTasks: number;
    completedTasks: number;
    optionalTasks: number;
    progress: number;
  } {
    if (!content || content.trim().length === 0) {
      return { totalTasks: 0, completedTasks: 0, optionalTasks: 0, progress: 0 };
    }

    const lines = content.split('\n');
    let totalTasks = 0;
    let completedTasks = 0;
    let optionalTasks = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Match task checkboxes: - [ ], - [x], - [~], - [-]
      // Optional tasks have * suffix: - [ ]*, - [x]*
      const taskMatch = trimmed.match(/^-\s*\[([ x~-])\](\*)?/);

      if (taskMatch) {
        const state = taskMatch[1];
        const isOptional = taskMatch[2] === '*';

        totalTasks++;
        
        // Count as completed if marked with 'x' (in progress/queued count as not completed)
        if (state === 'x') {
          completedTasks++;
        }
        
        if (isOptional) {
          optionalTasks++;
        }
      }
    }

    const progress = totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;

    return { totalTasks, completedTasks, optionalTasks, progress };
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.outputChannel.dispose();
  }
}
