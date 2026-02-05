# Mock Data and Testing Scripts

This folder contains mock data generators and testing utilities for the Kiro Specs Dashboard extension.

## Files

### Scripts

- **generate-mock-velocity-data.js** - Generates realistic velocity data for the last 12 weeks
- **test-velocity-flow.js** - Tests and documents the velocity tracking flow

### Documentation

- **MOCK_DATA_GENERATOR_SUMMARY.md** - Overview of the mock data generation system
- **MOCK_DATA_IMPROVEMENTS.md** - Details on improvements made to mock data generation
- **MOCK_DATA_USAGE.md** - Instructions for using the mock data generator

## Usage

### Generating Mock Data

The mock data generator creates realistic velocity tracking data for testing the Metrics panel.

**Method 1: Extension Host (Recommended)**
1. Open VSCode with your workspace
2. Open Command Palette (Cmd+Shift+P / Ctrl+Shift+P)
3. Run: `Developer: Execute JavaScript in Extension Host`
4. Copy and paste the `generateMockData` function from `generate-mock-velocity-data.js`
5. Call `generateMockData()` at the end
6. Refresh the Metrics panel to see the data

**Method 2: Using the Extension's Mock Data Generator**
The extension includes a built-in mock data generator in `src/mockDataGenerator.ts` that can be called programmatically.

### Testing Velocity Flow

Run the test script to verify the velocity tracking flow:

```bash
node mocks/test-velocity-flow.js
```

This will output the expected flow of data through the system when a task is toggled.

## Mock Data Structure

The generated mock data includes:

- **weeklyTasks**: Task completion counts per week (12 weeks)
- **weeklySpecs**: Spec completion counts per week
- **specActivity**: Per-spec tracking (start date, completion date, progress)
- **dayOfWeekTasks**: Task completion counts by day of week
- **dailyTaskCounts**: Daily task completion details
- **taskCompletionEvents**: Individual task completion events (last 100)
- **specLifecycleEvents**: Spec start/completion events

## Development

When modifying the mock data generator:

1. Update the generator script in this folder
2. Update the built-in generator in `src/mockDataGenerator.ts` if needed
3. Update the documentation files to reflect changes
4. Test with the extension to ensure data renders correctly

## Notes

- Mock data is stored in VSCode workspace state
- Data persists across VSCode sessions
- To clear mock data, use VSCode's "Clear Workspace State" command
- The generator creates realistic patterns with recent weeks having more activity
