# Kiro Specs Dashboard

A native VSCode extension for visualizing and tracking Kiro spec features and tasks directly within your IDE.

## ⚠️ Important Disclaimer

**This is an independent project and is NOT officially affiliated with, endorsed by, or part of the Kiro IDE project or Amazon Web Services (AWS).** This extension was created independently as a community contribution to provide additional tooling for developers using Kiro's spec-driven development workflow.

- **No Official Affiliation**: This project has no connection to AWS, Amazon, or the official Kiro IDE team
- **Independent Development**: Built independently to contribute to the Kiro IDE community
- **Community Tool**: Provided freely for anyone in the community to use
- **Independent Maintenance**: Maintained independently without official support from AWS or Kiro
- **Use at Your Own Risk**: This is a third-party tool provided as-is

For official Kiro IDE support and resources, please visit the official Kiro documentation and support channels.

## 🔒 Privacy & Data

**Your data stays on your machine.** This extension:
- ✅ **No cloud uploads**: Does not send any data to external servers or the cloud
- ✅ **Local storage only**: All data is stored locally on your machine using VSCode's workspace storage
- ✅ **No telemetry**: Does not collect or transmit usage statistics or analytics
- ✅ **No network requests**: Operates entirely offline, reading only from your local file system
- ✅ **Complete privacy**: Your specs, tasks, notes, and project data never leave your machine

This extension only reads and writes files in your workspace's `.kiro/specs/` directories and stores view preferences and notes locally in VSCode's workspace storage.

## Features

- **Automatic Spec Discovery**: Automatically detects and scans `.kiro/specs/` directories in your workspace
- **Real-Time Updates**: File system watcher monitors changes and updates the dashboard automatically
- **Progress Tracking**: Visual progress bars and task counts for each spec
- **Multi-Workspace Support**: Works seamlessly with multi-root workspaces
- **Native IDE Integration**: Matches VSCode's design language and theme
- **Quick File Access**: Open requirements.md, design.md, and tasks.md files with one click
- **Filtering & Search**: Find specs quickly with search and status filters
- **Persistent State**: Remembers your view preferences across sessions
- **Rich Text Notes**: Add formatted notes to any spec with WYSIWYG editor supporting bold, strikethrough, lists, and links
- **Notes Management**: Sort notes by recently updated, recently created, or oldest first with configurable pagination (10, 20, or show all)
- **Notes Persistence**: Notes are saved per spec and persist across sessions with creation and update timestamps

## Getting Started

1. **Install the Extension**: Install from the VSCode marketplace or from a `.vsix` file
2. **Open a Workspace**: Open a workspace containing `.kiro/specs/` directories
3. **View the Dashboard**: Click the Kiro Specs icon in the activity bar or run the "Show Specs Dashboard" command

## Usage

### Viewing Specs

The dashboard displays all specs found in your workspace's `.kiro/specs/` directories. Each spec card shows:
- Spec name and workspace folder (in multi-root workspaces)
- Progress bar with completion percentage
- Task counts (completed/total)
- Quick access buttons to open spec files and notes

### Opening Spec Files

Click the file access buttons to open the corresponding files:
- **Requirements** - Opens requirements.md in preview mode
- **Design** - Opens design.md in preview mode
- **Tasks** - Opens tasks.md in editor mode for direct editing
- **Notes** - Opens the notes panel for this spec

### Managing Notes

Click the **Notes** button on any spec to open the notes panel. The notes panel provides:

**Rich Text Editing**:
- **Bold** text formatting
- **Strikethrough** text
- **Bullet lists** and **numbered lists**
- **Links** with custom text and URLs
- **Clear formatting** to remove all formatting

**Notes Organization**:
- Sort by: Recently Updated, Recently Created, or Oldest First
- Pagination: View 10, 20, or all notes per page
- Timestamps: See when notes were created and last updated

**Notes Persistence**:
- Notes are saved automatically per spec
- State is preserved when switching tabs or reopening the panel
- Each spec has its own independent notes collection

### Filtering and Search

Use the search bar to filter specs by name. Use the filter buttons to show:
- **All**: All specs
- **Active**: Specs with some but not all tasks completed
- **Done**: Specs with all tasks completed
- **Todo**: Specs with no tasks completed

## Requirements

- VSCode 1.74.0 or higher
- Workspace with `.kiro/specs/` directories containing spec files

## Extension Settings

This extension contributes the following settings:

- Dashboard state (filter mode, search query, pagination) is automatically saved per workspace

## Known Issues

- None at this time

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

## Contributing

This is an independent project built as a contribution to the Kiro IDE community. Contributions, issues, and feature requests are welcome! This extension is not officially supported by AWS or the Kiro IDE team.

## License

See [LICENSE](LICENSE) file for details.

---

**Enjoy tracking your specs!** 🚀
