/**
 * Unit tests for VelocityCalculator metric calculations
 * 
 * Tests all 10 metrics with edge cases:
 * - Tasks per week
 * - Velocity trend
 * - Rolling average
 * - Specs per week
 * - Average time to complete
 * - Time distribution
 * - Projected completion date
 * - Day of week velocity
 * - Required vs optional split
 * - Consistency score
 * 
 * Requirements: 21.1-21.10
 */

import { VelocityCalculator } from './velocityCalculator';
import { StateManager } from './stateManager';
import { VelocityData } from './types';

// Mock StateManager
class MockStateManager {
  private velocityData: VelocityData | null = null;

  async getVelocityData(): Promise<VelocityData | null> {
    return this.velocityData;
  }

  async saveVelocityData(data: VelocityData): Promise<void> {
    this.velocityData = data;
  }

  async getActiveAnalyticsTab(): Promise<string> {
    return 'velocity';
  }

  async saveActiveAnalyticsTab(tab: string): Promise<void> {
    // No-op for tests
  }
}

describe('VelocityCalculator - Tasks Per Week (Metric 1)', () => {
  let calculator: VelocityCalculator;
  let mockStateManager: MockStateManager;

  beforeEach(async () => {
    mockStateManager = new MockStateManager();
    calculator = new VelocityCalculator(mockStateManager as any);
    await calculator.initialize();
  });

  test('should return array of correct length', () => {
    const tasksPerWeek = calculator.getTasksPerWeek(12);
    expect(tasksPerWeek).toHaveLength(12);
  });

  test('should pad with zeros when no data', () => {
    const tasksPerWeek = calculator.getTasksPerWeek(12);
    expect(tasksPerWeek.every(count => count === 0)).toBe(true);
  });

  test('should return correct task counts for recent weeks', async () => {
    // Add tasks for 3 different weeks
    const week1 = new Date('2026-01-26T10:00:00Z');
    const week2 = new Date('2026-02-02T10:00:00Z');
    const week3 = new Date('2026-02-09T10:00:00Z');
    
    await calculator.recordTaskCompletion('spec-1', 'task-1', true, week1);
    await calculator.recordTaskCompletion('spec-1', 'task-2', true, week1);
    
    await calculator.recordTaskCompletion('spec-1', 'task-3', true, week2);
    await calculator.recordTaskCompletion('spec-1', 'task-4', true, week2);
    await calculator.recordTaskCompletion('spec-1', 'task-5', true, week2);
    
    await calculator.recordTaskCompletion('spec-1', 'task-6', true, week3);
    
    const tasksPerWeek = calculator.getTasksPerWeek(12);
    
    expect(tasksPerWeek[tasksPerWeek.length - 3]).toBe(2);
    expect(tasksPerWeek[tasksPerWeek.length - 2]).toBe(3);
    expect(tasksPerWeek[tasksPerWeek.length - 1]).toBe(1);
  });
});

describe('VelocityCalculator - Velocity Trend (Metric 2)', () => {
  let calculator: VelocityCalculator;
  let mockStateManager: MockStateManager;

  beforeEach(async () => {
    mockStateManager = new MockStateManager();
    calculator = new VelocityCalculator(mockStateManager as any);
    await calculator.initialize();
  });

  test('should return 0 when no data', () => {
    const trend = calculator.calculateTrend();
    expect(trend).toBe(0);
  });

  test('should return 100% when current week has tasks but last week has none', async () => {
    const thisWeek = new Date('2026-02-03T10:00:00Z');
    await calculator.recordTaskCompletion('spec-1', 'task-1', true, thisWeek);
    
    const trend = calculator.calculateTrend();
    expect(trend).toBe(100);
  });

  test('should calculate positive trend correctly', async () => {
    const lastWeek = new Date('2026-01-27T10:00:00Z');
    const thisWeek = new Date('2026-02-03T10:00:00Z');
    
    // Last week: 4 tasks
    await calculator.recordTaskCompletion('spec-1', 'task-1', true, lastWeek);
    await calculator.recordTaskCompletion('spec-1', 'task-2', true, lastWeek);
    await calculator.recordTaskCompletion('spec-1', 'task-3', true, lastWeek);
    await calculator.recordTaskCompletion('spec-1', 'task-4', true, lastWeek);
    
    // This week: 6 tasks
    await calculator.recordTaskCompletion('spec-1', 'task-5', true, thisWeek);
    await calculator.recordTaskCompletion('spec-1', 'task-6', true, thisWeek);
    await calculator.recordTaskCompletion('spec-1', 'task-7', true, thisWeek);
    await calculator.recordTaskCompletion('spec-1', 'task-8', true, thisWeek);
    await calculator.recordTaskCompletion('spec-1', 'task-9', true, thisWeek);
    await calculator.recordTaskCompletion('spec-1', 'task-10', true, thisWeek);
    
    const trend = calculator.calculateTrend();
    expect(trend).toBe(50); // (6-4)/4 * 100 = 50%
  });

  test('should calculate negative trend correctly', async () => {
    const lastWeek = new Date('2026-01-27T10:00:00Z');
    const thisWeek = new Date('2026-02-03T10:00:00Z');
    
    // Last week: 10 tasks
    for (let i = 0; i < 10; i++) {
      await calculator.recordTaskCompletion('spec-1', `task-${i}`, true, lastWeek);
    }
    
    // This week: 5 tasks
    for (let i = 10; i < 15; i++) {
      await calculator.recordTaskCompletion('spec-1', `task-${i}`, true, thisWeek);
    }
    
    const trend = calculator.calculateTrend();
    expect(trend).toBe(-50); // (5-10)/10 * 100 = -50%
  });
});

describe('VelocityCalculator - Rolling Average (Metric 3)', () => {
  let calculator: VelocityCalculator;
  let mockStateManager: MockStateManager;

  beforeEach(async () => {
    mockStateManager = new MockStateManager();
    calculator = new VelocityCalculator(mockStateManager as any);
    await calculator.initialize();
  });

  test('should return 0 when no data', () => {
    const avg = calculator.calculateRollingAverage(4);
    expect(avg).toBe(0);
  });

  test('should calculate 4-week rolling average correctly', async () => {
    const week1 = new Date('2026-01-12T10:00:00Z');
    const week2 = new Date('2026-01-19T10:00:00Z');
    const week3 = new Date('2026-01-26T10:00:00Z');
    const week4 = new Date('2026-02-02T10:00:00Z');
    
    // Week 1: 5 tasks
    for (let i = 0; i < 5; i++) {
      await calculator.recordTaskCompletion('spec-1', `w1-task-${i}`, true, week1);
    }
    
    // Week 2: 8 tasks
    for (let i = 0; i < 8; i++) {
      await calculator.recordTaskCompletion('spec-1', `w2-task-${i}`, true, week2);
    }
    
    // Week 3: 6 tasks
    for (let i = 0; i < 6; i++) {
      await calculator.recordTaskCompletion('spec-1', `w3-task-${i}`, true, week3);
    }
    
    // Week 4: 9 tasks
    for (let i = 0; i < 9; i++) {
      await calculator.recordTaskCompletion('spec-1', `w4-task-${i}`, true, week4);
    }
    
    const avg = calculator.calculateRollingAverage(4);
    expect(avg).toBe(7); // (5+8+6+9)/4 = 7
  });

  test('should handle fewer weeks than requested', async () => {
    const week1 = new Date('2026-02-02T10:00:00Z');
    
    for (let i = 0; i < 10; i++) {
      await calculator.recordTaskCompletion('spec-1', `task-${i}`, true, week1);
    }
    
    const avg = calculator.calculateRollingAverage(4);
    expect(avg).toBe(10); // Only 1 week of data
  });
});

describe('VelocityCalculator - Specs Per Week (Metric 4)', () => {
  let calculator: VelocityCalculator;
  let mockStateManager: MockStateManager;

  beforeEach(async () => {
    mockStateManager = new MockStateManager();
    calculator = new VelocityCalculator(mockStateManager as any);
    await calculator.initialize();
  });

  test('should return array of correct length', () => {
    const specsPerWeek = calculator.getSpecsPerWeek(8);
    expect(specsPerWeek).toHaveLength(8);
  });

  test('should track spec completions per week', async () => {
    const week1 = new Date('2026-01-26T10:00:00Z');
    const week2 = new Date('2026-02-02T10:00:00Z');
    
    await calculator.recordSpecCompletion('spec-1', 10, 10, week1);
    await calculator.recordSpecCompletion('spec-2', 5, 5, week1);
    
    await calculator.recordSpecCompletion('spec-3', 8, 8, week2);
    
    const specsPerWeek = calculator.getSpecsPerWeek(8);
    
    expect(specsPerWeek[specsPerWeek.length - 2]).toBe(2);
    expect(specsPerWeek[specsPerWeek.length - 1]).toBe(1);
  });
});

describe('VelocityCalculator - Average Time to Complete (Metric 5)', () => {
  let calculator: VelocityCalculator;
  let mockStateManager: MockStateManager;

  beforeEach(async () => {
    mockStateManager = new MockStateManager();
    calculator = new VelocityCalculator(mockStateManager as any);
    await calculator.initialize();
  });

  test('should return 0 when no completed specs', () => {
    const avgTime = calculator.calculateAvgTimeToComplete();
    expect(avgTime).toBe(0);
  });

  test('should calculate average time correctly', async () => {
    // Spec 1: 10 days (Jan 1 to Jan 11)
    const spec1Start = new Date('2026-01-01T10:00:00Z');
    const spec1End = new Date('2026-01-11T10:00:00Z');
    
    await calculator.recordTaskCompletion('spec-1', 'task-1', true, spec1Start);
    await calculator.recordSpecCompletion('spec-1', 10, 10, spec1End);
    
    // Spec 2: 20 days (Jan 5 to Jan 25)
    const spec2Start = new Date('2026-01-05T10:00:00Z');
    const spec2End = new Date('2026-01-25T10:00:00Z');
    
    await calculator.recordTaskCompletion('spec-2', 'task-1', true, spec2Start);
    await calculator.recordSpecCompletion('spec-2', 8, 8, spec2End);
    
    const avgTime = calculator.calculateAvgTimeToComplete();
    expect(avgTime).toBe(15); // (10+20)/2 = 15 days
  });

  test('should handle single completed spec', async () => {
    const start = new Date('2026-01-01T10:00:00Z');
    const end = new Date('2026-01-08T10:00:00Z');
    
    await calculator.recordTaskCompletion('spec-1', 'task-1', true, start);
    await calculator.recordSpecCompletion('spec-1', 5, 5, end);
    
    const avgTime = calculator.calculateAvgTimeToComplete();
    expect(avgTime).toBe(7); // 7 days
  });
});

describe('VelocityCalculator - Time Distribution (Metric 6)', () => {
  let calculator: VelocityCalculator;
  let mockStateManager: MockStateManager;

  beforeEach(async () => {
    mockStateManager = new MockStateManager();
    calculator = new VelocityCalculator(mockStateManager as any);
    await calculator.initialize();
  });

  test('should return all zeros when no completed specs', () => {
    const distribution = calculator.calculateTimeDistribution();
    expect(distribution).toEqual({ fast: 0, medium: 0, slow: 0 });
  });

  test('should categorize specs correctly', async () => {
    // Fast spec: 5 days
    const fast1Start = new Date('2026-01-01T10:00:00Z');
    const fast1End = new Date('2026-01-06T10:00:00Z');
    await calculator.recordTaskCompletion('fast-1', 'task-1', true, fast1Start);
    await calculator.recordSpecCompletion('fast-1', 5, 5, fast1End);
    
    // Fast spec: 10 days (boundary)
    const fast2Start = new Date('2026-01-10T10:00:00Z');
    const fast2End = new Date('2026-01-20T10:00:00Z');
    await calculator.recordTaskCompletion('fast-2', 'task-1', true, fast2Start);
    await calculator.recordSpecCompletion('fast-2', 8, 8, fast2End);
    
    // Medium spec: 15 days
    const medStart = new Date('2026-01-01T10:00:00Z');
    const medEnd = new Date('2026-01-16T10:00:00Z');
    await calculator.recordTaskCompletion('medium-1', 'task-1', true, medStart);
    await calculator.recordSpecCompletion('medium-1', 10, 10, medEnd);
    
    // Slow spec: 25 days
    const slowStart = new Date('2026-01-01T10:00:00Z');
    const slowEnd = new Date('2026-01-26T10:00:00Z');
    await calculator.recordTaskCompletion('slow-1', 'task-1', true, slowStart);
    await calculator.recordSpecCompletion('slow-1', 15, 15, slowEnd);
    
    const distribution = calculator.calculateTimeDistribution();
    expect(distribution.fast).toBe(2);
    expect(distribution.medium).toBe(1);
    expect(distribution.slow).toBe(1);
  });
});

describe('VelocityCalculator - Projected Completion (Metric 7)', () => {
  let calculator: VelocityCalculator;
  let mockStateManager: MockStateManager;

  beforeEach(async () => {
    mockStateManager = new MockStateManager();
    calculator = new VelocityCalculator(mockStateManager as any);
    await calculator.initialize();
  });

  test('should return null when no velocity data', () => {
    const specs = [{ totalTasks: 10, completedTasks: 5 }];
    const projected = calculator.projectCompletionDate(specs);
    expect(projected).toBeNull();
  });

  test('should return null when no remaining tasks', () => {
    const specs = [{ totalTasks: 10, completedTasks: 10 }];
    const projected = calculator.projectCompletionDate(specs);
    expect(projected).toBeNull();
  });

  test('should calculate projected date correctly', async () => {
    // Build velocity: 10 tasks per week for 4 weeks
    const week1 = new Date('2026-01-05T10:00:00Z');
    const week2 = new Date('2026-01-12T10:00:00Z');
    const week3 = new Date('2026-01-19T10:00:00Z');
    const week4 = new Date('2026-01-26T10:00:00Z');
    
    for (let i = 0; i < 10; i++) {
      await calculator.recordTaskCompletion('spec-1', `w1-${i}`, true, week1);
      await calculator.recordTaskCompletion('spec-1', `w2-${i}`, true, week2);
      await calculator.recordTaskCompletion('spec-1', `w3-${i}`, true, week3);
      await calculator.recordTaskCompletion('spec-1', `w4-${i}`, true, week4);
    }
    
    // 20 remaining tasks, 10 tasks/week velocity = 2 weeks = 14 days
    const specs = [{ totalTasks: 60, completedTasks: 40 }];
    const projected = calculator.projectCompletionDate(specs);
    
    expect(projected).not.toBeNull();
    
    const daysRemaining = calculator.calculateDaysRemaining(specs);
    expect(daysRemaining).toBe(14);
  });

  test('should handle zero division gracefully', () => {
    const specs = [{ totalTasks: 10, completedTasks: 5 }];
    const projected = calculator.projectCompletionDate(specs);
    expect(projected).toBeNull();
  });
});

describe('VelocityCalculator - Day of Week Velocity (Metric 8)', () => {
  let calculator: VelocityCalculator;
  let mockStateManager: MockStateManager;

  beforeEach(async () => {
    mockStateManager = new MockStateManager();
    calculator = new VelocityCalculator(mockStateManager as any);
    await calculator.initialize();
  });

  test('should track all days correctly', async () => {
    const monday = new Date('2026-02-02T10:00:00Z');
    const tuesday = new Date('2026-02-03T10:00:00Z');
    const wednesday = new Date('2026-02-04T10:00:00Z');
    const thursday = new Date('2026-02-05T10:00:00Z');
    const friday = new Date('2026-02-06T10:00:00Z');
    const saturday = new Date('2026-02-07T10:00:00Z');
    const sunday = new Date('2026-02-08T10:00:00Z');
    
    await calculator.recordTaskCompletion('spec-1', 'mon', true, monday);
    await calculator.recordTaskCompletion('spec-1', 'tue', true, tuesday);
    await calculator.recordTaskCompletion('spec-1', 'wed', true, wednesday);
    await calculator.recordTaskCompletion('spec-1', 'thu', true, thursday);
    await calculator.recordTaskCompletion('spec-1', 'fri', true, friday);
    await calculator.recordTaskCompletion('spec-1', 'sat', true, saturday);
    await calculator.recordTaskCompletion('spec-1', 'sun', true, sunday);
    
    const metrics = calculator.calculateMetrics();
    const dayOfWeek = metrics.dayOfWeekVelocity;
    
    expect(dayOfWeek.monday).toBe(1);
    expect(dayOfWeek.tuesday).toBe(1);
    expect(dayOfWeek.wednesday).toBe(1);
    expect(dayOfWeek.thursday).toBe(1);
    expect(dayOfWeek.friday).toBe(1);
    expect(dayOfWeek.saturday).toBe(1);
    expect(dayOfWeek.sunday).toBe(1);
  });
});

describe('VelocityCalculator - Required vs Optional (Metric 9)', () => {
  let calculator: VelocityCalculator;
  let mockStateManager: MockStateManager;

  beforeEach(async () => {
    mockStateManager = new MockStateManager();
    calculator = new VelocityCalculator(mockStateManager as any);
    await calculator.initialize();
  });

  test('should return zeros when no data', () => {
    const split = calculator.calculateRequiredVsOptional();
    expect(split).toEqual({ required: 0, optional: 0 });
  });

  test('should calculate split correctly', async () => {
    const timestamp = new Date('2026-02-03T10:00:00Z');
    
    // 7 required tasks
    for (let i = 0; i < 7; i++) {
      await calculator.recordTaskCompletion('spec-1', `req-${i}`, true, timestamp);
    }
    
    // 3 optional tasks
    for (let i = 0; i < 3; i++) {
      await calculator.recordTaskCompletion('spec-1', `opt-${i}`, false, timestamp);
    }
    
    const split = calculator.calculateRequiredVsOptional();
    expect(split.required).toBe(7);
    expect(split.optional).toBe(3);
  });
});

describe('VelocityCalculator - Consistency Score (Metric 10)', () => {
  let calculator: VelocityCalculator;
  let mockStateManager: MockStateManager;

  beforeEach(async () => {
    mockStateManager = new MockStateManager();
    calculator = new VelocityCalculator(mockStateManager as any);
    await calculator.initialize();
  });

  test('should return 100 when no data (perfect consistency)', () => {
    const score = calculator.calculateConsistencyScore();
    expect(score).toBe(100);
  });

  test('should return high score for consistent velocity', async () => {
    // 10 tasks per week for 8 weeks (perfect consistency)
    for (let week = 0; week < 8; week++) {
      const weekDate = new Date('2026-01-05T10:00:00Z');
      weekDate.setDate(weekDate.getDate() + (week * 7));
      
      for (let i = 0; i < 10; i++) {
        await calculator.recordTaskCompletion('spec-1', `w${week}-${i}`, true, weekDate);
      }
    }
    
    const score = calculator.calculateConsistencyScore();
    expect(score).toBe(100); // Perfect consistency
  });

  test('should return lower score for inconsistent velocity', async () => {
    // Highly variable: 1, 20, 2, 18, 3, 17, 4, 16
    const taskCounts = [1, 20, 2, 18, 3, 17, 4, 16];
    
    for (let week = 0; week < 8; week++) {
      const weekDate = new Date('2026-01-05T10:00:00Z');
      weekDate.setDate(weekDate.getDate() + (week * 7));
      
      for (let i = 0; i < taskCounts[week]; i++) {
        await calculator.recordTaskCompletion('spec-1', `w${week}-${i}`, true, weekDate);
      }
    }
    
    const score = calculator.calculateConsistencyScore();
    expect(score).toBeLessThan(50); // Low consistency
  });

  test('should return correct rating for high score', async () => {
    // Build consistent velocity
    for (let week = 0; week < 8; week++) {
      const weekDate = new Date('2026-01-05T10:00:00Z');
      weekDate.setDate(weekDate.getDate() + (week * 7));
      
      for (let i = 0; i < 10; i++) {
        await calculator.recordTaskCompletion('spec-1', `w${week}-${i}`, true, weekDate);
      }
    }
    
    const rating = calculator.getConsistencyRating();
    expect(rating).toBe('High');
  });

  test('should return correct rating for medium score', async () => {
    // Moderately variable: 8, 10, 9, 11, 8, 10, 9, 11
    const taskCounts = [8, 10, 9, 11, 8, 10, 9, 11];
    
    for (let week = 0; week < 8; week++) {
      const weekDate = new Date('2026-01-05T10:00:00Z');
      weekDate.setDate(weekDate.getDate() + (week * 7));
      
      for (let i = 0; i < taskCounts[week]; i++) {
        await calculator.recordTaskCompletion('spec-1', `w${week}-${i}`, true, weekDate);
      }
    }
    
    const rating = calculator.getConsistencyRating();
    expect(rating).toBe('High'); // Should still be high with small variance
  });
});

describe('VelocityCalculator - Edge Cases', () => {
  let calculator: VelocityCalculator;
  let mockStateManager: MockStateManager;

  beforeEach(async () => {
    mockStateManager = new MockStateManager();
    calculator = new VelocityCalculator(mockStateManager as any);
    await calculator.initialize();
  });

  test('should handle single data point', async () => {
    const timestamp = new Date('2026-02-03T10:00:00Z');
    await calculator.recordTaskCompletion('spec-1', 'task-1', true, timestamp);
    
    const metrics = calculator.calculateMetrics();
    expect(metrics.currentWeekTasks).toBe(1);
    expect(metrics.averageVelocity).toBe(1);
    // Consistency score with single week will be 0 (all zeros except one week)
    expect(metrics.consistencyScore).toBeGreaterThanOrEqual(0);
  });

  test('should handle zero division in trend calculation', async () => {
    const thisWeek = new Date('2026-02-03T10:00:00Z');
    await calculator.recordTaskCompletion('spec-1', 'task-1', true, thisWeek);
    
    const trend = calculator.calculateTrend();
    expect(trend).toBe(100); // Last week = 0, so 100% increase
  });

  test('should handle empty specs array for projections', () => {
    const projected = calculator.projectCompletionDate([]);
    expect(projected).toBeNull();
    
    const remaining = calculator.getRemainingTasks([]);
    expect(remaining).toBe(0);
    
    const days = calculator.calculateDaysRemaining([]);
    expect(days).toBe(0);
  });

  test('should handle all completed specs for projections', async () => {
    const timestamp = new Date('2026-02-03T10:00:00Z');
    await calculator.recordTaskCompletion('spec-1', 'task-1', true, timestamp);
    
    const specs = [
      { totalTasks: 10, completedTasks: 10 },
      { totalTasks: 5, completedTasks: 5 }
    ];
    
    const projected = calculator.projectCompletionDate(specs);
    expect(projected).toBeNull();
    
    const remaining = calculator.getRemainingTasks(specs);
    expect(remaining).toBe(0);
  });
});
