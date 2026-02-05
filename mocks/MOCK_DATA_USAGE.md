# Mock Data Generator Usage

## Overview

The mock data generator creates realistic velocity data for testing the Analytics tab. This is useful for:
- Testing the Analytics UI with realistic data
- Demonstrating the extension's capabilities
- Development and debugging

## How to Use

### Method 1: Command Palette (Recommended)

1. Open the Command Palette (`Cmd+Shift+P` on macOS, `Ctrl+Shift+P` on Windows/Linux)
2. Type "Generate Mock Velocity Data"
3. Select the command: **Kiro: Generate Mock Velocity Data**
4. Wait for the confirmation message
5. Open the Analytics panel to see the generated data

### Method 2: Programmatically

You can also call the generator from code:

```typescript
import { generateMockVelocityData } from './mockDataGenerator';
import { StateManager } from './stateManager';

// Assuming you have access to the StateManager instance
await generateMockVelocityData(stateManager);
```

## What Data is Generated

The mock data generator creates:

### 1. Weekly Task Completions (12 weeks)
- Required and optional task counts
- Realistic activity patterns (more recent weeks have higher activity)
- Weekly summaries for velocity calculations

### 2. Weekly Spec Completions (12 weeks)
- Specs completed per week (0-2 specs)
- More recent weeks have higher completion rates
- Aligned with spec activity data

### 3. Daily Task Counts (84 days)
- Daily activity for the calendar heatmap
- Day-of-week distribution
- Realistic daily patterns (0-4 tasks per day)

### 4. Task Completion Events (up to 100 events)
- Timestamps with realistic working hours (9 AM - 5 PM)
- Task descriptions from a predefined list
- Associated spec names
- Required vs optional task flags

### 5. Spec Lifecycle Events
- Spec start dates
- Spec completion dates (for completed specs)
- Progress tracking

### 6. Spec Activity
- 5 mock specs: `user-authentication`, `dashboard-ui`, `api-integration`, `data-migration`, `testing-suite`
- First and last task dates
- Total and completed task counts
- Completion status (some completed, some in progress)
- Realistic completion timelines (7-70 days)

## Data Characteristics

- **Time Range**: Last 12 weeks from today
- **Activity Pattern**: More recent weeks have higher activity (simulates active development)
- **Specs Completion**: 0-2 specs per week, with 30-80% completion probability (higher in recent weeks)
- **Task Completion Rate**: 30-90% completion per spec
- **Daily Tasks**: 0-4 tasks per day (realistic workload)
- **Event Limit**: Maximum 100 task completion events (most recent)
- **Spec Timelines**: Realistic 7-70 day completion times

## Viewing the Data

After generating mock data:

1. Open the Specs Dashboard
2. Click the "Analytics" button
3. Navigate through the tabs:
   - **Velocity**: See specs and tasks performance metrics with charts showing:
     - Specs Performance: This Week | Average | Consistency metrics
     - Specs Completed chart (last 10 weeks)
     - Tasks Performance: This Week | Average | Consistency metrics
     - Tasks Completed chart (last 10 weeks)
     - Required vs Optional pie chart
     - Day of Week distribution
     - Average Time to Complete
   - **Timeline**: View calendar heatmap, activity stream, and spec timelines

## Clearing Mock Data

To clear the mock data and start fresh:

1. The data is stored in VSCode's workspace state
2. You can clear it by:
   - Uninstalling and reinstalling the extension
   - Manually clearing workspace state (advanced)
   - Generating new mock data (overwrites existing data)

## Notes

- Mock data is workspace-scoped (each workspace has its own data)
- The data persists across VSCode sessions
- Real task completions will be mixed with mock data if you generate mock data in a workspace with existing specs
- For best results, use mock data in a test workspace without real specs

## Example Output

After running the command, you'll see a message like:

```
Mock velocity data generated! 12 weeks, 8 specs completed, 67 days with activity, 89 events. Refresh Analytics to see it.
```

This confirms:
- 12 weeks of weekly data (both tasks and specs)
- 8 specs completed across all weeks
- 67 days with activity (out of 84 possible days)
- 89 task completion events
