# Quick Screenshot Reference

## Checklist

- [ ] **dashboard-overview.png** - Main dashboard with spec cards
- [ ] **team-metrics.png** - Team Performance section in Metrics panel
- [ ] **velocity-charts.png** - Velocity tab with charts and stats
- [ ] **execution-profiles.png** - Execute dropdown or Profiles panel
- [ ] **notes-panel.png** - Notes panel with rich text editor

## Quick Steps

### 1. Dashboard Overview
1. Open the Kiro Specs Dashboard (click icon in activity bar)
2. Ensure you have 3-4 specs visible with different statuses
3. Make sure search bar and filter buttons are visible
4. Capture the entire dashboard view
5. Save as `dashboard-overview.png`

### 2. Team Metrics
1. Click the "Metrics" button in dashboard header
2. Scroll down to "Team Performance" section
3. Ensure 2-3 team member cards are visible
4. Capture the team metrics section
5. Save as `team-metrics.png`

### 3. Velocity Charts
1. In Metrics panel, ensure "Velocity" tab is active
2. Scroll to show hero stats and charts
3. Include: This Week stats, bar charts, pie chart
4. Capture the full velocity view
5. Save as `velocity-charts.png`

### 4. Execution Profiles
1. Back in dashboard, click "Execute" button on a spec card
2. Capture the dropdown menu showing profiles
3. OR click "Profiles" button to show management panel
4. Save as `execution-profiles.png`

### 5. Notes Panel
1. Click "Notes" button on any spec card
2. Add 2-3 sample notes with formatting
3. Show the formatting toolbar and notes list
4. Capture the notes panel
5. Save as `notes-panel.png`

## After Taking Screenshots

1. Optimize images (compress to <500KB each)
2. Place in `media/screenshots/` directory
3. Remove the `.gitkeep` file
4. Update README.md to remove the "Coming Soon" note
5. Commit with: `docs: Add screenshots to README`

## Image Optimization Tools

- **macOS**: ImageOptim (free app)
- **Windows**: FileOptimizer or TinyPNG website
- **Linux**: pngquant or optipng
- **Online**: https://tinypng.com/ or https://squoosh.app/

## Final README Update

After adding screenshots, update README.md:

Remove this:
```markdown
> **Note:** Screenshots will be added soon. See `media/screenshots/README.md` for guidelines on capturing screenshots.

<details>
<summary>📸 View Screenshots (Coming Soon)</summary>
```

Replace with:
```markdown
<details>
<summary>📸 View Screenshots</summary>
```

Or remove the `<details>` wrapper entirely to show screenshots by default.
