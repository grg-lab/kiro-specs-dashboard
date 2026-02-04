# 🎉 Kiro Specs Dashboard v0.1.0

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
