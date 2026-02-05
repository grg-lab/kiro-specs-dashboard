/**
 * Unit tests for AnalyticsPanelManager
 * 
 * Tests analytics UI and interactions:
 * - Panel creation and lifecycle
 * - Message handling (refreshMetrics, switchTab, exportData)
 * - HTML content generation
 * - Tab restoration
 * - Error handling
 * 
 * Requirements: 18.2, 18.3, 18.4, 20.1-20.12, 22.1-22.10, 23.1, 23.2
 */

import { AnalyticsPanelManager } from './analyticsPanelManager';
import { VelocityCalculator } from './velocityCalculator';
import { StateManager } from './stateManager';
import * as vscode from 'vscode';

// Mock VSCode API
class MockWebviewPanel {
  public webview: MockWebview;
  public viewColumn: vscode.ViewColumn;
  public visible: boolean = true;
  private disposeCallback?: () => void;

  constructor() {
    this.webview = new MockWebview();
    this.viewColumn = vscode.ViewColumn.One;
  }

  reveal(viewColumn?: vscode.ViewColumn): void {
    this.visible = true;
    if (viewColumn) {
      this.viewColumn = viewColumn;
    }
  }

  dispose(): void {
    this.visible = false;
    if (this.disposeCallback) {
      this.disposeCallback();
    }
  }

  onDidDispose(callback: () => void): vscode.Disposable {
    this.disposeCallback = callback;
    return { dispose: () => {} };
  }
}

class MockWebview {
  public html: string = '';
  public cspSource: string = 'vscode-webview://';
  private messageHandlers: Array<(message: any) => void> = [];
  public sentMessages: any[] = [];

  asWebviewUri(uri: vscode.Uri): vscode.Uri {
    return uri;
  }

  postMessage(message: any): Thenable<boolean> {
    this.sentMessages.push(message);
    return Promise.resolve(true);
  }

  onDidReceiveMessage(handler: (message: any) => void): vscode.Disposable {
    this.messageHandlers.push(handler);
    return { dispose: () => {} };
  }

  // Test helper to simulate receiving a message
  simulateMessage(message: any): void {
    this.messageHandlers.forEach(handler => handler(message));
  }
}

class MockOutputChannel {
  private lines: string[] = [];

  appendLine(value: string): void {
    this.lines.push(value);
  }

  show(): void {
    // No-op for tests
  }

  getLines(): string[] {
    return this.lines;
  }
}

class MockExtensionContext {
  public subscriptions: vscode.Disposable[] = [];
  public extensionUri: vscode.Uri = vscode.Uri.file('/test/extension');
}

class MockStateManager {
  private activeTab: string = 'velocity';
  private velocityData: any = null;

  async getActiveAnalyticsTab(): Promise<string> {
    return this.activeTab;
  }

  async saveActiveAnalyticsTab(tab: string): Promise<void> {
    this.activeTab = tab;
  }

  async getVelocityData(): Promise<any> {
    return this.velocityData;
  }

  async saveVelocityData(data: any): Promise<void> {
    this.velocityData = data;
  }
}

// Mock vscode.window.createWebviewPanel
let mockPanel: MockWebviewPanel | null = null;
const originalCreateWebviewPanel = vscode.window.createWebviewPanel;

beforeAll(() => {
  (vscode.window as any).createWebviewPanel = (
    viewType: string,
    title: string,
    showOptions: any,
    options?: any
  ): vscode.WebviewPanel => {
    mockPanel = new MockWebviewPanel();
    return mockPanel as any;
  };
});

afterAll(() => {
  (vscode.window as any).createWebviewPanel = originalCreateWebviewPanel;
});

describe('AnalyticsPanelManager - Panel Creation', () => {
  let manager: AnalyticsPanelManager;
  let mockContext: MockExtensionContext;
  let mockStateManager: MockStateManager;
  let mockCalculator: VelocityCalculator;
  let mockOutputChannel: MockOutputChannel;

  beforeEach(() => {
    mockContext = new MockExtensionContext();
    mockStateManager = new MockStateManager();
    mockCalculator = new VelocityCalculator(mockStateManager as any);
    mockOutputChannel = new MockOutputChannel();
    mockPanel = null;

    manager = new AnalyticsPanelManager(
      mockContext as any,
      mockCalculator,
      mockStateManager as any,
      mockOutputChannel as any
    );
  });

  test('should create panel on first open', async () => {
    await manager.openAnalytics();

    expect(mockPanel).not.toBeNull();
    expect(mockPanel!.visible).toBe(true);
    expect(mockPanel!.viewColumn).toBe(vscode.ViewColumn.One);
  });

  test('should reveal existing panel on subsequent opens', async () => {
    await manager.openAnalytics();
    const firstPanel = mockPanel;

    await manager.openAnalytics();

    expect(mockPanel).toBe(firstPanel); // Same panel instance
    expect(mockPanel!.visible).toBe(true);
  });

  test('should set HTML content on panel creation', async () => {
    await manager.openAnalytics();

    expect(mockPanel!.webview.html).not.toBe('');
    expect(mockPanel!.webview.html).toContain('<!DOCTYPE html>');
  });

  test('should send initial metrics on panel creation', async () => {
    await manager.openAnalytics();

    const messages = mockPanel!.webview.sentMessages;
    const metricsMessage = messages.find(m => m.type === 'metricsUpdated');

    expect(metricsMessage).toBeDefined();
    expect(metricsMessage.metrics).toBeDefined();
  });

  test('should restore last active tab on panel creation', async () => {
    await mockStateManager.saveActiveAnalyticsTab('forecasts');

    await manager.openAnalytics();

    const messages = mockPanel!.webview.sentMessages;
    const restoreMessage = messages.find(m => m.type === 'restoreTab');

    expect(restoreMessage).toBeDefined();
    expect(restoreMessage.tab).toBe('forecasts');
  });
});

describe('AnalyticsPanelManager - Message Handling', () => {
  let manager: AnalyticsPanelManager;
  let mockContext: MockExtensionContext;
  let mockStateManager: MockStateManager;
  let mockCalculator: VelocityCalculator;
  let mockOutputChannel: MockOutputChannel;

  beforeEach(async () => {
    mockContext = new MockExtensionContext();
    mockStateManager = new MockStateManager();
    mockCalculator = new VelocityCalculator(mockStateManager as any);
    mockOutputChannel = new MockOutputChannel();
    mockPanel = null;

    manager = new AnalyticsPanelManager(
      mockContext as any,
      mockCalculator,
      mockStateManager as any,
      mockOutputChannel as any
    );

    await manager.openAnalytics();
  });

  test('should handle refreshMetrics message', async () => {
    mockPanel!.webview.sentMessages = []; // Clear initial messages

    mockPanel!.webview.simulateMessage({ type: 'refreshMetrics' });

    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 10));

    const messages = mockPanel!.webview.sentMessages;
    const metricsMessage = messages.find(m => m.type === 'metricsUpdated');

    expect(metricsMessage).toBeDefined();
  });

  test('should handle switchTab message and persist tab', async () => {
    mockPanel!.webview.simulateMessage({ type: 'switchTab', tab: 'timeline' });

    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 10));

    const savedTab = await mockStateManager.getActiveAnalyticsTab();
    expect(savedTab).toBe('timeline');
  });

  test('should handle exportData message', async () => {
    // Mock showInformationMessage
    const originalShowInfo = vscode.window.showInformationMessage;
    let shownMessage = '';
    (vscode.window as any).showInformationMessage = (message: string) => {
      shownMessage = message;
      return Promise.resolve(undefined);
    };

    mockPanel!.webview.simulateMessage({ type: 'exportData', format: 'csv' });

    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(shownMessage).toContain('CSV');

    // Restore original
    (vscode.window as any).showInformationMessage = originalShowInfo;
  });

  test('should log unknown message types', async () => {
    mockPanel!.webview.simulateMessage({ type: 'unknownType' });

    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 10));

    const logs = mockOutputChannel.getLines();
    const unknownLog = logs.find(line => line.includes('Unknown analytics message type'));

    expect(unknownLog).toBeDefined();
  });
});

describe('AnalyticsPanelManager - Data Refresh', () => {
  let manager: AnalyticsPanelManager;
  let mockContext: MockExtensionContext;
  let mockStateManager: MockStateManager;
  let mockCalculator: VelocityCalculator;
  let mockOutputChannel: MockOutputChannel;

  beforeEach(async () => {
    mockContext = new MockExtensionContext();
    mockStateManager = new MockStateManager();
    mockCalculator = new VelocityCalculator(mockStateManager as any);
    mockOutputChannel = new MockOutputChannel();
    mockPanel = null;

    manager = new AnalyticsPanelManager(
      mockContext as any,
      mockCalculator,
      mockStateManager as any,
      mockOutputChannel as any
    );

    await manager.openAnalytics();
  });

  test('should notify webview on data refresh', () => {
    mockPanel!.webview.sentMessages = []; // Clear initial messages

    manager.notifyDataRefreshed();

    const messages = mockPanel!.webview.sentMessages;
    const refreshMessage = messages.find(m => m.type === 'dataRefreshed');

    expect(refreshMessage).toBeDefined();
  });

  test('should send updated metrics on data refresh', async () => {
    mockPanel!.webview.sentMessages = []; // Clear initial messages

    manager.notifyDataRefreshed();

    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 10));

    const messages = mockPanel!.webview.sentMessages;
    const metricsMessage = messages.find(m => m.type === 'metricsUpdated');

    expect(metricsMessage).toBeDefined();
    expect(metricsMessage.metrics).toBeDefined();
  });

  test('should not crash if panel is not open', () => {
    manager.dispose();

    expect(() => {
      manager.notifyDataRefreshed();
    }).not.toThrow();
  });
});

describe('AnalyticsPanelManager - Panel Lifecycle', () => {
  let manager: AnalyticsPanelManager;
  let mockContext: MockExtensionContext;
  let mockStateManager: MockStateManager;
  let mockCalculator: VelocityCalculator;
  let mockOutputChannel: MockOutputChannel;

  beforeEach(() => {
    mockContext = new MockExtensionContext();
    mockStateManager = new MockStateManager();
    mockCalculator = new VelocityCalculator(mockStateManager as any);
    mockOutputChannel = new MockOutputChannel();
    mockPanel = null;

    manager = new AnalyticsPanelManager(
      mockContext as any,
      mockCalculator,
      mockStateManager as any,
      mockOutputChannel as any
    );
  });

  test('should dispose panel correctly', async () => {
    await manager.openAnalytics();

    expect(mockPanel).not.toBeNull();

    manager.dispose();

    expect(mockPanel!.visible).toBe(false);
  });

  test('should handle panel disposal by user', async () => {
    await manager.openAnalytics();

    mockPanel!.dispose();

    // Panel should be cleaned up
    expect(mockPanel!.visible).toBe(false);
  });

  test('should create new panel after disposal', async () => {
    await manager.openAnalytics();
    const firstPanel = mockPanel;

    manager.dispose();

    await manager.openAnalytics();

    expect(mockPanel).not.toBe(firstPanel); // New panel instance
    expect(mockPanel!.visible).toBe(true);
  });
});

describe('AnalyticsPanelManager - HTML Content', () => {
  let manager: AnalyticsPanelManager;
  let mockContext: MockExtensionContext;
  let mockStateManager: MockStateManager;
  let mockCalculator: VelocityCalculator;
  let mockOutputChannel: MockOutputChannel;

  beforeEach(() => {
    mockContext = new MockExtensionContext();
    mockStateManager = new MockStateManager();
    mockCalculator = new VelocityCalculator(mockStateManager as any);
    mockOutputChannel = new MockOutputChannel();
    mockPanel = null;

    manager = new AnalyticsPanelManager(
      mockContext as any,
      mockCalculator,
      mockStateManager as any,
      mockOutputChannel as any
    );
  });

  test('should include CSP in HTML', async () => {
    await manager.openAnalytics();

    const html = mockPanel!.webview.html;
    expect(html).toContain('Content-Security-Policy');
  });

  test('should include nonce in HTML', async () => {
    await manager.openAnalytics();

    const html = mockPanel!.webview.html;
    expect(html).toMatch(/nonce="[a-zA-Z0-9]+"/);
  });

  test('should use VSCode CSS variables', async () => {
    await manager.openAnalytics();

    const html = mockPanel!.webview.html;
    expect(html).toContain('--vscode-');
  });

  test('should include codicons reference', async () => {
    await manager.openAnalytics();

    const html = mockPanel!.webview.html;
    expect(html).toContain('codicon');
  });
});

describe('AnalyticsPanelManager - Error Handling', () => {
  let manager: AnalyticsPanelManager;
  let mockContext: MockExtensionContext;
  let mockStateManager: MockStateManager;
  let mockCalculator: VelocityCalculator;
  let mockOutputChannel: MockOutputChannel;

  beforeEach(() => {
    mockContext = new MockExtensionContext();
    mockStateManager = new MockStateManager();
    mockCalculator = new VelocityCalculator(mockStateManager as any);
    mockOutputChannel = new MockOutputChannel();
    mockPanel = null;

    manager = new AnalyticsPanelManager(
      mockContext as any,
      mockCalculator,
      mockStateManager as any,
      mockOutputChannel as any
    );
  });

  test('should handle metrics calculation errors gracefully', async () => {
    // Mock calculateMetrics to throw error
    const originalCalculateMetrics = mockCalculator.calculateMetrics;
    mockCalculator.calculateMetrics = () => {
      throw new Error('Test error');
    };

    // Mock showErrorMessage
    const originalShowError = vscode.window.showErrorMessage;
    let errorShown = false;
    (vscode.window as any).showErrorMessage = () => {
      errorShown = true;
      return Promise.resolve(undefined);
    };

    await manager.openAnalytics();

    expect(errorShown).toBe(true);

    // Restore originals
    mockCalculator.calculateMetrics = originalCalculateMetrics;
    (vscode.window as any).showErrorMessage = originalShowError;
  });

  test('should log errors to output channel', async () => {
    // Mock calculateMetrics to throw error
    const originalCalculateMetrics = mockCalculator.calculateMetrics;
    mockCalculator.calculateMetrics = () => {
      throw new Error('Test error');
    };

    // Mock showErrorMessage
    const originalShowError = vscode.window.showErrorMessage;
    (vscode.window as any).showErrorMessage = () => Promise.resolve(undefined);

    await manager.openAnalytics();

    const logs = mockOutputChannel.getLines();
    const errorLog = logs.find(line => line.includes('ERROR'));

    expect(errorLog).toBeDefined();

    // Restore originals
    mockCalculator.calculateMetrics = originalCalculateMetrics;
    (vscode.window as any).showErrorMessage = originalShowError;
  });
});
