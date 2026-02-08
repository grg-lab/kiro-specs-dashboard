# Release Notes

## 🎉 v0.1.2 - Execution Profiles & Automated Spec Execution

**Release Date:** February 6, 2026

### 🎯 What's New

#### **Execution Profiles**
Create and manage custom execution profiles to automate spec execution with tailored prompts and workflows.

**Profile Management:**
- **Built-in Profiles**: Two ready-to-use profiles included
  - **MVP (Required Tasks)**: Executes only required tasks, skipping optional ones
  - **Full (All Tasks)**: Executes all tasks including optional ones
- **Custom Profiles**: Create your own profiles with custom prompt templates
- **Profile Editor**: Manage profiles through a dedicated panel accessible via "Profiles" button
- **Template Variables**: Use placeholders like `{{specName}}`, `{{specPath}}`, `{{totalTasks}}`, etc. in prompt templates
- **Multi-Workspace Support**: Profiles are workspace-scoped with automatic conflict resolution

**Access:** Click the "Profiles" button in the dashboard header or run command `Specs Dashboard: Manage Profiles`

#### **Direct Spec Execution from Dashboard**
Execute specs directly from the dashboard with a single click.

**How it Works:**
1. Click the "Execute" button on any spec card in the dashboard
2. Select a profile from the dropdown menu (MVP, Full, or custom)
3. The extension sends the profile's prompt template to Kiro with spec details
4. Track execution status in real-time with visual indicators

**Execution Features:**
- **Task Progress Monitoring**: Automatic task file watching updates progress during execution

### 🎨 Improvements

- **Dashboard Spec Cards Redesign**: Completely redesigned spec card layout for better information hierarchy and usability
  - Execute button moved to top-right next to spec name for immediate access
  - Status badge and task statistics displayed in a single compact row
  - Enhanced progress bar with 8px height, rounded corners (5px), and diagonal stripe pattern for unfilled portion
  - Action buttons (Requirements, Design, Tasks, Notes) moved to bottom for consistent placement
  - Improved visual spacing and alignment throughout the card
  - Removed execution status display for simplified UI (button remains consistent)
- **Profile Dropdown Enhancements**:
  - Reduced dropdown dimensions for better fit (min-width: 180px, max-width: 200px, max-height: 200px)
  - Added toggle functionality - clicking Execute button again closes the dropdown
  - Added text truncation with ellipsis (...) for long profile names
  - Right-aligned dropdown to prevent clipping when editor panel is open
- Enhanced dashboard header with Profiles action button
- Improved spec card layout with execution controls
- Real-time execution state persistence across VSCode sessions
- Responsive profile dropdown with icon support
- Better error handling and user feedback for execution operations
- Updated command category from "Kiro" to "Specs Dashboard" for all commands
- Streamlined command palette with removal of internal/debug commands

### 🛠️ Technical

- Added `ProfileManager` for CRUD operations on execution profiles
- Added `ExecutionManager` for spec execution lifecycle management
- Added `ProfilesPanelManager` for profile management UI
- Implemented file-based profile storage in `.kiro/execution-profiles.json`
- Added workspace state persistence for execution states
- Implemented task file watching for progress tracking during execution
- Added template variable substitution for dynamic prompt generation
- Removed internal commands: openFile, openNotes, openHistory, listKiroCommands, testKiroMessage
- Added new command: `Specs Dashboard: Show Metrics` for opening analytics panel

---

## 🎉 v0.1.1 - Metrics & Analytics

**Release Date:** February 5, 2026

### 📊 What's New

#### **Metrics Panel**
A comprehensive analytics dashboard to track your development velocity and patterns.

**Access:** Click the "Metrics" button in the dashboard header

#### **Velocity Tab**
Track your performance with detailed metrics and visualizations:

**Specs Performance**
- Current week specs completed
- Average specs per week
- Consistency score and rating
- 10-week completion trend chart

**Tasks Performance**
- Current week tasks completed
- Average tasks per week
- Consistency score and rating
- 10-week completion trend chart

**Additional Insights**
- **Required vs Optional**: Pie chart showing task distribution
- **Day of Week**: Horizontal bar chart showing completion patterns by weekday
- **Avg Time to Complete**: Spec completion timeline with Fast (≤14 days), Medium (15-42 days), and Slow (≥43 days) breakdown
- **Projected Completion**: Estimated completion date with progress bar

#### **Mock Data Generator**
Development command to generate realistic test data for the Metrics panel.

**Usage:** Run command `Kiro: Generate Mock Velocity Data`

### 🎨 Improvements

- Renamed "Analytics" button to "Metrics" for clarity
- Responsive stats header layout that adapts to viewport width
- Enhanced chart styling with solid colors and consistent blue theme
- Improved section separators for better visual hierarchy
- Added legend to "Avg Time to Complete" metric explaining Fast/Medium/Slow categories

### 🐛 Fixes

- Fixed progress bar visibility in Velocity tab
- Fixed section separator contrast in dark themes
- Removed dividing line from pie chart for cleaner appearance
- Fixed Day of Week chart bar spacing and alignment
- Added empty state messages to charts when no data is available

### 🛠️ Technical

- Added `VelocityCalculator` for metrics computation
- Extended `VelocityMetrics` interface with specs tracking
- Implemented weekly aggregation and consistency scoring algorithms
- Added time-to-complete categorization logic
- Organized mock data scripts into `mocks/` folder
- Added `clearVelocityData` method to StateManager for data management

---

## 🎉 v0.1.0 - Initial Release

**Release Date:** January 31, 2026

We're excited to announce the initial release of **Kiro Specs Dashboard** - a native VSCode extension that brings spec-driven development visualization directly into your IDE!

---

## ⚠️ Important Notice

**This is an independent community project** and is NOT officially affiliated with, endorsed by, or part of the Kiro IDE project or Amazon Web Services (AWS). This extension was created independently to provide additional tooling for developers using Kiro's spec-driven development workflow.

---

## 🚀 What's New

### Core Features

#### 📊 **Automatic Spec Discovery**
The extension automatically detects and scans `.kiro/specs/` directories in your workspace - no manual configuration needed! Just open your project and start tracking your specs.

#### ⚡ **Real-Time Updates**
File system watchers monitor your spec files and automatically update the dashboard when you make changes. Edit your tasks.md, and watch the progress bars update instantly.

#### 🎨 **Native IDE Integration**
Built from the ground up to match VSCode's design language:
- Uses VSCode CSS variables for seamless theme integration
- Flat, minimalist design that feels like a native IDE panel
- Compact, information-dense layouts
- Automatic light/dark theme adaptation

#### 📁 **Multi-Workspace Support**
Works seamlessly with multi-root workspaces:
- Scans all workspace folders independently
- Per-workspace state isolation
- Workspace folder indicators on spec cards
- Automatic cleanup when folders are removed

#### 📝 **Rich Notes Feature**
Add formatted notes to any spec with a WYSIWYG editor:
- **Bold** and **strikethrough** text formatting
- Bullet lists and numbered lists
- Links with custom text and URLs
- Sort by recently updated, recently created, or oldest first
- Configurable pagination (10, 20, or show all)
- Notes persist across sessions with timestamps

#### 🔍 **Search & Filtering**
Find specs quickly with powerful filtering:
- Real-time search by name or content
- Status filters: All, Active, Done, Todo
- Persistent filter state across sessions

#### 📈 **Progress Tracking**
Visual progress indicators for each spec:
- Progress bars with completion percentage
- Task counts (completed/total)
- Optional task tracking
- Status badges

---

## 🛠️ Technical Highlights

### Architecture
- **Extension Host (Node.js)**: Handles file system operations, spec parsing, and state management
- **Webview (Browser)**: Renders the dashboard UI with markdown support
- **Message Passing**: Bidirectional communication between extension and webview

### Security
- Content Security Policy (CSP) for webview protection
- Nonce-based script execution
- Input sanitization to prevent XSS attacks
- Path traversal prevention

### Performance
- Debounced file system events (300ms delay)
- Deferred refresh when webview is hidden
- Asynchronous spec parsing
- Efficient resource disposal

### Testing
- **21 property-based tests** validating universal correctness properties
- **100+ iterations per property test** for comprehensive coverage
- Unit tests for core components and edge cases
- Integration tests for end-to-end workflows

---

## 📦 What's Included

### Commands
- `Kiro: Show Specs Dashboard` - Open the dashboard panel
- `Kiro: Refresh Specs Dashboard` - Manually refresh spec data
- `Kiro: Open Spec File` - Open spec markdown files in editor

### Views
- **Specs Dashboard** - Sidebar panel in the activity bar with custom icon

### File Support
- `tasks.md` - Required, tracks implementation tasks
- `requirements.md` - Optional, defines feature requirements
- `design.md` - Optional, documents technical design

---

## 🎯 Use Cases

### For Individual Developers
- Track feature implementation progress
- Visualize task completion across multiple specs
- Quick access to spec documentation
- Add personal notes and context to specs

### For Teams
- Share spec progress visibility
- Maintain consistent spec structure
- Document feature requirements and design
- Track optional vs required tasks

### For Project Managers
- Monitor development progress at a glance
- Identify blocked or stalled features
- Review completed vs pending work
- Export notes for reporting

---

## 🔒 Privacy & Data

**Your data stays on your machine.** This extension:
- ✅ **No cloud uploads** - Does not send data to external servers
- ✅ **Local storage only** - All data stored in VSCode workspace storage
- ✅ **No telemetry** - Does not collect usage statistics
- ✅ **No network requests** - Operates entirely offline
- ✅ **Complete privacy** - Your specs never leave your machine

---

## 📋 Requirements

- **VSCode**: 1.74.0 or higher
- **Workspace**: Must contain `.kiro/specs/` directories with spec files
- **Node.js**: 18.x or higher (for development)

---

## 🚦 Getting Started

1. **Install the Extension**
   - Install from VSCode marketplace, or
   - Install from `.vsix` file: Right-click → Install Extension VSIX

2. **Open Your Workspace**
   - Open a workspace containing `.kiro/specs/` directories
   - The extension activates automatically when specs are detected

3. **View the Dashboard**
   - Click the Kiro Specs icon in the activity bar, or
   - Run command: `Kiro: Show Specs Dashboard`

4. **Start Tracking**
   - View spec progress and task counts
   - Click spec cards to view details
   - Add notes to specs for context
   - Use search and filters to find specs

---

## 📚 Documentation

### Spec File Structure
```
.kiro/specs/
└── feature-name/           # kebab-case
    ├── tasks.md           # Required
    ├── requirements.md    # Optional
    └── design.md          # Optional
```

### Task Format
```markdown
# Tasks

- [x] 1. Completed task
- [ ] 2. Pending task
  - [x] 2.1 Completed subtask
  - [ ] 2.2 Pending subtask
- [ ]* 3. Optional task
```

**Checkbox States:**
- `- [ ]` - Not started
- `- [x]` - Completed
- `- [~]` - In progress
- `- [-]` - Queued

**Optional Tasks:**
- `- [ ]*` - Optional not started
- `- [x]*` - Optional completed

---

## 🐛 Known Issues

None at this time. Please report issues on [GitHub](https://github.com/grg-lab/kiro-specs-dashboard/issues).

---

## 🗺️ Roadmap

### Planned Features
- Sorting options for spec list
- Export functionality for specs and notes
- Keyboard shortcuts for common actions
- Task editing directly in the dashboard
- Spec templates and scaffolding
- Progress history and analytics

---

## 🤝 Contributing

This is an independent community project. Contributions, issues, and feature requests are welcome!

- **GitHub**: [grg-lab/kiro-specs-dashboard](https://github.com/grg-lab/kiro-specs-dashboard)
- **Issues**: [Report a bug or request a feature](https://github.com/grg-lab/kiro-specs-dashboard/issues)
- **License**: MIT

---

## 🙏 Acknowledgments

- Built for the Kiro IDE community
- Inspired by spec-driven development methodology
- Uses VSCode's excellent extension API
- Powered by marked.js, highlight.js, and mermaid.js

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

---

## 📞 Support

For questions, issues, or feature requests:
- Open an issue on [GitHub](https://github.com/grg-lab/kiro-specs-dashboard/issues)
- Check the [README](README.md) for usage instructions
- Review the [CHANGELOG](CHANGELOG.md) for version history

---

**Enjoy tracking your specs!** 🚀

*This extension is not affiliated with AWS or the official Kiro IDE project.*
