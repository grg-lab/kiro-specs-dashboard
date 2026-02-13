import * as vscode from 'vscode';
import { SpecsDashboardProvider } from './specsDashboardProvider';
import { generateMockVelocityData } from './mockDataGenerator';
import { migrateVelocityData } from './velocityMigration';
import { ProfileManager } from './profileManager';
import { ExecutionManager } from './executionManager';
import { ExecutionHistory } from './executionHistory';
import { ProfilesPanelManager } from './profilesPanelManager';
import { HistoryPanelManager } from './historyPanelManager';

/**
 * Extension activation function
 * Called when the extension is activated based on activation events
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('Kiro Specs Dashboard extension is now active');

  // Create output channel for execution managers
  const executionOutputChannel = vscode.window.createOutputChannel('Specs Execution');
  context.subscriptions.push(executionOutputChannel);

  // Create the dashboard provider first (it creates StateManager)
  const provider = new SpecsDashboardProvider(context);

  // Initialize execution managers with StateManager from provider
  // Requirements: 1.1, 11.4
  const profileManager = new ProfileManager(executionOutputChannel);
  const executionHistory = new ExecutionHistory(context.workspaceState, executionOutputChannel);
  const executionManager = new ExecutionManager(
    executionOutputChannel,
    profileManager,
    provider.getStateManager()
  );

  // Set execution history reference in execution manager
  // This allows the manager to update history entries with progress
  executionManager.setExecutionHistory(executionHistory);

  // Create panel managers
  // Requirements: 7.1, 7.5, 7.6
  const profilesPanelManager = new ProfilesPanelManager(
    context,
    profileManager,
    executionOutputChannel
  );
  const historyPanelManager = new HistoryPanelManager(
    context,
    executionHistory,
    executionOutputChannel
  );

  // Add panel managers to subscriptions for disposal
  // Requirements: 7.4
  context.subscriptions.push(profilesPanelManager, historyPanelManager);

  // Inject managers into provider
  provider.setExecutionManagers(profileManager, executionManager, executionHistory);
  
  // Inject panel managers into provider
  // Requirements: 7.3
  provider.setProfilesPanelManager(profilesPanelManager);
  provider.setHistoryPanelManager(historyPanelManager);

  // Wire up execution state change callback to notify webview
  // Requirements: 5.1, 5.2, 5.3, 7.1
  executionManager.onStateChanged((specId, state) => {
    provider.notifyExecutionStateChanged(specId, state);
  });

  // Add execution manager to subscriptions for proper disposal
  context.subscriptions.push(executionManager);

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

  // Auto-import Git data on first activation (if enabled)
  const autoImportEnabled = vscode.workspace.getConfiguration('kiroSpecsDashboard').get<boolean>('autoImportGitData', true);
  
  if (autoImportEnabled) {
    // Run auto-import immediately in the background
    (async () => {
      try {
        provider.getOutputChannel().appendLine(`[${new Date().toISOString()}] Auto-import: Starting check...`);
        
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
          provider.getOutputChannel().appendLine(`[${new Date().toISOString()}] Auto-import skipped: No workspace folders`);
          return;
        }

        provider.getOutputChannel().appendLine(`[${new Date().toISOString()}] Auto-import: Found ${workspaceFolders.length} workspace folder(s)`);

        // Directly scan for specs using the scanner (bypasses webview visibility check)
        const scanner = provider.getScanner();
        const specs = await scanner.scanWorkspace();
        
        provider.getOutputChannel().appendLine(`[${new Date().toISOString()}] Auto-import: Found ${specs.length} spec(s)`);
        
        if (specs.length === 0) {
          provider.getOutputChannel().appendLine(`[${new Date().toISOString()}] Auto-import skipped: No specs found`);
          return;
        }

        // Check if velocity data already exists by checking if there are any weekly tasks
        const velocityCalculator = provider.getVelocityCalculator();
        await velocityCalculator.initialize();
        const metrics = velocityCalculator.calculateMetrics(specs);
        const hasExistingData = metrics.tasksPerWeek.some(count => count > 0);
        
        provider.getOutputChannel().appendLine(`[${new Date().toISOString()}] Auto-import: Existing data check - hasData: ${hasExistingData}, tasksPerWeek: [${metrics.tasksPerWeek.join(', ')}]`);
        
        if (hasExistingData) {
          provider.getOutputChannel().appendLine(`[${new Date().toISOString()}] Auto-import skipped: Velocity data already exists`);
          return;
        }

        provider.getOutputChannel().appendLine(`[${new Date().toISOString()}] Auto-import starting: Found ${specs.length} specs, no existing velocity data`);

        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'Importing velocity data from Git history...',
          cancellable: false
        }, async (progress) => {
          try {
            const stats = await migrateVelocityData(
              workspaceFolders,
              provider.getStateManager(),
              provider.getVelocityCalculator(),
              provider.getOutputChannel()
            );
            
            // Reinitialize velocity calculator with migrated data
            await provider.getAnalyticsPanelManager().reinitializeVelocityCalculator();
            
            provider.getOutputChannel().appendLine(`[${new Date().toISOString()}] Auto-import complete: ${stats.tasksProcessed} tasks from ${stats.authors.size} authors`);
            
            // Show success message
            vscode.window.showInformationMessage(
              `Git data imported! Processed ${stats.tasksProcessed} tasks from ${stats.authors.size} team members.`
            );
            
            // Refresh both the dashboard and analytics panel
            await provider.refresh();
            provider.getAnalyticsPanelManager().notifyDataRefreshed(specs);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            provider.getOutputChannel().appendLine(`[${new Date().toISOString()}] Auto-import error: ${errorMessage}`);
            if (error instanceof Error && error.stack) {
              provider.getOutputChannel().appendLine(`[${new Date().toISOString()}] Stack trace: ${error.stack}`);
            }
            // Don't show error to user for auto-import, just log it
          }
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        provider.getOutputChannel().appendLine(`[${new Date().toISOString()}] Auto-import initialization error: ${errorMessage}`);
        if (error instanceof Error && error.stack) {
          provider.getOutputChannel().appendLine(`[${new Date().toISOString()}] Stack trace: ${error.stack}`);
        }
      }
    })();
  } else {
    provider.getOutputChannel().appendLine(`[${new Date().toISOString()}] Auto-import disabled in settings`);
  }

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

  const generateMockDataCommand = vscode.commands.registerCommand(
    'specs-dashboard.generateMockData',
    async () => {
      await generateMockVelocityData(provider.getStateManager());
      // Reinitialize velocity calculator with new data
      await provider.getAnalyticsPanelManager().reinitializeVelocityCalculator();
      vscode.window.showInformationMessage('Mock velocity data generated successfully.');
      // Refresh both the dashboard and analytics panel
      await provider.refresh();
      // Force analytics panel to recalculate with new velocity data
      provider.getAnalyticsPanelManager().notifyDataRefreshed(provider.getSpecs());
    }
  );

  const clearVelocityDataCommand = vscode.commands.registerCommand(
    'specs-dashboard.clearVelocityData',
    async () => {
      const answer = await vscode.window.showWarningMessage(
        'Are you sure you want to clear all velocity data? This action cannot be undone.',
        'Clear Data',
        'Cancel'
      );
      
      if (answer === 'Clear Data') {
        await provider.getStateManager().clearVelocityData();
        // Reinitialize velocity calculator with empty data
        await provider.getAnalyticsPanelManager().reinitializeVelocityCalculator();
        vscode.window.showInformationMessage('Velocity data cleared successfully.');
        // Refresh both the dashboard and analytics panel
        await provider.refresh();
        // Force analytics panel to recalculate with empty velocity data
        provider.getAnalyticsPanelManager().notifyDataRefreshed(provider.getSpecs());
      }
    }
  );

  const migrateVelocityDataCommand = vscode.commands.registerCommand(
    'specs-dashboard.migrateVelocityData',
    async () => {
      const answer = await vscode.window.showInformationMessage(
        'This will scan your Git history to import existing task completions. This may take a few minutes. Continue?',
        'Migrate Data',
        'Cancel'
      );
      
      if (answer === 'Migrate Data') {
        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'Migrating velocity data from Git history...',
          cancellable: false
        }, async (progress) => {
          try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
              vscode.window.showErrorMessage('No workspace folder open');
              return;
            }
            
            const stats = await migrateVelocityData(
              workspaceFolders,
              provider.getStateManager(),
              provider.getVelocityCalculator(),
              provider.getOutputChannel()
            );
            
            // Reinitialize velocity calculator with migrated data
            await provider.getAnalyticsPanelManager().reinitializeVelocityCalculator();
            
            vscode.window.showInformationMessage(
              `Migration complete! Processed ${stats.tasksProcessed} tasks from ${stats.authors.size} team members.`
            );
            
            // Refresh both the dashboard and analytics panel
            await provider.refresh();
            provider.getAnalyticsPanelManager().notifyDataRefreshed(provider.getSpecs());
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Migration failed: ${errorMessage}`);
            provider.getOutputChannel().appendLine(`[${new Date().toISOString()}] Migration error: ${errorMessage}`);
          }
        });
      }
    }
  );

  // Register panel manager commands
  // Requirements: 8.1, 8.2, 8.3, 8.4
  const openProfilesCommand = vscode.commands.registerCommand(
    'specs-dashboard.openProfiles',
    async () => {
      await profilesPanelManager.openProfiles();
    }
  );

  const openAnalyticsCommand = vscode.commands.registerCommand(
    'specs-dashboard.openAnalytics',
    async () => {
      await provider.getAnalyticsPanelManager().openAnalytics(provider.getSpecs());
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
   * Also detects task changes and records velocity data
   * 
   * Requirements: 3.1, 13.1 (debouncing for performance), 19.2 (velocity tracking)
   */
  const debouncedRefresh = (uri?: vscode.Uri) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    debounceTimer = setTimeout(() => {
      provider.refresh(uri);
      debounceTimer = undefined;
    }, DEBOUNCE_DELAY_MS);
  };

  watcher.onDidChange((uri) => debouncedRefresh(uri));
  watcher.onDidCreate((uri) => debouncedRefresh(uri));
  watcher.onDidDelete((uri) => debouncedRefresh(uri));

  // Set up file system watcher for execution profiles
  // Requirements: 11.4 (detect external changes to profiles file)
  const profilesWatcher = vscode.workspace.createFileSystemWatcher(
    '**/.kiro/execution-profiles.json'
  );

  /**
   * Handle external changes to execution profiles file
   * Notifies the dashboard provider to reload profiles
   */
  const handleProfilesChange = (uri: vscode.Uri) => {
    executionOutputChannel.appendLine(
      `[${new Date().toISOString()}] Execution profiles file changed: ${uri.fsPath}`
    );
    // Notify provider to reload profiles
    provider.onProfilesFileChanged(uri);
  };

  profilesWatcher.onDidChange(handleProfilesChange);
  profilesWatcher.onDidCreate(handleProfilesChange);
  profilesWatcher.onDidDelete(handleProfilesChange);

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
    generateMockDataCommand,
    clearVelocityDataCommand,
    migrateVelocityDataCommand,
    openProfilesCommand,
    openAnalyticsCommand,
    watcher,
    profilesWatcher,
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
 * - Commands (showDashboardCommand, refreshCommand, generateMockDataCommand, etc.)
 * - File system watchers
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
