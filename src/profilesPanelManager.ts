import * as vscode from 'vscode';
import { ProfileManager } from './profileManager';
import { ExecutionProfile, ProfilesWebviewMessage, ProfilesExtensionMessage } from './types';

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
  ) {
    this.context = context;
    this.profileManager = profileManager;
    this.outputChannel = outputChannel;
  }

  /**
   * Open or reveal the profiles panel
   * 
   * If a panel already exists, it will be revealed.
   * Otherwise, a new panel will be created.
   * 
   * Requirements: 1.1, 1.4
   */
  public async openProfiles(): Promise<void> {
    this.outputChannel.appendLine(`[${new Date().toISOString()}] Opening profiles panel`);

    if (this.panel) {
      // Panel exists, just reveal it
      this.panel.reveal(vscode.ViewColumn.One);
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Revealed existing profiles panel`);
    } else {
      // Create new panel
      await this.createPanel();
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Created new profiles panel`);
    }
  }

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
  private async createPanel(): Promise<void> {
    this.panel = vscode.window.createWebviewPanel(
      'specsProfiles',
      'Manage Profiles - Kiro Specs Dashboard',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.context.extensionUri]
      }
    );

    // Set HTML content
    this.panel.webview.html = this.getHtmlContent(this.panel.webview);

    // Set up message handling
    this.setupMessageHandling();

    // Handle panel disposal
    this.panel.onDidDispose(() => {
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Profiles panel disposed`);
      this.panel = undefined;
    }, undefined, this.context.subscriptions);
  }

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
  private setupMessageHandling(): void {
    if (!this.panel) {
      return;
    }

    this.panel.webview.onDidReceiveMessage(
      async (message: ProfilesWebviewMessage) => {
        this.outputChannel.appendLine(
          `[${new Date().toISOString()}] Profiles webview message: ${message.type}`
        );

        switch (message.type) {
          case 'loadProfiles':
            await this.handleLoadProfiles();
            break;

          case 'createProfile':
            await this.handleCreateProfile(message.profile);
            break;

          case 'updateProfile':
            await this.handleUpdateProfile(message.profileId, message.updates);
            break;

          case 'confirmDelete':
            await this.handleConfirmDelete(message.profileId, message.profileName);
            break;

          case 'deleteProfile':
            await this.handleDeleteProfile(message.profileId);
            break;

          case 'confirmReset':
            await this.handleConfirmReset(message.profileId, message.profileName);
            break;

          case 'resetProfile':
            await this.handleResetProfile(message.profileId);
            break;

          default:
            this.outputChannel.appendLine(
              `[${new Date().toISOString()}] Unknown profiles message type`
            );
        }
      },
      undefined,
      this.context.subscriptions
    );
  }

  /**
   * Handle loadProfiles message
   * Loads all profiles from all workspace folders
   * Ensures the profiles file exists before loading
   * 
   * Requirements: 5.1, 12.1
   */
  private async handleLoadProfiles(): Promise<void> {
    try {
      // Ensure profiles file exists in the first workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders && workspaceFolders.length > 0) {
        await this.profileManager.ensureProfilesFileExists(workspaceFolders[0]);
      }
      
      const profiles = await this.profileManager.loadAllProfiles();
      
      this.sendMessage({
        type: 'profilesLoaded',
        profiles: profiles
      });

      this.outputChannel.appendLine(
        `[${new Date().toISOString()}] Loaded ${profiles.length} profiles`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[${new Date().toISOString()}] ERROR: Failed to load profiles: ${errorMessage}`
      );
      
      if (error instanceof Error && error.stack) {
        this.outputChannel.appendLine(`Stack trace: ${error.stack}`);
      }

      this.sendMessage({
        type: 'error',
        message: 'Failed to load profiles',
        details: errorMessage
      });
    }
  }

  /**
   * Handle createProfile message
   * Validates and creates a new profile
   * 
   * Requirements: 5.2, 5.6, 5.7, 11.1, 12.1
   */
  private async handleCreateProfile(profile: ExecutionProfile): Promise<void> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder open');
      }

      // Use first workspace folder for new profiles
      const workspaceFolder = workspaceFolders[0];
      
      await this.profileManager.createProfile(profile, workspaceFolder);
      
      this.sendMessage({
        type: 'profileCreated',
        profile: profile
      });

      this.outputChannel.appendLine(
        `[${new Date().toISOString()}] Created profile: ${profile.id}`
      );

      // Reload all profiles to update the list
      await this.handleLoadProfiles();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[${new Date().toISOString()}] ERROR: Failed to create profile: ${errorMessage}`
      );
      
      if (error instanceof Error && error.stack) {
        this.outputChannel.appendLine(`Stack trace: ${error.stack}`);
      }

      this.sendMessage({
        type: 'error',
        message: 'Failed to create profile',
        details: errorMessage
      });
    }
  }

  /**
   * Handle updateProfile message
   * Validates and updates an existing profile
   * 
   * Requirements: 5.3, 5.6, 5.7, 11.1, 12.1
   */
  private async handleUpdateProfile(
    profileId: string,
    updates: Partial<ExecutionProfile>
  ): Promise<void> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder open');
      }

      // Try to update in each workspace folder until we find the profile
      let updated = false;
      for (const workspaceFolder of workspaceFolders) {
        try {
          await this.profileManager.updateProfile(profileId, updates, workspaceFolder);
          updated = true;
          break;
        } catch (error) {
          // Profile not found in this workspace, try next
          continue;
        }
      }

      if (!updated) {
        throw new Error(`Profile with ID "${profileId}" not found in any workspace folder`);
      }

      // Get the updated profile
      const profiles = await this.profileManager.loadAllProfiles();
      const updatedProfile = profiles.find(p => p.id === profileId);

      if (updatedProfile) {
        this.sendMessage({
          type: 'profileUpdated',
          profile: updatedProfile
        });
      }

      this.outputChannel.appendLine(
        `[${new Date().toISOString()}] Updated profile: ${profileId}`
      );

      // Reload all profiles to update the list
      await this.handleLoadProfiles();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[${new Date().toISOString()}] ERROR: Failed to update profile: ${errorMessage}`
      );
      
      if (error instanceof Error && error.stack) {
        this.outputChannel.appendLine(`Stack trace: ${error.stack}`);
      }

      this.sendMessage({
        type: 'error',
        message: 'Failed to update profile',
        details: errorMessage
      });
    }
  }

  /**
   * Handle confirmDelete message
   * Shows a native VSCode confirmation dialog and sends deleteProfile if confirmed
   * 
   * Requirements: 5.4, 5.6, 5.7, 11.1, 12.1
   */
  private async handleConfirmDelete(profileId: string, profileName: string): Promise<void> {
    const result = await vscode.window.showWarningMessage(
      `Are you sure you want to delete the profile "${profileName}"? This action cannot be undone.`,
      { modal: true },
      'Delete'
    );

    if (result === 'Delete') {
      await this.handleDeleteProfile(profileId);
    }
  }

  /**
   * Handle confirmReset message
   * Shows a native VSCode confirmation dialog and sends resetProfile if confirmed
   * 
   * Requirements: 5.5, 5.6, 5.7, 11.1, 12.1
   */
  private async handleConfirmReset(profileId: string, profileName: string): Promise<void> {
    const result = await vscode.window.showWarningMessage(
      `Are you sure you want to reset the profile "${profileName}" to its default settings? This will discard any customizations.`,
      { modal: true },
      'Reset'
    );

    if (result === 'Reset') {
      await this.handleResetProfile(profileId);
    }
  }

  /**
   * Handle deleteProfile message
   * Deletes a custom profile (prevents deletion of built-in profiles)
   * 
   * Requirements: 5.4, 5.6, 5.7, 11.1, 12.1
   */
  private async handleDeleteProfile(profileId: string): Promise<void> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder open');
      }

      // Try to delete from the first workspace folder (where custom profiles are stored)
      const workspaceFolder = workspaceFolders[0];
      await this.profileManager.deleteProfile(profileId, workspaceFolder);

      this.sendMessage({
        type: 'profileDeleted',
        profileId: profileId
      });

      this.outputChannel.appendLine(
        `[${new Date().toISOString()}] Deleted profile: ${profileId}`
      );

      // Show success message to user
      vscode.window.showInformationMessage(`Profile deleted successfully.`);

      // Reload all profiles to update the list
      await this.handleLoadProfiles();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[${new Date().toISOString()}] ERROR: Failed to delete profile: ${errorMessage}`
      );
      
      if (error instanceof Error && error.stack) {
        this.outputChannel.appendLine(`Stack trace: ${error.stack}`);
      }

      // Show error message to user
      vscode.window.showErrorMessage(`Failed to delete profile: ${errorMessage}`);

      this.sendMessage({
        type: 'error',
        message: `Failed to delete profile: ${errorMessage}`
      });
    }
  }

  /**
   * Handle resetProfile message
   * Resets a built-in profile to defaults
   * 
   * Requirements: 5.5, 5.6, 5.7, 11.1, 12.1
   */
  private async handleResetProfile(profileId: string): Promise<void> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder open');
      }

      // Try to reset in the first workspace folder (built-in profiles are global)
      const workspaceFolder = workspaceFolders[0];
      await this.profileManager.resetBuiltInProfile(profileId, workspaceFolder);

      // Get the reset profile
      const profiles = await this.profileManager.loadAllProfiles();
      const resetProfile = profiles.find(p => p.id === profileId);

      if (resetProfile) {
        this.sendMessage({
          type: 'profileReset',
          profile: resetProfile
        });
      }

      this.outputChannel.appendLine(
        `[${new Date().toISOString()}] Reset profile: ${profileId}`
      );

      // Show success message to user
      vscode.window.showInformationMessage(`Profile reset to default settings.`);

      // Reload all profiles to update the list
      await this.handleLoadProfiles();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[${new Date().toISOString()}] ERROR: Failed to reset profile: ${errorMessage}`
      );
      
      if (error instanceof Error && error.stack) {
        this.outputChannel.appendLine(`Stack trace: ${error.stack}`);
      }

      this.sendMessage({
        type: 'error',
        message: `Failed to reset profile: ${errorMessage}`
      });
    }
  }

  /**
   * Send a message to the webview
   */
  private sendMessage(message: ProfilesExtensionMessage): void {
    if (this.panel) {
      this.panel.webview.postMessage(message);
    }
  }

  /**
   * Generate HTML content for the profiles webview
   * 
   * Loads the profiles.html template and replaces placeholders
   * 
   * Requirements: 1.3, 9.1-9.5, 10.1-10.5
   */
  private getHtmlContent(webview: vscode.Webview): string {
    const nonce = this.getNonce();

    // Get URIs for resources
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
    );

    const htmlPath = vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'profiles.html');
    
    try {
      const fs = require('fs');
      let html = fs.readFileSync(htmlPath.fsPath, 'utf8');
      
      // Replace placeholders
      html = html.replace(/\{\{cspSource\}\}/g, webview.cspSource);
      html = html.replace(/\{\{nonce\}\}/g, nonce);
      html = html.replace(/\{\{codiconsUri\}\}/g, codiconsUri.toString());
      
      return html;
    } catch (error) {
      this.outputChannel.appendLine(
        `[${new Date().toISOString()}] ERROR: Failed to load profiles HTML: ${error}`
      );
      
      // Fallback to minimal HTML
      return this.getFallbackHtml(webview, nonce, codiconsUri);
    }
  }

  /**
   * Generate fallback HTML when profiles.html cannot be loaded
   */
  private getFallbackHtml(
    webview: vscode.Webview,
    nonce: string,
    codiconsUri: vscode.Uri
  ): string {
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
  <title>Manage Profiles</title>
  <style nonce="${nonce}">
    body {
      font-family: var(--vscode-font-family);
      font-size: 13px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 20px;
      line-height: 1.4;
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
    <h2>Failed to Load Profiles Panel</h2>
    <p>Could not load the profiles HTML template. Please check the extension installation.</p>
  </div>
</body>
</html>`;
  }

  /**
   * Generate a nonce for CSP
   * 
   * Requirements: 9.3
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
   * Dispose of the profiles panel
   * 
   * Requirements: 1.5
   */
  public dispose(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }
  }
}
