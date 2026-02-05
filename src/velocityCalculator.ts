import * as vscode from 'vscode';
import { StateManager } from './stateManager';
import {
  VelocityData,
  VelocityMetrics,
  WeeklyTaskData,
  WeeklySpecData,
  SpecActivityData,
  DayOfWeekData,
  DailyTaskCount,
  TaskCompletionEvent,
  SpecLifecycleEvent
} from './types';

/**
 * VelocityCalculator class for tracking and calculating velocity metrics
 * 
 * This class manages:
 * - Recording task completion events
 * - Tracking weekly task counts
 * - Tracking spec completion progress
 * - Calculating velocity metrics and trends
 * - Projecting completion dates
 * 
 * Requirements: 19.1, 19.2, 21.1-21.10
 */
export class VelocityCalculator {
  private velocityData: VelocityData;
  private stateManager: StateManager;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
    this.velocityData = this.getDefaultVelocityData();
  }

  /**
   * Initialize velocity data from workspace state
   * Should be called when extension activates
   * 
   * Requirements: 19.6
   */
  async initialize(): Promise<void> {
    const savedData = await this.stateManager.getVelocityData();
    if (savedData) {
      // Convert date strings back to Date objects
      this.velocityData = this.deserializeVelocityData(savedData);
    } else {
      this.velocityData = this.getDefaultVelocityData();
    }
  }

  /**
   * Record a task completion event
   * 
   * This method:
   * - Updates weekly task counts
   * - Updates day-of-week aggregations
   * - Updates spec activity tracking
   * - Records daily task count (for heatmap)
   * - Records task completion event (for activity stream)
   * - Persists data to workspace state
   * 
   * @param specName The name of the spec containing the task
   * @param taskId The task identifier (line number or task text)
   * @param isRequired Whether the task is required (not optional)
   * @param timestamp The completion timestamp (defaults to now)
   * @param taskDescription Optional task description (first 50 chars)
   * 
   * Requirements: 19.1, 19.2, Timeline Feature
   */
  async recordTaskCompletion(
    specName: string,
    taskId: string,
    isRequired: boolean,
    timestamp: Date = new Date(),
    taskDescription?: string
  ): Promise<void> {
    console.log(`[VelocityCalculator] Recording task completion: ${specName}, ${taskId}, required=${isRequired}, timestamp=${timestamp.toISOString()}`);
    
    // Update weekly tasks
    const weekStart = this.getWeekStart(timestamp);
    console.log(`[VelocityCalculator] Week start: ${weekStart.toISOString()}`);
    
    const weekData = this.getOrCreateWeekData(weekStart);
    weekData.completed++;
    if (isRequired) {
      weekData.required++;
    } else {
      weekData.optional++;
    }
    console.log(`[VelocityCalculator] Week data updated: completed=${weekData.completed}, required=${weekData.required}, optional=${weekData.optional}`);

    // Update day of week
    const dayName = this.getDayName(timestamp);
    this.velocityData.dayOfWeekTasks[dayName]++;
    console.log(`[VelocityCalculator] Day of week updated: ${dayName}=${this.velocityData.dayOfWeekTasks[dayName]}`);

    // Update spec activity
    this.updateSpecActivity(specName, timestamp);
    console.log(`[VelocityCalculator] Spec activity updated for: ${specName}`);

    // Record daily task count (for heatmap)
    this.recordDailyTaskCount(timestamp, isRequired);
    console.log(`[VelocityCalculator] Daily task count recorded`);

    // Record task completion event (for activity stream)
    this.recordTaskCompletionEvent({
      timestamp,
      specName,
      taskId,
      taskDescription: taskDescription ? taskDescription.substring(0, 50) : undefined,
      isRequired
    });
    console.log(`[VelocityCalculator] Task completion event recorded`);

    // Persist to state
    console.log(`[VelocityCalculator] Persisting velocity data...`);
    await this.persistVelocityData();
    console.log(`[VelocityCalculator] Velocity data persisted successfully`);
    
    // Log summary
    console.log(`[VelocityCalculator] Total weekly tasks: ${this.velocityData.weeklyTasks.length} weeks`);
    console.log(`[VelocityCalculator] Total specs tracked: ${Object.keys(this.velocityData.specActivity).length}`);
  }

  /**
   * Record spec completion (when spec reaches 100%)
   * 
   * This method:
   * - Updates spec activity with completion date
   * - Updates weekly spec completion counts
   * - Records spec lifecycle event
   * - Persists data to workspace state
   * 
   * @param specName The name of the spec that was completed
   * @param totalTasks Total number of tasks in the spec
   * @param completedTasks Number of completed tasks
   * @param timestamp The completion timestamp (defaults to now)
   * 
   * Requirements: 21.4, 21.5, 21.6, Timeline Feature
   */
  async recordSpecCompletion(
    specName: string,
    totalTasks: number,
    completedTasks: number,
    timestamp: Date = new Date()
  ): Promise<void> {
    // Update spec activity
    if (!this.velocityData.specActivity[specName]) {
      this.velocityData.specActivity[specName] = {
        firstTaskDate: null,
        lastTaskDate: null,
        completionDate: null,
        totalTasks: 0,
        completedTasks: 0
      };
    }
    
    const activity = this.velocityData.specActivity[specName];
    activity.completionDate = timestamp;
    activity.totalTasks = totalTasks;
    activity.completedTasks = completedTasks;
    
    // Update weekly specs
    const weekStart = this.getWeekStart(timestamp);
    const weekData = this.getOrCreateSpecWeekData(weekStart);
    weekData.completed++;
    
    // Record spec lifecycle event
    this.recordSpecLifecycleEvent({
      specName,
      eventType: 'completed',
      timestamp,
      progress: 100
    });
    
    // Persist to state
    await this.persistVelocityData();
  }

  /**
   * Update spec progress (called on any task change)
   * 
   * This method:
   * - Updates spec activity with current task counts
   * - Checks if spec reached 100% and records completion
   * 
   * @param specName The name of the spec
   * @param totalTasks Total number of tasks in the spec
   * @param completedTasks Number of completed tasks
   * 
   * Requirements: 21.4, 21.5, 21.6
   */
  async updateSpecProgress(
    specName: string,
    totalTasks: number,
    completedTasks: number
  ): Promise<void> {
    if (!this.velocityData.specActivity[specName]) {
      this.velocityData.specActivity[specName] = {
        firstTaskDate: null,
        lastTaskDate: null,
        completionDate: null,
        totalTasks: 0,
        completedTasks: 0
      };
    }
    
    const activity = this.velocityData.specActivity[specName];
    const wasCompleted = activity.completionDate !== null;
    const isNowCompleted = completedTasks === totalTasks && totalTasks > 0;
    
    activity.totalTasks = totalTasks;
    activity.completedTasks = completedTasks;
    
    // If spec just reached 100%, record completion
    if (isNowCompleted && !wasCompleted) {
      await this.recordSpecCompletion(specName, totalTasks, completedTasks);
    }
    // If spec was completed but is no longer (task unchecked), clear completion date
    else if (!isNowCompleted && wasCompleted) {
      const previousCompletionDate = activity.completionDate;
      activity.completionDate = null;
      // Decrement weekly spec count
      if (previousCompletionDate) {
        const weekStart = this.getWeekStart(previousCompletionDate);
        const weekData = this.velocityData.weeklySpecs.find(
          w => w.weekStart.getTime() === weekStart.getTime()
        );
        if (weekData && weekData.completed > 0) {
          weekData.completed--;
        }
      }
    }
    
    await this.persistVelocityData();
  }

  /**
   * Get tasks completed per week for the last N weeks
   * 
   * Requirements: 21.1
   */
  getTasksPerWeek(weeks: number): number[] {
    const result: number[] = [];
    const sortedWeeks = [...this.velocityData.weeklyTasks].sort(
      (a, b) => a.weekStart.getTime() - b.weekStart.getTime()
    );
    
    // Get the last N weeks
    const recentWeeks = sortedWeeks.slice(-weeks);
    
    for (const week of recentWeeks) {
      result.push(week.completed);
    }
    
    // Pad with zeros if we don't have enough data
    while (result.length < weeks) {
      result.unshift(0);
    }
    
    return result;
  }

  /**
   * Calculate velocity trend (current week vs last week)
   * 
   * Requirements: 21.2
   */
  calculateTrend(): number {
    const current = this.getCurrentWeekTasks();
    const last = this.getLastWeekTasks();
    
    if (last === 0) {
      return current > 0 ? 100 : 0;
    }
    
    return Math.round(((current - last) / last) * 100);
  }

  /**
   * Calculate rolling average velocity
   * 
   * Requirements: 21.3
   */
  calculateRollingAverage(weeks: number): number {
    const recentWeeks = this.velocityData.weeklyTasks.slice(-weeks);
    
    if (recentWeeks.length === 0) {
      return 0;
    }
    
    const total = recentWeeks.reduce((sum, week) => sum + week.completed, 0);
    return Math.round((total / recentWeeks.length) * 10) / 10; // Round to 1 decimal
  }

  /**
   * Calculate consistency score based on standard deviation
   * 
   * Requirements: 21.9
   */
  calculateConsistencyScore(): number {
    const tasks = this.getTasksPerWeek(8);
    
    if (tasks.length === 0) {
      return 0;
    }
    
    const mean = tasks.reduce((a, b) => a + b, 0) / tasks.length;
    
    if (mean === 0) {
      return 100; // Perfect consistency if no tasks
    }
    
    const variance = tasks.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / tasks.length;
    const stdDev = Math.sqrt(variance);
    
    // Lower std dev = higher consistency
    // Normalize to 0-100 scale
    const maxStdDev = mean; // Assume max std dev equals mean
    const score = Math.max(0, 100 - (stdDev / maxStdDev) * 100);
    return Math.round(score);
  }

  /**
   * Get consistency rating based on score
   * 
   * Requirements: 21.9
   */
  getConsistencyRating(): 'High' | 'Medium' | 'Low' {
    const score = this.calculateConsistencyScore();
    
    if (score >= 70) {
      return 'High';
    } else if (score >= 40) {
      return 'Medium';
    } else {
      return 'Low';
    }
  }

  /**
   * Calculate required vs optional task split
   * 
   * Requirements: 21.8
   */
  calculateRequiredVsOptional(): { required: number; optional: number } {
    let totalRequired = 0;
    let totalOptional = 0;
    
    for (const week of this.velocityData.weeklyTasks) {
      totalRequired += week.required;
      totalOptional += week.optional;
    }
    
    return {
      required: totalRequired,
      optional: totalOptional
    };
  }

  /**
   * Get specs completed per week for the last N weeks
   * 
   * Requirements: 21.4
   */
  getSpecsPerWeek(weeks: number): number[] {
    const result: number[] = [];
    const sortedWeeks = [...this.velocityData.weeklySpecs].sort(
      (a, b) => a.weekStart.getTime() - b.weekStart.getTime()
    );
    
    // Get the last N weeks
    const recentWeeks = sortedWeeks.slice(-weeks);
    
    for (const week of recentWeeks) {
      result.push(week.completed);
    }
    
    // Pad with zeros if we don't have enough data
    while (result.length < weeks) {
      result.unshift(0);
    }
    
    return result;
  }

  /**
   * Calculate average time to complete a spec
   * 
   * Requirements: 21.5
   */
  calculateAvgTimeToComplete(): number {
    const completedSpecs = Object.values(this.velocityData.specActivity).filter(
      spec => spec.firstTaskDate && spec.completionDate
    );
    
    if (completedSpecs.length === 0) {
      return 0;
    }
    
    const totalDays = completedSpecs.reduce((sum, spec) => {
      const days = this.daysBetween(spec.firstTaskDate!, spec.completionDate!);
      return sum + days;
    }, 0);
    
    return Math.round(totalDays / completedSpecs.length);
  }

  /**
   * Calculate time distribution (fast/medium/slow)
   * 
   * Requirements: 21.6
   */
  calculateTimeDistribution(): { fast: number; medium: number; slow: number } {
    const completedSpecs = Object.values(this.velocityData.specActivity).filter(
      spec => spec.firstTaskDate && spec.completionDate
    );
    
    let fast = 0;
    let medium = 0;
    let slow = 0;
    
    for (const spec of completedSpecs) {
      const days = this.daysBetween(spec.firstTaskDate!, spec.completionDate!);
      
      if (days <= 10) {
        fast++;
      } else if (days <= 20) {
        medium++;
      } else {
        slow++;
      }
    }
    
    return { fast, medium, slow };
  }

  /**
   * Get remaining tasks count
   * 
   * @param specs Optional array of spec files to calculate from
   * @returns Total number of remaining tasks across all specs
   * 
   * Requirements: 21.10
   */
  getRemainingTasks(specs?: Array<{ totalTasks: number; completedTasks: number }>): number {
    if (!specs || specs.length === 0) {
      return 0;
    }
    
    return specs.reduce((total, spec) => {
      return total + (spec.totalTasks - spec.completedTasks);
    }, 0);
  }

  /**
   * Project completion date based on velocity
   * 
   * @param specs Optional array of spec files to calculate remaining tasks from
   * @returns Projected completion date or null if cannot be calculated
   * 
   * Requirements: 21.6, 21.10
   */
  projectCompletionDate(specs?: Array<{ totalTasks: number; completedTasks: number }>): Date | null {
    const remaining = this.getRemainingTasks(specs);
    const avgVelocity = this.calculateRollingAverage(4);
    
    if (remaining === 0 || avgVelocity === 0) {
      return null;
    }
    
    const weeksRemaining = remaining / avgVelocity;
    const daysRemaining = Math.ceil(weeksRemaining * 7);
    
    const projectedDate = new Date();
    projectedDate.setDate(projectedDate.getDate() + daysRemaining);
    
    return projectedDate;
  }

  /**
   * Calculate days remaining based on projection
   * 
   * @param specs Optional array of spec files to calculate from
   * @returns Number of days remaining
   * 
   * Requirements: 21.10
   */
  calculateDaysRemaining(specs?: Array<{ totalTasks: number; completedTasks: number }>): number {
    const projectedDate = this.projectCompletionDate(specs);
    
    if (!projectedDate) {
      return 0;
    }
    
    return this.daysBetween(new Date(), projectedDate);
  }

  /**
   * Record daily task count for calendar heatmap
   * 
   * @param date The date of task completion
   * @param isRequired Whether the task is required
   * 
   * Requirements: Timeline Feature - Calendar Heatmap
   */
  private recordDailyTaskCount(date: Date, isRequired: boolean): void {
    const dateStr = this.formatDateYYYYMMDD(date);
    
    let dailyCount = this.velocityData.dailyTaskCounts.find(d => d.date === dateStr);
    
    if (!dailyCount) {
      dailyCount = {
        date: dateStr,
        completed: 0,
        required: 0,
        optional: 0
      };
      this.velocityData.dailyTaskCounts.push(dailyCount);
    }
    
    dailyCount.completed++;
    if (isRequired) {
      dailyCount.required++;
    } else {
      dailyCount.optional++;
    }
    
    // Keep only last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const cutoffStr = this.formatDateYYYYMMDD(ninetyDaysAgo);
    
    this.velocityData.dailyTaskCounts = this.velocityData.dailyTaskCounts.filter(
      d => d.date >= cutoffStr
    );
  }

  /**
   * Get daily task counts for the last N days
   * 
   * @param days Number of days to retrieve
   * @returns Array of daily task counts
   * 
   * Requirements: Timeline Feature - Calendar Heatmap
   */
  getDailyTaskCounts(days: number): DailyTaskCount[] {
    const result: DailyTaskCount[] = [];
    const today = new Date();
    
    // Generate array of last N days
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = this.formatDateYYYYMMDD(date);
      
      const existing = this.velocityData.dailyTaskCounts.find(d => d.date === dateStr);
      
      result.push(existing || {
        date: dateStr,
        completed: 0,
        required: 0,
        optional: 0
      });
    }
    
    return result;
  }

  /**
   * Record task completion event for activity stream
   * 
   * @param event The task completion event
   * 
   * Requirements: Timeline Feature - Activity Stream
   */
  private recordTaskCompletionEvent(event: TaskCompletionEvent): void {
    this.velocityData.taskCompletionEvents.push(event);
    
    // Keep only last 100 events
    if (this.velocityData.taskCompletionEvents.length > 100) {
      this.velocityData.taskCompletionEvents = this.velocityData.taskCompletionEvents.slice(-100);
    }
  }

  /**
   * Get recent task completion events
   * 
   * @param limit Maximum number of events to return
   * @returns Array of recent task completion events
   * 
   * Requirements: Timeline Feature - Activity Stream
   */
  getRecentTaskEvents(limit: number): TaskCompletionEvent[] {
    return this.velocityData.taskCompletionEvents.slice(-limit).reverse();
  }

  /**
   * Record spec lifecycle event for timeline
   * 
   * @param event The spec lifecycle event
   * 
   * Requirements: Timeline Feature - Spec Timeline
   */
  private recordSpecLifecycleEvent(event: SpecLifecycleEvent): void {
    this.velocityData.specLifecycleEvents.push(event);
  }

  /**
   * Get spec lifecycle events
   * 
   * @returns Array of all spec lifecycle events
   * 
   * Requirements: Timeline Feature - Spec Timeline
   */
  getSpecLifecycleEvents(): SpecLifecycleEvent[] {
    return this.velocityData.specLifecycleEvents;
  }

  /**
   * Get spec timelines for Gantt-style display
   * 
   * @returns Array of spec timeline data
   * 
   * Requirements: Timeline Feature - Spec Timeline
   */
  getSpecTimelines(): Array<{
    specName: string;
    startDate: Date | null;
    endDate: Date | null;
    progress: number;
    totalTasks: number;
    completedTasks: number;
  }> {
    return Object.entries(this.velocityData.specActivity).map(([specName, activity]) => ({
      specName,
      startDate: activity.firstTaskDate,
      endDate: activity.completionDate,
      progress: activity.totalTasks > 0 
        ? Math.round((activity.completedTasks / activity.totalTasks) * 100) 
        : 0,
      totalTasks: activity.totalTasks,
      completedTasks: activity.completedTasks
    }));
  }

  /**
   * Calculate all velocity metrics
   * 
   * @param specs Optional array of spec files for projection calculations
   * @returns Complete velocity metrics
   * 
   * Requirements: 21.1-21.10
   */
  calculateMetrics(specs?: Array<{ totalTasks: number; completedTasks: number }>): VelocityMetrics {
    console.log(`[VelocityCalculator] Calculating metrics...`);
    console.log(`[VelocityCalculator] Velocity data state:`, {
      weeklyTasksCount: this.velocityData.weeklyTasks.length,
      weeklySpecsCount: this.velocityData.weeklySpecs.length,
      specActivityCount: Object.keys(this.velocityData.specActivity).length,
      dayOfWeekTasks: this.velocityData.dayOfWeekTasks
    });
    
    const metrics = {
      // Tasks metrics
      tasksPerWeek: this.getTasksPerWeek(12),
      currentWeekTasks: this.getCurrentWeekTasks(),
      lastWeekTasks: this.getLastWeekTasks(),
      velocityTrend: this.calculateTrend(),
      averageVelocity: this.calculateRollingAverage(4),
      consistencyScore: this.calculateConsistencyScore(),
      consistencyRating: this.getConsistencyRating(),
      
      // Specs metrics
      specsPerWeek: this.getSpecsPerWeek(12),
      currentWeekSpecs: this.getCurrentWeekSpecs(),
      averageSpecs: this.calculateSpecsRollingAverage(4),
      specsConsistencyScore: this.calculateSpecsConsistencyScore(),
      specsConsistencyRating: this.getSpecsConsistencyRating(),
      
      // Other metrics
      averageTimeToComplete: this.calculateAvgTimeToComplete(),
      timeDistribution: this.calculateTimeDistribution(),
      projectedCompletionDate: this.projectCompletionDate(specs),
      remainingTasks: this.getRemainingTasks(specs),
      daysRemaining: this.calculateDaysRemaining(specs),
      dayOfWeekVelocity: { ...this.velocityData.dayOfWeekTasks },
      requiredVsOptional: this.calculateRequiredVsOptional(),
      
      // Timeline feature data
      dailyActivity: this.getDailyTaskCounts(84), // Last 12 weeks
      recentEvents: this.getRecentTaskEvents(100),
      specTimelines: this.getSpecTimelines()
    };
    
    console.log(`[VelocityCalculator] Calculated metrics:`, {
      currentWeekTasks: metrics.currentWeekTasks,
      lastWeekTasks: metrics.lastWeekTasks,
      averageVelocity: metrics.averageVelocity,
      velocityTrend: metrics.velocityTrend,
      remainingTasks: metrics.remainingTasks,
      currentWeekSpecs: metrics.currentWeekSpecs,
      averageSpecs: metrics.averageSpecs,
      specsConsistencyScore: metrics.specsConsistencyScore
    });
    
    return metrics;
  }

  /**
   * Update spec activity tracking
   */
  private updateSpecActivity(specName: string, timestamp: Date): void {
    if (!this.velocityData.specActivity[specName]) {
      this.velocityData.specActivity[specName] = {
        firstTaskDate: timestamp,
        lastTaskDate: timestamp,
        completionDate: null,
        totalTasks: 0,
        completedTasks: 0
      };
    } else {
      const activity = this.velocityData.specActivity[specName];
      
      // Update first task date if this is earlier
      if (!activity.firstTaskDate || timestamp < activity.firstTaskDate) {
        activity.firstTaskDate = timestamp;
      }
      
      // Update last task date if this is later
      if (!activity.lastTaskDate || timestamp > activity.lastTaskDate) {
        activity.lastTaskDate = timestamp;
      }
    }
  }

  /**
   * Get current week tasks
   */
  private getCurrentWeekTasks(): number {
    const currentWeekStart = this.getWeekStart(new Date());
    const weekData = this.velocityData.weeklyTasks.find(
      w => w.weekStart.getTime() === currentWeekStart.getTime()
    );
    return weekData ? weekData.completed : 0;
  }

  /**
   * Get last week tasks
   */
  private getLastWeekTasks(): number {
    const lastWeekStart = this.getWeekStart(new Date());
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    
    const weekData = this.velocityData.weeklyTasks.find(
      w => w.weekStart.getTime() === lastWeekStart.getTime()
    );
    return weekData ? weekData.completed : 0;
  }

  /**
   * Get current week specs completed
   */
  private getCurrentWeekSpecs(): number {
    const currentWeekStart = this.getWeekStart(new Date());
    const weekData = this.velocityData.weeklySpecs.find(
      w => w.weekStart.getTime() === currentWeekStart.getTime()
    );
    return weekData ? weekData.completed : 0;
  }

  /**
   * Calculate rolling average for specs (n-week)
   */
  private calculateSpecsRollingAverage(weeks: number): number {
    if (this.velocityData.weeklySpecs.length === 0) {
      return 0;
    }
    
    // Get last n weeks
    const recentWeeks = this.velocityData.weeklySpecs.slice(-weeks);
    const total = recentWeeks.reduce((sum, week) => sum + week.completed, 0);
    
    return total / weeks;
  }

  /**
   * Calculate consistency score for specs
   * Measures how consistent spec completion is week-over-week
   */
  private calculateSpecsConsistencyScore(): number {
    if (this.velocityData.weeklySpecs.length < 2) {
      return 0;
    }
    
    const recentWeeks = this.velocityData.weeklySpecs.slice(-8); // Last 8 weeks
    const values = recentWeeks.map(w => w.completed);
    
    // Calculate standard deviation
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Convert to consistency score (0-100)
    // Lower std dev = higher consistency
    if (mean === 0) {
      return 0;
    }
    
    const coefficientOfVariation = stdDev / mean;
    const consistencyScore = Math.max(0, Math.min(100, 100 - (coefficientOfVariation * 100)));
    
    return Math.round(consistencyScore);
  }

  /**
   * Get consistency rating for specs based on score
   */
  private getSpecsConsistencyRating(): 'High' | 'Medium' | 'Low' {
    const score = this.calculateSpecsConsistencyScore();
    
    if (score >= 70) {
      return 'High';
    } else if (score >= 40) {
      return 'Medium';
    } else {
      return 'Low';
    }
  }

  /**
   * Get or create week data for a given week start
   */
  private getOrCreateWeekData(weekStart: Date): WeeklyTaskData {
    let weekData = this.velocityData.weeklyTasks.find(
      w => w.weekStart.getTime() === weekStart.getTime()
    );
    
    if (!weekData) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      weekData = {
        weekStart,
        weekEnd,
        completed: 0,
        required: 0,
        optional: 0
      };
      
      this.velocityData.weeklyTasks.push(weekData);
    }
    
    return weekData;
  }

  /**
   * Get or create spec week data for a given week start
   */
  private getOrCreateSpecWeekData(weekStart: Date): WeeklySpecData {
    let weekData = this.velocityData.weeklySpecs.find(
      w => w.weekStart.getTime() === weekStart.getTime()
    );
    
    if (!weekData) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      weekData = {
        weekStart,
        weekEnd,
        completed: 0,
        started: 0
      };
      
      this.velocityData.weeklySpecs.push(weekData);
    }
    
    return weekData;
  }

  /**
   * Get the start of the week (Monday) for a given date
   */
  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const weekStart = new Date(d.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }

  /**
   * Get day name from date
   */
  private getDayName(date: Date): keyof DayOfWeekData {
    const days: (keyof DayOfWeekData)[] = [
      'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
    ];
    return days[date.getDay()];
  }

  /**
   * Calculate days between two dates
   */
  private daysBetween(start: Date, end: Date): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    const diff = end.getTime() - start.getTime();
    return Math.round(diff / msPerDay);
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private formatDateYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Get default velocity data structure
   */
  private getDefaultVelocityData(): VelocityData {
    return {
      weeklyTasks: [],
      weeklySpecs: [],
      specActivity: {},
      dayOfWeekTasks: {
        monday: 0,
        tuesday: 0,
        wednesday: 0,
        thursday: 0,
        friday: 0,
        saturday: 0,
        sunday: 0
      },
      dailyTaskCounts: [],
      taskCompletionEvents: [],
      specLifecycleEvents: []
    };
  }

  /**
   * Persist velocity data to workspace state
   */
  private async persistVelocityData(): Promise<void> {
    await this.stateManager.saveVelocityData(this.velocityData);
  }

  /**
   * Deserialize velocity data (convert date strings to Date objects)
   * Handles corrupted data gracefully by using defaults
   */
  private deserializeVelocityData(data: any): VelocityData {
    try {
      // Validate data structure
      if (!data || typeof data !== 'object') {
        return this.getDefaultVelocityData();
      }

      return {
        weeklyTasks: Array.isArray(data.weeklyTasks) 
          ? data.weeklyTasks.map((w: any) => ({
              ...w,
              weekStart: new Date(w.weekStart),
              weekEnd: new Date(w.weekEnd)
            }))
          : [],
        weeklySpecs: Array.isArray(data.weeklySpecs)
          ? data.weeklySpecs.map((w: any) => ({
              ...w,
              weekStart: new Date(w.weekStart),
              weekEnd: new Date(w.weekEnd)
            }))
          : [],
        specActivity: data.specActivity && typeof data.specActivity === 'object'
          ? Object.fromEntries(
              Object.entries(data.specActivity).map(([key, value]: [string, any]) => [
                key,
                {
                  ...value,
                  firstTaskDate: value.firstTaskDate ? new Date(value.firstTaskDate) : null,
                  lastTaskDate: value.lastTaskDate ? new Date(value.lastTaskDate) : null,
                  completionDate: value.completionDate ? new Date(value.completionDate) : null
                }
              ])
            )
          : {},
        dayOfWeekTasks: data.dayOfWeekTasks && typeof data.dayOfWeekTasks === 'object'
          ? data.dayOfWeekTasks
          : {
              monday: 0,
              tuesday: 0,
              wednesday: 0,
              thursday: 0,
              friday: 0,
              saturday: 0,
              sunday: 0
            },
        dailyTaskCounts: Array.isArray(data.dailyTaskCounts)
          ? data.dailyTaskCounts
          : [],
        taskCompletionEvents: Array.isArray(data.taskCompletionEvents)
          ? data.taskCompletionEvents.map((e: any) => ({
              ...e,
              timestamp: new Date(e.timestamp)
            }))
          : [],
        specLifecycleEvents: Array.isArray(data.specLifecycleEvents)
          ? data.specLifecycleEvents.map((e: any) => ({
              ...e,
              timestamp: new Date(e.timestamp)
            }))
          : []
      };
    } catch (error) {
      // If deserialization fails, return default data
      console.error('Failed to deserialize velocity data:', error);
      return this.getDefaultVelocityData();
    }
  }
}
