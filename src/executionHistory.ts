import * as vscode from 'vscode';
import { ExecutionHistoryEntry, HistoryFilter, ExecutionStatistics, SpecExecutionStats, ProfileExecutionStats } from './types';

/**
 * Manages execution history for automated spec execution
 * 
 * Persists history entries to workspace state using VSCode Memento API.
 * Provides query interface for filtering and sorting history entries.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.6
 */
export class ExecutionHistory {
  private static readonly HISTORY_KEY = 'executionHistory';
  private memento: vscode.Memento;
  private outputChannel: vscode.OutputChannel;

  constructor(memento: vscode.Memento, outputChannel: vscode.OutputChannel) {
    this.memento = memento;
    this.outputChannel = outputChannel;
  }

  /**
   * Add a new history entry
   * Handles persistence failures gracefully and continues with in-memory operation
   * 
   * Creates a new execution history entry and persists it to workspace state.
   * 
   * @param entry The execution history entry to add
   * 
   * Requirements: 6.1, 10.5
   */
  async addEntry(entry: ExecutionHistoryEntry): Promise<void> {
    try {
      const entries = await this.getAllEntries();
      entries.push(entry);
      
      try {
        await this.saveEntries(entries);
        
        this.outputChannel.appendLine(
          `[ExecutionHistory] Added entry: ${entry.executionId} (${entry.specName}, ${entry.profileName})`
        );
      } catch (saveError) {
        // Log error but continue operation (Requirement 10.5)
        const errorMsg = saveError instanceof Error ? saveError.message : String(saveError);
        this.outputChannel.appendLine(
          `[ExecutionHistory] Warning: Could not persist history entry to workspace state: ${errorMsg}`
        );
        this.outputChannel.appendLine(
          `[ExecutionHistory] Entry will be kept in memory but lost on restart`
        );
        
        // Show warning to user
        vscode.window.showWarningMessage(
          'Could not save execution history. History will be lost on restart.',
          'View Output'
        ).then(selection => {
          if (selection === 'View Output') {
            this.outputChannel.show();
          }
        });
        
        // Continue operation - entry is still in memory
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[ExecutionHistory] Error adding entry: ${errorMsg}`
      );
      throw error;
    }
  }

  /**
   * Update an existing entry
   * Handles persistence failures gracefully and continues with in-memory operation
   * 
   * Updates an existing execution history entry with new data.
   * If the entry doesn't exist, this method does nothing.
   * 
   * @param executionId The execution ID to update
   * @param updates Partial updates to apply to the entry
   * 
   * Requirements: 6.2, 10.5
   */
  async updateEntry(executionId: string, updates: Partial<ExecutionHistoryEntry>): Promise<void> {
    try {
      const entries = await this.getAllEntries();
      const index = entries.findIndex(e => e.executionId === executionId);
      
      if (index === -1) {
        this.outputChannel.appendLine(
          `[ExecutionHistory] Entry not found for update: ${executionId}`
        );
        return;
      }
      
      // Apply updates
      entries[index] = { ...entries[index], ...updates };
      
      // Calculate duration if endTime is provided and not already set
      if (updates.endTime && !updates.duration) {
        const startTime = new Date(entries[index].startTime).getTime();
        const endTime = new Date(updates.endTime).getTime();
        entries[index].duration = endTime - startTime;
      }
      
      try {
        await this.saveEntries(entries);
        
        this.outputChannel.appendLine(
          `[ExecutionHistory] Updated entry: ${executionId}`
        );
      } catch (saveError) {
        // Log error but continue operation (Requirement 10.5)
        const errorMsg = saveError instanceof Error ? saveError.message : String(saveError);
        this.outputChannel.appendLine(
          `[ExecutionHistory] Warning: Could not persist history update to workspace state: ${errorMsg}`
        );
        this.outputChannel.appendLine(
          `[ExecutionHistory] Update will be kept in memory but lost on restart`
        );
        
        // Don't show warning for every update (too noisy), just log
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[ExecutionHistory] Error updating entry: ${errorMsg}`
      );
      throw error;
    }
  }

  /**
   * Get all history entries
   * Handles errors gracefully and returns empty array on failure
   * 
   * Returns all execution history entries sorted by timestamp (most recent first).
   * 
   * @returns Array of execution history entries sorted by startTime descending
   * 
   * Requirements: 6.3, 6.4, 10.5
   */
  async getAllEntries(): Promise<ExecutionHistoryEntry[]> {
    try {
      const entries = this.memento.get<ExecutionHistoryEntry[]>(ExecutionHistory.HISTORY_KEY, []);
      
      // Sort by startTime descending (most recent first)
      return entries.sort((a, b) => {
        const timeA = new Date(a.startTime).getTime();
        const timeB = new Date(b.startTime).getTime();
        return timeB - timeA;
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[ExecutionHistory] Error loading entries from workspace state: ${errorMsg}`
      );
      this.outputChannel.appendLine(
        `[ExecutionHistory] Returning empty history array`
      );
      
      // Show warning to user
      vscode.window.showWarningMessage(
        'Could not load execution history. History may be corrupted.',
        'View Output'
      ).then(selection => {
        if (selection === 'View Output') {
          this.outputChannel.show();
        }
      });
      
      // Return empty array to allow continued operation (Requirement 10.5)
      return [];
    }
  }

  /**
   * Get entries for a specific spec
   * 
   * Returns all execution history entries for a given spec,
   * sorted by timestamp (most recent first).
   * 
   * @param specId The spec ID to filter by
   * @returns Array of execution history entries for the spec
   */
  async getEntriesForSpec(specId: string): Promise<ExecutionHistoryEntry[]> {
    const allEntries = await this.getAllEntries();
    return allEntries.filter(e => e.specId === specId);
  }

  /**
   * Get entries filtered by criteria
   * Handles errors gracefully and returns empty array on failure
   * 
   * Returns execution history entries that match all specified filter criteria.
   * All filters are optional and combined with AND logic.
   * 
   * @param filter Filter criteria to apply
   * @returns Array of execution history entries matching the filter
   * 
   * Requirements: 6.6, 10.5
   */
  async queryEntries(filter: HistoryFilter): Promise<ExecutionHistoryEntry[]> {
    try {
      const allEntries = await this.getAllEntries();
      
      return allEntries.filter(entry => {
        // Filter by spec ID
        if (filter.specId && entry.specId !== filter.specId) {
          return false;
        }
        
        // Filter by profile ID
        if (filter.profileId && entry.profileId !== filter.profileId) {
          return false;
        }
        
        // Filter by status
        if (filter.status && entry.status !== filter.status) {
          return false;
        }
        
        // Filter by workspace folder
        if (filter.workspaceFolder && entry.workspaceFolder !== filter.workspaceFolder) {
          return false;
        }
        
        // Filter by start date (entries on or after this date)
        if (filter.startDate) {
          const entryTime = new Date(entry.startTime).getTime();
          const filterTime = new Date(filter.startDate).getTime();
          if (entryTime < filterTime) {
            return false;
          }
        }
        
        // Filter by end date (entries on or before this date)
        if (filter.endDate) {
          const entryTime = new Date(entry.startTime).getTime();
          const filterTime = new Date(filter.endDate).getTime();
          if (entryTime > filterTime) {
            return false;
          }
        }
        
        return true;
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[ExecutionHistory] Error querying entries: ${errorMsg}`
      );
      
      // Return empty array to allow continued operation (Requirement 10.5)
      return [];
    }
  }

  /**
   * Clear all history
   * Handles persistence failures gracefully
   * 
   * Removes all execution history entries from workspace state.
   * 
   * Requirements: 10.5
   */
  async clearHistory(): Promise<void> {
    try {
      await this.memento.update(ExecutionHistory.HISTORY_KEY, []);
      this.outputChannel.appendLine('[ExecutionHistory] Cleared all history');
      
      vscode.window.showInformationMessage('Execution history cleared successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[ExecutionHistory] Error clearing history: ${errorMsg}`
      );
      
      vscode.window.showErrorMessage(
        `Could not clear execution history: ${errorMsg}`,
        'View Output'
      ).then(selection => {
        if (selection === 'View Output') {
          this.outputChannel.show();
        }
      });
      
      throw error;
    }
  }

  /**
   * Get execution statistics
   * 
   * Calculates aggregate statistics from execution history including:
   * - Total executions
   * - Success rate
   * - Average duration
   * - Per-spec statistics
   * - Per-profile statistics
   * 
   * @returns Execution statistics object
   * 
   * Requirements: 6.6
   */
  async getStatistics(): Promise<ExecutionStatistics> {
    try {
      const entries = await this.getAllEntries();
      
      // Calculate total executions
      const totalExecutions = entries.length;
      
      // Calculate success rate
      const successfulExecutions = entries.filter(e => e.status === 'completed').length;
      const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;
      
      // Calculate average duration (only for completed executions with duration)
      const completedWithDuration = entries.filter(e => e.duration !== undefined);
      const totalDuration = completedWithDuration.reduce((sum, e) => sum + (e.duration || 0), 0);
      const averageDuration = completedWithDuration.length > 0 
        ? totalDuration / completedWithDuration.length 
        : 0;
      
      // Calculate per-spec statistics
      const bySpec: { [specId: string]: SpecExecutionStats } = {};
      for (const entry of entries) {
        if (!bySpec[entry.specId]) {
          bySpec[entry.specId] = {
            specName: entry.specName,
            totalExecutions: 0,
            successCount: 0,
            failureCount: 0,
            averageDuration: 0
          };
        }
        
        const stats = bySpec[entry.specId];
        stats.totalExecutions++;
        
        if (entry.status === 'completed') {
          stats.successCount++;
        } else if (entry.status === 'failed') {
          stats.failureCount++;
        }
      }
      
      // Calculate average duration per spec
      for (const specId in bySpec) {
        const specEntries = entries.filter(e => e.specId === specId && e.duration !== undefined);
        const specTotalDuration = specEntries.reduce((sum, e) => sum + (e.duration || 0), 0);
        bySpec[specId].averageDuration = specEntries.length > 0 
          ? specTotalDuration / specEntries.length 
          : 0;
      }
      
      // Calculate per-profile statistics
      const byProfile: { [profileId: string]: ProfileExecutionStats } = {};
      for (const entry of entries) {
        if (!byProfile[entry.profileId]) {
          byProfile[entry.profileId] = {
            profileName: entry.profileName,
            totalExecutions: 0,
            successCount: 0,
            failureCount: 0,
            averageDuration: 0
          };
        }
        
        const stats = byProfile[entry.profileId];
        stats.totalExecutions++;
        
        if (entry.status === 'completed') {
          stats.successCount++;
        } else if (entry.status === 'failed') {
          stats.failureCount++;
        }
      }
      
      // Calculate average duration per profile
      for (const profileId in byProfile) {
        const profileEntries = entries.filter(e => e.profileId === profileId && e.duration !== undefined);
        const profileTotalDuration = profileEntries.reduce((sum, e) => sum + (e.duration || 0), 0);
        byProfile[profileId].averageDuration = profileEntries.length > 0 
          ? profileTotalDuration / profileEntries.length 
          : 0;
      }
      
      return {
        totalExecutions,
        successRate,
        averageDuration,
        bySpec,
        byProfile
      };
    } catch (error) {
      this.outputChannel.appendLine(
        `[ExecutionHistory] Error calculating statistics: ${error instanceof Error ? error.message : String(error)}`
      );
      
      // Return empty statistics on error
      return {
        totalExecutions: 0,
        successRate: 0,
        averageDuration: 0,
        bySpec: {},
        byProfile: {}
      };
    }
  }

  /**
   * Save entries to workspace state
   * Provides detailed error logging for persistence failures
   * 
   * @param entries Array of execution history entries to save
   * 
   * Requirements: 10.5
   */
  private async saveEntries(entries: ExecutionHistoryEntry[]): Promise<void> {
    try {
      await this.memento.update(ExecutionHistory.HISTORY_KEY, entries);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[ExecutionHistory] Error saving entries to workspace state: ${errorMsg}`
      );
      this.outputChannel.appendLine(
        `[ExecutionHistory] This may indicate workspace state corruption or storage quota exceeded`
      );
      
      throw error;
    }
  }
}
