# Screenshots Guide

This directory contains screenshots for the README documentation.

## Required Screenshots

### 1. dashboard-overview.png
**What to capture:**
- Main dashboard view with multiple spec cards
- Show progress bars, status badges (TODO/ACTIVE/DONE)
- Display the search bar and filter buttons (All, Active, Done, Todo)
- Include the Metrics and Profiles buttons in the header
- Show at least 3-4 spec cards with different statuses

**Recommended size:** 1200-1600px wide

**Tips:**
- Use a clean theme (Dark+ or Light+)
- Show realistic spec names and progress
- Ensure text is readable

---

### 2. team-metrics.png
**What to capture:**
- Open the Metrics panel (click Metrics button)
- Scroll to the "Team Performance" section
- Show 2-3 team member cards with statistics
- Include tasks completed, specs completed, and velocity bars

**Recommended size:** 1200-1400px wide

**Tips:**
- Show real or realistic team member names
- Display varied statistics to show the feature's value
- Capture the explanatory note below the section title

---

### 3. velocity-charts.png
**What to capture:**
- Metrics panel showing the Velocity tab
- Include the hero stats (This Week, Average, Consistency)
- Show the "Tasks Completed (Last 10 Weeks)" bar chart
- Include the "Specs Completed (Last 10 Weeks)" chart
- Capture the Required vs Optional pie chart and Day of Week bars

**Recommended size:** 1200-1600px wide

**Tips:**
- Ensure charts have visible data (not all zeros)
- Show the analytics disclaimer banner at the top
- Capture enough to show the variety of visualizations

---

### 4. execution-profiles.png
**What to capture:**
- Main dashboard with a spec card showing the Execute dropdown
- Click the Execute button to show the profile dropdown menu
- Alternatively, show the Profiles management panel (click Profiles button)
- Display the profile list with MVP, Full, and custom profiles

**Recommended size:** 1000-1400px wide

**Tips:**
- Show the dropdown menu open with profile options
- Or show the profile management UI with template variables
- Highlight the ease of use

---

### 5. notes-panel.png
**What to capture:**
- Open a spec's notes panel (click Notes button on a spec card)
- Show the rich text editor with formatting toolbar
- Display 2-3 sample notes with different formatting (bold, lists, links)
- Include the sort and pagination controls

**Recommended size:** 1000-1400px wide

**Tips:**
- Add sample notes with varied formatting to showcase features
- Show the timestamps (created/updated)
- Display the formatting toolbar clearly

---

## Screenshot Best Practices

1. **Resolution**: Use retina/2x resolution for crisp images
2. **Theme**: Stick to one theme (Dark+ recommended for consistency)
3. **Window Size**: Use a reasonable window size (not too small, not full 4K)
4. **Content**: Use realistic but generic content (no sensitive data)
5. **Compression**: Optimize images to keep file sizes under 500KB each
6. **Format**: Use PNG for UI screenshots (better quality than JPG)

## Taking Screenshots

### macOS
- `Cmd + Shift + 4` then `Space` to capture a window
- Or use `Cmd + Shift + 4` to select a region

### Windows
- `Win + Shift + S` to open Snipping Tool
- Or use the Snipping Tool app

### Linux
- Use `gnome-screenshot` or your distribution's screenshot tool
- Or use `Shift + PrtScn` to select a region

## Image Optimization

After taking screenshots, optimize them:

```bash
# Using ImageOptim (macOS)
# Drag and drop images into ImageOptim app

# Using pngquant (cross-platform)
pngquant --quality=80-95 *.png

# Using online tools
# TinyPNG: https://tinypng.com/
# Squoosh: https://squoosh.app/
```

## Naming Convention

- Use lowercase with hyphens
- Be descriptive but concise
- Match the names referenced in README.md:
  - `dashboard-overview.png`
  - `team-metrics.png`
  - `velocity-charts.png`
  - `execution-profiles.png`
  - `notes-panel.png`

## Updating Screenshots

When updating screenshots:
1. Replace the old file with the same filename
2. Ensure the new image maintains similar dimensions
3. Test that the README displays correctly
4. Commit with message: `docs: Update screenshots for [feature]`
