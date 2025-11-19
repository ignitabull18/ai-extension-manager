# Changelog

All notable changes to the Extension Manager project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Mutex (Mutual Exclusion) Groups**: Groups can now be marked as "mutex" to ensure only one extension in the group is enabled at a time
  - When an extension in a mutex group is enabled, all other extensions in that group are automatically disabled
  - Useful for preventing conflicts between similar extensions (e.g., multiple VPNs, ad blockers)
  - Visual indicator (purple tag) in group list showing which groups are mutex
  - Mutex toggle in group editor UI
  - Handled by `MutexGroupHandler` which listens to extension enable events
- **Global Keyboard Shortcuts**: Rapid scene switching via hotkeys
  - `Ctrl+Shift+Right` (Mac: `Cmd+Shift+Right`) - Switch to next scene
  - `Ctrl+Shift+Left` (Mac: `Cmd+Shift+Left`) - Switch to previous scene
  - Scenes cycle through available scenes, enabling always-on extensions on switch
  - Shortcuts defined in `manifest.json` and handled in background script
- **Rule Indexing Optimization**: Inverted index for efficient rule matching
  - `RuleIndexer` class builds domain/scene/OS indices for O(1) rule lookup
  - Reduces rule processing from O(n) to O(1) for domain-based rules
  - Automatically rebuilds index when rules change
  - Only activates for rule sets with >10 rules (optimization threshold)
  - Falls back to full rule processing for rules without URL/scene/OS triggers (ensures backward compatibility)

### Changed
- **Performance Optimization**: Improved extension management performance
  - Added in-memory cache for sync storage in background script (`SyncStorageCache.ts`)
  - Cache automatically invalidates on `chrome.storage.onChanged` events
  - Reduces redundant `chrome.storage.sync.get()` calls in background script
  - Cache is only active in background script context (popup/options pages use direct storage access)
- **Code Quality Improvements**: Refactored large components and improved type safety
  - Refactored `AIProfiles.jsx` (1069 lines → 230 lines) into focused sub-components:
    - `EnrichmentSection.jsx` - AI enrichment functionality
    - `SmartGroupSection.jsx` - Smart group suggestions
    - `AISettings.jsx` - AI configuration settings
  - Improved type safety in `RuleHandler.ts`:
    - Added explicit return types to all methods
    - Replaced `any` types with proper types (`rule.IRuleConfig`, `chrome.tabs.TabRemoveInfo`)
    - Fixed singleton pattern typing (`RuleHandler | null` instead of `any`)
  - Improved type safety in `ExtensionService.ts`:
    - Added explicit return type to `initial()` method (`Promise<void>`)
  - All components now follow single responsibility principle and are easier to maintain

### Added
- **Enhanced Configuration Import/Export**: Improved config portability for cross-browser and backup scenarios
  - Export now includes domain rules, always-on group flags, version metadata, extension version, and complete extension list
  - Extension list includes all installed extensions with IDs, names, versions, and metadata
  - Import preview modal shows what will be imported and what will overwrite existing data
  - Missing extensions detection: warns about extensions referenced in groups/rules but not found in exported list or currently installed
  - Import options: merge mode (skip existing) or overwrite mode (replace existing)
  - Config validation ensures imported files have correct structure
  - Config bundle includes version metadata for compatibility tracking
  - Supports transferring configuration between Chrome forks (Comet, Edge, etc.) via JSON export/import
- **Domain-based Auto-Enable**: New feature to automatically enable extensions based on the current domain/URL
  - Domain Auto-Enable page in Options UI (`src/pages/Options/domain/`) for managing domain rules
  - Support for wildcard and regex pattern matching
  - Per-domain override mode: "soft" (default priority) or "override" (higher priority) to control rule precedence
  - Domain rules work with individual extensions (not groups) for fine-grained control
  - Quick "copy current tab domain" button for easy rule creation
  - Domain rules are stored as ruleV2.IRuleConfig with `source="domainAuto"` and filtered from advanced rule editor
- **Always-On Groups**: Groups can now be marked as "always on"
  - Extensions in always-on groups are automatically enabled on startup and when scene/group changes
  - Always-on groups can still be disabled by rules (not immutable)
  - Visual indicator (tag) in group list showing which groups are always-on
  - Always-on toggle in group editor UI
- **Priority-based Rule Processing**: Enhanced rule execution system
  - Rules now support priority levels (domain rules with override mode have priority 10)
  - Rules are sorted by priority before execution (higher priority wins conflicts)
  - ExecuteTaskPriority class extended with `setPriority()` method for rule-based priority control

### Changed
- **Build System Optimization**: Migrated from ts-loader + babel-loader to esbuild-loader for significantly faster builds
  - Replaced dual loader chain with single high-performance esbuild-loader for TS/JS/JSX/TSX
  - Added filesystem caching to webpack for faster rebuilds
  - Moved type checking to separate `npm run lint:types` script (tsc --noEmit)
  - Removed CleanWebpackPlugin (using webpack's built-in output.clean instead)
  - Restricted source-map-loader to development only
  - Made zipping optional (use `npm run build:package` to create zip files)
  - Switched production minification to esbuild (faster than Terser)
- **Bundle Size Optimization**: Reduced bundle sizes through dependency optimization and code splitting
  - Replaced full lodash imports with modular imports (lodash/debounce, lodash/throttle) or native alternatives
  - Removed immutable.js dependency (replaced with native JavaScript spread operators)
  - Unified drag-and-drop libraries: refactored GroupNav to use @dnd-kit and removed @hello-pangea/dnd
  - Implemented aggressive code-splitting: lazy-loaded heavy routes (AI, History, Management, Rules) in Options page
  - Lazy-loaded react-json-view-lite component in JSON share view
  - All changes preserve existing functionality while reducing initial bundle size
- **Runtime Performance**: Added caching for chrome.management.getAll() calls
  - Implemented 5-second TTL cache in ExtensionService with automatic invalidation on extension events
  - Updated AI services to use cached extension lists when available
  - Reduces redundant API calls during AI operations and grouping
- **Performance Documentation**: Added performance testing guide to DEBUG.md
  - Documented bundle size analysis workflow
  - Added Chrome Extension performance best practices
  - Included testing procedures for validating optimizations

### Fixed
- **AI Settings API Key Save Issue**: Fixed message port closing before async handlers could respond
  - Updated `listen` function in `messageHelper.js` to properly await async callbacks and catch errors
  - Fixed Chrome message listener to return `true` synchronously (removed `async` from listener function) to keep port open for async handlers
  - Changed message handlers to fire-and-forget pattern: handlers run asynchronously while listener returns immediately
  - Added error handling with `.catch()` to ensure error responses are sent even if handlers fail
  - Enhanced `listen` function to catch handler errors and send error responses as fallback
  - Fixed `createAIMessage` to send error response when AI service is not initialized
  - Added fallback error response in `createAIMessage` for unknown message types
  - Optimized `createAIMessage` to use early return pattern, stopping handler checks once a match is found
  - Fixed API key save logic to explicitly exclude masked keys when no new key is provided
  - This fixes the "message port closed before a response was received" error when saving AI API keys and other AI settings
- **LLM API Error Handling**: Enhanced error handling for OpenAI API calls
  - Added API key validation and format checking
  - Improved error messages for network failures ("Failed to fetch" errors)
  - Added detailed logging of endpoint URLs and request details
  - Better error context to help diagnose connection issues

### Added
- **AI Enrichment Feature**: New dedicated section in AI Profiles page for generating detailed AI descriptions, use cases, and categories for extensions
  - "Enrich All Extensions" button to generate AI metadata for all installed extensions
  - "Enrich Selected" button to enrich only selected extensions from a searchable table
  - Expandable rows showing AI-generated descriptions, use cases, and categories for each extension
  - Progress indicator during enrichment process
  - Enrichment status display (Enriched, Partial, Not Enriched) with use case and category counts
  - Search functionality to filter extensions by name or ID
  - Select all/deselect all functionality for batch operations
  - Positioned before Smart Organize section to improve grouping accuracy (enrichment should be done first)

### Changed
- **AI Integration Improvements**: Enhanced OpenAI integration for more reliable JSON parsing
  - Updated AI model configuration to use OpenAI `gpt-5-2025-08-07` exclusively (removed references to other providers)
  - Added structured JSON output request (`response_format: { type: "json_object" }`) to all OpenAI API calls
  - Enhanced JSON parser to handle common malformed JSON patterns (arrays closed with `}` instead of `]`, trailing commas, etc.)
  - Improved error logging to show which parsing strategy failed for better debugging
  - Updated all documentation to reflect OpenAI-only support
  - Fixed GPT-5 model compatibility: Removed unsupported `temperature` parameter for GPT-5 models (GPT-5 only supports default temperature value)
  - Fixed AI message handler response conflict: Removed premature `sendResponse` call in `createAIMessage` that was interfering with async handlers, causing UI error flashes
  - Fixed message routing: Refactored message routing to prevent rule/history handlers from sending premature responses to AI messages, ensuring AI enrichment and other AI operations receive proper responses in the UI
  - Enhanced AI suggested groups UI: Added expandable rows to preview group details (description, rationale, extension names) before applying, improved empty state messaging, and preserved suggestions during errors for better exploration experience

### Added
- **AI-Assisted Extension Management**: Natural language interface for intelligent extension management
  - AI Assistant service (`src/pages/Background/ai/`) that processes natural language intents
  - Extension Knowledge Base that enriches extension metadata with context and use cases
  - AI Profiles page in Options UI (`src/pages/Options/ai/`) for interacting with AI assistant
  - Message handlers for AI intent processing and action execution
  - Support for OpenAI gpt-5-2025-08-07 (OpenAI-only support)
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

