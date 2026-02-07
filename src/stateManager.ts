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
   * Get velocity data for analytics
   * 
   * Handles missing or corrupted data gracefully by:
   * - Returning null if data doesn't exist
   * - Validating data structure
   * - Returning null if data is corrupted
   * - Logging errors for debugging
   * 
   * Requirements: 19.6, 23.3, 23.5
   */
  async getVelocityData(): Promise<any> {
    try {
      const data = this.workspaceState.get('velocityData', null);
      
      if (!data) {
        return null;
      }
      
      // Validate velocity data structure
      if (!this.isValidVelocityData(data)) {
        console.warn('Corrupted velocity data detected, returning null:', data);
        vscode.window.showWarningMessage(
          'Velocity data was corrupted and has been reset. Analytics will start fresh.'
        );
        // Clear corrupted data
        await this.workspaceState.update('velocityData', undefined);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error loading velocity data:', error);
      vscode.window.showErrorMessage(
        'Failed to load velocity data: ' + (error instanceof Error ? error.message : String(error))
      );
      return null;
    }
  }

  /**
   * Save velocity data for analytics
   * 
   * Requirements: 19.6
   */
  async saveVelocityData(velocityData: any): Promise<void> {
    try {
      await this.workspaceState.update('velocityData', velocityData);
    } catch (error) {
      console.error('Error saving velocity data:', error);
      vscode.window.showErrorMessage(
        'Failed to save velocity data: ' + (error instanceof Error ? error.message : String(error))
      );
    }
  }

  /**
   * Get the last active analytics tab
   * 
   * Returns the name of the last active tab in the analytics panel,
   * or 'velocity' as the default if no saved state exists.
   * 
   * Requirements: 23.1, 23.2
   */
  async getActiveAnalyticsTab(): Promise<string> {
    try {
      return this.workspaceState.get('activeAnalyticsTab', 'velocity');
    } catch (error) {
      console.error('Error loading active analytics tab:', error);
      return 'velocity';
    }
  }

  /**
   * Save the active analytics tab
   * 
   * Persists the currently active tab name to workspace state
   * so it can be restored when the analytics panel is reopened.
   * 
   * Requirements: 23.1, 23.2
   */
  async saveActiveAnalyticsTab(tabName: string): Promise<void> {
    try {
      await this.workspaceState.update('activeAnalyticsTab', tabName);
    } catch (error) {
      console.error('Error saving active analytics tab:', error);
    }
  }

  /**
   * Get velocity data for a specific workspace folder
   * 
   * This allows maintaining separate velocity data per workspace folder
   * in multi-root workspaces.
   * 
   * @param workspaceFolderName The name of the workspace folder
   * @returns The velocity data for that workspace folder, or null if not found
   * 
   * Requirements: 23.4
   */
  async getWorkspaceFolderVelocityData(workspaceFolderName: string): Promise<any> {
    try {
      const key = `velocityData_${workspaceFolderName}`;
      const data = this.workspaceState.get(key, null);
      
      if (!data) {
        return null;
      }
      
      // Validate velocity data structure
      if (!this.isValidVelocityData(data)) {
        console.warn(`Corrupted velocity data for workspace folder ${workspaceFolderName}, returning null`);
        // Clear corrupted data
        await this.workspaceState.update(key, undefined);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error(`Error loading velocity data for workspace folder ${workspaceFolderName}:`, error);
      return null;
    }
  }

  /**
   * Save velocity data for a specific workspace folder
   * 
   * This allows maintaining separate velocity data per workspace folder
   * in multi-root workspaces.
   * 
   * @param workspaceFolderName The name of the workspace folder
   * @param velocityData The velocity data to save
   * 
   * Requirements: 23.4
   */
  async saveWorkspaceFolderVelocityData(workspaceFolderName: string, velocityData: any): Promise<void> {
    try {
      const key = `velocityData_${workspaceFolderName}`;
      await this.workspaceState.update(key, velocityData);
    } catch (error) {
      console.error(`Error saving velocity data for workspace folder ${workspaceFolderName}:`, error);
    }
  }

  /**
   * Clear velocity data for a specific workspace folder
   * 
   * Called when a workspace folder is removed from the workspace.
   * 
   * @param workspaceFolderName The name of the workspace folder to clear data for
   * 
   * Requirements: 23.4
   */
  async clearWorkspaceFolderVelocityData(workspaceFolderName: string): Promise<void> {
    try {
      const key = `velocityData_${workspaceFolderName}`;
      await this.workspaceState.update(key, undefined);
      console.log(`Cleared velocity data for workspace folder: ${workspaceFolderName}`);
    } catch (error) {
      console.error(`Error clearing velocity data for workspace folder ${workspaceFolderName}:`, error);
    }
  }

  /**
   * Clear all velocity data
   * 
   * Removes all velocity tracking data from workspace state.
   * This is useful for resetting analytics or removing mock data.
   */
  async clearVelocityData(): Promise<void> {
    try {
      await this.workspaceState.update('velocityData', undefined);
      console.log('Cleared all velocity data');
    } catch (error) {
      console.error('Error clearing velocity data:', error);
      throw error;
    }
  }

  /**
   * Get execution states for automated spec execution
   * 
   * Requirements: 5.5
   */
  async getExecutionStates(): Promise<Record<string, any>> {
    try {
      return this.workspaceState.get('executionStates', {});
    } catch (error) {
      console.error('Error loading execution states:', error);
      return {};
    }
  }

  /**
   * Save execution states for automated spec execution
   * 
   * Requirements: 5.5
   */
  async saveExecutionStates(states: Record<string, any>): Promise<void> {
    try {
      await this.workspaceState.update('executionStates', states);
    } catch (error) {
      console.error('Error saving execution states:', error);
      throw error;
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

  /**
   * Validate velocity data structure
   * 
   * Checks that velocity data has the expected structure:
   * - weeklyTasks array
   * - weeklySpecs array
   * - specActivity object
   * - dayOfWeekTasks object
   * 
   * Requirements: 23.5
   */
  private isValidVelocityData(data: any): boolean {
    try {
      return (
        data &&
        typeof data === 'object' &&
        Array.isArray(data.weeklyTasks) &&
        Array.isArray(data.weeklySpecs) &&
        typeof data.specActivity === 'object' &&
        data.specActivity !== null &&
        typeof data.dayOfWeekTasks === 'object' &&
        data.dayOfWeekTasks !== null &&
        // Validate dayOfWeekTasks has all required days
        ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].every(
          day => typeof data.dayOfWeekTasks[day] === 'number'
        )
      );
    } catch (error) {
      console.error('Error validating velocity data:', error);
      return false;
    }
  }
}
