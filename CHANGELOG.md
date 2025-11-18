# Changelog

All notable changes to the Extension Manager project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **AI-Assisted Extension Management**: Natural language interface for intelligent extension management
  - AI Assistant service (`src/pages/Background/ai/`) that processes natural language intents
  - Extension Knowledge Base that enriches extension metadata with context and use cases
  - AI Profiles page in Options UI (`src/pages/Options/ai/`) for interacting with AI assistant
  - Message handlers for AI intent processing and action execution
  - Support for configurable LLM models (gpt-5-2025-08-07, claude-sonnet-4-5-20250929, gemini-2.5-pro)
  - Extension knowledge tracking with use cases and alias history
  - Recent AI actions history and explainability features
- **Smart Organizing & Group Creation**: AI-powered extension grouping
  - Smart grouping engine that clusters extensions into logical workflows (Developer Tools, Productivity, Writing, etc.)
  - Group suggestion UI with confidence scores and rationale
  - Ability to review, rename, and selectively apply AI-suggested groups
  - Integration with existing group management system
- **Description & Metadata Enrichment**: AI-generated extension descriptions and metadata
  - Automatic detection of extensions with missing or poor descriptions
  - AI-generated descriptions, use cases, and category tags for under-documented extensions
  - Optional external metadata API integration for fetching official extension data
  - User-configurable enrichment settings with on-demand refresh
- **External Metadata Client**: Optional integration with external APIs/databases
  - `ExternalKnowledgeClient` for fetching extension metadata from external sources
  - Configurable API URL in AI settings
  - Fallback to local AI enrichment when external API is unavailable
  - Optional host permissions for external API calls
- Comprehensive rules files: `CLAUDE.md`, `AGENTS.md`, and `CHANGELOG.md`
- Repository migration to `ignitabull18/ai-extension-manager`
- Type definitions for AI features (`src/types/ai.d.ts`)

### Changed
- Repository URL updated from `JasonGrass/auto-extension-manager` to `ignitabull18/ai-extension-manager`
- Extended `IExtensionManager` interface to include AI services
- Background initialization now includes AI assistant (non-blocking)
- ExtensionRepo exposed in Extension module for AI knowledge base access
- Extended `IExtensionKnowledge` type to include categories, AI-generated descriptions, and enrichment flags
- Added optional host permissions to manifest for external metadata API support

## [0.5.27] - Previous Release

### Note
This version represents the state of the project when the rules files were created. For detailed version history prior to this point, refer to git history or release notes.

---

## Version History Format

Each version entry should follow this structure:

```markdown
## [Version] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes to existing functionality

### Deprecated
- Soon-to-be removed features

### Removed
- Removed features

### Fixed
- Bug fixes

### Security
- Security fixes
```

## Guidelines for Contributors

When making changes to the project:

1. **Always update this CHANGELOG.md** with your changes
2. **Use clear, descriptive language** - explain what changed and why
3. **Group changes by type** (Added, Changed, Fixed, etc.)
4. **Include version numbers** and dates
5. **Reference issue numbers** if applicable (e.g., `#123`)
6. **Update version in package.json** following semantic versioning

### Semantic Versioning

- **MAJOR** version (X.0.0): Incompatible API changes
- **MINOR** version (0.X.0): New functionality in a backwards compatible manner
- **PATCH** version (0.0.X): Backwards compatible bug fixes

### Examples

```markdown
## [0.6.0] - 2025-01-27

### Added
- New rule action type: `customAdvanced`
- Support for time-based rule triggers
- Dark mode toggle in settings

### Changed
- Improved rule processing performance
- Updated UI components to use Ant Design 5.5.0

### Fixed
- Rule execution not triggering on tab change (#123)
- Extension icons not loading in popup (#124)

### Security
- Fixed XSS vulnerability in rule editor
```

---

**Note**: This changelog is maintained by AI agents working on the project. All changes should be documented here for transparency and collaboration.

