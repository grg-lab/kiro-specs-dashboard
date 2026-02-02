import * as vscode from 'vscode';
import { SpecsDashboardProvider } from './specsDashboardProvider';

/**
 * Extension activation function
 * Called when the extension is activated based on activation events
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('Kiro Specs Dashboard extension is now active');

  // Create the dashboard provider
  const provider = new SpecsDashboardProvider(context);

  // Register the webview view provider
  const providerRegistration = vscode.window.registerWebviewViewProvider(
    'specs-dashboard.view',
    provider,
    {
      webviewOptions: {
        retainContextWhenHidden: true
      }
    }
  );

  // Add provider and its registration to subscriptions for proper disposal
  // Requirements: 13.4 (resource disposal on deactivation)
  context.subscriptions.push(
    providerRegistration,
    provider
  );

  // Register commands
  const showDashboardCommand = vscode.commands.registerCommand(
    'specs-dashboard.show',
    () => {
      // The view will be shown automatically when the command is invoked
      vscode.commands.executeCommand('specs-dashboard.view.focus');
    }
  );

  const refreshCommand = vscode.commands.registerCommand(
    'specs-dashboard.refresh',
    () => {
      provider.refresh();
    }
  );

  const openFileCommand = vscode.commands.registerCommand(
    'specs-dashboard.openFile',
    async (filePath: string) => {
      if (filePath) {
        const uri = vscode.Uri.file(filePath);
        await vscode.window.showTextDocument(uri);
      }
    }
  );

  const openNotesCommand = vscode.commands.registerCommand(
    'specs-dashboard.openNotes',
    async (specName: string) => {
      if (specName) {
        await provider.openNotesPanel(specName);
      }
    }
  );

  // Set up file system watcher for spec files with debouncing
  const watcher = vscode.workspace.createFileSystemWatcher(
    '**/.kiro/specs/**/*.md'
  );

  // Debounce timer to avoid excessive re-parsing during rapid file changes
  let debounceTimer: NodeJS.Timeout | undefined;
  const DEBOUNCE_DELAY_MS = 300; // Wait 300ms after last change before refreshing

  /**
   * Debounced refresh function
   * Delays the refresh until no file changes have occurred for DEBOUNCE_DELAY_MS
   * This prevents excessive re-parsing when multiple files are saved rapidly
   * 
   * Requirements: 3.1, 13.1 (debouncing for performance)
   */
  const debouncedRefresh = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    debounceTimer = setTimeout(() => {
      provider.refresh();
      debounceTimer = undefined;
    }, DEBOUNCE_DELAY_MS);
  };

  watcher.onDidChange(debouncedRefresh);
  watcher.onDidCreate(debouncedRefresh);
  watcher.onDidDelete(debouncedRefresh);

  // Handle workspace folder changes for multi-root workspace support
  // Requirements: 12.2, 12.3 (clean up watchers and state when workspaces are removed)
  const workspaceFoldersChangeListener = vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
    console.log('Workspace folders changed:', {
      added: event.added.length,
      removed: event.removed.length
    });

    // Clean up state for removed workspace folders
    for (const folder of event.removed) {
      console.log(`Cleaning up state for removed workspace folder: ${folder.name}`);
      await provider.cleanupWorkspaceFolder(folder.name);
    }

    // Refresh the dashboard to reflect the new workspace structure
    if (event.added.length > 0 || event.removed.length > 0) {
      provider.refresh();
    }
  });

  // Add all disposables to subscriptions
  context.subscriptions.push(
    showDashboardCommand,
    refreshCommand,
    openFileCommand,
    openNotesCommand,
    watcher,
    workspaceFoldersChangeListener,
    // Dispose of debounce timer on deactivation
    new vscode.Disposable(() => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = undefined;
      }
    })
  );
}

/**
 * Extension deactivation function
 * Called when the extension is deactivated
 * 
 * All resources are automatically disposed via the context.subscriptions array:
 * - Commands (showDashboardCommand, refreshCommand, openFileCommand)
 * - File system watcher
 * - Workspace folders change listener
 * - Debounce timer disposable
 * - Webview provider registration
 * - Dashboard provider (which disposes output channels and scanner)
 * 
 * Requirements: 13.4
 */
export function deactivate(): void {
  // Cleanup is handled automatically by disposing subscriptions
  console.log('Kiro Specs Dashboard extension is now deactivated');
  console.log('All resources have been disposed via context.subscriptions');
}
