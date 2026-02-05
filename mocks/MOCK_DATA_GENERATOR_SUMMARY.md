# Mock Data Generator - Implementation Summary

## Overview

Successfully implemented a mock data generator for testing the Analytics tab with 12 weeks of realistic velocity data.

## Implementation Details

### Files Created/Modified

1. **src/mockDataGenerator.ts** (NEW)
   - `generateMockVelocityData()` function
   - Generates 12 weeks of realistic data
   - Creates 5 mock specs with varying completion rates
   - Produces daily activity, events, and lifecycle data

2. **src/extension.ts** (MODIFIED)
   - Added import for `generateMockVelocityData`
   - Registered `specs-dashboard.generateMockData` command
   - Command calls generator with StateManager instance

3. **src/specsDashboardProvider.ts** (MODIFIED)
   - Added `getStateManager()` method
   - Exposes StateManager instance for mock data generator

4. **package.json** (MODIFIED)
   - Registered command: `specs-dashboard.generateMockData`
   - Title: "Generate Mock Velocity Data"
   - Category: "Kiro"

5. **MOCK_DATA_USAGE.md** (NEW)
   - Complete usage documentation
   - Explains what data is generated
   - Instructions for using the command

## How to Use

### Command Palette Method
1. Open Command Palette (`Cmd+Shift+P`)
2. Type "Generate Mock Velocity Data"
3. Select: **Kiro: Generate Mock Velocity Data**
4. Wait for confirmation message
5. Open Analytics panel to view data

### What Gets Generated

- **12 weeks** of weekly task completion data
- **84 days** of daily activity (with realistic gaps)
- **Up to 100** task completion events
- **5 mock specs**: user-authentication, dashboard-ui, api-integration, data-migration, testing-suite
- **Spec lifecycle events** (started/completed)
- **Realistic patterns**: More recent weeks have higher activity

## Testing

- All 99 unit tests pass ✅
- No TypeScript compilation errors ✅
- No diagnostics issues ✅
- Command properly registered ✅

## Technical Details

### Data Structure

The generator creates a complete `VelocityData` object with:
- `weeklyTasks[]` - Weekly aggregates
- `weeklySpecs[]` - Spec completion by week
- `specActivity{}` - Per-spec tracking
- `dayOfWeekTasks{}` - Day-of-week distribution
- `dailyTaskCounts[]` - Daily activity for heatmap
- `taskCompletionEvents[]` - Event stream data
- `specLifecycleEvents[]` - Spec timeline data

### Realistic Patterns

- **Activity Distribution**: 0-4 tasks per day
- **Recency Boost**: More recent weeks have 2-5 more tasks
- **Working Hours**: Events timestamped 9 AM - 5 PM
- **Completion Rates**: 30-100% per spec
- **Event Limit**: Keeps only last 100 events

## Next Steps

Users can now:
1. Generate mock data to test the Analytics UI
2. See realistic velocity trends
3. Explore the Timeline tab features
4. Demonstrate the extension's capabilities

## Notes

- Data is workspace-scoped (persists in VSCode Memento)
- Overwrites existing velocity data when run
- Best used in test workspaces
- Data persists across VSCode sessions
- Cleared when extension is uninstalled
