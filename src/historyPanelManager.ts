import * as vscode from 'vscode';
import { ExecutionHistory } from './executionHistory';
import { 
  HistoryWebviewMessage, 
  HistoryExtensionMessage, 
  ExecutionHistoryEntry,
  HistoryFilter,
  ExecutionStatistics
} from './types';

/**
 * Manages the History webview panel
 * 
 * Handles:
 * - Creating and revealing the history panel in the main editor area
 * - Managing panel lifecycle (creation, disposal, visibility)
 * - Handling messages from the history webview
 * - Delegating history operations to ExecutionHistory
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.1-6.6, 7.6, 12.2
 */
export class HistoryPanelManager {
  private panel: vscode.WebviewPanel | undefined;
  private executionHistory: ExecutionHistory;
  private context: vscode.ExtensionContext;
  private outputChannel: vscode.OutputChannel;

  constructor(
    context: vscode.ExtensionContext,
    executionHistory: ExecutionHistory,
    outputChannel: vscode.OutputChannel
  ) {
    this.context = context;
    this.executionHistory = executionHistory;
    this.outputChannel = outputChannel;
  }

  /**
   * Open or reveal the history panel
   * 
   * If a panel already exists, it will be revealed.
   * Otherwise, a new panel will be created.
   * 
   * Requirements: 2.1, 2.4
   */
  public async openHistory(): Promise<void> {
    this.outputChannel.appendLine(`[${new Date().toISOString()}] Opening history panel`);

    if (this.panel) {
      // Panel exists, just reveal it
      this.panel.reveal(vscode.ViewColumn.One);
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Revealed existing history panel`);
    } else {
      // Create new panel
      await this.createPanel();
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Created new history panel`);
    }
  }

  /**
   * Create the history webview panel
   * 
   * Creates a new webview panel in the main editor area with:
   * - Title: "Execution History - Kiro Specs Dashboard"
   * - Position: ViewColumn.One (main editor area)
   * - Options: enableScripts=true, retainContextWhenHidden=true
   * 
   * Requirements: 2.1, 2.2, 2.3, 9.1-9.5
   */
  private async createPanel(): Promise<void> {
    this.panel = vscode.window.createWebviewPanel(
      'specsHistory',
      'Execution History - Kiro Specs Dashboard',
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
      this.outputChannel.appendLine(`[${new Date().toISOString()}] History panel disposed`);
      this.panel = undefined;
    }, undefined, this.context.subscriptions);
  }

  /**
   * Set up message handling for the history webview
   * 
   * Handles messages:
   * - loadHistory: Load all history entries
   * - filterHistory: Filter history by criteria
   * - getStatistics: Get execution statistics
   * - clearHistory: Clear all history
   * 
   * Requirements: 6.1-6.6, 12.2
   */
  private setupMessageHandling(): void {
    if (!this.panel) {
      return;
    }

    this.panel.webview.onDidReceiveMessage(
      async (message: HistoryWebviewMessage) => {
        this.outputChannel.appendLine(
          `[${new Date().toISOString()}] History webview message: ${message.type}`
        );

        switch (message.type) {
          case 'loadHistory':
            await this.handleLoadHistory();
            break;

          case 'filterHistory':
            await this.handleFilterHistory(message.filter);
            break;

          case 'getStatistics':
            await this.handleGetStatistics();
            break;

          case 'clearHistory':
            await this.handleClearHistory();
            break;

          default:
            this.outputChannel.appendLine(
              `[${new Date().toISOString()}] Unknown history message type`
            );
        }
      },
      undefined,
      this.context.subscriptions
    );
  }

  /**
   * Handle loadHistory message
   * Loads all history entries sorted by date
   * 
   * Requirements: 6.1, 6.5, 12.2
   */
  private async handleLoadHistory(): Promise<void> {
    try {
      const entries = await this.executionHistory.getAllEntries();
      
      this.sendMessage({
        type: 'historyLoaded',
        entries: entries
      });

      this.outputChannel.appendLine(
        `[${new Date().toISOString()}] Loaded ${entries.length} history entries`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[${new Date().toISOString()}] ERROR: Failed to load history: ${errorMessage}`
      );
      
      if (error instanceof Error && error.stack) {
        this.outputChannel.appendLine(`Stack trace: ${error.stack}`);
      }

      this.sendMessage({
        type: 'error',
        message: 'Failed to load execution history',
        details: errorMessage
      });
    }
  }

  /**
   * Handle filterHistory message
   * Filters history entries by criteria
   * 
   * Requirements: 6.2, 6.5, 12.2
   */
  private async handleFilterHistory(filter: HistoryFilter): Promise<void> {
    try {
      const entries = await this.executionHistory.queryEntries(filter);
      
      this.sendMessage({
        type: 'historyFiltered',
        entries: entries
      });

      this.outputChannel.appendLine(
        `[${new Date().toISOString()}] Filtered history: ${entries.length} entries match criteria`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[${new Date().toISOString()}] ERROR: Failed to filter history: ${errorMessage}`
      );
      
      if (error instanceof Error && error.stack) {
        this.outputChannel.appendLine(`Stack trace: ${error.stack}`);
      }

      this.sendMessage({
        type: 'error',
        message: 'Failed to filter execution history',
        details: errorMessage
      });
    }
  }

  /**
   * Handle getStatistics message
   * Calculates and returns execution statistics
   * 
   * Requirements: 6.3, 6.5, 12.2
   */
  private async handleGetStatistics(): Promise<void> {
    try {
      const statistics = await this.executionHistory.getStatistics();
      
      this.sendMessage({
        type: 'statisticsLoaded',
        statistics: statistics
      });

      this.outputChannel.appendLine(
        `[${new Date().toISOString()}] Loaded execution statistics: ${statistics.totalExecutions} total executions`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[${new Date().toISOString()}] ERROR: Failed to get statistics: ${errorMessage}`
      );
      
      if (error instanceof Error && error.stack) {
        this.outputChannel.appendLine(`Stack trace: ${error.stack}`);
      }

      this.sendMessage({
        type: 'error',
        message: 'Failed to calculate execution statistics',
        details: errorMessage
      });
    }
  }

  /**
   * Handle clearHistory message
   * Clears all history entries
   * 
   * Requirements: 6.4, 6.5, 6.6, 11.3, 12.2
   */
  private async handleClearHistory(): Promise<void> {
    try {
      await this.executionHistory.clearHistory();
      
      this.sendMessage({
        type: 'historyCleared'
      });

      this.outputChannel.appendLine(
        `[${new Date().toISOString()}] Cleared all execution history`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[${new Date().toISOString()}] ERROR: Failed to clear history: ${errorMessage}`
      );
      
      if (error instanceof Error && error.stack) {
        this.outputChannel.appendLine(`Stack trace: ${error.stack}`);
      }

      this.sendMessage({
        type: 'error',
        message: 'Failed to clear execution history',
        details: errorMessage
      });
    }
  }

  /**
   * Send a message to the webview
   */
  private sendMessage(message: HistoryExtensionMessage): void {
    if (this.panel) {
      this.panel.webview.postMessage(message);
    }
  }

  /**
   * Generate HTML content for the history webview
   * 
   * Loads the history.html template and replaces placeholders
   * 
   * Requirements: 2.3, 9.1-9.5, 10.1-10.5
   */
  private getHtmlContent(webview: vscode.Webview): string {
    const nonce = this.getNonce();

    // Get URIs for resources
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
    );

    const htmlPath = vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'history.html');
    
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
        `[${new Date().toISOString()}] ERROR: Failed to load history HTML: ${error}`
      );
      
      // Fallback to minimal HTML
      return this.getFallbackHtml(webview, nonce, codiconsUri);
    }
  }

  /**
   * Generate fallback HTML when history.html cannot be loaded
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
  <title>Execution History</title>
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
    <h2>Failed to Load History Panel</h2>
    <p>Could not load the history HTML template. Please check the extension installation.</p>
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
   * Dispose of the history panel
   * 
   * Requirements: 2.5
   */
  public dispose(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }
  }
}
