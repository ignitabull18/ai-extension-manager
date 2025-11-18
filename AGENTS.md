# AI Agents Collaboration Guide

This document provides comprehensive information for AI agents working collaboratively on the Extension Manager project.

## Project Identity

- **Name**: Extension Manager (AI Extension Manager)
- **Repository**: `ignitabull18/ai-extension-manager`
- **Type**: Chrome/Edge Browser Extension (Manifest V3)
- **Purpose**: Intelligent browser extension management with rule-based automation
- **Version**: 0.5.27

## Architecture Overview

### Project Structure

```
auto-extension-manager/
├── src/
│   ├── pages/
│   │   ├── Background/     # Service worker (background script)
│   │   ├── Options/        # Options/settings page (React)
│   │   └── Popup/          # Popup UI (React)
│   ├── storage/           # Storage layer (sync & local)
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   ├── assets/            # Static assets (images, icons)
│   ├── _locales/          # i18n translation files
│   └── manifest.json      # Extension manifest
├── utils/                 # Build utilities
├── webpack.config.js      # Webpack configuration
└── package.json           # Dependencies and scripts
```

### Core Components

#### 1. Background Service Worker (`src/pages/Background/`)

**Purpose**: Handles extension management, rule processing, and event handling

**Key Modules**:
- `index.js` - Main entry point, initializes EM (ExtensionManager) global object
- `extension/` - Extension management service
  - `ExtensionService.ts` - Core extension operations
  - `ExtensionRepo.ts` - Extension data repository
  - `ExtensionRecord.ts` - Extension data models
  - `ExtensionIconBuilder.ts` - Icon generation
- `rule/` - Rule processing engine
  - `RuleHandler.ts` - Rule execution coordinator
  - `processor.ts` - Rule matching and processing logic
  - `ExecuteTaskHandler.ts` - Batched extension operations
  - `handlers/` - Match handlers (URL, Scene, OS, Period)
  - `RuleConverter.ts` - Rule version migration
- `history/` - Extension history tracking
  - `History.ts` - History service
  - `HistoryRepo.ts` - History data repository
  - `Record.ts` - History record models
- `message/` - Message passing handlers
  - `messageIndex.js` - Message router
  - `ruleMessage.js` - Rule-related messages
  - `historyMessage.js` - History-related messages
  - `aiMessage.js` - AI assistant messages (intent processing, group suggestions, enrichment, settings)
- `ai/` - AI-assisted extension management
  - `ExtensionKnowledgeBase.ts` - Extension metadata enrichment and knowledge storage
  - `AIAssistantService.ts` - Natural language intent processing and action execution
  - `ExternalKnowledgeClient.ts` - External metadata API integration
  - `index.ts` - AI module initialization
- `event/` - Event caching system
  - `EventCache.ts` - Event storage
  - `extensionStatusEvent.ts` - Extension status events
  - `tabChangeEvent.js` - Tab change events

**Global Object Pattern**:
```javascript
const EM = {
  LocalOptions: LocalOptions,
  Rule: { handler: RuleHandler },
  Extension: { items: [], service: ExtensionService, repo: ExtensionRepo },
  History: History,
  EventCache: EventCache,
  AI: { knowledgeBase: ExtensionKnowledgeBase, assistant: AIAssistantService }
}
```

#### 2. Options Page (`src/pages/Options/`)

**Purpose**: Full-featured settings and management UI

**Technology**: React 18 + React Router + Ant Design 5

**Key Pages**:
- `about/` - About page
- `settings/` - General settings
- `scene/` - Scene management (contextual modes)
- `group/` - Extension group management
- `management/` - Extension management
  - `import/` - Import extensions from share/JSON
  - `share/` - Export/share extensions
- `rule/` - Rule configuration and editing
  - `editor/` - Rule editor components
  - `view/` - Rule viewer components
- `history/` - Extension history viewer
- `ai/` - AI Assistant interface
  - `AIProfiles.jsx` - Natural language extension management UI
- `navigation/` - Side navigation component

**Routing**: Uses HashRouter with routes defined in `Options.jsx`

#### 3. Popup UI (`src/pages/Popup/`)

**Purpose**: Quick access extension manager popup

**Features**:
- List and grid view modes
- Group-based organization
- Search functionality
- Quick enable/disable
- Dark/light theme support

**Key Components**:
- `Components/Popup.jsx` - Main popup component
- `Components/header/` - Header with search and controls
- `Components/grid-view/` - Grid layout components
- `Components/list-view/` - List layout components
- `hooks/` - Custom React hooks
- `utils/` - Popup-specific utilities
- `prepare.js` - Data preparation before render

#### 4. Storage Layer (`src/storage/`)

**Sync Storage** (`src/storage/sync/`):
- Uses `webext-options-sync` for Chrome sync storage
- Stores: Settings, Groups, Scenes, Rules, Management data
- Automatically syncs across devices

**Local Storage** (`src/storage/local/`):
- `LocalOptions.ts` - Local-only options (not synced)
- `ManualEnableCounter.ts` - Manual enable tracking
- Handles migrations

**Utilities**:
- `ConfigCompress.js` - Configuration compression
- `LargeSyncStorage.js` - Handling large sync storage items

### AI System Architecture

#### AI Assistant Service

**Purpose**: Process natural language intents and intelligently manage extensions

**Key Components**:
- `ExtensionKnowledgeBase` - Enriches extension metadata with context, use cases, and alias history
- `AIAssistantService` - Processes natural language queries and generates action plans
- Message handlers for AI intents (`ai-process-intent`, `ai-execute-action`, `ai-get-intents`, `ai-update-knowledge`)

**Knowledge Base**:
- Stores enriched extension descriptions, permission summaries, use cases, alias history, categories, and AI-generated descriptions
- Refreshes automatically every 24 hours
- Supports semantic search and knowledge updates
- Detects and enriches extensions with missing or poor descriptions
- Integrates with optional external metadata APIs for enhanced data

**Smart Grouping**:
- `suggestGroups()` - Analyzes extensions and suggests logical groups based on functionality
- Returns `IAIGroupSuggestions` with confidence scores and rationale
- `applySuggestedGroups()` - Creates actual groups from suggestions
- Supports filtering (only enabled, only ungrouped extensions)

**Description Enrichment**:
- `needsEnrichment()` - Detects extensions with missing/poor descriptions
- `enrichExtensionMetadata()` - Generates AI descriptions, use cases, and categories
- `refreshWithEnrichment()` - Batch enrichment process
- Integrates with `ExternalKnowledgeClient` for external metadata

**External Metadata Client**:
- `ExternalKnowledgeClient` - Fetches extension metadata from external APIs
- Configurable API URL (stored in LocalOptions)
- Batch fetching with rate limiting
- Graceful fallback when external API is unavailable

**AI Models**:
- Primary: `gpt-5-2025-08-07`
- Fallbacks: `claude-sonnet-4-5-20250929`, `gemini-2.5-pro`
- Configurable via LocalOptions (stored securely)
- Currently uses rule-based fallback when AI is disabled

**Action Plans**:
```typescript
interface IAIActionPlan {
  enable: string[]        // Extension IDs to enable
  disable: string[]       // Extension IDs to disable
  activateGroups: string[] // Group IDs to activate
  switchScene?: string    // Scene ID to switch to
  explanation: string     // Why these actions were chosen
  confidence: number      // Confidence score (0-1)
}
```

**Group Suggestions**:
```typescript
interface IAISuggestedGroup {
  id: string
  name: string
  description: string
  extensionIds: string[]
  rationale: string
  confidence: number
  aiCreated?: boolean
}
```

### Rule System Architecture

#### Rule Types

**Rule V2** (Current):
```typescript
interface IRuleConfig {
  id?: string
  version: number
  enable: boolean
  match?: IMatch
  target?: ITarget
  action?: IAction
}
```

**Match Triggers**:
- `urlTrigger` - URL pattern matching (wildcard/regex)
- `sceneTrigger` - Scene-based matching
- `osTrigger` - Operating system matching
- `periodTrigger` - Time period matching

**Match Relationships**:
- `and` - All triggers must match
- `or` - Any trigger must match

**Action Types**:
- `openWhenMatched` - Enable when match occurs
- `closeWhenMatched` - Disable when match occurs
- `openOnlyWhenMatched` - Enable only when matched, disable otherwise
- `closeOnlyWhenMatched` - Disable only when matched, enable otherwise
- `custom` - Advanced custom logic
- `none` - No action

**Rule Processing Flow**:
1. Tab change or extension status change triggers rule evaluation
2. `RuleHandler.do()` is debounced (20ms)
3. Rules are processed via `processor.ts`
4. Matching logic checks all triggers
5. Actions are queued in `ExecuteTaskHandler`
6. Extension operations are batched and executed

### Data Models

#### Extension Info
```typescript
interface ExtensionInfo {
  id: string
  name: string
  enabled: boolean
  // ... chrome.management.ExtensionInfo
}
```

#### Group
```typescript
interface IGroup {
  id: string
  name: string
  desc: string
  extensions: string[] // Extension IDs
}
```

#### Scene
```typescript
interface IScene {
  id: string
  name: string
}
```

#### Settings
```typescript
interface ISetting {
  isShowApp: boolean
  isShowItemOperationAlways: boolean
  isShowSearchBarDefault: boolean
  isRaiseEnableWhenSwitchGroup: boolean
  isShowFixedExtension: boolean
  isShowHiddenExtension: boolean
  darkMode?: "light" | "dark" | "system"
  layout?: "list" | "grid"
  // ... more settings
}
```

### Build System

**Webpack Configuration**:
- Entry points: `options`, `popup`, `background`
- Output: `build/` directory
- Loaders: Babel (JS/JSX), TypeScript, CSS/SCSS, file loaders
- Plugins: HTML, Copy, Clean, Terser (production)

**Build Scripts**:
- `npm run build` - Build for Chrome
- `npm run build:edge` - Build for Edge
- `npm run start` - Development server
- `npm run prettier` - Format code

**Environment**:
- Uses `utils/env.js` for environment detection
- Supports development and production modes
- Secrets can be loaded from `secrets.*.js` files

### Internationalization

**Supported Languages**:
- English (en) - Default
- Japanese (ja)
- Russian (ru)
- Chinese (zh)
- Simplified Chinese (zh_CN)
- Traditional Chinese (zh_TW)

**Implementation**:
- Uses Chrome i18n API
- Translation files in `src/_locales/{lang}/messages.json`
- Access via `chrome.i18n.getMessage()`
- Manifest uses `__MSG_*__` placeholders

### Key Patterns & Conventions

#### Import Path Alias
- `...` maps to `src/` directory
- Example: `import { LocalOptions } from ".../storage/local"`

#### Service Pattern
```typescript
export class ServiceName {
  constructor(EM: IExtensionManager) {
    this.EM = EM
  }
  
  async method() {
    // Implementation
  }
}
```

#### React Component Pattern
```jsx
import React from 'react'

export default function ComponentName(props) {
  // Component logic
  return <div>...</div>
}
```

#### Storage Pattern
```javascript
import OptionsSync from 'webext-options-sync'

const optionsStorage = new OptionsSync({
  defaults: { /* defaults */ },
  migrations: [ /* migrations */ ]
})
```

### Chrome Extension APIs Used

- **chrome.management** - Extension management (enable/disable/get info)
- **chrome.storage** - Data persistence (sync and local)
- **chrome.tabs** - Tab information for rule matching
- **chrome.runtime** - Extension lifecycle, messaging, onInstalled events

### Development Workflow

1. **Understanding Changes**:
   - Read `CHANGELOG.md` for recent changes
   - Check `CLAUDE.md` for Claude-specific rules
   - Review related code files

2. **Making Changes**:
   - Follow existing patterns
   - Keep files under 200 lines
   - Use TypeScript for new logic files
   - Update types in `src/types/`

3. **Testing**:
   - Test in Chrome and Edge
   - Check background console for errors
   - Verify storage operations
   - Test rule execution

4. **Documentation**:
   - Update `CHANGELOG.md` with changes
   - Update relevant docs if architecture changes
   - Add comments for complex logic

### Common Tasks

#### Adding a New Feature
1. Plan architecture impact
2. Add types if needed (`src/types/`)
3. Implement backend logic (`src/pages/Background/`)
4. Add UI components (`src/pages/Options/` or `Popup/`)
5. Add storage schema if needed
6. Update documentation

#### Fixing a Bug
1. Reproduce the issue
2. Check logs (background console)
3. Identify root cause
4. Fix with minimal changes
5. Test thoroughly
6. Update CHANGELOG.md

#### Refactoring
1. Use `tree` command to understand structure
2. Identify affected files
3. Make incremental changes
4. Test after each change
5. Update types if needed

### Important Constraints

- **Manifest V3**: Service worker (not persistent background page)
- **Self-Management**: Extension cannot enable/disable itself
- **Firefox**: Not supported (no enable/disable API)
- **APP Extensions**: Deprecated but still supported
- **File Size**: Keep files under 200 lines when possible

### Communication Between Agents

When working on this project:

1. **Always check CHANGELOG.md** before starting work
2. **Update CHANGELOG.md** after completing work
3. **Use byterover-store-knowledge** when learning new patterns
4. **Use byterover-retrieve-knowledge** when starting new tasks
5. **Follow patterns** established in existing code
6. **Keep code clean** and well-organized

### Resources

- **Documentation**: https://ext.jgrass.cc/docs/intro
- **Blog**: https://ext.jgrass.cc/blog
- **Chrome Store**: https://chrome.google.com/webstore/detail/extension-manager/efajbgpnlnobnkgdcgcnclngeolnmggp
- **Edge Store**: https://microsoftedge.microsoft.com/addons/detail/pifijhmfdnkanlcnecpifkmjbfoopokf

---

**Last Updated**: 2025-01-27
**For**: AI Agents collaborating on Extension Manager project
