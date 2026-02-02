import * as vscode from 'vscode';
import { DashboardState } from './types';

/**
 * Manages persistent state for the dashboard
 * Uses VSCode's workspace and global state APIs
 * Supports per-workspace-folder state isolation for multi-root workspaces
 */
export class StateManager {
  private workspaceState: vscode.Memento;
  private globalState: vscode.Memento;

  constructor(context: vscode.ExtensionContext) {
    this.workspaceState = context.workspaceState;
    this.globalState = context.globalState;
  }

  /**
   * Get the current dashboard state for this workspace
   * In multi-root workspaces, returns a merged view of all workspace folder states
   */
  async getDashboardState(): Promise<DashboardState> {
    try {
      const state = this.workspaceState.get<DashboardState>('dashboardState');
      
      if (state && this.isValidDashboardState(state)) {
        return state;
      }
      
      // Return default state if not found or invalid
      return this.getDefaultState();
    } catch (error) {
      console.error('Error loading dashboard state:', error);
      return this.getDefaultState();
    }
  }

  /**
   * Save the dashboard state for this workspace
   */
  async saveDashboardState(state: DashboardState): Promise<void> {
    try {
      if (!this.isValidDashboardState(state)) {
        console.warn('Invalid dashboard state, not saving:', state);
        return;
      }
      
      await this.workspaceState.update('dashboardState', state);
    } catch (error) {
      console.error('Error saving dashboard state:', error);
      vscode.window.showErrorMessage(
        'Failed to save dashboard state: ' + (error instanceof Error ? error.message : String(error))
      );
    }
  }

  /**
   * Get dashboard state for a specific workspace folder
   * This allows maintaining separate state per workspace folder in multi-root workspaces
   * 
   * @param workspaceFolderName The name of the workspace folder
   * @returns The dashboard state for that workspace folder, or default state if not found
   * 
   * Requirements: 12.4, 12.5
   */
  async getWorkspaceFolderState(workspaceFolderName: string): Promise<DashboardState> {
    try {
      const key = `dashboardState_${workspaceFolderName}`;
      const state = this.workspaceState.get<DashboardState>(key);
      
      if (state && this.isValidDashboardState(state)) {
        return state;
      }
      
      return this.getDefaultState();
    } catch (error) {
      console.error(`Error loading state for workspace folder ${workspaceFolderName}:`, error);
      return this.getDefaultState();
    }
  }

  /**
   * Save dashboard state for a specific workspace folder
   * This allows maintaining separate state per workspace folder in multi-root workspaces
   * 
   * @param workspaceFolderName The name of the workspace folder
   * @param state The dashboard state to save
   * 
   * Requirements: 12.4, 12.5
   */
  async saveWorkspaceFolderState(workspaceFolderName: string, state: DashboardState): Promise<void> {
    try {
      if (!this.isValidDashboardState(state)) {
        console.warn(`Invalid dashboard state for workspace folder ${workspaceFolderName}, not saving:`, state);
        return;
      }
      
      const key = `dashboardState_${workspaceFolderName}`;
      await this.workspaceState.update(key, state);
    } catch (error) {
      console.error(`Error saving state for workspace folder ${workspaceFolderName}:`, error);
    }
  }

  /**
   * Clear state for a specific workspace folder
   * Called when a workspace folder is removed from the workspace
   * 
   * @param workspaceFolderName The name of the workspace folder to clear state for
   * 
   * Requirements: 12.2, 12.3
   */
  async clearWorkspaceFolderState(workspaceFolderName: string): Promise<void> {
    try {
      const key = `dashboardState_${workspaceFolderName}`;
      await this.workspaceState.update(key, undefined);
      console.log(`Cleared state for workspace folder: ${workspaceFolderName}`);
    } catch (error) {
      console.error(`Error clearing state for workspace folder ${workspaceFolderName}:`, error);
    }
  }

  /**
   * Get global preferences (cross-workspace)
   */
  async getGlobalPreferences(): Promise<any> {
    try {
      return this.globalState.get('preferences', {});
    } catch (error) {
      console.error('Error loading global preferences:', error);
      return {};
    }
  }

  /**
   * Save global preferences (cross-workspace)
   */
  async saveGlobalPreferences(preferences: any): Promise<void> {
    try {
      await this.globalState.update('preferences', preferences);
    } catch (error) {
      console.error('Error saving global preferences:', error);
    }
  }

  /**
   * Get the default dashboard state
   */
  private getDefaultState(): DashboardState {
    return {
      filterMode: 'all',
      searchQuery: '',
      currentPage: 1,
      itemsPerPage: 10,
      sortBy: 'name',
      sortOrder: 'asc'
    };
  }

  /**
   * Validate dashboard state structure
   */
  private isValidDashboardState(state: any): state is DashboardState {
    return (
      state &&
      typeof state === 'object' &&
      ['all', 'in-progress', 'completed', 'pending'].includes(state.filterMode) &&
      typeof state.searchQuery === 'string' &&
      typeof state.currentPage === 'number' &&
      typeof state.itemsPerPage === 'number' &&
      ['name', 'progress'].includes(state.sortBy) &&
      ['asc', 'desc'].includes(state.sortOrder)
    );
  }
}
