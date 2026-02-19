import * as vscode from 'vscode';
import { SpecScanner } from './specScanner';
import { StateManager } from './stateManager';
import { VelocityCalculator } from './velocityCalculator';
import { AnalyticsPanelManager } from './analyticsPanelManager';
import { ProfileManager } from './profileManager';
import { ExecutionManager } from './executionManager';
import { ExecutionHistory } from './executionHistory';
import { SpecFile } from './types';

/**
 * Webview provider for the Specs Dashboard
 * Manages the webview lifecycle, content, and message passing
 */
export class SpecsDashboardProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private scanner: SpecScanner;
  private stateManager: StateManager;
  private velocityCalculator: VelocityCalculator;
  private analyticsPanelManager: AnalyticsPanelManager;
  private profileManager?: ProfileManager;
  private executionManager?: ExecutionManager;
  private executionHistory?: ExecutionHistory;
  private profilesPanelManager?: any; // ProfilesPanelManager
  private historyPanelManager?: any; // HistoryPanelManager
  private specs: SpecFile[] = [];
  private outputChannel: vscode.OutputChannel;
  private isWebviewVisible: boolean = false;
  private pendingRefresh: boolean = false;
  private notesPanels: Map<string, vscode.WebviewPanel> = new Map();

  constructor(private context: vscode.ExtensionContext) {
    this.scanner = new SpecScanner();
    this.stateManager = new StateManager(context);
    this.velocityCalculator = new VelocityCalculator(this.stateManager);
    this.outputChannel = vscode.window.createOutputChannel('Specs Dashboard');
    this.analyticsPanelManager = new AnalyticsPanelManager(
      context,
      this.velocityCalculator,
      this.stateManager,
      this.outputChannel
    );
    
    // Initialize velocity calculator
    this.velocityCalculator.initialize().catch(error => {
      this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: Failed to initialize velocity calculator: ${error}`);
    });
  }

  /**
   * Set execution managers after construction
   * This allows the extension to create the provider first, then inject the managers
   * 
   * Requirements: 1.1
   */
  setExecutionManagers(
    profileManager: ProfileManager,
    executionManager: ExecutionManager,
    executionHistory: ExecutionHistory
  ): void {
    this.profileManager = profileManager;
    this.executionManager = executionManager;
    this.executionHistory = executionHistory;
  }

  /**
   * Set profiles panel manager after construction
   * This allows the extension to inject the panel manager for opening profiles
   * 
   * Requirements: 7.3
   */
  setProfilesPanelManager(profilesPanelManager: any): void {
    this.profilesPanelManager = profilesPanelManager;
  }

  /**
   * Set history panel manager after construction
   * This allows the extension to inject the panel manager for opening history
   * 
   * Requirements: 7.3
   */
  setHistoryPanelManager(historyPanelManager: any): void {
    this.historyPanelManager = historyPanelManager;
  }

  /**
   * Called when the webview view is resolved
   */
  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): Promise<void> {
    this.view = webviewView;
    this.isWebviewVisible = webviewView.visible;

    // Configure webview options
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    // Set the HTML content
    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    // Set up message handling
    webviewView.webview.onDidReceiveMessage(
      message => this.handleMessage(message),
      undefined,
      this.context.subscriptions
    );

    // Track visibility changes for performance optimization
    // Requirements: 13.5 (pause non-critical operations when hidden)
    webviewView.onDidChangeVisibility(() => {
      const wasVisible = this.isWebviewVisible;
      this.isWebviewVisible = webviewView.visible;
      
      this.outputChannel.appendLine(
        `[${new Date().toISOString()}] Webview visibility changed: ${wasVisible} -> ${this.isWebviewVisible}`
      );
      
      // If webview became visible and there's a pending refresh, execute it now
      if (this.isWebviewVisible && !wasVisible && this.pendingRefresh) {
        this.outputChannel.appendLine(
          `[${new Date().toISOString()}] Webview became visible, executing pending refresh`
        );
        this.pendingRefresh = false;
        this.loadSpecs();
      }
    }, undefined, this.context.subscriptions);

    // Load initial data
    await this.loadSpecs();
  }

  /**
   * Refresh the dashboard by reloading specs
   * 
   * This method is called when:
   * - File system watcher detects changes to .kiro/specs markdown files
   * - User manually invokes the refresh command
   * - Webview requests updated data
   * 
   * It re-scans the workspace, updates internal state, and sends updated data to the webview.
   * 
   * Performance optimization: If the webview is hidden, the refresh is deferred until
   * the webview becomes visible again. This prevents unnecessary work when the user
   * is not actively viewing the dashboard.
   * 
   * Requirements: 3.2, 3.3, 3.4, 13.5
   */
  async refresh(uri?: vscode.Uri): Promise<void> {
    console.log('Refreshing specs dashboard...', uri?.fsPath || 'all specs');
    
    // Performance optimization: Defer refresh if webview is hidden (Requirement 13.5)
    if (!this.isWebviewVisible) {
      this.outputChannel.appendLine(
        `[${new Date().toISOString()}] Webview is hidden, deferring refresh until visible`
      );
      this.pendingRefresh = true;
      return;
    }
    
    await this.loadSpecs();
  }

  /**
   * Handle external changes to execution profiles file
   * 
   * Called when the file watcher detects changes to execution-profiles.json.
   * Reloads profiles and notifies the webview.
   * 
   * Requirements: 11.4
   */
  async onProfilesFileChanged(uri: vscode.Uri): Promise<void> {
    this.outputChannel.appendLine(
      `[${new Date().toISOString()}] Profiles file changed, reloading profiles`
    );
    
    // Check if profile manager is initialized
    if (!this.profileManager) {
      this.outputChannel.appendLine(
        `[${new Date().toISOString()}] WARNING: ProfileManager not initialized, skipping profiles reload`
      );
      return;
    }
    
    // Send profiles update to webview if visible
    if (this.view && this.isWebviewVisible) {
      // Get workspace folder from URI
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      if (workspaceFolder) {
        try {
          const profiles = await this.profileManager.loadProfiles(workspaceFolder);
          this.view.webview.postMessage({
            type: 'profilesUpdated',
            profiles: profiles
          });
          this.outputChannel.appendLine(
            `[${new Date().toISOString()}] Sent updated profiles to webview (${profiles.length} profiles)`
          );
        } catch (error) {
          this.outputChannel.appendLine(
            `[${new Date().toISOString()}] ERROR: Failed to reload profiles: ${error}`
          );
        }
      }
    }
  }

  /**
   * Clean up state for a removed workspace folder
   * Called when a workspace folder is removed from the workspace
   * 
   * This method:
   * - Clears the dashboard state for the removed workspace folder
   * - Clears the velocity data for the removed workspace folder
   * - Removes specs from the internal state that belong to the removed folder
   * 
   * Requirements: 12.2, 12.3, 23.4
   */
  async cleanupWorkspaceFolder(workspaceFolderName: string): Promise<void> {
    try {
      // Clear the state for this workspace folder
      await this.stateManager.clearWorkspaceFolderState(workspaceFolderName);
      
      // Clear the velocity data for this workspace folder (Requirement: 23.4)
      await this.stateManager.clearWorkspaceFolderVelocityData(workspaceFolderName);
      
      // Remove specs from internal state that belong to this workspace folder
      const previousCount = this.specs.length;
      this.specs = this.specs.filter(spec => spec.workspaceFolder !== workspaceFolderName);
      const removedCount = previousCount - this.specs.length;
      
      console.log(`Cleaned up ${removedCount} spec(s) from workspace folder: ${workspaceFolderName}`);
    } catch (error) {
      console.error(`Error cleaning up workspace folder ${workspaceFolderName}:`, error);
    }
  }

  /**
   * Load specs from the workspace
   * 
   * This method:
   * - Scans all workspace folders for .kiro/specs directories
   * - Parses all spec files and extracts metadata
   * - Detects task changes and records velocity data
   * - Updates internal state with the new spec data
   * - Sends updated data to the webview via message passing (only if visible)
   * - Loads and sends the saved dashboard state to restore view preferences
   * - Handles errors gracefully and reports them to the webview
   * 
   * Requirements: 3.2, 3.3, 3.4, 4.3, 4.4, 11.1, 13.5, 19.2
   */
  private async loadSpecs(): Promise<void> {
    try {
      // Store previous specs for comparison
      const previousSpecs = new Map(this.specs.map(spec => [spec.name, spec]));
      
      const previousCount = this.specs.length;
      this.specs = await this.scanner.scanWorkspace();
      const currentCount = this.specs.length;

      this.outputChannel.appendLine(`[${new Date().toISOString()}] Loaded ${currentCount} spec(s) (previously ${previousCount})`);

      // Detect task changes and record velocity data
      await this.detectAndRecordTaskChanges(previousSpecs, this.specs);

      // Only send updates to webview if it's visible (Requirement 13.5)
      if (this.view && this.isWebviewVisible) {
        // Load saved dashboard state
        const dashboardState = await this.stateManager.getDashboardState();
        
        this.view.webview.postMessage({
          type: 'specsLoaded',
          specs: this.specs,
          state: dashboardState
        });
        this.outputChannel.appendLine(`[${new Date().toISOString()}] Sent updated specs and state to webview`);
      } else if (this.view && !this.isWebviewVisible) {
        this.outputChannel.appendLine(`[${new Date().toISOString()}] Webview is hidden, skipping message send (will update when visible)`);
      } else {
        this.outputChannel.appendLine(`[${new Date().toISOString()}] Webview not available, specs loaded but not sent`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: Failed to load specs: ${errorMessage}`);
      if (error instanceof Error && error.stack) {
        this.outputChannel.appendLine(`Stack trace: ${error.stack}`);
      }
      
      // Show user-friendly error notification with actionable message (Requirement 11.1)
      vscode.window.showErrorMessage(
        `Failed to load specs: ${errorMessage}. Check the Output panel for details.`,
        'Show Output'
      ).then(selection => {
        if (selection === 'Show Output') {
          this.outputChannel.show();
        }
      });
      
      if (this.view) {
        this.view.webview.postMessage({
          type: 'error',
          message: 'Failed to load specs: ' + errorMessage
        });
      }
    }
  }

  /**
   * Handle messages from the webview
   * 
   * Processes messages sent from the webview and performs appropriate actions:
   * - requestSpecs: Reload all specs and send to webview
   * - toggleTask: Toggle a task checkbox in a spec file
   * - openFile: Open a file in the editor
   * - saveState: Persist dashboard state
   * - webviewError: Log errors from webview
   * 
   * All user-provided input is validated and sanitized to prevent security issues.
   * 
   * Requirements: 6.2, 6.3, 6.4, 10.4, 10.5, 11.3
   */
  private async handleMessage(message: any): Promise<void> {
    // Validate message structure (Requirement 10.4: Message Origin Validation)
    if (!message || typeof message !== 'object' || !message.type || typeof message.type !== 'string') {
      this.outputChannel.appendLine(`[${new Date().toISOString()}] WARNING: Invalid message structure, ignoring`);
      return;
    }

    this.outputChannel.appendLine(`[${new Date().toISOString()}] Received message from webview: ${message.type}`);
    
    try {
      switch (message.type) {
        case 'requestSpecs':
          await this.loadSpecs();
          break;

        case 'toggleTask':
          // Validate and sanitize input (Requirement 10.5)
          if (typeof message.specName !== 'string' || typeof message.taskLine !== 'number') {
            this.outputChannel.appendLine(`[${new Date().toISOString()}] WARNING: Invalid toggleTask message parameters`);
            return;
          }
          // Sanitize spec name to prevent path traversal
          const sanitizedSpecName = this.sanitizeFileName(message.specName);
          await this.toggleTask(sanitizedSpecName, message.taskLine);
          break;

        case 'openFile':
          // Validate and sanitize input (Requirement 10.5)
          if (typeof message.filePath !== 'string') {
            this.outputChannel.appendLine(`[${new Date().toISOString()}] WARNING: Invalid openFile message parameters`);
            return;
          }
          // Sanitize file path to prevent path traversal
          const sanitizedFilePath = this.sanitizeFilePath(message.filePath);
          await this.openFile(sanitizedFilePath);
          break;

        case 'saveState':
          // Validate state object (Requirement 10.5)
          if (!message.state || typeof message.state !== 'object') {
            this.outputChannel.appendLine(`[${new Date().toISOString()}] WARNING: Invalid saveState message parameters`);
            return;
          }
          await this.stateManager.saveDashboardState(message.state);
          break;
        
        case 'openAnalytics':
          // Open the analytics panel
          this.outputChannel.appendLine(`[${new Date().toISOString()}] Opening analytics panel`);
          this.analyticsPanelManager.openAnalytics(this.specs);
          break;
        
        case 'openProfiles':
          // Open the profiles panel
          this.outputChannel.appendLine(`[${new Date().toISOString()}] Opening profiles panel`);
          if (this.profilesPanelManager) {
            this.profilesPanelManager.openProfiles();
          } else {
            this.outputChannel.appendLine(`[${new Date().toISOString()}] WARNING: ProfilesPanelManager not initialized`);
            vscode.window.showWarningMessage('Profiles panel manager is not available');
          }
          break;
        
        case 'openHistory':
          // Open the history panel
          this.outputChannel.appendLine(`[${new Date().toISOString()}] Opening history panel`);
          if (this.historyPanelManager) {
            this.historyPanelManager.openHistory();
          } else {
            this.outputChannel.appendLine(`[${new Date().toISOString()}] WARNING: HistoryPanelManager not initialized`);
            vscode.window.showWarningMessage('History panel manager is not available');
          }
          break;
        
        case 'addNote':
          // Validate input
          if (typeof message.specName !== 'string' || typeof message.text !== 'string') {
            this.outputChannel.appendLine(`[${new Date().toISOString()}] WARNING: Invalid addNote message parameters`);
            return;
          }
          await this.addNote(this.sanitizeFileName(message.specName), message.text);
          break;
        
        case 'updateNote':
          // Validate input
          if (typeof message.specName !== 'string' || typeof message.noteId !== 'string' || typeof message.text !== 'string') {
            this.outputChannel.appendLine(`[${new Date().toISOString()}] WARNING: Invalid updateNote message parameters`);
            return;
          }
          await this.updateNote(this.sanitizeFileName(message.specName), message.noteId, message.text);
          break;
        
        case 'deleteNote':
          // Validate input
          if (typeof message.specName !== 'string' || typeof message.noteId !== 'string') {
            this.outputChannel.appendLine(`[${new Date().toISOString()}] WARNING: Invalid deleteNote message parameters`);
            return;
          }
          await this.deleteNote(this.sanitizeFileName(message.specName), message.noteId);
          break;
        
        case 'openNotes':
          // Validate input
          if (typeof message.specName !== 'string') {
            this.outputChannel.appendLine(`[${new Date().toISOString()}] WARNING: Invalid openNotes message parameters`);
            return;
          }
          await this.openNotesPanel(this.sanitizeFileName(message.specName));
          break;
        
        // Execution profile management messages
        // Requirements: 1.3, 1.4, 1.5, 3.5
        
        case 'createProfile':
          // Validate input
          if (!message.profile || typeof message.profile !== 'object') {
            this.outputChannel.appendLine(`[${new Date().toISOString()}] WARNING: Invalid createProfile message parameters`);
            return;
          }
          await this.handleCreateProfile(message.profile);
          break;
        
        case 'updateProfile':
          // Validate input
          if (typeof message.profileId !== 'string' || !message.updates || typeof message.updates !== 'object') {
            this.outputChannel.appendLine(`[${new Date().toISOString()}] WARNING: Invalid updateProfile message parameters`);
            return;
          }
          await this.handleUpdateProfile(message.profileId, message.updates);
          break;
        
        case 'deleteProfile':
          // Validate input
          if (typeof message.profileId !== 'string') {
            this.outputChannel.appendLine(`[${new Date().toISOString()}] WARNING: Invalid deleteProfile message parameters`);
            return;
          }
          await this.handleDeleteProfile(message.profileId);
          break;
        
        case 'resetBuiltInProfile':
          // Validate input
          if (typeof message.profileId !== 'string') {
            this.outputChannel.appendLine(`[${new Date().toISOString()}] WARNING: Invalid resetBuiltInProfile message parameters`);
            return;
          }
          await this.handleResetBuiltInProfile(message.profileId);
          break;
        
        case 'getProfiles':
          await this.handleGetProfiles();
          break;
        
        // Execution management messages
        // Requirements: 4.1, 4.2
        
        case 'executeSpec':
          // Validate input
          if (typeof message.specId !== 'string' || typeof message.profileId !== 'string') {
            this.outputChannel.appendLine(`[${new Date().toISOString()}] WARNING: Invalid executeSpec message parameters`);
            return;
          }
          await this.handleExecuteSpec(message.specId, message.profileId);
          break;
        
        case 'cancelExecution':
          // Validate input
          if (typeof message.executionId !== 'string') {
            this.outputChannel.appendLine(`[${new Date().toISOString()}] WARNING: Invalid cancelExecution message parameters`);
            return;
          }
          await this.handleCancelExecution(message.executionId);
          break;
        
        // Execution history messages
        // Requirements: 6.4, 6.6
        
        case 'getExecutionHistory':
          await this.handleGetExecutionHistory(message.filter);
          break;
        
        case 'getExecutionStatistics':
          await this.handleGetExecutionStatistics();
          break;
        
        case 'webviewError':
          // Log webview errors to output channel (Requirement 11.3)
          this.outputChannel.appendLine(`[${new Date().toISOString()}] WEBVIEW ERROR: ${message.error?.message || 'Unknown error'}`);
          if (message.error?.stack) {
            this.outputChannel.appendLine(`Stack trace: ${message.error.stack}`);
          }
          if (message.error?.filename) {
            this.outputChannel.appendLine(`File: ${message.error.filename}:${message.error.lineno}:${message.error.colno}`);
          }
          break;
        
        default:
          this.outputChannel.appendLine(`[${new Date().toISOString()}] WARNING: Unknown message type: ${message.type}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: Failed to handle message: ${errorMessage}`);
      if (error instanceof Error && error.stack) {
        this.outputChannel.appendLine(`Stack trace: ${error.stack}`);
      }
      // Don't throw - gracefully handle errors to prevent crashes
    }
  }

  /**
   * Sanitize a file name to prevent path traversal attacks
   * Removes any path separators and parent directory references
   * 
   * @param fileName The file name to sanitize
   * @returns Sanitized file name
   * 
   * Requirements: 10.5
   */
  private sanitizeFileName(fileName: string): string {
    if (!fileName || typeof fileName !== 'string') {
      return '';
    }
    
    // Remove any path separators and parent directory references
    return fileName
      .replace(/\.\./g, '')  // Remove ..
      .replace(/[\/\\]/g, '') // Remove / and \
      .replace(/^\.+/, '')    // Remove leading dots
      .trim();
  }

  /**
   * Handle createProfile message
   * 
   * Requirements: 1.3
   */
  private async handleCreateProfile(profile: any): Promise<void> {
    if (!this.profileManager) {
      this.sendError('Profile manager not initialized');
      return;
    }

    try {
      // Get first workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        this.sendError('No workspace folder open');
        return;
      }

      await this.profileManager.createProfile(profile, workspaceFolder);
      
      // Reload and send updated profiles
      const profiles = await this.profileManager.loadProfiles(workspaceFolder);
      this.sendProfilesUpdated(profiles);
      
      vscode.window.showInformationMessage(`Profile "${profile.name}" created successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: Failed to create profile: ${errorMessage}`);
      this.sendError(`Failed to create profile: ${errorMessage}`);
      vscode.window.showErrorMessage(`Failed to create profile: ${errorMessage}`);
    }
  }

  /**
   * Handle updateProfile message
   * 
   * Requirements: 1.4
   */
  private async handleUpdateProfile(profileId: string, updates: any): Promise<void> {
    if (!this.profileManager) {
      this.sendError('Profile manager not initialized');
      return;
    }

    try {
      // Get first workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        this.sendError('No workspace folder open');
        return;
      }

      await this.profileManager.updateProfile(profileId, updates, workspaceFolder);
      
      // Reload and send updated profiles
      const profiles = await this.profileManager.loadProfiles(workspaceFolder);
      this.sendProfilesUpdated(profiles);
      
      vscode.window.showInformationMessage(`Profile "${profileId}" updated successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: Failed to update profile: ${errorMessage}`);
      this.sendError(`Failed to update profile: ${errorMessage}`);
      vscode.window.showErrorMessage(`Failed to update profile: ${errorMessage}`);
    }
  }

  /**
   * Handle deleteProfile message
   * 
   * Requirements: 1.5
   */
  private async handleDeleteProfile(profileId: string): Promise<void> {
    if (!this.profileManager) {
      this.sendError('Profile manager not initialized');
      return;
    }

    try {
      // Get first workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        this.sendError('No workspace folder open');
        return;
      }

      await this.profileManager.deleteProfile(profileId, workspaceFolder);
      
      // Reload and send updated profiles
      const profiles = await this.profileManager.loadProfiles(workspaceFolder);
      this.sendProfilesUpdated(profiles);
      
      vscode.window.showInformationMessage(`Profile "${profileId}" deleted successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: Failed to delete profile: ${errorMessage}`);
      this.sendError(`Failed to delete profile: ${errorMessage}`);
      vscode.window.showErrorMessage(`Failed to delete profile: ${errorMessage}`);
    }
  }

  /**
   * Handle resetBuiltInProfile message
   * 
   * Requirements: 3.5
   */
  private async handleResetBuiltInProfile(profileId: string): Promise<void> {
    if (!this.profileManager) {
      this.sendError('Profile manager not initialized');
      return;
    }

    try {
      // Get first workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        this.sendError('No workspace folder open');
        return;
      }

      await this.profileManager.resetBuiltInProfile(profileId, workspaceFolder);
      
      // Reload and send updated profiles
      const profiles = await this.profileManager.loadProfiles(workspaceFolder);
      this.sendProfilesUpdated(profiles);
      
      vscode.window.showInformationMessage(`Profile "${profileId}" reset to default`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: Failed to reset profile: ${errorMessage}`);
      this.sendError(`Failed to reset profile: ${errorMessage}`);
      vscode.window.showErrorMessage(`Failed to reset profile: ${errorMessage}`);
    }
  }

  /**
   * Handle getProfiles message
   * 
   * Requirements: 4.1
   */
  private async handleGetProfiles(): Promise<void> {
    if (!this.profileManager) {
      this.sendError('Profile manager not initialized');
      return;
    }

    try {
      // Get first workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        this.sendError('No workspace folder open');
        return;
      }

      const profiles = await this.profileManager.loadProfiles(workspaceFolder);
      this.sendProfilesUpdated(profiles);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: Failed to load profiles: ${errorMessage}`);
      this.sendError(`Failed to load profiles: ${errorMessage}`);
    }
  }

  /**
   * Handle executeSpec message
   * 
   * Requirements: 4.1, 4.2
   */
  private async handleExecuteSpec(specId: string, profileId: string): Promise<void> {
    if (!this.executionManager || !this.executionHistory) {
      this.sendError('Execution manager not initialized');
      return;
    }

    try {
      // Find the spec
      const spec = this.specs.find(s => s.name === specId);
      if (!spec) {
        this.sendError(`Spec "${specId}" not found`);
        return;
      }

      // Get workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        this.sendError('No workspace folder open');
        return;
      }

      // Execute the spec
      const result = await this.executionManager.executeSpec(spec, profileId, workspaceFolder);
      
      if (result.success && result.executionId) {
        // Get execution state
        const state = this.executionManager.getExecutionState(specId);
        if (state) {
          this.sendExecutionStateChanged(specId, state);
        }

        // Create history entry
        const profile = await this.profileManager?.getProfile(profileId, workspaceFolder);
        if (profile) {
          await this.executionHistory.addEntry({
            executionId: result.executionId,
            specId: spec.name,
            specName: spec.name,
            profileId: profile.id,
            profileName: profile.name,
            workspaceFolder: workspaceFolder.uri.fsPath,
            status: 'running',
            startTime: new Date().toISOString(),
            completedTasks: spec.completedTasks,
            totalTasks: spec.totalTasks
          });
        }

        // Note: ExecutionManager already shows a notification, so we don't need to show another one here
      } else {
        this.sendError(result.error || 'Execution failed');
        vscode.window.showErrorMessage(result.error || 'Execution failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: Failed to execute spec: ${errorMessage}`);
      this.sendError(`Failed to execute spec: ${errorMessage}`);
      vscode.window.showErrorMessage(`Failed to execute spec: ${errorMessage}`);
    }
  }

  /**
   * Handle cancelExecution message
   * 
   * Requirements: 7.2
   */
  private async handleCancelExecution(executionId: string): Promise<void> {
    if (!this.executionManager || !this.executionHistory) {
      this.sendError('Execution manager not initialized');
      return;
    }

    try {
      await this.executionManager.cancelExecution(executionId);
      
      // Update history entry
      await this.executionHistory.updateEntry(executionId, {
        status: 'cancelled',
        endTime: new Date().toISOString()
      });

      vscode.window.showInformationMessage('Execution cancelled');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: Failed to cancel execution: ${errorMessage}`);
      this.sendError(`Failed to cancel execution: ${errorMessage}`);
      vscode.window.showErrorMessage(`Failed to cancel execution: ${errorMessage}`);
    }
  }

  /**
   * Handle getExecutionHistory message
   * 
   * Requirements: 6.4
   */
  private async handleGetExecutionHistory(filter?: any): Promise<void> {
    if (!this.executionHistory) {
      this.sendError('Execution history not initialized');
      return;
    }

    try {
      const entries = filter 
        ? await this.executionHistory.queryEntries(filter)
        : await this.executionHistory.getAllEntries();
      
      this.sendExecutionHistoryUpdated(entries);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: Failed to load execution history: ${errorMessage}`);
      this.sendError(`Failed to load execution history: ${errorMessage}`);
    }
  }

  /**
   * Handle getExecutionStatistics message
   * 
   * Requirements: 6.6
   */
  private async handleGetExecutionStatistics(): Promise<void> {
    if (!this.executionHistory) {
      this.sendError('Execution history not initialized');
      return;
    }

    try {
      const statistics = await this.executionHistory.getStatistics();
      this.sendExecutionStatisticsUpdated(statistics);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: Failed to load execution statistics: ${errorMessage}`);
      this.sendError(`Failed to load execution statistics: ${errorMessage}`);
    }
  }

  /**
   * Send profilesUpdated message to webview
   */
  private sendProfilesUpdated(profiles: any[]): void {
    if (this.view) {
      this.view.webview.postMessage({
        type: 'profilesUpdated',
        profiles: profiles
      });
    }
  }

  /**
   * Send executionStateChanged message to webview
   */
  private sendExecutionStateChanged(specId: string, state: any): void {
    if (this.view) {
      this.view.webview.postMessage({
        type: 'executionStateChanged',
        specId: specId,
        state: state
      });
    }
  }

  /**
   * Send executionHistoryUpdated message to webview
   */
  private sendExecutionHistoryUpdated(entries: any[]): void {
    if (this.view) {
      this.view.webview.postMessage({
        type: 'executionHistoryUpdated',
        entries: entries
      });
    }
  }

  /**
   * Send executionStatisticsUpdated message to webview
   * 
   * Requirements: 6.6
   */
  private sendExecutionStatisticsUpdated(statistics: any): void {
    if (this.view) {
      this.view.webview.postMessage({
        type: 'executionStatisticsUpdated',
        statistics: statistics
      });
    }
  }

  /**
   * Send error message to webview
   */
  private sendError(message: string): void {
    if (this.view) {
      this.view.webview.postMessage({
        type: 'error',
        message: message
      });
    }
  }

  /**
   * Sanitize a file path to prevent path traversal attacks
   * Ensures the path is within the workspace and doesn't contain malicious patterns
   * 
   * @param filePath The file path to sanitize
   * @returns Sanitized file path
   * 
   * Requirements: 10.5
   */
  private sanitizeFilePath(filePath: string): string {
    if (!filePath || typeof filePath !== 'string') {
      return '';
    }
    
    // Normalize the path to resolve any .. or . segments
    const path = require('path');
    const normalizedPath = path.normalize(filePath);
    
    // Check if the path contains parent directory references after normalization
    // This would indicate an attempt to escape the intended directory
    if (normalizedPath.includes('..')) {
      // Path contains parent directory references - reject it
      this.outputChannel.appendLine(`[${new Date().toISOString()}] WARNING: Suspicious file path rejected (contains ..): ${filePath}`);
      return '';
    }
    
    // Absolute paths are allowed as long as they don't contain .. references
    // The path should be within the workspace, which we'll verify when opening
    return normalizedPath;
  }

  /**
   * Toggle a task checkbox in a spec file
   * 
   * This method:
   * - Finds the spec by name
   * - Reads the tasks.md file content
   * - Locates the task at the specified line number
   * - Toggles the checkbox state ([ ] ↔ [x])
   * - Preserves all other markdown formatting
   * - Writes the updated content back to the file
   * - Recalculates progress and updates internal state
   * - Sends immediate update to webview
   * 
   * Requirements: 8.2, 8.3, 8.4, 8.5, 11.1
   */
  private async toggleTask(specName: string, taskLine: number): Promise<void> {
    this.outputChannel.appendLine(`[${new Date().toISOString()}] Toggle task: ${specName}, line ${taskLine}`);
    
    try {
      // Find the spec by name
      const spec = this.specs.find(s => s.name === specName);
      if (!spec) {
        const errorMsg = `Spec not found: ${specName}`;
        this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: ${errorMsg}`);
        vscode.window.showErrorMessage(errorMsg);
        return;
      }

      if (!spec.tasksContent) {
        const errorMsg = `No tasks content found for spec: ${specName}`;
        this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: ${errorMsg}`);
        vscode.window.showErrorMessage(errorMsg);
        return;
      }

      // Split content into lines
      const lines = spec.tasksContent.split('\n');
      
      // Validate line number
      if (taskLine < 0 || taskLine >= lines.length) {
        const errorMsg = `Invalid task line number: ${taskLine} (file has ${lines.length} lines)`;
        this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: ${errorMsg}`);
        vscode.window.showErrorMessage(errorMsg);
        return;
      }

      const line = lines[taskLine];
      
      // Check if the line contains a task checkbox
      if (!line.match(/^(\s*)-\s*\[([ x])\](\*)?/)) {
        const errorMsg = `Line ${taskLine} is not a task checkbox: "${line.trim()}"`;
        this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: ${errorMsg}`);
        vscode.window.showErrorMessage(errorMsg);
        return;
      }

      // Extract task metadata for velocity tracking
      const taskMatch = line.match(/^(\s*)-\s*\[([ x])\](\*)?/);
      const wasCompleted = taskMatch![2] === 'x';
      const isOptional = taskMatch![3] === '*';
      const isRequired = !isOptional;
      
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Task state before toggle: wasCompleted=${wasCompleted}, isOptional=${isOptional}, line="${line.trim()}"`);

      // Toggle checkbox state while preserving all other formatting
      let updatedLine: string;
      let isNowCompleted: boolean;
      if (line.includes('- [x]')) {
        // Change [x] to [ ]
        updatedLine = line.replace(/- \[x\]/, '- [ ]');
        isNowCompleted = false;
      } else if (line.includes('- [ ]')) {
        // Change [ ] to [x]
        updatedLine = line.replace(/- \[ \]/, '- [x]');
        isNowCompleted = true;
      } else {
        const errorMsg = `Could not parse checkbox state on line ${taskLine}`;
        this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: ${errorMsg}`);
        vscode.window.showErrorMessage(errorMsg);
        return;
      }
      
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Task state after toggle: isNowCompleted=${isNowCompleted}, updatedLine="${updatedLine.trim()}"`);
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Will record velocity? ${isNowCompleted && !wasCompleted}`);

      // Update the line in the array
      lines[taskLine] = updatedLine;
      
      // Join lines back together
      const updatedContent = lines.join('\n');

      // Construct the tasks.md file URI
      const tasksUri = vscode.Uri.file(`${spec.path}/tasks.md`);

      // Write the updated content back to the file
      try {
        await vscode.workspace.fs.writeFile(
          tasksUri,
          Buffer.from(updatedContent, 'utf8')
        );
        this.outputChannel.appendLine(`[${new Date().toISOString()}] Successfully toggled task on line ${taskLine} in ${specName}`);
      } catch (writeError) {
        const errorMsg = writeError instanceof Error ? writeError.message : String(writeError);
        this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: Failed to write file ${tasksUri.fsPath}: ${errorMsg}`);
        if (writeError instanceof Error && writeError.stack) {
          this.outputChannel.appendLine(`Stack trace: ${writeError.stack}`);
        }
        
        // Show actionable error message (Requirement 11.1)
        vscode.window.showErrorMessage(
          `Failed to save task changes to ${spec.name}/tasks.md: ${errorMsg}. Check file permissions.`,
          'Show Output'
        ).then(selection => {
          if (selection === 'Show Output') {
            this.outputChannel.show();
          }
        });
        return;
      }
      
      // Recalculate progress and update internal state (Requirements: 8.4, 8.5)
      const taskStats = this.recalculateTaskStats(updatedContent);
      spec.tasksContent = updatedContent;
      spec.totalTasks = taskStats.totalTasks;
      spec.completedTasks = taskStats.completedTasks;
      spec.optionalTasks = taskStats.optionalTasks;
      spec.progress = taskStats.progress;
      
      // Record task completion in velocity tracker (Requirements: 19.2, 19.6)
      // Only record when task is marked as completed (not when uncompleted)
      if (isNowCompleted && !wasCompleted) {
        try {
          const taskId = `line-${taskLine}`;
          
          // Get Git author information
          const { getFileAuthor } = await import('./gitUtils');
          const author = await getFileAuthor(tasksUri.fsPath);
          
          await this.velocityCalculator.recordTaskCompletion(
            specName,
            taskId,
            isRequired,
            new Date(),
            line.trim().substring(0, 50),
            author?.name,
            author?.email
          );
          this.outputChannel.appendLine(
            `[${new Date().toISOString()}] Recorded task completion for velocity tracking: ${specName}, ${isRequired ? 'required' : 'optional'}, author=${author?.name || 'unknown'}`
          );
        } catch (velocityError) {
          // Log error but don't fail the task toggle
          this.outputChannel.appendLine(
            `[${new Date().toISOString()}] WARNING: Failed to record velocity data: ${velocityError}`
          );
        }
      }
      
      // Update spec progress tracking (Requirements: 21.4, 21.5, 21.6)
      try {
        // Get Git author information
        const { getFileAuthor } = await import('./gitUtils');
        const author = await getFileAuthor(tasksUri.fsPath);
        
        await this.velocityCalculator.updateSpecProgress(
          specName,
          spec.totalTasks,
          spec.completedTasks,
          author?.name,
          author?.email
        );
        this.outputChannel.appendLine(
          `[${new Date().toISOString()}] Updated spec progress tracking: ${specName} (${spec.completedTasks}/${spec.totalTasks}), author=${author?.name || 'unknown'}`
        );
      } catch (velocityError) {
        // Log error but don't fail the task toggle
        this.outputChannel.appendLine(
          `[${new Date().toISOString()}] WARNING: Failed to update spec progress: ${velocityError}`
        );
      }
      
      // Notify analytics panel of data refresh (Requirements: 18.3, 22.9)
      try {
        this.analyticsPanelManager.notifyDataRefreshed(this.specs);
        this.outputChannel.appendLine(
          `[${new Date().toISOString()}] Notified analytics panel of data refresh`
        );
      } catch (analyticsError) {
        // Log error but don't fail the task toggle
        this.outputChannel.appendLine(
          `[${new Date().toISOString()}] WARNING: Failed to notify analytics panel: ${analyticsError}`
        );
      }
      
      // Send immediate update to webview
      if (this.view) {
        this.view.webview.postMessage({
          type: 'specUpdated',
          spec: spec
        });
        this.outputChannel.appendLine(`[${new Date().toISOString()}] Sent updated spec to webview: ${specName} (${spec.progress}% complete)`);
      }
      
      // Note: File watcher will also trigger a full refresh, but this provides immediate feedback
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: Failed to toggle task: ${errorMessage}`);
      if (error instanceof Error && error.stack) {
        this.outputChannel.appendLine(`Stack trace: ${error.stack}`);
      }
      
      // Show actionable error message (Requirement 11.1)
      vscode.window.showErrorMessage(
        `Failed to toggle task: ${errorMessage}. Check the Output panel for details.`,
        'Show Output'
      ).then(selection => {
        if (selection === 'Show Output') {
          this.outputChannel.show();
        }
      });
    }
  }

  /**
   * Detect task changes between previous and current specs and record velocity data
   * 
   * This method compares the previous state of tasks with the current state
   * and records any tasks that changed from uncompleted to completed.
   * 
   * @param previousSpecs Map of previous spec states (name -> SpecFile)
   * @param currentSpecs Array of current spec states
   * 
   * Requirements: 19.2, 19.6
   */
  private async detectAndRecordTaskChanges(
    previousSpecs: Map<string, SpecFile>,
    currentSpecs: SpecFile[]
  ): Promise<void> {
    for (const currentSpec of currentSpecs) {
      const previousSpec = previousSpecs.get(currentSpec.name);
      
      // Skip if this is a new spec (no previous state to compare)
      if (!previousSpec || !previousSpec.tasksContent || !currentSpec.tasksContent) {
        continue;
      }
      
      // Parse tasks from both versions
      const previousTasks = this.parseTasksFromContent(previousSpec.tasksContent);
      const currentTasks = this.parseTasksFromContent(currentSpec.tasksContent);
      
      // Find tasks that changed from uncompleted to completed
      for (let i = 0; i < Math.min(previousTasks.length, currentTasks.length); i++) {
        const prevTask = previousTasks[i];
        const currTask = currentTasks[i];
        
        // Check if task went from uncompleted to completed
        if (!prevTask.completed && currTask.completed) {
          this.outputChannel.appendLine(
            `[${new Date().toISOString()}] Detected task completion: ${currentSpec.name}, line ${i}, ${currTask.isOptional ? 'optional' : 'required'}`
          );
          
          try {
            await this.velocityCalculator.recordTaskCompletion(
              currentSpec.name,
              `line-${i}`,
              !currTask.isOptional,
              new Date(),
              currTask.description
            );
            
            this.outputChannel.appendLine(
              `[${new Date().toISOString()}] Recorded velocity data for task completion`
            );
          } catch (error) {
            this.outputChannel.appendLine(
              `[${new Date().toISOString()}] WARNING: Failed to record velocity data: ${error}`
            );
          }
        }
      }
      
      // Update spec progress tracking
      try {
        await this.velocityCalculator.updateSpecProgress(
          currentSpec.name,
          currentSpec.totalTasks,
          currentSpec.completedTasks
        );
      } catch (error) {
        this.outputChannel.appendLine(
          `[${new Date().toISOString()}] WARNING: Failed to update spec progress: ${error}`
        );
      }
    }
    
    // Notify analytics panel if it's open
    try {
      this.analyticsPanelManager.notifyDataRefreshed(this.specs);
    } catch (error) {
      this.outputChannel.appendLine(
        `[${new Date().toISOString()}] WARNING: Failed to notify analytics panel: ${error}`
      );
    }
  }

  /**
   * Parse tasks from markdown content
   * 
   * Returns an array of task objects with completion state, optional flag, and description
   * 
   * @param content Markdown content containing tasks
   * @returns Array of parsed tasks
   */
  private parseTasksFromContent(content: string): Array<{ completed: boolean; isOptional: boolean; description: string }> {
    const tasks: Array<{ completed: boolean; isOptional: boolean; description: string }> = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const taskMatch = line.match(/^(\s*)-\s*\[([ x~-])\](\*)?\s*(.*)$/);
      if (taskMatch) {
        const completed = taskMatch[2] === 'x';
        const isOptional = taskMatch[3] === '*';
        const description = taskMatch[4] || '';
        tasks.push({ completed, isOptional, description });
      }
    }
    
    return tasks;
  }

  /**
   * Recalculate task statistics from tasks.md content
   * 
   * This method parses the task content and extracts:
   * - Total task count
   * - Completed task count
   * - Optional task count
   * - Progress percentage
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
   * 
   * Requirements: 8.4, 8.5
   */
  private recalculateTaskStats(content: string): {
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
   * Open a file in the editor
   * 
   * Requirements: 11.1
   */
  private async openFile(filePath: string): Promise<void> {
    this.outputChannel.appendLine(`[${new Date().toISOString()}] Opening file: ${filePath}`);
    
    try {
      const uri = vscode.Uri.file(filePath);
      
      // Check if file exists before trying to open
      try {
        await vscode.workspace.fs.stat(uri);
      } catch (statError) {
        const errorMsg = `File not found: ${filePath}`;
        const errorMessage = statError instanceof Error ? statError.message : String(statError);
        this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: ${errorMsg} - ${errorMessage}`);
        
        // Log stack trace if available
        if (statError instanceof Error && statError.stack) {
          this.outputChannel.appendLine(`Stack trace: ${statError.stack}`);
        }
        
        // Show error notification with "Show Output" button (Requirement 11.1)
        const selection = await vscode.window.showErrorMessage(
          `Failed to open file: ${errorMsg}`,
          'Show Output'
        );
        
        if (selection === 'Show Output') {
          this.outputChannel.show();
        }
        return;
      }
      
      // Open tasks.md in editor mode for editing, other markdown files in preview mode for reading
      if (filePath.endsWith('tasks.md')) {
        await vscode.window.showTextDocument(uri);
      } else if (filePath.endsWith('.md')) {
        await vscode.commands.executeCommand('markdown.showPreview', uri);
      } else {
        await vscode.window.showTextDocument(uri);
      }
      
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Successfully opened file: ${filePath}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: Failed to open file ${filePath}: ${errorMessage}`);
      if (error instanceof Error && error.stack) {
        this.outputChannel.appendLine(`Stack trace: ${error.stack}`);
      }
      
      // Show actionable error message (Requirement 11.1)
      const selection = await vscode.window.showErrorMessage(
        `Failed to open file: ${errorMessage}`,
        'Show Output'
      );
      
      if (selection === 'Show Output') {
        this.outputChannel.show();
      }
    }
  }

  /**
   * Generate the HTML content for the webview
   * 
   * Loads the dashboard HTML template and replaces placeholders with:
   * - CSP source for secure resource loading
   * - Nonce for inline script execution
   * - URIs for local library resources (marked.js, highlight.js, mermaid.js)
   * 
   * Requirements: 5.2, 7.1, 7.2, 7.3, 10.1, 10.2, 10.3
   */
  private getHtmlContent(webview: vscode.Webview): string {
    const nonce = this.getNonce();
    
    // Get URIs for external libraries
    const markedUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'marked.min.js')
    );
    const highlightJsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'highlight.min.js')
    );
    const highlightCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'highlight.css')
    );
    const mermaidUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'mermaid.min.js')
    );
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
    );
    
    const htmlPath = vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'dashboard.html');
    
    try {
      const fs = require('fs');
      let html = fs.readFileSync(htmlPath.fsPath, 'utf8');
      
      // Replace placeholders
      html = html.replace(/\{\{cspSource\}\}/g, webview.cspSource);
      html = html.replace(/\{\{nonce\}\}/g, nonce);
      html = html.replace(/\{\{markedUri\}\}/g, markedUri.toString());
      html = html.replace(/\{\{highlightJsUri\}\}/g, highlightJsUri.toString());
      html = html.replace(/\{\{highlightCssUri\}\}/g, highlightCssUri.toString());
      html = html.replace(/\{\{mermaidUri\}\}/g, mermaidUri.toString());
      html = html.replace(/\{\{codiconsUri\}\}/g, codiconsUri.toString());
      
      return html;
    } catch (error) {
      console.error('Failed to load dashboard HTML:', error);
      // Fallback to minimal HTML
      return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" 
            content="default-src 'none'; 
                     style-src ${webview.cspSource} 'unsafe-inline'; 
                     script-src 'nonce-${nonce}';">
      <title>Specs Dashboard</title>
      <style nonce="${nonce}">
        body {
          padding: 20px;
          color: var(--vscode-foreground);
          font-family: var(--vscode-font-family);
        }
        .error {
          color: var(--vscode-errorForeground);
          padding: 10px;
          border: 1px solid var(--vscode-errorBorder);
        }
      </style>
    </head>
    <body>
      <div class="error">
        <h2>Failed to Load Dashboard</h2>
        <p>Could not load the dashboard HTML template. Please check the extension installation.</p>
        <p>Error: ${error instanceof Error ? error.message : String(error)}</p>
      </div>
    </body>
    </html>`;
    }
  }

  /**
   * Generate a nonce for CSP
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Format spec name from kebab-case to Title Case
   * Converts "webview-panels-refactor" to "Webview Panels Refactor"
   */
  private formatSpecName(specName: string): string {
    return specName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Add a note to a spec
   */
  private async addNote(specName: string, text: string): Promise<void> {
    try {
      const state = await this.stateManager.getDashboardState();
      if (!state.notes) {
        state.notes = {};
      }
      if (!state.notes[specName]) {
        state.notes[specName] = [];
      }
      
      const now = Date.now();
      const note = {
        id: now.toString() + Math.random().toString(36).substr(2, 9),
        text: text.trim(),
        createdAt: now,
        updatedAt: now
      };
      
      state.notes[specName].push(note);
      await this.stateManager.saveDashboardState(state);
      
      // Send only notes update to webview (don't reset dashboard state)
      if (this.view) {
        this.view.webview.postMessage({
          type: 'notesUpdated',
          specName: specName,
          notes: state.notes[specName]
        });
      }
      
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Added note to spec: ${specName}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: Failed to add note: ${errorMessage}`);
    }
  }

  /**
   * Update an existing note
   */
  private async updateNote(specName: string, noteId: string, text: string): Promise<void> {
    try {
      const state = await this.stateManager.getDashboardState();
      if (!state.notes || !state.notes[specName]) {
        return;
      }
      
      const note = state.notes[specName].find(n => n.id === noteId);
      if (note) {
        note.text = text.trim();
        note.updatedAt = Date.now();
        await this.stateManager.saveDashboardState(state);
        
        // Send only notes update to webview (don't reset dashboard state)
        if (this.view) {
          this.view.webview.postMessage({
            type: 'notesUpdated',
            specName: specName,
            notes: state.notes[specName]
          });
        }
        
        this.outputChannel.appendLine(`[${new Date().toISOString()}] Updated note in spec: ${specName}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: Failed to update note: ${errorMessage}`);
    }
  }

  /**
   * Delete a note from a spec
   */
  private async deleteNote(specName: string, noteId: string): Promise<void> {
    try {
      // Show confirmation dialog
      const answer = await vscode.window.showWarningMessage(
        'Are you sure you want to delete this note?',
        { modal: true },
        'Delete'
      );
      
      // If user didn't click "Delete", cancel the operation
      if (answer !== 'Delete') {
        return;
      }
      
      const state = await this.stateManager.getDashboardState();
      if (!state.notes || !state.notes[specName]) {
        return;
      }
      
      state.notes[specName] = state.notes[specName].filter(n => n.id !== noteId);
      await this.stateManager.saveDashboardState(state);
      
      // Send only notes update to webview (don't reset dashboard state)
      if (this.view) {
        this.view.webview.postMessage({
          type: 'notesUpdated',
          specName: specName,
          notes: state.notes[specName]
        });
      }
      
      // Also update the notes panel if it's open for this spec
      const notesPanel = this.notesPanels.get(specName);
      if (notesPanel) {
        notesPanel.webview.postMessage({
          type: 'notesUpdated',
          notes: (state.notes && state.notes[specName]) || []
        });
      }
      
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Deleted note from spec: ${specName}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: Failed to delete note: ${errorMessage}`);
    }
  }

  /**
   * Open notes panel in main editor area
   */
  async openNotesPanel(specName: string): Promise<void> {
    // Check if a panel already exists for this spec
    const existingPanel = this.notesPanels.get(specName);
    if (existingPanel) {
      // Panel exists, just reveal it
      existingPanel.reveal(vscode.ViewColumn.One);
      
      // Refresh the notes content without resetting pagination
      const state = await this.stateManager.getDashboardState();
      const notes = (state.notes && state.notes[specName]) || [];
      existingPanel.webview.postMessage({
        type: 'notesUpdated',
        notes: notes,
        resetPage: false  // Don't reset page when just revealing
      });
      return;
    }

    // Create a new panel
    const panel = vscode.window.createWebviewPanel(
      'specNotes',
      `Notes: ${this.formatSpecName(specName)}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    // Store the panel in the map
    this.notesPanels.set(specName, panel);

    // Remove from map when panel is disposed
    panel.onDidDispose(() => {
      this.notesPanels.delete(specName);
    }, undefined, this.context.subscriptions);

    const state = await this.stateManager.getDashboardState();
    const notes = (state.notes && state.notes[specName]) || [];

    panel.webview.html = this.getNotesHtml(panel.webview, specName, notes);

    // Handle messages from the notes panel
    panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'addNote':
            await this.addNote(specName, message.text);
            const updatedState = await this.stateManager.getDashboardState();
            panel.webview.postMessage({
              type: 'notesUpdated',
              notes: (updatedState.notes && updatedState.notes[specName]) || [],
              resetPage: true  // Reset to page 1 when adding a note
            });
            break;
          case 'updateNote':
            await this.updateNote(specName, message.noteId, message.text);
            const updatedState2 = await this.stateManager.getDashboardState();
            panel.webview.postMessage({
              type: 'notesUpdated',
              notes: (updatedState2.notes && updatedState2.notes[specName]) || [],
              resetPage: false  // Keep current page when updating
            });
            break;
          case 'deleteNote':
            await this.deleteNote(specName, message.noteId);
            const updatedState3 = await this.stateManager.getDashboardState();
            panel.webview.postMessage({
              type: 'notesUpdated',
              notes: (updatedState3.notes && updatedState3.notes[specName]) || [],
              resetPage: false  // Keep current page when deleting
            });
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );
  }

  /**
   * Generate HTML for notes panel
   */
  private getNotesHtml(webview: vscode.Webview, specName: string, notes: any[]): string {
    const nonce = this.getNonce();
    
    // Get codicons URI
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
    );
    
    // Default sort: by updatedAt timestamp (latest first), fallback to timestamp for migration
    const sortedNotes = [...notes].sort((a, b) => {
      const aTime = a.updatedAt || a.timestamp || 0;
      const bTime = b.updatedAt || b.timestamp || 0;
      return bTime - aTime;
    });
    
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" 
            content="default-src 'none'; 
                     style-src ${webview.cspSource} 'unsafe-inline'; 
                     script-src 'nonce-${nonce}';
                     font-src ${webview.cspSource};">
      <link rel="stylesheet" href="${codiconsUri}">
      <title>Notes: ${specName}</title>
      <style nonce="${nonce}">
        body {
          font-family: var(--vscode-font-family);
          font-size: 13px;
          color: var(--vscode-foreground);
          background: var(--vscode-editor-background);
          padding: 20px;
          line-height: 1.4;
          box-sizing: border-box;
        }
        
        * {
          box-sizing: border-box;
        }
        
        .notes-header {
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--vscode-panel-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .notes-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .notes-title {
          font-size: 18px;
          font-weight: 600;
        }
        
        .notes-sort-select {
          padding: 4px 8px;
          background: var(--vscode-dropdown-background);
          color: var(--vscode-dropdown-foreground);
          border: 1px solid var(--vscode-dropdown-border);
          border-radius: 2px;
          font-family: var(--vscode-font-family);
          font-size: 12px;
          cursor: pointer;
          outline: none;
        }
        
        .notes-sort-select:focus {
          outline: 1px solid var(--vscode-focusBorder);
          outline-offset: -1px;
        }
        
        .notes-sort-select:hover {
          background: var(--vscode-dropdown-listBackground);
        }
        
        .notes-add-btn {
          padding: 6px 12px;
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          border-radius: 2px;
          font-family: var(--vscode-font-family);
          font-size: 13px;
          cursor: pointer;
        }
        
        .notes-add-btn:hover {
          background: var(--vscode-button-hoverBackground);
        }
        
        .notes-add-form {
          margin-bottom: 16px;
        }
        
        .notes-input-wrapper {
          margin-bottom: 4px;
        }
        
        .notes-toolbar {
          display: flex;
          gap: 2px;
          padding: 6px 8px;
          background: var(--vscode-editor-background);
          border: 1px solid var(--vscode-input-border);
          border-bottom: none;
          border-radius: 2px 2px 0 0;
          flex-wrap: wrap;
          align-items: center;
        }
        
        .notes-toolbar-btn {
          padding: 4px 6px;
          background: transparent;
          color: var(--vscode-foreground);
          border: none;
          border-radius: 2px;
          font-family: var(--vscode-font-family);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 32px;
          height: 28px;
          line-height: 1;
        }
        
        .notes-toolbar-btn:hover {
          background: var(--vscode-toolbar-hoverBackground);
        }
        
        .notes-toolbar-btn:active,
        .notes-toolbar-btn.active {
          background: var(--vscode-toolbar-activeBackground);
        }
        
        .notes-toolbar-separator {
          width: 2px;
          height: 20px;
          background: rgba(255, 255, 255, 0.2);
          margin: 0 8px;
          align-self: center;
        }
        
        .notes-editor {
          width: 100%;
          max-width: 100%;
          min-height: 120px;
          max-height: 400px;
          padding: 8px;
          background: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          border: 1px solid var(--vscode-input-border);
          border-top: none;
          border-radius: 0 0 2px 2px;
          box-sizing: border-box;
          line-height: 1.6;
          overflow-y: auto;
          margin-bottom: 8px;
        }
        
        .notes-editor:focus {
          outline: 1px solid var(--vscode-focusBorder);
          outline-offset: -1px;
        }
        
        .notes-editor:empty:before {
          content: attr(data-placeholder);
          color: var(--vscode-input-placeholderForeground);
        }
        
        .link-dialog {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 4px;
          padding: 20px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          z-index: 1000;
          min-width: 400px;
        }
        
        .link-dialog-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 999;
        }
        
        .link-dialog-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 20px;
        }
        
        .link-dialog-label {
          font-size: 13px;
          margin-bottom: 8px;
          display: block;
        }
        
        .link-dialog-input {
          width: 100%;
          padding: 8px;
          background: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          border: 1px solid var(--vscode-input-border);
          border-radius: 2px;
          font-family: var(--vscode-font-family);
          font-size: 13px;
          margin-bottom: 16px;
          box-sizing: border-box;
        }
        
        .link-dialog-input:focus {
          outline: 1px solid var(--vscode-focusBorder);
          outline-offset: -1px;
        }
        
        .link-dialog-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-top: 20px;
        }
        
        .notes-editor p {
          margin: 0 0 8px 0;
        }
        
        .notes-editor p:last-child {
          margin-bottom: 0;
        }
        
        .notes-editor ul,
        .notes-editor ol {
          margin: 0 0 8px 0;
          padding-left: 24px;
        }
        
        .notes-editor li {
          margin: 2px 0;
        }
        
        .notes-editor h1,
        .notes-editor h2,
        .notes-editor h3 {
          margin: 12px 0 8px 0;
          font-weight: 600;
        }
        
        .notes-editor h1 { font-size: 1.5em; }
        .notes-editor h2 { font-size: 1.3em; }
        .notes-editor h3 { font-size: 1.1em; }
        
        .notes-editor blockquote {
          border-left: 3px solid var(--vscode-textBlockQuote-border);
          background: var(--vscode-textBlockQuote-background);
          padding: 8px 12px;
          margin: 8px 0;
        }
        
        .notes-editor a {
          color: var(--vscode-textLink-foreground);
          text-decoration: underline;
        }
        
        .notes-form-actions {
          display: flex;
          gap: 8px;
        }
        
        .notes-save-btn, .notes-cancel-btn {
          padding: 6px 12px;
          border: none;
          border-radius: 2px;
          font-family: var(--vscode-font-family);
          font-size: 13px;
          cursor: pointer;
        }
        
        .notes-save-btn {
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
        }
        
        .notes-cancel-btn {
          background: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
        }
        
        .notes-list {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        
        .note-item {
          padding: 16px 0;
          background: transparent;
          border: none;
          border-bottom: 1px solid rgba(128, 128, 128, 0.35);
        }
        
        .note-item:first-child {
          padding-top: 0;
        }
        
        .note-item:last-child {
          border-bottom: 1px solid rgba(128, 128, 128, 0.35);
        }
        
        .note-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        
        .note-header.editing {
          margin-bottom: 4px;
        }
        
        .note-timestamp {
          font-size: 11px;
          color: var(--vscode-descriptionForeground);
        }
        
        .note-actions {
          display: flex;
          gap: 4px;
        }
        
        .note-edit-btn, .note-delete-btn {
          padding: 4px 8px;
          background: transparent;
          color: var(--vscode-button-foreground);
          border: 1px solid var(--vscode-button-border);
          border-radius: 2px;
          font-family: var(--vscode-font-family);
          font-size: 11px;
          cursor: pointer;
          outline: none;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        
        .note-edit-btn:hover:not(:disabled), .note-delete-btn:hover:not(:disabled) {
          background: var(--vscode-button-hoverBackground);
        }
        
        .note-edit-btn:focus, .note-delete-btn:focus {
          outline: 1px solid var(--vscode-focusBorder);
          outline-offset: -1px;
        }
        
        .note-edit-btn:disabled, .note-delete-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        
        .note-delete-btn {
          color: var(--vscode-errorForeground);
          border-color: var(--vscode-errorForeground);
        }
        
        .note-delete-btn:hover:not(:disabled) {
          background: var(--vscode-statusBarItem-errorBackground);
        }
        
        .codicon {
          font-size: 16px;
        }
        
        .note-text {
          font-size: 13px;
          line-height: 1.6;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        
        .note-text.markdown-content {
          /* Markdown styling */
        }
        
        .note-text.markdown-content h1,
        .note-text.markdown-content h2,
        .note-text.markdown-content h3,
        .note-text.markdown-content h4,
        .note-text.markdown-content h5,
        .note-text.markdown-content h6 {
          margin-top: 12px;
          margin-bottom: 8px;
          font-weight: 600;
        }
        
        .note-text.markdown-content h1 { font-size: 1.5em; }
        .note-text.markdown-content h2 { font-size: 1.3em; }
        .note-text.markdown-content h3 { font-size: 1.1em; }
        
        .note-text.markdown-content p {
          margin: 8px 0;
        }
        
        .note-text.markdown-content ul,
        .note-text.markdown-content ol {
          margin: 8px 0;
          padding-left: 24px;
        }
        
        .note-text.markdown-content li {
          margin: 4px 0;
        }
        
        .note-text.markdown-content code {
          background: var(--vscode-textCodeBlock-background);
          padding: 2px 4px;
          border-radius: 2px;
          font-family: var(--vscode-editor-font-family);
          font-size: 0.9em;
        }
        
        .note-text.markdown-content pre {
          background: var(--vscode-textCodeBlock-background);
          padding: 8px;
          border-radius: 2px;
          overflow-x: auto;
          margin: 8px 0;
        }
        
        .note-text.markdown-content pre code {
          background: none;
          padding: 0;
        }
        
        .note-text.markdown-content blockquote {
          border-left: 3px solid var(--vscode-textBlockQuote-border);
          background: var(--vscode-textBlockQuote-background);
          padding: 8px 12px;
          margin: 8px 0;
        }
        
        .note-text.markdown-content a {
          color: var(--vscode-textLink-foreground);
          text-decoration: none;
        }
        
        .note-text.markdown-content a:hover {
          text-decoration: underline;
        }
        
        .note-text.markdown-content strong {
          font-weight: 600;
        }
        
        .note-text.markdown-content em {
          font-style: italic;
        }
        
        .note-text.markdown-content hr {
          border: none;
          border-top: 1px solid var(--vscode-panel-border);
          margin: 12px 0;
        }
        
        .note-text .notes-input {
          margin-bottom: 4px;
        }
        
        .note-text .notes-form-actions {
          margin-bottom: 0;
        }
        
        .empty-state {
          text-align: center;
          padding: 40px;
          color: var(--vscode-descriptionForeground);
        }
        
        .notes-pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid var(--vscode-panel-border);
        }
        
        .notes-pagination-btn {
          padding: 4px 12px;
          background: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
          border: none;
          border-radius: 2px;
          font-family: var(--vscode-font-family);
          font-size: 13px;
          cursor: pointer;
        }
        
        .notes-pagination-btn:hover:not(:disabled) {
          background: var(--vscode-button-secondaryHoverBackground);
        }
        
        .notes-pagination-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .notes-pagination-info {
          font-size: 13px;
          color: var(--vscode-descriptionForeground);
        }
      </style>
    </head>
    <body>
      <div class="notes-header">
        <div class="notes-header-left">
          <div class="notes-title">Notes for ${this.formatSpecName(specName)}</div>
          <select class="notes-sort-select" id="sortSelect">
            <option value="recently-updated">Recently Updated</option>
            <option value="recently-created">Recently Created</option>
            <option value="oldest-first">Oldest First</option>
          </select>
          <select class="notes-sort-select" id="itemsPerPageSelect">
            <option value="10">10 per page</option>
            <option value="20">20 per page</option>
            <option value="all">Show all</option>
          </select>
        </div>
        <button class="notes-add-btn" id="addBtn">Add Note</button>
      </div>
      
      <div class="notes-add-form" id="addForm" style="display: none;">
        <div class="notes-toolbar">
          <button class="notes-toolbar-btn" data-command="bold" title="Bold (Ctrl+B)">
            <span class="codicon codicon-bold"></span>
          </button>
          <button class="notes-toolbar-btn" data-command="strikeThrough" title="Strikethrough">
            <s style="font-weight: 600; font-size: 14px;">S</s>
          </button>
          <div class="notes-toolbar-separator"></div>
          <button class="notes-toolbar-btn" data-command="insertUnorderedList" title="Bullet List">
            <span class="codicon codicon-list-unordered"></span>
          </button>
          <button class="notes-toolbar-btn" data-command="insertOrderedList" title="Numbered List">
            <span class="codicon codicon-list-ordered"></span>
          </button>
          <div class="notes-toolbar-separator"></div>
          <button class="notes-toolbar-btn" data-command="createLink" title="Insert Link">
            <span class="codicon codicon-link"></span>
          </button>
          <button class="notes-toolbar-btn" data-command="removeFormat" title="Clear Formatting">
            <span class="codicon codicon-clear-all"></span>
          </button>
        </div>
        <div class="notes-editor" id="addEditor" contenteditable="true" data-placeholder="Enter your note..."></div>
        <div class="notes-form-actions">
          <button class="notes-save-btn" id="addSave">Save</button>
          <button class="notes-cancel-btn" id="addCancel">Cancel</button>
        </div>
      </div>
      
      <div class="notes-list" id="notesList"></div>
      
      <div class="notes-pagination" id="notesPagination" style="display: none;">
        <button class="notes-pagination-btn" id="prevPageBtn">Previous</button>
        <span class="notes-pagination-info" id="paginationInfo"></span>
        <button class="notes-pagination-btn" id="nextPageBtn">Next</button>
      </div>
      
      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let currentNotes = ${JSON.stringify(sortedNotes)};
        
        // Get saved state or use defaults
        const savedState = vscode.getState() || {};
        let currentSortMode = savedState.sortMode || 'recently-updated';
        let currentPage = savedState.currentPage || 1;
        let itemsPerPage = savedState.itemsPerPage || 10;
        
        // Save state whenever it changes
        function saveState() {
          vscode.setState({
            sortMode: currentSortMode,
            currentPage: currentPage,
            itemsPerPage: itemsPerPage
          });
        }
        
        // Initialize dropdowns immediately
        (function initDropdowns() {
          const sortSelect = document.getElementById('sortSelect');
          const itemsSelect = document.getElementById('itemsPerPageSelect');
          if (sortSelect) sortSelect.value = currentSortMode;
          if (itemsSelect) itemsSelect.value = itemsPerPage === 'all' ? 'all' : itemsPerPage.toString();
        })();
        
        // Rich text editor functions
        function execCommand(command, value = null) {
          document.execCommand(command, false, value);
        }
        
        function showLinkDialog(callback, preSelectedText = '') {
          // Create overlay
          const overlay = document.createElement('div');
          overlay.className = 'link-dialog-overlay';
          
          // Create dialog
          const dialog = document.createElement('div');
          dialog.className = 'link-dialog';
          dialog.innerHTML = \`
            <div class="link-dialog-title">Insert link</div>
            <label class="link-dialog-label">Text to display</label>
            <input type="text" class="link-dialog-input" id="linkTextInput" placeholder="Text to display" />
            <label class="link-dialog-label">Address</label>
            <input type="text" class="link-dialog-input" id="linkUrlInput" placeholder="Link to an existing file or web page" />
            <div class="link-dialog-actions">
              <button class="notes-cancel-btn" id="linkCancelBtn">Cancel</button>
              <button class="notes-save-btn" id="linkInsertBtn">Insert</button>
            </div>
          \`;
          
          document.body.appendChild(overlay);
          document.body.appendChild(dialog);
          
          const textInput = document.getElementById('linkTextInput');
          const urlInput = document.getElementById('linkUrlInput');
          const insertBtn = document.getElementById('linkInsertBtn');
          const cancelBtn = document.getElementById('linkCancelBtn');
          
          // Use pre-selected text if provided
          if (preSelectedText) {
            textInput.value = preSelectedText;
            urlInput.focus();
          } else {
            textInput.focus();
          }
          
          function cleanup() {
            document.body.removeChild(overlay);
            document.body.removeChild(dialog);
          }
          
          insertBtn.onclick = () => {
            const text = textInput.value.trim();
            const url = urlInput.value.trim();
            if (url) {
              callback(url, text || url);
            }
            cleanup();
          };
          
          cancelBtn.onclick = cleanup;
          overlay.onclick = cleanup;
          
          // Handle Enter key in inputs
          textInput.onkeydown = urlInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
              const text = textInput.value.trim();
              const url = urlInput.value.trim();
              if (url) {
                callback(url, text || url);
              }
              cleanup();
            } else if (e.key === 'Escape') {
              cleanup();
            }
          };
        }
        
        function setupToolbar(toolbarElement, editorElement) {
          const buttons = toolbarElement.querySelectorAll('.notes-toolbar-btn');
          
          buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.preventDefault();
              const command = btn.getAttribute('data-command');
              const value = btn.getAttribute('data-value');
              
              if (command === 'createLink') {
                // Save the current selection range before opening dialog
                const selection = window.getSelection();
                const selectedText = selection.toString();
                let savedRange = null;
                
                if (selection.rangeCount > 0) {
                  savedRange = selection.getRangeAt(0).cloneRange();
                }
                
                showLinkDialog((url, text) => {
                  editorElement.focus();
                  
                  // Restore the saved selection
                  if (savedRange) {
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(savedRange);
                  }
                  
                  // If there was no selection, insert the text first
                  if (!selectedText) {
                    document.execCommand('insertText', false, text);
                    // Select the inserted text
                    const sel = window.getSelection();
                    if (sel.rangeCount > 0) {
                      const range = sel.getRangeAt(0);
                      range.setStart(range.startContainer, range.startOffset - text.length);
                      sel.removeAllRanges();
                      sel.addRange(range);
                    }
                  }
                  
                  // Now create the link
                  document.execCommand('createLink', false, url);
                  
                  // Move cursor after the link
                  const sel = window.getSelection();
                  if (sel.rangeCount > 0) {
                    const range = sel.getRangeAt(0);
                    range.collapse(false);
                  }
                }, selectedText);
              } else if (value) {
                execCommand(command, value);
                editorElement.focus();
              } else {
                execCommand(command);
                editorElement.focus();
              }
            });
          });
          
          // Update button states based on current selection
          editorElement.addEventListener('mouseup', updateToolbarState);
          editorElement.addEventListener('keyup', updateToolbarState);
          
          function updateToolbarState() {
            buttons.forEach(btn => {
              const command = btn.getAttribute('data-command');
              if (command && document.queryCommandState(command)) {
                btn.classList.add('active');
              } else {
                btn.classList.remove('active');
              }
            });
          }
        }
        
        function getEditorHTML(editor) {
          return editor.innerHTML.trim();
        }
        
        function setEditorHTML(editor, html) {
          editor.innerHTML = html;
        }
        
        function clearEditor(editor) {
          editor.innerHTML = '';
        }
        
        function sortNotes(notes, sortMode) {
          const sorted = [...notes];
          
          switch (sortMode) {
            case 'recently-updated':
              // Sort by updatedAt (latest first)
              sorted.sort((a, b) => {
                const aTime = a.updatedAt || a.timestamp || 0;
                const bTime = b.updatedAt || b.timestamp || 0;
                return bTime - aTime;
              });
              break;
            
            case 'recently-created':
              // Sort by createdAt (latest first)
              sorted.sort((a, b) => {
                const aTime = a.createdAt || a.timestamp || 0;
                const bTime = b.createdAt || b.timestamp || 0;
                return bTime - aTime;
              });
              break;
            
            case 'oldest-first':
              // Sort by createdAt (oldest first)
              sorted.sort((a, b) => {
                const aTime = a.createdAt || a.timestamp || 0;
                const bTime = b.createdAt || b.timestamp || 0;
                return aTime - bTime;
              });
              break;
          }
          
          return sorted;
        }
        
        function renderNotes() {
          const notesList = document.getElementById('notesList');
          const pagination = document.getElementById('notesPagination');
          const paginationInfo = document.getElementById('paginationInfo');
          const prevBtn = document.getElementById('prevPageBtn');
          const nextBtn = document.getElementById('nextPageBtn');
          
          if (currentNotes.length === 0) {
            notesList.innerHTML = '<div class="empty-state">No notes yet. Click "Add Note" to create one.</div>';
            pagination.style.display = 'none';
            return;
          }
          
          const sortedNotes = sortNotes(currentNotes, currentSortMode);
          
          // Calculate pagination
          let paginatedNotes;
          let totalPages;
          
          if (itemsPerPage === 'all') {
            // Show all notes, no pagination
            paginatedNotes = sortedNotes;
            pagination.style.display = 'none';
          } else {
            // Paginate
            const itemsPerPageNum = parseInt(itemsPerPage);
            totalPages = Math.ceil(sortedNotes.length / itemsPerPageNum);
            const startIndex = (currentPage - 1) * itemsPerPageNum;
            const endIndex = Math.min(startIndex + itemsPerPageNum, sortedNotes.length);
            paginatedNotes = sortedNotes.slice(startIndex, endIndex);
            
            // Update pagination
            if (totalPages > 1) {
              pagination.style.display = 'flex';
              paginationInfo.textContent = \`Page \${currentPage} of \${totalPages} (\${sortedNotes.length} notes)\`;
              prevBtn.disabled = currentPage === 1;
              nextBtn.disabled = currentPage === totalPages;
            } else {
              pagination.style.display = 'none';
            }
          }
          
          // Render notes
          notesList.innerHTML = paginatedNotes.map(note => \`
            <div class="note-item">
              <div class="note-header">
                <span class="note-timestamp">\${formatNoteTimestamp(note)}</span>
                <div class="note-actions">
                  <button class="note-edit-btn" data-note-id="\${note.id}" title="Edit note">
                    <span class="codicon codicon-edit"></span>
                    Edit
                  </button>
                  <button class="note-delete-btn" data-note-id="\${note.id}" title="Delete note">
                    <span class="codicon codicon-trash"></span>
                    Delete
                  </button>
                </div>
              </div>
              <div class="note-text markdown-content" data-note-id="\${note.id}">\${note.text}</div>
            </div>
          \`).join('');
          
          attachNoteListeners();
        }
        
        function formatTimestamp(timestamp) {
          const now = Date.now();
          const diff = now - timestamp;
          const seconds = Math.floor(diff / 1000);
          const minutes = Math.floor(seconds / 60);
          const hours = Math.floor(minutes / 60);
          const days = Math.floor(hours / 24);
          
          if (seconds < 60) return 'just now';
          if (minutes < 60) return \`\${minutes} minute\${minutes > 1 ? 's' : ''} ago\`;
          if (hours < 24) return \`\${hours} hour\${hours > 1 ? 's' : ''} ago\`;
          if (days < 7) return \`\${days} day\${days > 1 ? 's' : ''} ago\`;
          
          const date = new Date(timestamp);
          return date.toLocaleDateString();
        }
        
        function formatNoteTimestamp(note) {
          // Handle migration from old timestamp field
          const createdAt = note.createdAt || note.timestamp;
          const updatedAt = note.updatedAt || note.timestamp;
          
          if (!createdAt) return '';
          
          const createdStr = formatTimestamp(createdAt);
          
          // If note was updated after creation (more than 1 minute difference)
          if (updatedAt && updatedAt - createdAt > 60000) {
            const updatedStr = formatTimestamp(updatedAt);
            return \`Created \${createdStr} (updated \${updatedStr})\`;
          }
          
          return \`Created \${createdStr}\`;
        }
        
        function attachNoteListeners() {
          document.querySelectorAll('.note-edit-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
              e.stopPropagation();
              const noteId = this.getAttribute('data-note-id');
              const note = currentNotes.find(n => n.id === noteId);
              const noteItem = this.closest('.note-item');
              const noteHeader = noteItem.querySelector('.note-header');
              const noteActions = noteHeader.querySelector('.note-actions');
              const noteText = noteItem.querySelector(\`.note-text[data-note-id="\${noteId}"]\`);
              
              if (note && noteText) {
                // Hide action buttons during edit
                noteActions.style.display = 'none';
                
                noteText.innerHTML = \`
                  <div class="notes-toolbar" id="editToolbar-\${noteId}">
                    <button class="notes-toolbar-btn" data-command="bold" title="Bold">
                      <span class="codicon codicon-bold"></span>
                    </button>
                    <button class="notes-toolbar-btn" data-command="strikeThrough" title="Strikethrough">
                      <s style="font-weight: 600; font-size: 14px;">S</s>
                    </button>
                    <div class="notes-toolbar-separator"></div>
                    <button class="notes-toolbar-btn" data-command="insertUnorderedList" title="Bullet List">
                      <span class="codicon codicon-list-unordered"></span>
                    </button>
                    <button class="notes-toolbar-btn" data-command="insertOrderedList" title="Numbered List">
                      <span class="codicon codicon-list-ordered"></span>
                    </button>
                    <div class="notes-toolbar-separator"></div>
                    <button class="notes-toolbar-btn" data-command="createLink" title="Insert Link">
                      <span class="codicon codicon-link"></span>
                    </button>
                    <button class="notes-toolbar-btn" data-command="removeFormat" title="Clear Formatting">
                      <span class="codicon codicon-clear-all"></span>
                    </button>
                  </div>
                  <div class="notes-editor" id="editEditor-\${noteId}" contenteditable="true">\${note.text}</div>
                  <div class="notes-form-actions">
                    <button class="notes-save-btn" id="editSave-\${noteId}">Save</button>
                    <button class="notes-cancel-btn" id="editCancel-\${noteId}">Cancel</button>
                  </div>
                \`;
                
                const toolbar = document.getElementById(\`editToolbar-\${noteId}\`);
                const editor = document.getElementById(\`editEditor-\${noteId}\`);
                setupToolbar(toolbar, editor);
                editor.focus();
                
                document.getElementById(\`editSave-\${noteId}\`).addEventListener('click', function() {
                  const newHTML = getEditorHTML(editor);
                  if (newHTML) {
                    vscode.postMessage({ type: 'updateNote', noteId, text: newHTML });
                  }
                });
                
                document.getElementById(\`editCancel-\${noteId}\`).addEventListener('click', function() {
                  renderNotes();
                });
              }
            });
          });
          
          document.querySelectorAll('.note-delete-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
              e.stopPropagation();
              const noteId = this.getAttribute('data-note-id');
              vscode.postMessage({ type: 'deleteNote', noteId });
            });
          });
        }
        
        document.getElementById('addBtn').onclick = () => {
          document.getElementById('addForm').style.display = 'block';
          document.getElementById('addBtn').style.display = 'none';
          const addEditor = document.getElementById('addEditor');
          const addToolbar = document.querySelector('#addForm .notes-toolbar');
          setupToolbar(addToolbar, addEditor);
          addEditor.focus();
        };
        
        document.getElementById('addCancel').onclick = () => {
          document.getElementById('addForm').style.display = 'none';
          document.getElementById('addBtn').style.display = 'inline-block';
          clearEditor(document.getElementById('addEditor'));
        };
        
        document.getElementById('addSave').onclick = () => {
          const addEditor = document.getElementById('addEditor');
          const html = getEditorHTML(addEditor);
          if (html) {
            vscode.postMessage({ type: 'addNote', text: html });
            document.getElementById('addForm').style.display = 'none';
            document.getElementById('addBtn').style.display = 'inline-block';
            clearEditor(addEditor);
          }
        };
        
        document.getElementById('sortSelect').onchange = (e) => {
          currentSortMode = e.target.value;
          currentPage = 1; // Reset to first page when sorting changes
          saveState();
          renderNotes();
        };
        
        document.getElementById('itemsPerPageSelect').onchange = (e) => {
          itemsPerPage = e.target.value === 'all' ? 'all' : parseInt(e.target.value);
          currentPage = 1; // Reset to first page when items per page changes
          saveState();
          renderNotes();
        };
        
        document.getElementById('prevPageBtn').onclick = () => {
          if (currentPage > 1) {
            currentPage--;
            saveState();
            renderNotes();
            document.getElementById('notesList').scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        };
        
        document.getElementById('nextPageBtn').onclick = () => {
          const itemsPerPageNum = itemsPerPage === 'all' ? currentNotes.length : parseInt(itemsPerPage);
          const totalPages = Math.ceil(currentNotes.length / itemsPerPageNum);
          if (currentPage < totalPages) {
            currentPage++;
            saveState();
            renderNotes();
            document.getElementById('notesList').scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        };
        
        window.addEventListener('message', event => {
          const message = event.data;
          if (message.type === 'notesUpdated') {
            currentNotes = message.notes;
            // Only reset to page 1 if explicitly requested or if notes count changed significantly
            if (message.resetPage || currentNotes.length === 0) {
              currentPage = 1;
              saveState();
            }
            renderNotes();
          }
        });
        
        renderNotes();
      </script>
    </body>
    </html>`;
  }

  /**
   * Get the StateManager instance
   * Used by mock data generator to access state management
   * 
   * @returns StateManager instance
   */
  getStateManager(): StateManager {
    return this.stateManager;
  }

  /**
   * Get the AnalyticsPanelManager instance
   * Used by commands that need to refresh analytics
   * 
   * @returns AnalyticsPanelManager instance
   */
  getAnalyticsPanelManager(): AnalyticsPanelManager {
    return this.analyticsPanelManager;
  }

  /**
   * Get the current specs array
   * Used by commands that need to access spec data
   * 
   * @returns Array of specs
   */
  getSpecs(): Array<{ totalTasks: number; completedTasks: number }> {
    return this.specs;
  }

  /**
   * Get the velocity calculator instance
   * Used by migration command
   * 
   * @returns VelocityCalculator instance
   */
  getVelocityCalculator(): VelocityCalculator {
    return this.velocityCalculator;
  }

  /**
   * Get the output channel instance
   * Used by migration command for logging
   * 
   * @returns OutputChannel instance
   */
  getOutputChannel(): vscode.OutputChannel {
    return this.outputChannel;
  }

  /**
   * Get spec scanner instance
   * Used for direct spec scanning bypassing webview visibility checks
   * 
   * @returns SpecScanner instance
   */
  getScanner(): SpecScanner {
    return this.scanner;
  }

  /**
   * Notify webview of execution state change
   * Called by ExecutionManager when execution state changes
   * 
   * Requirements: 5.1, 5.2, 5.3, 7.1
   */
  notifyExecutionStateChanged(specId: string, state: any): void {
    this.sendExecutionStateChanged(specId, state);
  }

  /**
   * Dispose of all resources
   * 
   * This method is called when the extension is deactivated or the provider is disposed.
   * It ensures all resources are properly cleaned up to prevent memory leaks.
   * 
   * Resources disposed:
   * - Output channel
   * - Spec scanner (which disposes its own output channel)
   * - Webview view (if it exists)
   * - Visibility tracking state
   * 
   * Requirements: 13.4
   */
  dispose(): void {
    console.log('Disposing SpecsDashboardProvider resources...');
    
    // Dispose output channel
    if (this.outputChannel) {
      this.outputChannel.dispose();
    }
    
    // Dispose scanner (which disposes its own output channel)
    if (this.scanner) {
      this.scanner.dispose();
    }
    
    // Dispose all notes panels
    this.notesPanels.forEach(panel => {
      panel.dispose();
    });
    this.notesPanels.clear();
    
    // Dispose analytics panel manager
    if (this.analyticsPanelManager) {
      this.analyticsPanelManager.dispose();
    }
    
    // Clear webview reference and visibility tracking
    // Note: The webview itself is managed by VSCode and will be disposed automatically
    // We just need to clear our reference to it
    this.view = undefined;
    this.isWebviewVisible = false;
    this.pendingRefresh = false;
    
    console.log('SpecsDashboardProvider resources disposed');
  }
}
