import * as vscode from 'vscode';
import { VelocityCalculator } from './velocityCalculator';
import { StateManager } from './stateManager';

/**
 * Manages the Analytics webview panel
 * 
 * This class handles:
 * - Creating and revealing the analytics panel in the main editor area
 * - Managing panel lifecycle (creation, disposal, visibility)
 * - Sending velocity metrics data to the webview
 * - Handling messages from the analytics webview
 * 
 * Requirements: 18.2, 18.3, 18.4
 */
export class AnalyticsPanelManager {
  private panel: vscode.WebviewPanel | undefined;
  private velocityCalculator: VelocityCalculator;
  private stateManager: StateManager;
  private context: vscode.ExtensionContext;
  private outputChannel: vscode.OutputChannel;

  constructor(
    context: vscode.ExtensionContext,
    velocityCalculator: VelocityCalculator,
    stateManager: StateManager,
    outputChannel: vscode.OutputChannel
  ) {
    this.context = context;
    this.velocityCalculator = velocityCalculator;
    this.stateManager = stateManager;
    this.outputChannel = outputChannel;
  }

  /**
   * Open or reveal the analytics panel
   * 
   * If a panel already exists, it will be revealed.
   * Otherwise, a new panel will be created.
   * 
   * @param specs Optional array of spec files for projection calculations
   * 
   * Requirements: 18.2
   */
  public async openAnalytics(specs?: Array<{ totalTasks: number; completedTasks: number }>): Promise<void> {
    this.outputChannel.appendLine(`[${new Date().toISOString()}] Opening analytics panel`);

    if (this.panel) {
      // Panel exists, just reveal it
      this.panel.reveal(vscode.ViewColumn.One);
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Revealed existing analytics panel`);
      
      // Update content with latest metrics
      await this.updateContent(specs);
    } else {
      // Create new panel
      await this.createPanel(specs);
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Created new analytics panel`);
    }
  }

  /**
   * Create the analytics webview panel
   * 
   * Creates a new webview panel in the main editor area with:
   * - Title: "Analytics - Kiro Specs Dashboard"
   * - Position: ViewColumn.One (main editor area)
   * - Options: enableScripts=true, retainContextWhenHidden=true
   * 
   * Sets up:
   * - HTML content
   * - Message handling
   * - Disposal handler
   * - Restores last active tab from workspace state
   * 
   * @param specs Optional array of spec files for projection calculations
   * 
   * Requirements: 18.2, 18.3, 18.4, 23.1, 23.2
   */
  private async createPanel(specs?: Array<{ totalTasks: number; completedTasks: number }>): Promise<void> {
    this.panel = vscode.window.createWebviewPanel(
      'specsAnalytics',
      'Analytics - Kiro Specs Dashboard',
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
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Analytics panel disposed`);
      this.panel = undefined;
    }, undefined, this.context.subscriptions);

    // Send initial metrics data
    await this.updateContent(specs);
    
    // Restore last active tab (Requirements: 23.1, 23.2)
    const activeTab = await this.stateManager.getActiveAnalyticsTab();
    this.outputChannel.appendLine(
      `[${new Date().toISOString()}] Restoring active analytics tab: ${activeTab}`
    );
    
    // Send message to webview to activate the saved tab
    this.panel.webview.postMessage({
      type: 'restoreTab',
      tab: activeTab
    });
  }

  /**
   * Set up message handling for the analytics webview
   * 
   * Handles messages from the webview:
   * - refreshMetrics: Recalculate and send updated metrics
   * - switchTab: Track active tab (for future state persistence)
   * - exportData: Export velocity data (future feature)
   * 
   * Requirements: 18.3, 22.9, 23.1
   */
  private setupMessageHandling(): void {
    if (!this.panel) {
      return;
    }

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        this.outputChannel.appendLine(
          `[${new Date().toISOString()}] Analytics webview message: ${message.type}`
        );

        switch (message.type) {
          case 'refreshMetrics':
            // Recalculate metrics on demand
            this.outputChannel.appendLine(
              `[${new Date().toISOString()}] Refreshing metrics on demand`
            );
            await this.updateContent();
            break;

          case 'switchTab':
            // Track active tab and persist to workspace state
            this.outputChannel.appendLine(
              `[${new Date().toISOString()}] Analytics tab switched to: ${message.tab}`
            );
            // Persist active tab in workspace state (Requirements: 23.1, 23.2)
            await this.stateManager.saveActiveAnalyticsTab(message.tab);
            break;

          case 'exportData':
            // Future feature: Export velocity data to CSV/JSON
            this.outputChannel.appendLine(
              `[${new Date().toISOString()}] Export data requested: ${message.format}`
            );
            await this.handleExportData(message.format);
            break;

          default:
            this.outputChannel.appendLine(
              `[${new Date().toISOString()}] Unknown analytics message type: ${message.type}`
            );
        }
      },
      undefined,
      this.context.subscriptions
    );
  }

  /**
   * Handle export data command
   * 
   * Future feature: Export velocity data to CSV or JSON format
   * 
   * Requirements: 22.9, 23.1
   */
  private async handleExportData(format: 'csv' | 'json'): Promise<void> {
    // Placeholder for future implementation
    vscode.window.showInformationMessage(
      `Export to ${format.toUpperCase()} feature coming soon`
    );
    
    this.outputChannel.appendLine(
      `[${new Date().toISOString()}] Export to ${format} not yet implemented`
    );
  }

  /**
   * Update analytics content with latest metrics
   * 
   * Calculates current velocity metrics and sends them to the webview
   * 
   * @param specs Optional array of spec files for projection calculations
   * 
   * Requirements: 18.3, 22.9
   */
  private async updateContent(specs?: Array<{ totalTasks: number; completedTasks: number }>): Promise<void> {
    if (!this.panel) {
      return;
    }

    try {
      const metrics = await this.velocityCalculator.calculateMetrics(specs);
      
      // Send metricsUpdated message with calculated metrics
      this.panel.webview.postMessage({
        type: 'metricsUpdated',
        metrics: metrics
      });

      this.outputChannel.appendLine(
        `[${new Date().toISOString()}] Sent updated metrics to analytics webview`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[${new Date().toISOString()}] ERROR: Failed to update analytics content: ${errorMessage}`
      );
      
      if (error instanceof Error && error.stack) {
        this.outputChannel.appendLine(`Stack trace: ${error.stack}`);
      }

      // Send error message to webview
      this.panel.webview.postMessage({
        type: 'error',
        message: errorMessage
      });

      vscode.window.showErrorMessage(
        `Failed to load analytics: ${errorMessage}`,
        'Show Output'
      ).then(selection => {
        if (selection === 'Show Output') {
          this.outputChannel.show();
        }
      });
    }
  }

  /**
   * Notify webview that data has been refreshed
   * 
   * This is called when velocity data changes (e.g., task completion)
   * to trigger a refresh in the analytics panel
   * 
   * @param specs Optional array of spec files for projection calculations
   * 
   * Requirements: 18.3, 22.9
   */
  public notifyDataRefreshed(specs?: Array<{ totalTasks: number; completedTasks: number }>): void {
    if (!this.panel) {
      return;
    }

    this.outputChannel.appendLine(
      `[${new Date().toISOString()}] Notifying analytics webview of data refresh`
    );

    // Send dataRefreshed message
    this.panel.webview.postMessage({
      type: 'dataRefreshed'
    });

    // Update content with new metrics
    this.updateContent(specs);
  }

  /**
   * Reinitialize the velocity calculator
   * 
   * Forces the velocity calculator to reload data from workspace state.
   * Useful after clearing velocity data to ensure the calculator has fresh data.
   */
  public async reinitializeVelocityCalculator(): Promise<void> {
    this.outputChannel.appendLine(
      `[${new Date().toISOString()}] Reinitializing velocity calculator`
    );
    await this.velocityCalculator.initialize();
  }

  /**
   * Generate HTML content for the analytics webview
   * 
   * Loads the analytics.html template and replaces placeholders with:
   * - CSP source for secure resource loading
   * - Nonce for inline script execution
   * - URIs for local resources (codicons)
   * 
   * Requirements: 18.3
   */
  private getHtmlContent(webview: vscode.Webview): string {
    const nonce = this.getNonce();

    // Get URIs for resources
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
    );

    const htmlPath = vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'analytics.html');
    
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
        `[${new Date().toISOString()}] ERROR: Failed to load analytics HTML: ${error}`
      );
      
      // Fallback to minimal HTML
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
      <title>Analytics</title>
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
        <h2>Failed to Load Analytics</h2>
        <p>Could not load the analytics HTML template. Please check the extension installation.</p>
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
   * Dispose of the analytics panel
   * 
   * Requirements: 18.4
   */
  public dispose(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }
  }
}
