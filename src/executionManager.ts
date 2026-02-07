/**
 * ExecutionManager - Manages spec execution lifecycle and state
 * 
 * Requirements: 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 7.2, 12.1, 12.2, 12.5
 */

import * as vscode from 'vscode';
import { ExecutionState, ExecutionResult, SpecFile, ExecutionProfile } from './types';
import { ProfileManager } from './profileManager';
import { StateManager } from './stateManager';
import { ExecutionHistory } from './executionHistory';

/**
 * ExecutionManager handles the execution lifecycle of specs
 * 
 * State machine: idle → running → completed/failed/cancelled
 */
export class ExecutionManager {
  private readonly outputChannel: vscode.OutputChannel;
  private readonly profileManager: ProfileManager;
  private readonly stateManager: StateManager;
  private executionHistory?: ExecutionHistory;
  
  // Track active executions in memory
  private activeExecutions: Map<string, ExecutionState> = new Map();
  
  // Track file watchers for active executions
  private taskFileWatchers: Map<string, vscode.FileSystemWatcher> = new Map();
  
  // Track inactivity timers for detecting stalled/cancelled executions
  private inactivityTimers: Map<string, NodeJS.Timeout> = new Map();
  
  // Callback for state changes (to notify webview)
  private onStateChangedCallback?: (specId: string, state: ExecutionState) => void;
  
  // Inactivity timeout (5 minutes of no task changes = assume cancelled/stalled)
  private readonly INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

  constructor(
    outputChannel: vscode.OutputChannel,
    profileManager: ProfileManager,
    stateManager: StateManager
  ) {
    this.outputChannel = outputChannel;
    this.profileManager = profileManager;
    this.stateManager = stateManager;
    
    // Restore execution states from workspace state
    this.restoreExecutionStates();
  }

  /**
   * Set the execution history instance
   * This is called after ExecutionHistory is created to avoid circular dependencies
   * 
   * Requirements: 12.5
   */
  setExecutionHistory(executionHistory: ExecutionHistory): void {
    this.executionHistory = executionHistory;
  }

  /**
   * Set callback for state change notifications
   * 
   * Requirements: 5.1, 5.2, 5.3
   */
  onStateChanged(callback: (specId: string, state: ExecutionState) => void): void {
    this.onStateChangedCallback = callback;
  }

  /**
   * Restore execution states from workspace state
   * 
   * Requirements: 5.5, 5.6
   */
  private async restoreExecutionStates(): Promise<void> {
    try {
      // Use a custom method to get execution states from workspace state
      const states = await this.getExecutionStatesFromStorage();
      
      // Restore active executions
      for (const [specId, state] of Object.entries(states)) {
        this.activeExecutions.set(specId, state);
      }
      
      this.outputChannel.appendLine(`[ExecutionManager] Restored ${this.activeExecutions.size} execution states`);
    } catch (error) {
      this.outputChannel.appendLine(`[ExecutionManager] Error restoring execution states: ${error}`);
    }
  }

  /**
   * Get execution states from storage
   * Helper method to access workspace state through StateManager
   */
  private async getExecutionStatesFromStorage(): Promise<Record<string, ExecutionState>> {
    return await this.stateManager.getExecutionStates();
  }

  /**
   * Persist execution states to workspace state
   * 
   * Requirements: 5.5
   */
  private async persistExecutionStates(): Promise<void> {
    try {
      const states: Record<string, ExecutionState> = {};
      
      for (const [specId, state] of this.activeExecutions.entries()) {
        states[specId] = state;
      }
      
      await this.saveExecutionStatesToStorage(states);
    } catch (error) {
      this.outputChannel.appendLine(`[ExecutionManager] Error persisting execution states: ${error}`);
    }
  }

  /**
   * Save execution states to storage
   * Helper method to access workspace state through StateManager
   */
  private async saveExecutionStatesToStorage(states: Record<string, ExecutionState>): Promise<void> {
    await this.stateManager.saveExecutionStates(states);
  }

  /**
   * Get profiles available for a specific workspace folder
   * Filters profiles to only those from the spec's workspace folder
   * 
   * Requirements: 9.4
   */
  async getProfilesForWorkspace(workspaceFolder: vscode.WorkspaceFolder): Promise<ExecutionProfile[]> {
    try {
      // Load all profiles
      const allProfiles = await this.profileManager.loadAllProfiles();
      
      // Filter to profiles from this workspace folder
      const filteredProfiles = allProfiles.filter(profile => {
        // Check if profile has workspace folder metadata
        if (profile.metadata?.workspaceFolder) {
          return profile.metadata.workspaceFolder === workspaceFolder.uri.fsPath;
        }
        
        // Built-in profiles without workspace metadata are available to all workspaces
        return profile.isBuiltIn;
      });
      
      this.outputChannel.appendLine(
        `[ExecutionManager] Found ${filteredProfiles.length} profiles for workspace "${workspaceFolder.name}"`
      );
      
      return filteredProfiles;
    } catch (error) {
      this.outputChannel.appendLine(
        `[ExecutionManager] Error getting profiles for workspace: ${error}`
      );
      return [];
    }
  }

  /**
   * Execute a spec with a given profile by sending to Kiro chat
   * 
   * Requirements: 4.2, 4.3, 4.4, 4.5, 9.4, 10.3, 12.1
   */
  async executeSpec(
    spec: SpecFile,
    profileId: string,
    workspaceFolder: vscode.WorkspaceFolder
  ): Promise<ExecutionResult> {
    try {
      // Load profile
      const profile = await this.profileManager.getProfile(profileId, workspaceFolder);
      if (!profile) {
        const errorMsg = `Profile "${profileId}" not found`;
        this.outputChannel.appendLine(`[ExecutionManager] ${errorMsg}`);
        
        vscode.window.showErrorMessage(errorMsg);
        
        return {
          success: false,
          error: errorMsg
        };
      }

      // Generate execution ID
      const executionId = this.generateExecutionId();
      
      // Create execution state
      const executionState: ExecutionState = {
        executionId,
        specId: spec.name,
        profileId: profile.id,
        workspaceFolder: workspaceFolder.uri.fsPath,
        status: 'running',
        startTime: new Date().toISOString(),
        completedTasks: spec.completedTasks,
        totalTasks: spec.totalTasks
      };
      
      // Store execution state
      this.activeExecutions.set(spec.name, executionState);
      await this.persistExecutionStates();
      
      // Notify state change
      this.notifyStateChanged(spec.name, executionState);
      
      // Set up file watcher for tasks.md to monitor progress
      // Requirements: 12.1
      this.setupTaskFileWatcher(spec);
      
      // Instantiate template
      let prompt: string;
      try {
        prompt = this.profileManager.instantiateTemplate(profile, spec);
      } catch (templateError) {
        const errorMsg = `Template instantiation failed: ${templateError}`;
        this.outputChannel.appendLine(`[ExecutionManager] ${errorMsg}`);
        
        // Update state to failed
        executionState.status = 'failed';
        executionState.endTime = new Date().toISOString();
        executionState.error = errorMsg;
        
        this.activeExecutions.set(spec.name, executionState);
        await this.persistExecutionStates();
        this.notifyStateChanged(spec.name, executionState);
        this.cleanupTaskFileWatcher(spec.name);
        
        vscode.window.showErrorMessage(
          `Could not execute spec: ${errorMsg}`
        );
        
        return {
          success: false,
          error: errorMsg
        };
      }
      
      // Send prompt to Kiro chat (Requirement 4.3, 4.5, 10.3)
      try {
        this.outputChannel.appendLine(
          `[ExecutionManager] Sending prompt to Kiro chat (length: ${prompt.length} chars)`
        );
        this.outputChannel.appendLine(
          `[ExecutionManager] Prompt preview: ${prompt.substring(0, 200)}...`
        );
        
        // Check available commands
        const commands = await vscode.commands.getCommands();
        this.outputChannel.appendLine(`[ExecutionManager] Total commands available: ${commands.length}`);
        
        // Try different command variations to find the right one for Kiro
        const possibleCommands = [
          'kiroAgent.sendMainUserInput',  // Kiro command to send user input
          'kiroAgent.executions.queueUserMessage',  // Kiro command to queue messages
          'kiroAgent.agent.chatAgent',  // Kiro chat agent
          'workbench.action.chat.open'  // Fallback
        ];
        
        let commandToUse: string | null = null;
        for (const cmd of possibleCommands) {
          if (commands.includes(cmd)) {
            commandToUse = cmd;
            this.outputChannel.appendLine(`[ExecutionManager] Found available command: ${cmd}`);
            break;
          }
        }
        
        if (!commandToUse) {
          // List all kiro-related commands for debugging
          const kiroCommands = commands.filter(cmd => cmd.toLowerCase().includes('kiro') || cmd.toLowerCase().includes('chat'));
          this.outputChannel.appendLine(`[ExecutionManager] Available Kiro/Chat commands: ${kiroCommands.join(', ')}`);
          throw new Error('No suitable chat command found. Please check the output channel for available commands.');
        }
        
        // Send to Kiro chat using the found command
        this.outputChannel.appendLine(`[ExecutionManager] Sending via ${commandToUse}`);
        
        // Try Kiro-specific commands first
        if (commandToUse === 'kiroAgent.executions.queueUserMessage') {
          // Try sending directly to Kiro queue
          this.outputChannel.appendLine('[ExecutionManager] Queueing message to Kiro');
          await vscode.commands.executeCommand(commandToUse, prompt);
        } else if (commandToUse === 'kiroAgent.sendMainUserInput' || 
                   commandToUse === 'kiroAgent.agent.chatAgent') {
          // These commands need the input to be in the chat field first
          // Use clipboard workaround
          this.outputChannel.appendLine('[ExecutionManager] Using Kiro clipboard workaround');
          
          // Save original clipboard
          const originalClipboard = await vscode.env.clipboard.readText();
          
          // Focus chat input
          if (commands.includes('kiroAgent.focusContinueInput')) {
            await vscode.commands.executeCommand('kiroAgent.focusContinueInput');
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          
          // Copy prompt to clipboard
          await vscode.env.clipboard.writeText(prompt);
          
          // Paste into chat
          await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
          
          // Wait a bit
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Send the input
          if (commandToUse === 'kiroAgent.sendMainUserInput') {
            await vscode.commands.executeCommand('kiroAgent.sendMainUserInput');
          }
          
          // Restore clipboard
          await vscode.env.clipboard.writeText(originalClipboard);
        } else {
          // Fallback: Use clipboard workaround with workbench.action.chat.open
          this.outputChannel.appendLine('[ExecutionManager] Using generic clipboard workaround');
          
          const originalClipboard = await vscode.env.clipboard.readText();
          await vscode.commands.executeCommand(commandToUse);
          await new Promise(resolve => setTimeout(resolve, 500));
          await vscode.env.clipboard.writeText(prompt);
          await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
          await vscode.env.clipboard.writeText(originalClipboard);
          
          this.outputChannel.appendLine('[ExecutionManager] Message pasted - user needs to press Enter');
        }
        
        this.outputChannel.appendLine('[ExecutionManager] Message sent successfully');
        
        this.outputChannel.appendLine(
          `[ExecutionManager] Execution started: ${executionId} for spec "${spec.name}" with profile "${profile.name}"`
        );
        
        // Show success notification
        vscode.window.showInformationMessage(
          `Executing spec "${spec.name}" with profile "${profile.name}". Check the Kiro chat panel.`
        );
        
        return {
          success: true,
          executionId
        };
        
      } catch (commandError) {
        // Command execution failed (Requirement 4.5, 10.3)
        const errorMsg = commandError instanceof Error ? commandError.message : String(commandError);
        this.outputChannel.appendLine(
          `[ExecutionManager] Kiro chat execution failed: ${errorMsg}`
        );
        
        // Update state to failed
        executionState.status = 'failed';
        executionState.endTime = new Date().toISOString();
        executionState.error = `Kiro chat execution failed: ${errorMsg}`;
        
        this.activeExecutions.set(spec.name, executionState);
        await this.persistExecutionStates();
        this.notifyStateChanged(spec.name, executionState);
        
        // Clean up file watcher
        this.cleanupTaskFileWatcher(spec.name);
        
        // Show error to user
        vscode.window.showErrorMessage(
          `Execution failed: ${errorMsg}`,
          'View Output'
        ).then(selection => {
          if (selection === 'View Output') {
            this.outputChannel.show();
          }
        });
        
        return {
          success: false,
          error: `Kiro chat execution failure: ${errorMsg}`
        };
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[ExecutionManager] Error executing spec: ${errorMsg}`);
      
      vscode.window.showErrorMessage(
        `Execution failed: ${errorMsg}`,
        'View Output'
      ).then(selection => {
        if (selection === 'View Output') {
          this.outputChannel.show();
        }
      });
      
      return {
        success: false,
        error: `Execution failed: ${errorMsg}`
      };
    }
  }

  /**
   * Cancel a running execution
   * Handles errors gracefully with detailed logging
   * 
   * Requirements: 7.2, 7.3, 7.4, 10.3
   */
  async cancelExecution(executionId: string): Promise<void> {
    try {
      // Find execution by ID
      let specId: string | undefined;
      let state: ExecutionState | undefined;
      
      for (const [sid, s] of this.activeExecutions.entries()) {
        if (s.executionId === executionId) {
          specId = sid;
          state = s;
          break;
        }
      }
      
      if (!specId || !state) {
        const errorMsg = `Execution "${executionId}" not found`;
        this.outputChannel.appendLine(`[ExecutionManager] ${errorMsg}`);
        
        vscode.window.showWarningMessage(errorMsg);
        throw new Error(errorMsg);
      }
      
      // Only cancel if running
      if (state.status !== 'running') {
        const errorMsg = `Execution "${executionId}" is not running (status: ${state.status})`;
        this.outputChannel.appendLine(`[ExecutionManager] ${errorMsg}`);
        
        vscode.window.showWarningMessage(
          `Cannot cancel execution: it is already ${state.status}`
        );
        throw new Error(errorMsg);
      }
      
      // Try to abort the Kiro agent execution (Requirement 7.4)
      try {
        this.outputChannel.appendLine(`[ExecutionManager] Attempting to abort Kiro agent execution`);
        
        // Check if the abort command is available
        const commands = await vscode.commands.getCommands();
        if (commands.includes('kiroAgent.executions.abortActiveAgent')) {
          await vscode.commands.executeCommand('kiroAgent.executions.abortActiveAgent');
          this.outputChannel.appendLine(`[ExecutionManager] Successfully sent abort command to Kiro agent`);
        } else {
          this.outputChannel.appendLine(`[ExecutionManager] WARNING: kiroAgent.executions.abortActiveAgent command not available`);
          this.outputChannel.appendLine(`[ExecutionManager] Available Kiro commands: ${commands.filter(cmd => cmd.includes('kiro')).join(', ')}`);
        }
      } catch (abortError) {
        // Log the error but don't fail the cancellation - we still want to update our state
        const abortErrorMsg = abortError instanceof Error ? abortError.message : String(abortError);
        this.outputChannel.appendLine(`[ExecutionManager] WARNING: Failed to abort Kiro agent: ${abortErrorMsg}`);
      }
      
      // Update state to cancelled
      state.status = 'cancelled';
      state.endTime = new Date().toISOString();
      
      this.activeExecutions.set(specId, state);
      await this.persistExecutionStates();
      
      // Notify state change
      this.notifyStateChanged(specId, state);
      
      // Clean up file watcher and inactivity timer
      this.cleanupTaskFileWatcher(specId);
      
      this.outputChannel.appendLine(`[ExecutionManager] Execution cancelled: ${executionId}`);
      
      // Show success notification
      vscode.window.showInformationMessage(
        `Execution cancelled for spec "${specId}"`
      );
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[ExecutionManager] Error cancelling execution: ${errorMsg}`);
      
      // Only show error if it's not already shown (not found or not running)
      if (!errorMsg.includes('not found') && !errorMsg.includes('not running')) {
        vscode.window.showErrorMessage(
          `Could not cancel execution: ${errorMsg}`
        );
      }
      
      throw error;
    }
  }

  /**
   * Get current execution state for a spec
   * 
   * Requirements: 5.1
   */
  getExecutionState(specId: string): ExecutionState | undefined {
    return this.activeExecutions.get(specId);
  }

  /**
   * Get all active executions
   * 
   * Requirements: 5.1
   */
  getActiveExecutions(): Map<string, ExecutionState> {
    return new Map(this.activeExecutions);
  }

  /**
   * Mark execution as completed
   * Handles errors gracefully with detailed logging
   * 
   * Requirements: 5.2, 5.3, 10.3
   */
  async completeExecution(
    executionId: string,
    status: 'completed' | 'failed',
    error?: string
  ): Promise<void> {
    try {
      // Find execution by ID
      let specId: string | undefined;
      let state: ExecutionState | undefined;
      
      for (const [sid, s] of this.activeExecutions.entries()) {
        if (s.executionId === executionId) {
          specId = sid;
          state = s;
          break;
        }
      }
      
      if (!specId || !state) {
        const errorMsg = `Execution "${executionId}" not found`;
        this.outputChannel.appendLine(`[ExecutionManager] ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      // Update state
      state.status = status;
      state.endTime = new Date().toISOString();
      if (error) {
        state.error = error;
      }
      
      this.activeExecutions.set(specId, state);
      await this.persistExecutionStates();
      
      // Notify state change
      this.notifyStateChanged(specId, state);
      
      // Clean up file watcher
      this.cleanupTaskFileWatcher(specId);
      
      this.outputChannel.appendLine(`[ExecutionManager] Execution ${status}: ${executionId}`);
      
      // Show notification to user
      if (status === 'completed') {
        vscode.window.showInformationMessage(
          `Spec "${specId}" execution completed successfully`
        );
      } else {
        vscode.window.showErrorMessage(
          `Spec "${specId}" execution failed${error ? `: ${error}` : ''}`,
          'View Output'
        ).then(selection => {
          if (selection === 'View Output') {
            this.outputChannel.show();
          }
        });
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[ExecutionManager] Error completing execution: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Update task progress for an execution
   * 
   * Requirements: 12.1, 12.2, 12.5
   */
  updateTaskProgress(executionId: string, completedTasks: number, totalTasks: number): void {
    try {
      // Find execution by ID
      let specId: string | undefined;
      let state: ExecutionState | undefined;
      
      for (const [sid, s] of this.activeExecutions.entries()) {
        if (s.executionId === executionId) {
          specId = sid;
          state = s;
          break;
        }
      }
      
      if (!specId || !state) {
        this.outputChannel.appendLine(`[ExecutionManager] Execution "${executionId}" not found for progress update`);
        return;
      }
      
      // Update progress
      state.completedTasks = completedTasks;
      state.totalTasks = totalTasks;
      
      this.activeExecutions.set(specId, state);
      
      // Persist asynchronously (don't await to avoid blocking)
      this.persistExecutionStates().catch(error => {
        this.outputChannel.appendLine(`[ExecutionManager] Error persisting progress update: ${error}`);
      });
      
      // Notify state change
      this.notifyStateChanged(specId, state);
      
      // Update execution history entry with progress
      // Requirements: 12.5
      if (this.executionHistory) {
        this.executionHistory.updateEntry(executionId, {
          completedTasks,
          totalTasks
        }).catch(error => {
          this.outputChannel.appendLine(`[ExecutionManager] Error updating history with progress: ${error}`);
        });
      }
      
    } catch (error) {
      this.outputChannel.appendLine(`[ExecutionManager] Error updating task progress: ${error}`);
    }
  }

  /**
   * Set up file watcher for tasks.md to monitor task completion during execution
   * 
   * Requirements: 12.1
   */
  private setupTaskFileWatcher(spec: SpecFile): void {
    try {
      // Clean up any existing watcher for this spec
      this.cleanupTaskFileWatcher(spec.name);
      
      // Create a file system watcher for the tasks.md file
      const tasksFilePath = vscode.Uri.file(spec.path).fsPath + '/tasks.md';
      const watcher = vscode.workspace.createFileSystemWatcher(tasksFilePath);
      
      // Handle file changes
      watcher.onDidChange(async (uri) => {
        await this.handleTaskFileChange(spec.name, uri);
      });
      
      // Store the watcher
      this.taskFileWatchers.set(spec.name, watcher);
      
      // Get execution state to start inactivity timer
      const state = this.activeExecutions.get(spec.name);
      if (state) {
        this.resetInactivityTimer(spec.name, state.executionId);
      }
      
      this.outputChannel.appendLine(`[ExecutionManager] Set up task file watcher for spec "${spec.name}"`);
      
    } catch (error) {
      this.outputChannel.appendLine(`[ExecutionManager] Error setting up task file watcher: ${error}`);
    }
  }

  /**
   * Handle changes to tasks.md file during execution
   * 
   * Requirements: 12.1, 12.2, 12.5
   */
  private async handleTaskFileChange(specId: string, uri: vscode.Uri): Promise<void> {
    try {
      // Get the execution state
      const state = this.activeExecutions.get(specId);
      
      // Only process if execution is still running
      if (!state || state.status !== 'running') {
        return;
      }
      
      // Reset inactivity timer - we detected activity
      this.resetInactivityTimer(specId, state.executionId);
      
      // Read and parse the tasks.md file
      const content = await vscode.workspace.fs.readFile(uri);
      const tasksContent = Buffer.from(content).toString('utf8');
      
      // Parse task completion status
      const taskStats = this.parseTaskStats(tasksContent);
      
      // Check if task counts have changed
      if (taskStats.completedTasks !== state.completedTasks || taskStats.totalTasks !== state.totalTasks) {
        this.outputChannel.appendLine(
          `[ExecutionManager] Task progress updated for spec "${specId}": ${taskStats.completedTasks}/${taskStats.totalTasks}`
        );
        
        // Update execution state with new progress
        // Requirements: 12.2
        this.updateTaskProgress(state.executionId, taskStats.completedTasks, taskStats.totalTasks);
        
        // Check if all tasks are completed
        if (taskStats.completedTasks === taskStats.totalTasks && taskStats.totalTasks > 0) {
          this.outputChannel.appendLine(
            `[ExecutionManager] All tasks completed for spec "${specId}". Marking execution as completed.`
          );
          await this.completeExecution(state.executionId, 'completed');
        }
      }
      
    } catch (error) {
      this.outputChannel.appendLine(`[ExecutionManager] Error handling task file change: ${error}`);
    }
  }
  
  /**
   * Reset inactivity timer for an execution
   * If no task changes occur for INACTIVITY_TIMEOUT_MS, assume execution was cancelled/stalled
   */
  private resetInactivityTimer(specId: string, executionId: string): void {
    // Clear existing timer
    const existingTimer = this.inactivityTimers.get(specId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Set new timer
    const timer = setTimeout(async () => {
      const state = this.activeExecutions.get(specId);
      
      // Only mark as cancelled if still running
      if (state && state.status === 'running') {
        this.outputChannel.appendLine(
          `[ExecutionManager] No activity detected for ${this.INACTIVITY_TIMEOUT_MS / 1000}s on spec "${specId}". ` +
          `Assuming execution was cancelled or stalled.`
        );
        
        // Mark as cancelled
        state.status = 'cancelled';
        state.endTime = new Date().toISOString();
        state.error = 'Execution appears to have been cancelled or stalled (no activity detected)';
        
        this.activeExecutions.set(specId, state);
        await this.persistExecutionStates();
        
        // Notify state change
        this.notifyStateChanged(specId, state);
        
        // Clean up
        this.cleanupTaskFileWatcher(specId);
        this.inactivityTimers.delete(specId);
        
        // Show notification
        vscode.window.showWarningMessage(
          `Execution for spec "${specId}" appears to have been cancelled or stalled.`
        );
      }
    }, this.INACTIVITY_TIMEOUT_MS);
    
    this.inactivityTimers.set(specId, timer);
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
   * Requirements: 12.1
   */
  private parseTaskStats(content: string): {
    totalTasks: number;
    completedTasks: number;
  } {
    if (!content || content.trim().length === 0) {
      return { totalTasks: 0, completedTasks: 0 };
    }

    const lines = content.split('\n');
    let totalTasks = 0;
    let completedTasks = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Match task checkboxes: - [ ], - [x], - [~], - [-]
      // Optional tasks have * suffix: - [ ]*, - [x]*
      const taskMatch = trimmed.match(/^-\s*\[([ x~-])\](\*)?/);

      if (taskMatch) {
        const state = taskMatch[1];

        totalTasks++;
        
        // Count as completed if marked with 'x' (in progress/queued count as not completed)
        if (state === 'x') {
          completedTasks++;
        }
      }
    }

    return { totalTasks, completedTasks };
  }

  /**
   * Clean up file watcher for a spec
   */
  private cleanupTaskFileWatcher(specId: string): void {
    const watcher = this.taskFileWatchers.get(specId);
    if (watcher) {
      watcher.dispose();
      this.taskFileWatchers.delete(specId);
      this.outputChannel.appendLine(`[ExecutionManager] Cleaned up task file watcher for spec "${specId}"`);
    }
    
    // Also clean up inactivity timer
    const timer = this.inactivityTimers.get(specId);
    if (timer) {
      clearTimeout(timer);
      this.inactivityTimers.delete(specId);
      this.outputChannel.appendLine(`[ExecutionManager] Cleaned up inactivity timer for spec "${specId}"`);
    }
  }

  /**
   * Generate a unique execution ID
   */
  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Notify state change callback
   */
  private notifyStateChanged(specId: string, state: ExecutionState): void {
    if (this.onStateChangedCallback) {
      this.onStateChangedCallback(specId, state);
    }
  }

  /**
   * Clear execution state for a spec
   * Useful for cleanup or resetting
   */
  async clearExecutionState(specId: string): Promise<void> {
    this.cleanupTaskFileWatcher(specId);
    this.activeExecutions.delete(specId);
    await this.persistExecutionStates();
  }

  /**
   * Clear all execution states
   * Useful for testing or reset
   */
  async clearAllExecutionStates(): Promise<void> {
    // Clean up all file watchers
    for (const specId of this.taskFileWatchers.keys()) {
      this.cleanupTaskFileWatcher(specId);
    }
    
    this.activeExecutions.clear();
    await this.persistExecutionStates();
  }

  /**
   * Dispose of all resources
   * Called when the extension is deactivated
   */
  dispose(): void {
    // Clean up all file watchers
    for (const watcher of this.taskFileWatchers.values()) {
      watcher.dispose();
    }
    this.taskFileWatchers.clear();
    
    // Clean up all inactivity timers
    for (const timer of this.inactivityTimers.values()) {
      clearTimeout(timer);
    }
    this.inactivityTimers.clear();
    
    this.outputChannel.appendLine('[ExecutionManager] Disposed all resources');
  }
}
