import { VelocityCalculator } from './velocityCalculator';
import { StateManager } from './stateManager';

// Mock VSCode API
jest.mock('vscode', () => ({
  ExtensionContext: jest.fn(),
  Memento: jest.fn()
}), { virtual: true });

describe('VelocityCalculator - Timeline Features', () => {
  let calculator: VelocityCalculator;
  let mockStateManager: StateManager;

  beforeEach(async () => {
    mockStateManager = {
      getVelocityData: jest.fn().mockResolvedValue(null),
      saveVelocityData: jest.fn().mockResolvedValue(undefined)
    } as any;

    calculator = new VelocityCalculator(mockStateManager);
    await calculator.initialize();
  });

  describe('Daily Task Counts', () => {
    test('should record daily task counts', async () => {
      const today = new Date('2026-02-04T10:00:00Z');
      
      await calculator.recordTaskCompletion('spec-1', 'task-1', true, today);
      await calculator.recordTaskCompletion('spec-1', 'task-2', true, today);
      await calculator.recordTaskCompletion('spec-1', 'task-3', false, today);
      
      const dailyCounts = calculator.getDailyTaskCounts(7);
      
      // Should have 7 days
      expect(dailyCounts).toHaveLength(7);
      
      // Today should have 3 tasks
      const todayData = dailyCounts[dailyCounts.length - 1];
      expect(todayData.completed).toBe(3);
      expect(todayData.required).toBe(2);
      expect(todayData.optional).toBe(1);
    });

    test('should return empty days for days with no activity', async () => {
      const dailyCounts = calculator.getDailyTaskCounts(7);
      
      expect(dailyCounts).toHaveLength(7);
      dailyCounts.forEach(day => {
        expect(day.completed).toBe(0);
        expect(day.required).toBe(0);
        expect(day.optional).toBe(0);
      });
    });

    test('should limit to last 90 days', async () => {
      // Record tasks over 100 days
      for (let i = 0; i < 100; i++) {
        const date = new Date('2026-02-04T10:00:00Z');
        date.setDate(date.getDate() - i);
        await calculator.recordTaskCompletion('spec-1', `task-${i}`, true, date);
      }
      
      const dailyCounts = calculator.getDailyTaskCounts(100);
      
      // Should only have data for last 90 days (plus today)
      const nonZeroDays = dailyCounts.filter(d => d.completed > 0);
      expect(nonZeroDays.length).toBeLessThanOrEqual(91);
    });
  });

  describe('Task Completion Events', () => {
    test('should record task completion events', async () => {
      const timestamp = new Date('2026-02-04T10:00:00Z');
      
      await calculator.recordTaskCompletion(
        'spec-1',
        'task-1',
        true,
        timestamp,
        'Implement feature X'
      );
      
      const events = calculator.getRecentTaskEvents(10);
      
      expect(events).toHaveLength(1);
      expect(events[0].specName).toBe('spec-1');
      expect(events[0].taskId).toBe('task-1');
      expect(events[0].isRequired).toBe(true);
      expect(events[0].taskDescription).toBe('Implement feature X');
    });

    test('should limit to last 100 events', async () => {
      const timestamp = new Date('2026-02-04T10:00:00Z');
      
      // Record 150 events
      for (let i = 0; i < 150; i++) {
        await calculator.recordTaskCompletion(
          'spec-1',
          `task-${i}`,
          true,
          timestamp,
          `Task ${i}`
        );
      }
      
      const events = calculator.getRecentTaskEvents(200);
      
      // Should only have last 100
      expect(events).toHaveLength(100);
    });

    test('should return events in reverse chronological order', async () => {
      const date1 = new Date('2026-02-04T10:00:00Z');
      const date2 = new Date('2026-02-04T11:00:00Z');
      const date3 = new Date('2026-02-04T12:00:00Z');
      
      await calculator.recordTaskCompletion('spec-1', 'task-1', true, date1);
      await calculator.recordTaskCompletion('spec-1', 'task-2', true, date2);
      await calculator.recordTaskCompletion('spec-1', 'task-3', true, date3);
      
      const events = calculator.getRecentTaskEvents(10);
      
      expect(events).toHaveLength(3);
      expect(events[0].taskId).toBe('task-3'); // Most recent first
      expect(events[1].taskId).toBe('task-2');
      expect(events[2].taskId).toBe('task-1');
    });
  });

  describe('Spec Lifecycle Events', () => {
    test('should record spec completion events', async () => {
      await calculator.recordSpecCompletion('spec-1', 10, 10);
      
      const events = calculator.getSpecLifecycleEvents();
      
      expect(events).toHaveLength(1);
      expect(events[0].specName).toBe('spec-1');
      expect(events[0].eventType).toBe('completed');
      expect(events[0].progress).toBe(100);
    });
  });

  describe('Spec Timelines', () => {
    test('should generate spec timeline data', async () => {
      const startDate = new Date('2026-01-01T10:00:00Z');
      const endDate = new Date('2026-01-15T10:00:00Z');
      
      await calculator.recordTaskCompletion('spec-1', 'task-1', true, startDate);
      await calculator.updateSpecProgress('spec-1', 10, 5);
      
      const timelines = calculator.getSpecTimelines();
      
      expect(timelines).toHaveLength(1);
      expect(timelines[0].specName).toBe('spec-1');
      expect(timelines[0].startDate).toEqual(startDate);
      expect(timelines[0].progress).toBe(50);
      expect(timelines[0].totalTasks).toBe(10);
      expect(timelines[0].completedTasks).toBe(5);
    });

    test('should calculate progress correctly', async () => {
      await calculator.recordTaskCompletion('spec-1', 'task-1', true);
      await calculator.updateSpecProgress('spec-1', 4, 3);
      
      const timelines = calculator.getSpecTimelines();
      
      expect(timelines[0].progress).toBe(75);
    });
  });

  describe('Metrics Integration', () => {
    test('should include timeline data in metrics', async () => {
      const today = new Date('2026-02-04T10:00:00Z');
      
      await calculator.recordTaskCompletion('spec-1', 'task-1', true, today, 'Test task');
      await calculator.updateSpecProgress('spec-1', 10, 1);
      
      const metrics = calculator.calculateMetrics();
      
      expect(metrics.dailyActivity).toBeDefined();
      expect(metrics.dailyActivity.length).toBeGreaterThan(0);
      
      expect(metrics.recentEvents).toBeDefined();
      expect(metrics.recentEvents.length).toBe(1);
      
      expect(metrics.specTimelines).toBeDefined();
      expect(metrics.specTimelines.length).toBe(1);
    });
  });
});
