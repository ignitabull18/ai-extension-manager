import { History } from ".../pages/Background/history/History"
import { RuleHandler } from ".../pages/Background/rule/RuleHandler"
import { EventCache } from "../pages/Background/event/EventCache"
import { ExtensionService } from "../pages/Background/extension/ExtensionService"
import { ExtensionRepo } from "../pages/Background/extension/ExtensionRepo"
import { LocalOptions } from "../storage/local"
import { ExtensionKnowledgeBase } from "../pages/Background/ai/ExtensionKnowledgeBase"
import { AIAssistantService } from "../pages/Background/ai/AIAssistantService"

declare interface IExtensionManager {
  LocalOptions: LocalOptions
  Rule: {
    handler: RuleHandler
  }
  Extension: {
    items: chrome.management.ExtensionInfo[]
    service: ExtensionService
    repo?: ExtensionRepo
  }
  History: History
  EventCache: EventCache
  AI?: {
    knowledgeBase: ExtensionKnowledgeBase
    assistant: AIAssistantService
    externalClient?: any // ExternalKnowledgeClient
  } | null
}
