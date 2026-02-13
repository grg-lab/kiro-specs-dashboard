# Testing Team Metrics Feature

## Quick Start - Import Your Existing Data

Since your team has already completed tasks, you need to import that historical data from Git:

### Step 1: Import Historical Data

1. Open the Command Palette (`Cmd+Shift+P` on Mac, `Ctrl+Shift+P` on Windows/Linux)
2. Type: `Specs Dashboard: Import Velocity Data from Git History`
3. Press Enter
4. Click "Migrate Data" when prompted
5. Wait for the migration to complete (may take a few minutes depending on your Git history)
6. You'll see a message like: "Migration complete! Processed 45 tasks from 3 team members."

### Step 2: View Analytics

1. Open your Specs Dashboard (if not already open)
2. Click the "Analytics" button in the dashboard
3. The Analytics panel will open showing the Velocity tab

### Step 3: Verify Team Metrics

You should now see:

1. **Specs Performance** section with your team's metrics
2. **Tasks Performance** section with completion data
3. **Team Performance** section showing all team members who have committed to your specs:
   - Each engineer's name (from Git)
   - Total tasks completed
   - Total specs completed
   - Velocity (tasks per week)
   - Visual velocity bar

## How It Works

The migration script:
1. Scans all spec folders in `.kiro/specs/`
2. Analyzes Git history for each `tasks.md` file
3. Identifies when tasks were marked as completed (checkbox changes from `[ ]` to `[x]`)
4. Extracts the author information from Git commits
5. Records each completion with the correct timestamp and author
6. Builds up your team's velocity history

## Alternative: Generate Test Data

If you want to see the feature with mock data first:

1. Command Palette → `Specs Dashboard: Generate Mock Velocity Data`
2. This creates sample data with 4 fictional team members
3. Good for testing the UI before importing real data

## Troubleshooting

### No Data After Migration

If migration completes but you don't see data:

1. Check the Output panel:
   - View → Output
   - Select "Specs Dashboard" from the dropdown
   - Look for migration logs and any errors

2. Verify Git is working:
   ```bash
   git log --oneline .kiro/specs/
   ```

3. Make sure tasks were actually committed:
   - The migration only finds tasks that were committed to Git
   - If tasks were completed but not committed, they won't be imported

### Partial Data

If you see some team members but not all:

- Only team members who committed changes to `tasks.md` files will appear
- If someone completed tasks but another person committed them, the committer is recorded
- This is based on Git commit history, not who actually did the work

### Migration Takes Too Long

For large repositories:

- The migration analyzes the full Git history of all tasks.md files
- This can take several minutes for repos with extensive history
- Check the Output panel to see progress
- The migration runs in the background, you can continue working

## After Migration

Once migration is complete:

1. **Future tasks** will be tracked automatically when toggled
2. **Team metrics** will update in real-time
3. **Historical data** is preserved and combined with new data
4. You can re-run migration if needed (it will update existing data)

## Clear and Start Over

If you need to reset:

1. `Specs Dashboard: Clear Velocity Data` - removes all velocity data
2. `Specs Dashboard: Import Velocity Data from Git History` - re-import from Git
3. Or use mock data for testing: `Specs Dashboard: Generate Mock Velocity Data`

## Notes

- Migration is safe and non-destructive (doesn't modify your Git history or files)
- You can run it multiple times if needed
- Data is stored in VSCode workspace state
- Each workspace has its own velocity data
- The feature works offline once data is imported
