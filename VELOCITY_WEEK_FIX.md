# Velocity Week Distribution Fix

## Issue
All historical tasks from the migration were being placed in the current week instead of being distributed across their actual commit dates (Feb 2, 5, 7, 2026).

## Root Cause
The `getOrCreateWeekData()` method was comparing week start dates using direct timestamp comparison (`getTime()`), but dates deserialized from JSON or created at different times could have slightly different time components even when representing the same week start.

## Solution

### 1. Normalized Date Comparison
Updated `getOrCreateWeekData()` and `getOrCreateSpecWeekData()` to normalize dates before comparison:

```typescript
private getOrCreateWeekData(weekStart: Date): WeeklyTaskData {
  // Normalize the weekStart to ensure consistent comparison
  const normalizedWeekStart = new Date(weekStart);
  normalizedWeekStart.setHours(0, 0, 0, 0);
  
  // Find existing week data by comparing normalized dates
  let weekData = this.velocityData.weeklyTasks.find(w => {
    const existingWeekStart = new Date(w.weekStart);
    existingWeekStart.setHours(0, 0, 0, 0);
    return existingWeekStart.getTime() === normalizedWeekStart.getTime();
  });
  // ...
}
```

### 2. Improved getWeekStart()
Ensured the `getWeekStart()` method returns properly normalized dates:

```typescript
private getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0); // Normalize to start of day first
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0); // Ensure normalized
  return d;
}
```

### 3. Fixed Spec Completion Tracking
Updated `updateSpecProgress()` to use the same normalized comparison when decrementing spec counts:

```typescript
const weekData = this.velocityData.weeklySpecs.find(w => {
  const existingWeekStart = new Date(w.weekStart);
  existingWeekStart.setHours(0, 0, 0, 0);
  return existingWeekStart.getTime() === normalizedWeekStart.getTime();
});
```

## Impact
- Historical tasks from migration now correctly distribute across their actual weeks
- Spec completion tracking properly detects when all tasks are done
- Week-based charts now show accurate historical data
- Team metrics correctly attribute work to the right time periods

## Testing
1. Clear existing velocity data (or use fresh workspace)
2. Run migration: Command Palette → "Specs Dashboard: Migrate Velocity Data"
3. Check Output panel for migration logs showing different week starts
4. Open Analytics tab and verify tasks are distributed across multiple weeks
5. Complete all tasks in a spec and verify it appears in spec completion metrics
