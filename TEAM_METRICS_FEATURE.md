# Team Metrics Feature

## Overview

This feature adds team-level velocity tracking to the Specs Dashboard extension, allowing project managers to see task and spec completion metrics for all team members, not just themselves.

## Problem Solved

Previously, the velocity metrics only tracked the current user's activity. As a project manager, you couldn't see the work completed by your engineers. This feature uses Git commit history to attribute task completions to the appropriate team members.

## Implementation

### 1. Type Definitions (`src/types.ts`)

Added author tracking fields to existing interfaces:

- `WeeklyTaskData.byAuthor`: Track tasks per author per week
- `WeeklySpecData.byAuthor`: Track specs per author per week
- `TaskCompletionEvent.author` & `authorEmail`: Track who completed each task
- `SpecLifecycleEvent.author` & `authorEmail`: Track who completed each spec
- `VelocityMetrics.teamMetrics`: New team-level aggregated metrics

### 2. Git Integration (`src/gitUtils.ts`)

New utility module for Git operations:

- `getFileAuthor()`: Get the author of the last commit for a file
- `getCurrentGitUser()`: Get the current Git user configuration
- `isGitRepository()`: Check if a path is in a Git repository
- `getDirectoryAuthors()`: Get all unique authors for a directory

### 3. Velocity Calculator (`src/velocityCalculator.ts`)

Updated to track authors:

- `recordTaskCompletion()`: Now accepts `author` and `authorEmail` parameters
- `recordSpecCompletion()`: Now accepts `author` and `authorEmail` parameters
- `updateSpecProgress()`: Now accepts `author` and `authorEmail` parameters
- `calculateTeamMetrics()`: New method to aggregate team-level statistics

### 4. Dashboard Provider (`src/specsDashboardProvider.ts`)

Updated task toggle handler:

- Retrieves Git author information when tasks are toggled
- Passes author data to velocity calculator
- Logs author information for debugging

### 5. Analytics UI (`src/webview/analytics.html`)

Added team metrics visualization:

- New "Team Performance" section in the Velocity tab
- Shows cards for each team member with:
  - Avatar with initials
  - Total tasks completed
  - Total specs completed
  - Velocity (tasks per week)
  - Visual velocity bar
- Automatically hidden when no team data is available

## How It Works

1. When a user toggles a task checkbox, the extension:
   - Saves the file change
   - Uses Git to identify who made the change (via `git log`)
   - Records the task completion with author information
   
2. The velocity calculator:
   - Stores author information with each task/spec completion
   - Aggregates data by author across all weeks
   - Calculates per-author velocity metrics

3. The analytics panel:
   - Displays team metrics when multiple authors are detected
   - Shows individual and team-level statistics
   - Updates in real-time as tasks are completed

## Usage

### For Project Managers

1. Open the Specs Dashboard
2. Click "Analytics" to view metrics
3. Scroll to the "Team Performance" section
4. View each engineer's:
   - Total tasks completed
   - Total specs completed
   - Current velocity (tasks/week)

### Requirements

- Project must be in a Git repository
- Team members must have Git configured with their name/email
- Git must be available in the system PATH

### Fallback Behavior

If Git is not available or the project is not in a repository:
- Tasks are still tracked
- Author information is recorded as "unknown"
- Team metrics section is hidden
- Individual metrics continue to work normally

## Benefits

- **Visibility**: See all team members' contributions
- **Planning**: Understand team capacity and velocity
- **Recognition**: Identify high performers
- **Bottlenecks**: Spot team members who may need support
- **Historical Data**: Track team performance over time

## Future Enhancements

Potential improvements for future versions:

1. Filter metrics by specific team members
2. Compare team member velocities
3. Export team reports
4. Team velocity trends over time
5. Configurable author mapping (for users with multiple Git identities)
6. Integration with other VCS systems (SVN, Mercurial)

## Testing

To test the feature:

1. Ensure you're in a Git repository
2. Complete some tasks in different specs
3. Have team members complete tasks (or simulate with different Git users)
4. Open Analytics panel
5. Verify team metrics appear with correct attribution

## Notes

- Author attribution is based on the last commit that modified the tasks.md file
- If a task is toggled multiple times, the most recent author is recorded
- The feature gracefully degrades if Git is unavailable
- No external dependencies required (uses built-in Git via command line)
