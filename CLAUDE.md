# Claude AI Agent Rules for Extension Manager

This document contains essential rules and guidelines for AI agents (particularly Claude) working on the Extension Manager project.

## Project Overview

**Extension Manager** is a Chrome/Edge browser extension that provides intelligent extension management with rule-based automation. It allows users to automatically enable/disable browser extensions based on URL patterns, scenes, OS, time periods, and custom conditions.

- **Repository**: `ignitabull18/ai-extension-manager`
- **Current Version**: `0.5.27` (check `package.json`)
- **License**: AGPL-3.0
- **Tech Stack**: React 18, TypeScript, Webpack, Chrome Extension Manifest V3

## Critical Rules

### 1. File Organization & Structure

- **Keep files under 200 lines** whenever possible. Split large files into smaller, focused modules.
- **Maintain clean codebase structure**: Everything has a place. If something doesn't fit, create a proper structure for it.
- **Use TypeScript** for new files when appropriate (`.ts` for logic, `.tsx` for React components)
- **Follow existing patterns**: The project uses a modular architecture with clear separation of concerns

### 2. Code Quality Standards

- **Always double-check your work** before marking tasks complete
- **Use the `tree` command** before making potentially breaking changes or cleanup operations
- **Maintain existing code style**: The project uses Prettier for formatting
- **Run `npm run prettier`** after making changes to ensure consistent formatting

### 3. Architecture Patterns

#### Background Script Architecture
- Background scripts are in `src/pages/Background/`
- Main entry: `src/pages/Background/index.js`
- Uses a global `EM` (ExtensionManager) object pattern
- Key modules:
  - `extension/` - Extension management service
  - `rule/` - Rule processing and execution engine
  - `history/` - Extension history tracking
  - `ai/` - AI-assisted extension management
  - `message/` - Message passing handlers
  - `event/` - Event caching system

#### Options Page Architecture
- React-based options UI in `src/pages/Options/`
- Uses React Router with HashRouter
- Main routes:
  - `/about` - About page
  - `/setting` - Settings
  - `/scene` - Scene management
  - `/group` - Extension groups
  - `/management` - Extension management (with share/import sub-routes)
  - `/rule` - Rule configuration
  - `/history` - Extension history
  - `/ai` - AI Assistant (natural language extension management)

#### Popup Architecture
- React-based popup UI in `src/pages/Popup/`
- Supports both list and grid views
- Uses styled-components for theming (light/dark mode)
- Prepares data via `prepare.js` before rendering

#### Storage Architecture
- **Sync Storage**: `src/storage/sync/` - Uses `webext-options-sync` for synced settings
- **Local Storage**: `src/storage/local/` - Local-only options (LocalOptions.ts)
- Storage utilities: `src/storage/utils/` - Compression, large storage handling

### 4. Type Definitions

- Type definitions are in `src/types/`
- Key types:
  - `rule.d.ts` - Rule system types (both v1 and v2)
  - `config.d.ts` - Configuration types (Settings, Scenes, Groups, Management)
  - `global.d.ts` - Global ExtensionManager interface
  - `ai.d.ts` - AI assistant types (ExtensionKnowledge, AIIntent, AIActionPlan, AIModelConfig)

### 5. AI System

The AI system provides natural language extension management:

- **ExtensionKnowledgeBase**: Enriches extension metadata with context, use cases, alias history, categories, and AI-generated descriptions
- **AIAssistantService**: Processes natural language intents and generates action plans
- **Smart Grouping**: `suggestGroups()` method clusters extensions into logical workflows with confidence scores
- **Description Enrichment**: Automatically detects and enriches extensions with missing/poor descriptions using AI
- **ExternalKnowledgeClient**: Optional integration with external metadata APIs for enhanced extension knowledge
- **Knowledge Refresh**: Automatic nightly refresh of extension knowledge with optional enrichment
- **AI Models**: Configurable LLM support (gpt-5-2025-08-07, claude-sonnet-4-5-20250929, gemini-2.5-pro)
- **Fallback**: Rule-based matching when AI is disabled or unavailable
- **Message Handlers**: 
  - `ai-process-intent` - Process natural language queries
  - `ai-execute-action` - Execute AI-generated action plans
  - `ai-get-intents` - Get recent AI actions
  - `ai-update-knowledge` - Update extension knowledge
  - `ai-suggest-groups` - Get AI-suggested extension groups
  - `ai-apply-groups` - Apply suggested groups to storage
  - `ai-refresh-enrichment` - Refresh extension descriptions/metadata
  - `ai-get-settings` / `ai-set-settings` - Manage AI configuration
- **Action Plans**: Generated plans include extensions to enable/disable, groups to activate, and explanations
- **Settings**: User-configurable toggles for description enrichment and external metadata lookup

### 6. Rule System

The rule system is the core feature. Understand these concepts:

- **Rule V2** is the current version (use `ruleV2.IRuleConfig`)
- **Match Types**: URL, Scene, OS, Period triggers
- **Action Types**: `openWhenMatched`, `closeWhenMatched`, `openOnlyWhenMatched`, `closeOnlyWhenMatched`, `custom`, `none`
- **Rule Processing**: Rules are processed in `src/pages/Background/rule/processor.ts`
- **Rule Handler**: `src/pages/Background/rule/RuleHandler.ts` manages rule execution
- **Execute Task Handler**: Batches extension enable/disable operations

### 7. Build System

- **Webpack** configuration: `webpack.config.js`
- **Build scripts**: 
  - `npm run build` - Chrome build
  - `npm run build:edge` - Edge build
  - `npm run start` - Development server
- **Entry points**:
  - `options` - Options page
  - `popup` - Popup UI
  - `background` - Background service worker

### 8. Internationalization

- Uses Chrome i18n API
- Locale files in `src/_locales/`
- Supported languages: en, ja, ru, zh, zh_CN, zh_TW
- Always use `__MSG_*__` for translatable strings in manifest

### 9. Import Path Aliases

- `...` alias maps to `src/` directory
- Use `.../` prefix for imports from src directory
- Example: `import { LocalOptions } from ".../storage/local"`

### 10. Testing & Debugging

- Check `DEBUG.md` for debugging information
- Use `logger()` utility for logging (from `src/utils/logger.js`)
- Background script logs appear in extension service worker console
- Options/Popup logs appear in browser console

### 11. Chrome Extension APIs

Key APIs used:
- `chrome.management` - Extension management
- `chrome.storage` - Data persistence (sync and local)
- `chrome.tabs` - Tab information for rule matching
- `chrome.runtime` - Extension lifecycle and messaging

### 12. Dependencies

Key dependencies:
- **React 18** - UI framework
- **Ant Design 5** - UI component library
- **styled-components** - CSS-in-JS theming
- **react-router-dom** - Routing
- **dexie** - IndexedDB wrapper
- **localforage** - Local storage abstraction
- **webext-options-sync** - Sync storage management
- **@dnd-kit** - Drag and drop functionality

### 13. Version Management

- **Always update CHANGELOG.md** when making changes
- **Update version** in `package.json` following semantic versioning
- **Update repository URL** in `package.json` if repository changes

### 14. Code Patterns to Follow

#### Service Pattern
```typescript
// Services follow this pattern:
export class ExtensionService {
  constructor(EM: IExtensionManager) {
    this.EM = EM
  }
  // Methods here
}
```

#### Storage Pattern
```javascript
// Sync storage uses webext-options-sync pattern
import OptionsSync from 'webext-options-sync'
const optionsStorage = new OptionsSync({...})
```

#### React Component Pattern
```jsx
// Components use functional components with hooks
import React from 'react'
export default function ComponentName() {
  // Component logic
  return <div>...</div>
}
```

### 15. Common Tasks

#### Adding AI Features
1. Update `ExtensionKnowledgeBase` to enrich extension metadata
2. Extend `AIAssistantService` for new intent types or grouping logic
3. Add message handlers in `aiMessage.js` if needed
4. Update UI in `src/pages/Options/ai/AIProfiles.jsx` for new features
5. Update types in `src/types/ai.d.ts` if needed
6. Consider external metadata integration via `ExternalKnowledgeClient` if applicable

#### Using External Metadata API
1. User configures API URL in AI Settings
2. `ExternalKnowledgeClient` fetches metadata via `fetch()` with optional host permissions
3. External data is merged with AI-generated metadata (external takes priority for categories/useCases)
4. Falls back to pure AI enrichment if external API unavailable
5. API should return JSON: `{ description?: string, categories?: string[], useCases?: string[] }`

#### Adding a New Rule Action Type
1. Update `ruleV2.IAction` type in `src/types/rule.d.ts`
2. Add handler logic in `src/pages/Background/rule/processor.ts`
3. Update rule editor UI in `src/pages/Options/rule/editor/`
4. Update rule converter if needed (`RuleConverter.ts`)

#### Adding a New Storage Option
1. Add type definition in `src/types/config.d.ts`
2. Add to sync storage schema in `src/storage/sync/`
3. Add UI in Settings page if user-configurable
4. Update migration logic in `LocalOptions.ts` if needed

#### Adding a New Page/Route
1. Create component in `src/pages/Options/`
2. Add route in `src/pages/Options/Options.jsx`
3. Add navigation item in `src/pages/Options/navigation/Navigation.jsx`
4. Add styles if needed

### 16. Git & Repository

- **Repository**: `ignitabull18/ai-extension-manager`
- **Main branch**: `master`
- Always commit with clear, descriptive messages
- Never commit sensitive data (check `secrets.*.js` files)

### 17. Documentation

- **README.md** - User-facing documentation (Chinese)
- **README.en.md** - English documentation
- **AGENTS.md** - AI agent collaboration guide
- **CLAUDE.md** - This file (Claude-specific rules)
- **CHANGELOG.md** - Version history and changes
- **DEBUG.md** - Debugging information

### 18. Important Notes

- The extension uses **Manifest V3**
- Background script is a **service worker** (not persistent)
- Extension **cannot enable/disable itself** (filtered in rule processing)
- **Firefox is not supported** (no enable/disable API)
- APP-type extensions are deprecated (but still supported)

### 19. Before Making Changes

1. **Read relevant existing code** to understand patterns
2. **Check CHANGELOG.md** for recent changes
3. **Use `tree` command** to understand file structure
4. **Test in both Chrome and Edge** if making UI changes
5. **Update CHANGELOG.md** after completing changes

### 20. Error Handling

- Always wrap async operations in try-catch
- Use logger for error reporting
- Provide user-friendly error messages in UI
- Log errors with context for debugging

### 21. Performance Considerations

- Rules are debounced (20ms) to avoid excessive execution
- Extension operations are batched via `ExecuteTaskHandler`
- Use React.memo for expensive components
- Lazy load heavy components when possible

---

**Last Updated**: 2025-01-27
**Maintainer**: AI Agents working on Extension Manager project

