/**
 * Unit tests for ExecutionManager
 * 
 * Requirements: 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 7.2
 */

import { ExecutionManager } from './executionManager';
import { ProfileManager } from './profileManager';
import { StateManager } from './stateManager';
import { ExecutionState, SpecFile, ExecutionProfile } from './types';
import * as vscode from 'vscode';

// Mock vscode module
jest.mock('vscode', () => ({
  commands: {
    getCommands: jest.fn(),
    executeCommand: jest.fn()
  },
  window: {
    showErrorMessage: jest.fn().mockResolvedValue(undefined),
    showInformationMessage: jest.fn().mockResolvedValue(undefined),
    showWarningMessage: jest.fn().mockResolvedValue(undefined)
  },
  workspace: {
    createFileSystemWatcher: jest.fn(() => ({
      onDidChange: jest.fn(),
      dispose: jest.fn()
    })),
    fs: {
      readFile: jest.fn()
    }
  }
}));

describe('ExecutionManager', () => {
  let executionManager: ExecutionManager;
  let mockOutputChannel: vscode.OutputChannel;
  let mockProfileManager: jest.Mocked<ProfileManager>;
  let mockStateManager: jest.Mocked<StateManager>;

  beforeEach(() => {
    // Create mock output channel
    mockOutputChannel = {
      appendLine: jest.fn(),
      append: jest.fn(),
      clear: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
      name: 'Test',
      replace: jest.fn()
    } as any;

    // Create mock ProfileManager
    mockProfileManager = {
      getProfile: jest.fn(),
      instantiateTemplate: jest.fn(),
      loadProfiles: jest.fn(),
      createProfile: jest.fn(),
      updateProfile: jest.fn(),
      deleteProfile: jest.fn(),
      resetBuiltInProfile: jest.fn(),
      validateProfile: jest.fn(),
      getBuiltInProfiles: jest.fn()
    } as any;

    // Create mock StateManager
    mockStateManager = {
      getExecutionStates: jest.fn().mockResolvedValue({}),
      saveExecutionStates: jest.fn().mockResolvedValue(undefined),
      getDashboardState: jest.fn(),
      saveDashboardState: jest.fn(),
      getVelocityData: jest.fn(),
      saveVelocityData: jest.fn()
    } as any;

    // Create ExecutionManager instance
    executionManager = new ExecutionManager(
      mockOutputChannel,
      mockProfileManager,
      mockStateManager
    );
  });

  describe('executeSpec', () => {
    it('should execute a spec with a valid profile', async () => {
      // Arrange
      const spec: SpecFile = {
        name: 'test-spec',
        path: '/path/to/spec',
        totalTasks: 10,
        completedTasks: 5,
        optionalTasks: 2,
        progress: 50,
        workspaceFolder: 'test-workspace'
      };

      const profile: ExecutionProfile = {
        id: 'mvp',
        name: 'MVP',
        icon: 'rocket',
        promptTemplate: 'Execute {{specName}}',
        isBuiltIn: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const workspaceFolder = {
        uri: { fsPath: '/workspace' },
        name: 'test-workspace',
        index: 0
      } as vscode.WorkspaceFolder;

      mockProfileManager.getProfile.mockResolvedValue(profile);
      mockProfileManager.instantiateTemplate.mockReturnValue('Execute test-spec');

      // Mock vscode.commands
      (vscode.commands.getCommands as jest.Mock).mockResolvedValue(['kiro.sendMessage']);
      (vscode.commands.executeCommand as jest.Mock).mockResolvedValue(undefined);

      // Act
      const result = await executionManager.executeSpec(spec, 'mvp', workspaceFolder);

      // Assert
      expect(result.success).toBe(true);
      expect(result.executionId).toBeDefined();
      expect(mockProfileManager.getProfile).toHaveBeenCalledWith('mvp', workspaceFolder);
      expect(mockProfileManager.instantiateTemplate).toHaveBeenCalledWith(profile, spec);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('kiro.sendMessage', 'Execute test-spec');
    });

    it('should fail if profile not found', async () => {
      // Arrange
      const spec: SpecFile = {
        name: 'test-spec',
        path: '/path/to/spec',
        totalTasks: 10,
        completedTasks: 5,
        optionalTasks: 2,
        progress: 50
      };

      const workspaceFolder = {
        uri: { fsPath: '/workspace' },
        name: 'test-workspace',
        index: 0
      } as vscode.WorkspaceFolder;

      mockProfileManager.getProfile.mockResolvedValue(undefined);

      // Act
      const result = await executionManager.executeSpec(spec, 'nonexistent', workspaceFolder);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Profile "nonexistent" not found');
    });

    it('should fail if Kiro command is not available', async () => {
      // Arrange
      const spec: SpecFile = {
        name: 'test-spec',
        path: '/path/to/spec',
        totalTasks: 10,
        completedTasks: 5,
        optionalTasks: 2,
        progress: 50
      };

      const profile: ExecutionProfile = {
        id: 'mvp',
        name: 'MVP',
        icon: 'rocket',
        promptTemplate: 'Execute {{specName}}',
        isBuiltIn: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const workspaceFolder = {
        uri: { fsPath: '/workspace' },
        name: 'test-workspace',
        index: 0
      } as vscode.WorkspaceFolder;

      mockProfileManager.getProfile.mockResolvedValue(profile);
      (vscode.commands.getCommands as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await executionManager.executeSpec(spec, 'mvp', workspaceFolder);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Kiro chat interface is not available');
    });
  });

  describe('cancelExecution', () => {
    it('should cancel a running execution', async () => {
      // Arrange
      const spec: SpecFile = {
        name: 'test-spec',
        path: '/path/to/spec',
        totalTasks: 10,
        completedTasks: 5,
        optionalTasks: 2,
        progress: 50
      };

      const profile: ExecutionProfile = {
        id: 'mvp',
        name: 'MVP',
        icon: 'rocket',
        promptTemplate: 'Execute {{specName}}',
        isBuiltIn: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const workspaceFolder = {
        uri: { fsPath: '/workspace' },
        name: 'test-workspace',
        index: 0
      } as vscode.WorkspaceFolder;

      mockProfileManager.getProfile.mockResolvedValue(profile);
      mockProfileManager.instantiateTemplate.mockReturnValue('Execute test-spec');
      (vscode.commands.getCommands as jest.Mock).mockResolvedValue(['kiro.sendMessage']);
      (vscode.commands.executeCommand as jest.Mock).mockResolvedValue(undefined);

      // Start execution
      const result = await executionManager.executeSpec(spec, 'mvp', workspaceFolder);
      expect(result.success).toBe(true);

      // Act
      await executionManager.cancelExecution(result.executionId!);

      // Assert
      const state = executionManager.getExecutionState('test-spec');
      expect(state?.status).toBe('cancelled');
      expect(state?.endTime).toBeDefined();
    });

    it('should throw error if execution not found', async () => {
      // Act & Assert
      await expect(executionManager.cancelExecution('nonexistent')).rejects.toThrow('Execution "nonexistent" not found');
    });
  });

  describe('getExecutionState', () => {
    it('should return execution state for a spec', async () => {
      // Arrange
      const spec: SpecFile = {
        name: 'test-spec',
        path: '/path/to/spec',
        totalTasks: 10,
        completedTasks: 5,
        optionalTasks: 2,
        progress: 50
      };

      const profile: ExecutionProfile = {
        id: 'mvp',
        name: 'MVP',
        icon: 'rocket',
        promptTemplate: 'Execute {{specName}}',
        isBuiltIn: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const workspaceFolder = {
        uri: { fsPath: '/workspace' },
        name: 'test-workspace',
        index: 0
      } as vscode.WorkspaceFolder;

      mockProfileManager.getProfile.mockResolvedValue(profile);
      mockProfileManager.instantiateTemplate.mockReturnValue('Execute test-spec');
      (vscode.commands.getCommands as jest.Mock).mockResolvedValue(['kiro.sendMessage']);
      (vscode.commands.executeCommand as jest.Mock).mockResolvedValue(undefined);

      await executionManager.executeSpec(spec, 'mvp', workspaceFolder);

      // Act
      const state = executionManager.getExecutionState('test-spec');

      // Assert
      expect(state).toBeDefined();
      expect(state?.specId).toBe('test-spec');
      expect(state?.status).toBe('running');
    });

    it('should return undefined for non-existent spec', () => {
      // Act
      const state = executionManager.getExecutionState('nonexistent');

      // Assert
      expect(state).toBeUndefined();
    });
  });

  describe('completeExecution', () => {
    it('should mark execution as completed', async () => {
      // Arrange
      const spec: SpecFile = {
        name: 'test-spec',
        path: '/path/to/spec',
        totalTasks: 10,
        completedTasks: 5,
        optionalTasks: 2,
        progress: 50
      };

      const profile: ExecutionProfile = {
        id: 'mvp',
        name: 'MVP',
        icon: 'rocket',
        promptTemplate: 'Execute {{specName}}',
        isBuiltIn: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const workspaceFolder = {
        uri: { fsPath: '/workspace' },
        name: 'test-workspace',
        index: 0
      } as vscode.WorkspaceFolder;

      mockProfileManager.getProfile.mockResolvedValue(profile);
      mockProfileManager.instantiateTemplate.mockReturnValue('Execute test-spec');
      (vscode.commands.getCommands as jest.Mock).mockResolvedValue(['kiro.sendMessage']);
      (vscode.commands.executeCommand as jest.Mock).mockResolvedValue(undefined);

      const result = await executionManager.executeSpec(spec, 'mvp', workspaceFolder);

      // Act
      await executionManager.completeExecution(result.executionId!, 'completed');

      // Assert
      const state = executionManager.getExecutionState('test-spec');
      expect(state?.status).toBe('completed');
      expect(state?.endTime).toBeDefined();
    });

    it('should mark execution as failed with error', async () => {
      // Arrange
      const spec: SpecFile = {
        name: 'test-spec',
        path: '/path/to/spec',
        totalTasks: 10,
        completedTasks: 5,
        optionalTasks: 2,
        progress: 50
      };

      const profile: ExecutionProfile = {
        id: 'mvp',
        name: 'MVP',
        icon: 'rocket',
        promptTemplate: 'Execute {{specName}}',
        isBuiltIn: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const workspaceFolder = {
        uri: { fsPath: '/workspace' },
        name: 'test-workspace',
        index: 0
      } as vscode.WorkspaceFolder;

      mockProfileManager.getProfile.mockResolvedValue(profile);
      mockProfileManager.instantiateTemplate.mockReturnValue('Execute test-spec');
      (vscode.commands.getCommands as jest.Mock).mockResolvedValue(['kiro.sendMessage']);
      (vscode.commands.executeCommand as jest.Mock).mockResolvedValue(undefined);

      const result = await executionManager.executeSpec(spec, 'mvp', workspaceFolder);

      // Act
      await executionManager.completeExecution(result.executionId!, 'failed', 'Test error');

      // Assert
      const state = executionManager.getExecutionState('test-spec');
      expect(state?.status).toBe('failed');
      expect(state?.error).toBe('Test error');
      expect(state?.endTime).toBeDefined();
    });
  });

  describe('updateTaskProgress', () => {
    it('should update task progress for an execution', async () => {
      // Arrange
      const spec: SpecFile = {
        name: 'test-spec',
        path: '/path/to/spec',
        totalTasks: 10,
        completedTasks: 5,
        optionalTasks: 2,
        progress: 50
      };

      const profile: ExecutionProfile = {
        id: 'mvp',
        name: 'MVP',
        icon: 'rocket',
        promptTemplate: 'Execute {{specName}}',
        isBuiltIn: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const workspaceFolder = {
        uri: { fsPath: '/workspace' },
        name: 'test-workspace',
        index: 0
      } as vscode.WorkspaceFolder;

      mockProfileManager.getProfile.mockResolvedValue(profile);
      mockProfileManager.instantiateTemplate.mockReturnValue('Execute test-spec');
      (vscode.commands.getCommands as jest.Mock).mockResolvedValue(['kiro.sendMessage']);
      (vscode.commands.executeCommand as jest.Mock).mockResolvedValue(undefined);

      const result = await executionManager.executeSpec(spec, 'mvp', workspaceFolder);

      // Act
      executionManager.updateTaskProgress(result.executionId!, 7, 10);

      // Assert
      const state = executionManager.getExecutionState('test-spec');
      expect(state?.completedTasks).toBe(7);
      expect(state?.totalTasks).toBe(10);
    });
  });

  describe('getActiveExecutions', () => {
    it('should return all active executions', async () => {
      // Arrange
      const spec1: SpecFile = {
        name: 'spec-1',
        path: '/path/to/spec1',
        totalTasks: 10,
        completedTasks: 5,
        optionalTasks: 2,
        progress: 50
      };

      const spec2: SpecFile = {
        name: 'spec-2',
        path: '/path/to/spec2',
        totalTasks: 8,
        completedTasks: 3,
        optionalTasks: 1,
        progress: 37.5
      };

      const profile: ExecutionProfile = {
        id: 'mvp',
        name: 'MVP',
        icon: 'rocket',
        promptTemplate: 'Execute {{specName}}',
        isBuiltIn: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const workspaceFolder = {
        uri: { fsPath: '/workspace' },
        name: 'test-workspace',
        index: 0
      } as vscode.WorkspaceFolder;

      mockProfileManager.getProfile.mockResolvedValue(profile);
      mockProfileManager.instantiateTemplate.mockReturnValue('Execute spec');
      (vscode.commands.getCommands as jest.Mock).mockResolvedValue(['kiro.sendMessage']);
      (vscode.commands.executeCommand as jest.Mock).mockResolvedValue(undefined);

      await executionManager.executeSpec(spec1, 'mvp', workspaceFolder);
      await executionManager.executeSpec(spec2, 'mvp', workspaceFolder);

      // Act
      const activeExecutions = executionManager.getActiveExecutions();

      // Assert
      expect(activeExecutions.size).toBe(2);
      expect(activeExecutions.has('spec-1')).toBe(true);
      expect(activeExecutions.has('spec-2')).toBe(true);
    });
  });

  describe('task parsing', () => {
    it('should parse various task formats correctly', () => {
      // Arrange
      const tasksContent = `
# Tasks

- [ ] 1. Pending task
- [x] 2. Completed task
- [~] 3. In progress task
- [-] 4. Queued task
- [ ]* 5. Optional pending task
- [x]* 6. Optional completed task
      `;

      // Act - Access private method via any cast for testing
      const stats = (executionManager as any).parseTaskStats(tasksContent);

      // Assert
      expect(stats.totalTasks).toBe(6);
      expect(stats.completedTasks).toBe(2); // Only tasks 2 and 6 are completed
    });

    it('should handle empty content', () => {
      // Act
      const stats = (executionManager as any).parseTaskStats('');

      // Assert
      expect(stats.totalTasks).toBe(0);
      expect(stats.completedTasks).toBe(0);
    });

    it('should handle content with no tasks', () => {
      // Arrange
      const content = `
# Some heading

This is just text without any tasks.
      `;

      // Act
      const stats = (executionManager as any).parseTaskStats(content);

      // Assert
      expect(stats.totalTasks).toBe(0);
      expect(stats.completedTasks).toBe(0);
    });

    it('should count nested tasks correctly', () => {
      // Arrange
      const tasksContent = `
# Tasks

- [x] 1. Parent task
  - [x] 1.1 Child task
  - [ ] 1.2 Another child task
- [ ] 2. Another parent task
      `;

      // Act
      const stats = (executionManager as any).parseTaskStats(tasksContent);

      // Assert
      expect(stats.totalTasks).toBe(4);
      expect(stats.completedTasks).toBe(2);
    });
  });

  describe('dispose', () => {
    it('should clean up all resources', () => {
      // Act
      executionManager.dispose();

      // Assert
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Disposed all resources')
      );
    });
  });
});
