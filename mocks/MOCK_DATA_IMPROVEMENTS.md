# Mock Data Generator Improvements

## Overview

Updated the mock data generator to create comprehensive data for the new Velocity tab structure, including specs completion metrics.

## Changes Made

### 1. Weekly Specs Completion Data

**Before:**
- Specs completion data was generated randomly (only 60% of weeks had data)
- Inconsistent distribution made charts look sparse

**After:**
- Every week now has specs completion data (0-2 specs per week)
- Realistic probability distribution: 30-80% chance of completion (higher in recent weeks)
- 70% chance of 1 spec, 30% chance of 2 specs when completion occurs
- More recent weeks have higher completion rates (simulates active development)

### 2. Spec Activity Alignment

**Before:**
- Spec completion dates were random and not aligned with weekly data
- All specs had completion dates set to "now"

**After:**
- Spec completions are now aligned with the total specs completed across all weeks
- Realistic completion timelines (7-70 days from start to completion)
- Completion dates are distributed throughout the 12-week period
- Some specs are completed, others are in progress (30-90% complete)

### 3. Enhanced Console Output

**Before:**
```
Mock velocity data generated! 12 weeks, 67 days, 89 events.
```

**After:**
```
Mock velocity data generated! 12 weeks, 8 specs completed, 67 days with activity, 89 events.
```

Now includes total specs completed for better visibility.

## Data Generation Details

### Specs Per Week Distribution

```typescript
// Completion probability increases with recency
const completionChance = 0.3 + ((12 - week) / 12) * 0.5; // 30-80%

// When completion occurs:
// - 70% chance: 1 spec completed
// - 30% chance: 2 specs completed
```

### Spec Activity Generation

- **5 mock specs**: user-authentication, dashboard-ui, api-integration, data-migration, testing-suite
- **Start dates**: Distributed across last 10 weeks
- **Completion status**: Aligned with weekly completion counts
- **Progress**: Completed specs at 100%, in-progress specs at 30-90%
- **Timelines**: 7-70 days from first task to completion

## Expected Results

When you run the mock data generator, you should see:

### Specs Performance Section
- **This Week**: 0-2 specs completed
- **Average**: ~0.5-1.0 specs per week (4-week rolling average)
- **Consistency**: Medium to High (depends on distribution)

### Specs Completed Chart
- Shows last 10 weeks of data
- Bars ranging from 0-2 specs per week
- More activity in recent weeks
- Clear visual trend

### Spec Timelines
- 5 specs with realistic start/end dates
- Some completed (100% progress)
- Some in progress (30-90% progress)

## Testing

To test the improved mock data:

1. Install the extension: `kiro-specs-dashboard-0.1.0.vsix`
2. Open Command Palette: `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
3. Run: **Kiro: Generate Mock Velocity Data**
4. Open Analytics panel
5. Check Velocity tab for:
   - Specs Performance metrics
   - Specs Completed chart (should show data for all 10 weeks)
   - Consistency scores

## Files Modified

- `src/mockDataGenerator.ts` - Updated specs generation logic
- `MOCK_DATA_USAGE.md` - Updated documentation with new data characteristics

## Benefits

1. **Better Visualization**: Charts now show meaningful data instead of sparse/empty bars
2. **Realistic Patterns**: Data follows realistic development patterns (more recent activity)
3. **Aligned Data**: Specs completion counts match spec activity data
4. **Testing Coverage**: All new charts and metrics have data to display
5. **User Experience**: Developers can see how the extension works with real-looking data
