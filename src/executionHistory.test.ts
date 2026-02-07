import { ExecutionHistory } from './executionHistory';
import { ExecutionHistoryEntry, HistoryFilter } from './types';
import * as vscode from 'vscode';

// Mock VSCode API
jest.mock('vscode');

describe('ExecutionHistory', () => {
  let executionHistory: ExecutionHistory;
  let mockMemento: jest.Mocked<vscode.Memento>;
  let mockOutputChannel: jest.Mocked<vscode.OutputChannel>;
  let mockEntries: ExecutionHistoryEntry[];

  beforeEach(() => {
    // Create mock memento
    mockMemento = {
      get: jest.fn(),
      update: jest.fn(),
      keys: jest.fn()
    } as any;

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

    executionHistory = new ExecutionHistory(mockMemento, mockOutputChannel);

    // Create mock entries
    mockEntries = [
      {
        executionId: 'exec-1',
        specId: 'spec-1',
        specName: 'Feature A',
        profileId: 'mvp',
        profileName: 'MVP',
        workspaceFolder: '/workspace',
        status: 'completed',
        startTime: '2024-01-01T10:00:00.000Z',
        endTime: '2024-01-01T10:30:00.000Z',
        duration: 1800000,
        completedTasks: 10,
        totalTasks: 10
      },
      {
        executionId: 'exec-2',
        specId: 'spec-2',
        specName: 'Feature B',
        profileId: 'full',
        profileName: 'Full',
        workspaceFolder: '/workspace',
        status: 'failed',
        startTime: '2024-01-02T10:00:00.000Z',
        endTime: '2024-01-02T10:15:00.000Z',
        duration: 900000,
        completedTasks: 5,
        totalTasks: 10,
        error: 'Test error'
      },
      {
        executionId: 'exec-3',
        specId: 'spec-1',
        specName: 'Feature A',
        profileId: 'mvp',
        profileName: 'MVP',
        workspaceFolder: '/workspace',
        status: 'running',
        startTime: '2024-01-03T10:00:00.000Z',
        completedTasks: 3,
        totalTasks: 10
      }
    ];
  });

  describe('addEntry', () => {
    it('should add a new entry to empty history', async () => {
      mockMemento.get.mockReturnValue([]);

      const newEntry: ExecutionHistoryEntry = {
        executionId: 'exec-new',
        specId: 'spec-new',
        specName: 'New Feature',
        profileId: 'mvp',
        profileName: 'MVP',
        workspaceFolder: '/workspace',
        status: 'running',
        startTime: new Date().toISOString(),
        completedTasks: 0,
        totalTasks: 5
      };

      await executionHistory.addEntry(newEntry);

      expect(mockMemento.update).toHaveBeenCalledWith('executionHistory', [newEntry]);
    });

    it('should add a new entry to existing history', async () => {
      mockMemento.get.mockReturnValue([mockEntries[0]]);

      await executionHistory.addEntry(mockEntries[1]);

      expect(mockMemento.update).toHaveBeenCalledWith('executionHistory', [
        mockEntries[0],
        mockEntries[1]
      ]);
    });

    it('should log when adding entry', async () => {
      mockMemento.get.mockReturnValue([]);

      await executionHistory.addEntry(mockEntries[0]);

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Added entry: exec-1')
      );
    });
  });

  describe('updateEntry', () => {
    beforeEach(() => {
      mockMemento.get.mockReturnValue([...mockEntries]);
    });

    it('should update an existing entry', async () => {
      const updates: Partial<ExecutionHistoryEntry> = {
        status: 'completed',
        endTime: '2024-01-03T10:30:00.000Z',
        completedTasks: 10
      };

      await executionHistory.updateEntry('exec-3', updates);

      // Get the saved entries
      const savedEntries = mockMemento.update.mock.calls[0][1] as ExecutionHistoryEntry[];
      const updatedEntry = savedEntries.find(e => e.executionId === 'exec-3');

      expect(updatedEntry).toMatchObject({
        executionId: 'exec-3',
        status: 'completed',
        endTime: '2024-01-03T10:30:00.000Z',
        completedTasks: 10,
        duration: 1800000
      });
    });

    it('should calculate duration when endTime is provided', async () => {
      const updates: Partial<ExecutionHistoryEntry> = {
        endTime: '2024-01-03T10:30:00.000Z'
      };

      await executionHistory.updateEntry('exec-3', updates);

      const savedEntries = mockMemento.update.mock.calls[0][1] as ExecutionHistoryEntry[];
      const updatedEntry = savedEntries.find(e => e.executionId === 'exec-3');

      expect(updatedEntry?.duration).toBe(1800000); // 30 minutes in milliseconds
    });

    it('should not overwrite duration if already provided', async () => {
      const updates: Partial<ExecutionHistoryEntry> = {
        endTime: '2024-01-03T10:30:00.000Z',
        duration: 999999
      };

      await executionHistory.updateEntry('exec-3', updates);

      const savedEntries = mockMemento.update.mock.calls[0][1] as ExecutionHistoryEntry[];
      const updatedEntry = savedEntries.find(e => e.executionId === 'exec-3');

      expect(updatedEntry?.duration).toBe(999999);
    });

    it('should do nothing if entry not found', async () => {
      await executionHistory.updateEntry('non-existent', { status: 'completed' });

      expect(mockMemento.update).not.toHaveBeenCalled();
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Entry not found')
      );
    });
  });

  describe('getAllEntries', () => {
    it('should return empty array when no entries exist', async () => {
      mockMemento.get.mockReturnValue([]);

      const entries = await executionHistory.getAllEntries();

      expect(entries).toEqual([]);
    });

    it('should return all entries sorted by startTime descending', async () => {
      mockMemento.get.mockReturnValue([...mockEntries]);

      const entries = await executionHistory.getAllEntries();

      expect(entries).toHaveLength(3);
      expect(entries[0].executionId).toBe('exec-3'); // Most recent
      expect(entries[1].executionId).toBe('exec-2');
      expect(entries[2].executionId).toBe('exec-1'); // Oldest
    });

    it('should handle errors gracefully', async () => {
      mockMemento.get.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const entries = await executionHistory.getAllEntries();

      expect(entries).toEqual([]);
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Error loading entries')
      );
    });
  });

  describe('getEntriesForSpec', () => {
    beforeEach(() => {
      mockMemento.get.mockReturnValue([...mockEntries]);
    });

    it('should return only entries for specified spec', async () => {
      const entries = await executionHistory.getEntriesForSpec('spec-1');

      expect(entries).toHaveLength(2);
      expect(entries.every(e => e.specId === 'spec-1')).toBe(true);
    });

    it('should return empty array if no entries for spec', async () => {
      const entries = await executionHistory.getEntriesForSpec('non-existent');

      expect(entries).toEqual([]);
    });
  });

  describe('queryEntries', () => {
    beforeEach(() => {
      mockMemento.get.mockReturnValue([...mockEntries]);
    });

    it('should filter by specId', async () => {
      const filter: HistoryFilter = { specId: 'spec-1' };
      const entries = await executionHistory.queryEntries(filter);

      expect(entries).toHaveLength(2);
      expect(entries.every(e => e.specId === 'spec-1')).toBe(true);
    });

    it('should filter by profileId', async () => {
      const filter: HistoryFilter = { profileId: 'mvp' };
      const entries = await executionHistory.queryEntries(filter);

      expect(entries).toHaveLength(2);
      expect(entries.every(e => e.profileId === 'mvp')).toBe(true);
    });

    it('should filter by status', async () => {
      const filter: HistoryFilter = { status: 'completed' };
      const entries = await executionHistory.queryEntries(filter);

      expect(entries).toHaveLength(1);
      expect(entries[0].status).toBe('completed');
    });

    it('should filter by workspaceFolder', async () => {
      const filter: HistoryFilter = { workspaceFolder: '/workspace' };
      const entries = await executionHistory.queryEntries(filter);

      expect(entries).toHaveLength(3);
    });

    it('should filter by startDate', async () => {
      const filter: HistoryFilter = { startDate: '2024-01-02T00:00:00.000Z' };
      const entries = await executionHistory.queryEntries(filter);

      expect(entries).toHaveLength(2);
      expect(entries.every(e => new Date(e.startTime) >= new Date('2024-01-02T00:00:00.000Z'))).toBe(true);
    });

    it('should filter by endDate', async () => {
      const filter: HistoryFilter = { endDate: '2024-01-02T00:00:00.000Z' };
      const entries = await executionHistory.queryEntries(filter);

      expect(entries).toHaveLength(1);
      expect(entries[0].executionId).toBe('exec-1');
    });

    it('should combine multiple filters with AND logic', async () => {
      const filter: HistoryFilter = {
        specId: 'spec-1',
        profileId: 'mvp',
        status: 'completed'
      };
      const entries = await executionHistory.queryEntries(filter);

      expect(entries).toHaveLength(1);
      expect(entries[0].executionId).toBe('exec-1');
    });

    it('should return empty array if no entries match filter', async () => {
      const filter: HistoryFilter = { specId: 'non-existent' };
      const entries = await executionHistory.queryEntries(filter);

      expect(entries).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      // Mock getAllEntries to succeed but queryEntries logic to fail
      const mockEntriesWithError = [...mockEntries];
      // Make one entry have invalid date to cause error in filtering
      mockEntriesWithError[0] = { ...mockEntriesWithError[0], startTime: 'invalid-date' };
      mockMemento.get.mockReturnValue(mockEntriesWithError);

      // This should still work because we catch errors in the filter logic
      const entries = await executionHistory.queryEntries({ specId: 'spec-1' });

      // Should return entries that don't cause errors
      expect(Array.isArray(entries)).toBe(true);
    });
  });

  describe('clearHistory', () => {
    it('should clear all history entries', async () => {
      await executionHistory.clearHistory();

      expect(mockMemento.update).toHaveBeenCalledWith('executionHistory', []);
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Cleared all history')
      );
    });

    it('should handle errors when clearing', async () => {
      mockMemento.update.mockRejectedValue(new Error('Storage error'));

      await expect(executionHistory.clearHistory()).rejects.toThrow('Storage error');
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Error clearing history')
      );
    });
  });

  describe('getStatistics', () => {
    beforeEach(() => {
      mockMemento.get.mockReturnValue([...mockEntries]);
    });

    it('should calculate total executions', async () => {
      const stats = await executionHistory.getStatistics();

      expect(stats.totalExecutions).toBe(3);
    });

    it('should calculate success rate', async () => {
      const stats = await executionHistory.getStatistics();

      expect(stats.successRate).toBeCloseTo(33.33, 1); // 1 out of 3 completed
    });

    it('should calculate average duration', async () => {
      const stats = await executionHistory.getStatistics();

      // Average of 1800000 and 900000 (exec-3 has no duration)
      expect(stats.averageDuration).toBe(1350000);
    });

    it('should calculate per-spec statistics', async () => {
      const stats = await executionHistory.getStatistics();

      expect(stats.bySpec['spec-1']).toEqual({
        specName: 'Feature A',
        totalExecutions: 2,
        successCount: 1,
        failureCount: 0,
        averageDuration: 1800000
      });

      expect(stats.bySpec['spec-2']).toEqual({
        specName: 'Feature B',
        totalExecutions: 1,
        successCount: 0,
        failureCount: 1,
        averageDuration: 900000
      });
    });

    it('should calculate per-profile statistics', async () => {
      const stats = await executionHistory.getStatistics();

      expect(stats.byProfile['mvp']).toEqual({
        profileName: 'MVP',
        totalExecutions: 2,
        successCount: 1,
        failureCount: 0,
        averageDuration: 1800000
      });

      expect(stats.byProfile['full']).toEqual({
        profileName: 'Full',
        totalExecutions: 1,
        successCount: 0,
        failureCount: 1,
        averageDuration: 900000
      });
    });

    it('should return empty statistics when no entries exist', async () => {
      mockMemento.get.mockReturnValue([]);

      const stats = await executionHistory.getStatistics();

      expect(stats).toEqual({
        totalExecutions: 0,
        successRate: 0,
        averageDuration: 0,
        bySpec: {},
        byProfile: {}
      });
    });

    it('should handle errors gracefully', async () => {
      // Mock getAllEntries to succeed but make statistics calculation fail
      const mockEntriesWithError = [...mockEntries];
      // Make duration undefined to test edge case handling
      mockEntriesWithError[0] = { ...mockEntriesWithError[0], duration: undefined };
      mockMemento.get.mockReturnValue(mockEntriesWithError);

      const stats = await executionHistory.getStatistics();

      // Should still calculate statistics with available data
      expect(stats.totalExecutions).toBe(3);
      expect(stats.averageDuration).toBe(900000); // Only exec-2 has duration now
    });
  });

  describe('edge cases', () => {
    it('should handle empty history', async () => {
      mockMemento.get.mockReturnValue([]);

      const entries = await executionHistory.getAllEntries();
      const stats = await executionHistory.getStatistics();

      expect(entries).toEqual([]);
      expect(stats.totalExecutions).toBe(0);
    });

    it('should handle history with thousands of entries', async () => {
      // Create 1000 mock entries
      const largeHistory: ExecutionHistoryEntry[] = Array.from({ length: 1000 }, (_, i) => ({
        executionId: `exec-${i}`,
        specId: `spec-${i % 10}`,
        specName: `Feature ${i % 10}`,
        profileId: 'mvp',
        profileName: 'MVP',
        workspaceFolder: '/workspace',
        status: i % 2 === 0 ? 'completed' : 'failed',
        startTime: new Date(2024, 0, 1 + i).toISOString(),
        endTime: new Date(2024, 0, 1 + i, 1).toISOString(),
        duration: 3600000,
        completedTasks: 10,
        totalTasks: 10
      }));

      mockMemento.get.mockReturnValue(largeHistory);

      const entries = await executionHistory.getAllEntries();
      const stats = await executionHistory.getStatistics();

      expect(entries).toHaveLength(1000);
      expect(stats.totalExecutions).toBe(1000);
      expect(stats.successRate).toBe(50); // Half completed, half failed
    });
  });
});
