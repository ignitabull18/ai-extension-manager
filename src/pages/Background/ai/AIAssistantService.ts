import chromeP from "webext-polyfill-kinda"

import type { IExtensionManager } from ".../types/global"
import logger from ".../utils/logger"
import { ExtensionKnowledgeBase } from "./ExtensionKnowledgeBase"
import { LLMClient } from "./LLMClient"
import { ExecuteTask, ExecuteTaskHandler, ExecuteTaskPriority } from "../rule/ExecuteTaskHandler"
import type { RunningProcessContext } from "../rule/processor"

/**
 * AI Assistant Service
 * Handles natural language intents and translates them into extension management actions
 */
export class AIAssistantService {
  private knowledgeBase: ExtensionKnowledgeBase
  private llmClient: LLMClient
  private lastRefreshTime: number = 0
  private readonly REFRESH_INTERVAL = 1000 * 60 * 60 * 24 // 24 hours

  constructor(private EM: IExtensionManager, knowledgeBase: ExtensionKnowledgeBase) {
    this.knowledgeBase = knowledgeBase
    this.llmClient = new LLMClient()
  }

  /**
   * Initialize AI assistant (refresh knowledge if needed)
   */
  public async initialize(): Promise<void> {
    const now = Date.now()
    const lastRefresh = await this.EM.LocalOptions.getValue<number>("aiKnowledgeLastRefresh") || 0
    
    if (now - lastRefresh > this.REFRESH_INTERVAL) {
      try {
        await this.knowledgeBase.refreshAllKnowledge()
        await this.EM.LocalOptions.setValue("aiKnowledgeLastRefresh", now)
      } catch (error) {
        logger().error("[AI] Failed to refresh knowledge on init", error)
      }
    }
  }

  /**
   * Process natural language intent and generate action plan
   */
  public async processIntent(
    query: string,
    context?: {
      activeTabs?: chrome.tabs.Tab[]
      currentScene?: config.IScene
      activeGroups?: config.IGroup[]
    }
  ): Promise<ai.IAIActionPlan> {
    logger().info(`[AI] Processing intent: ${query}`)

    // Get current context
    const tabs = context?.activeTabs || await chromeP.tabs.query({ active: true })
    const activeTab = tabs.find((t) => t.active) || tabs[0]
    
    // Get all extensions with knowledge
    const allExtensions = await chromeP.management.getAll()
    const knowledgeMap = new Map<string, ai.IExtensionKnowledge>()
    
    for (const ext of allExtensions) {
      const knowledge = await this.knowledgeBase.getKnowledge(ext.id)
      if (knowledge) {
        knowledgeMap.set(ext.id, knowledge)
      }
    }

    // Build context for AI
    const aiContext = {
      query,
      activeTab: activeTab ? {
        url: activeTab.url,
        title: activeTab.title
      } : null,
      currentScene: context?.currentScene,
      activeGroups: context?.activeGroups,
      extensions: allExtensions.map((ext) => {
        const knowledge = knowledgeMap.get(ext.id)
        return {
          id: ext.id,
          name: ext.name,
          enabled: ext.enabled,
          description: ext.description,
          enrichedDescription: knowledge?.enrichedDescription || ext.description || "",
          useCases: knowledge?.useCases || [],
          permissions: ext.permissions || []
        }
      })
    }

    // Call LLM to generate action plan
    const actionPlan = await this.callLLM(aiContext)

    logger().info(`[AI] Generated action plan:`, actionPlan)

    return actionPlan
  }

  /**
   * Execute an action plan
   */
  public async executeActionPlan(
    actionPlan: ai.IAIActionPlan,
    explanation?: string
  ): Promise<void> {
    logger().info(`[AI] Executing action plan`)

    const self = await chromeP.management.getSelf()
    const tabs = await chromeP.tabs.query({})
    const activeTab = tabs.find((t) => t.active) || tabs[0] || null

    const ctx: RunningProcessContext = {
      self,
      tabs,
      tab: activeTab,
      EM: this.EM,
      rule: undefined,
      matchResult: undefined
    }

    const taskHandler = new ExecuteTaskHandler()
    const priority = new ExecuteTaskPriority()

    // Enable extensions
    if (actionPlan.enable.length > 0) {
      const enableTask: ExecuteTask = {
        executeType: "enable",
        targetExtensions: actionPlan.enable.filter((id) => id !== self.id),
        reload: false,
        tabInfo: activeTab,
        ctx,
        priority
      }
      taskHandler.open(enableTask)
    }

    // Disable extensions
    if (actionPlan.disable.length > 0) {
      const disableTask: ExecuteTask = {
        executeType: "disable",
        targetExtensions: actionPlan.disable.filter((id) => id !== self.id),
        reload: false,
        tabInfo: activeTab,
        ctx,
        priority
      }
      taskHandler.close(disableTask)
    }

    // Execute tasks
    await taskHandler.execute()

    // Record in history with AI tag
    if (actionPlan.enable.length > 0 || actionPlan.disable.length > 0) {
      await this.recordAIAction(actionPlan, explanation)
    }

    logger().info(`[AI] Action plan executed successfully`)
  }

  /**
   * Call LLM to generate action plan
   */
  private async callLLM(context: any): Promise<ai.IAIActionPlan> {
    // Get model config
    const modelConfig = await this.getModelConfig()
    
    if (!modelConfig.enabled || !modelConfig.apiKey) {
      // Fallback to rule-based matching
      return this.fallbackRuleBasedMatching(context)
    }

    try {
      const systemPrompt = `You are an AI assistant that helps manage browser extensions intelligently. 
Analyze the user's task description and current browser context to determine which extensions should be enabled or disabled.
Return a JSON object with this structure:
{
  "enable": ["extension-id-1", "extension-id-2"],
  "disable": ["extension-id-3"],
  "activateGroups": ["group-id-1"],
  "switchScene": "scene-id",
  "explanation": "Brief explanation of your reasoning",
  "confidence": 0.85
}

Be conservative - only enable/disable extensions that are clearly relevant to the task.`

      const extensionsList = context.extensions.map((ext: any) => 
        `- ${ext.name} (${ext.id}): ${ext.enrichedDescription || ext.description || "No description"}`
      ).join("\n")

      const userPrompt = `User's task: "${context.query}"

Current context:
- Active tab: ${context.activeTab?.title || "N/A"} (${context.activeTab?.url || "N/A"})
- Current scene: ${context.currentScene?.name || "None"}
- Active groups: ${context.activeGroups?.map((g: any) => g.name).join(", ") || "None"}

Available extensions:
${extensionsList}

Based on the user's task, which extensions should be enabled or disabled? Return only valid JSON.`

      const response = await this.llmClient.call(userPrompt, systemPrompt, modelConfig)
      const actionPlan = this.llmClient.parseJSONResponse(response)

      // Validate and normalize the response
      return {
        enable: Array.isArray(actionPlan.enable) ? actionPlan.enable : [],
        disable: Array.isArray(actionPlan.disable) ? actionPlan.disable : [],
        activateGroups: Array.isArray(actionPlan.activateGroups) ? actionPlan.activateGroups : [],
        switchScene: actionPlan.switchScene || undefined,
        explanation: actionPlan.explanation || "AI-generated action plan",
        confidence: typeof actionPlan.confidence === "number" ? Math.max(0, Math.min(1, actionPlan.confidence)) : 0.7
      }
    } catch (error) {
      logger().error("[AI] LLM call failed, using fallback", error)
      return this.fallbackRuleBasedMatching(context)
    }
  }

  /**
   * Fallback rule-based matching when AI is disabled or unavailable
   */
  private async fallbackRuleBasedMatching(context: any): Promise<ai.IAIActionPlan> {
    const query = context.query.toLowerCase()
    const extensions = context.extensions || []
    
    const enable: string[] = []
    const disable: string[] = []
    
    // Simple keyword matching
    for (const ext of extensions) {
      const searchText = [
        ext.name,
        ext.description,
        ext.enrichedDescription,
        ...ext.useCases
      ].join(" ").toLowerCase()

      if (searchText.includes(query)) {
        if (!ext.enabled) {
          enable.push(ext.id)
        }
      } else {
        // Disable unrelated extensions (conservative approach)
        // Only disable if explicitly mentioned
        if (ext.enabled && searchText.includes(query.split(" ")[0])) {
          // Don't auto-disable, let user be explicit
        }
      }
    }

    return {
      enable,
      disable,
      activateGroups: [],
      explanation: `Matched ${enable.length} extensions based on keyword matching`,
      confidence: 0.5
    }
  }

  /**
   * Get AI model configuration
   */
  public async getModelConfig(): Promise<ai.IAIModelConfig> {
    const config = await this.EM.LocalOptions.getValue<ai.IAIModelConfig>("aiModelConfig")
    return config || {
      primary: "gpt-5-2025-08-07",
      fallback: ["claude-sonnet-4-5-20250929", "gemini-2.5-pro"],
      enabled: false
    }
  }

  /**
   * Record AI action in history
   */
  private async recordAIAction(
    actionPlan: ai.IAIActionPlan,
    explanation?: string
  ): Promise<void> {
    // Store intent in local storage for history
    const intent: ai.IAIIntent = {
      id: `ai_${Date.now()}`,
      query: explanation || "AI-assisted extension management",
      timestamp: Date.now(),
      actionPlan,
      executed: true
    }

    const intents = await this.EM.LocalOptions.getValue<ai.IAIIntent[]>("aiIntents") || []
    intents.unshift(intent)
    
    // Keep only last 100 intents
    if (intents.length > 100) {
      intents.splice(100)
    }

    await this.EM.LocalOptions.setValue("aiIntents", intents)
  }

  /**
   * Get recent AI intents
   */
  public async getRecentIntents(limit: number = 10): Promise<ai.IAIIntent[]> {
    const intents = await this.EM.LocalOptions.getValue<ai.IAIIntent[]>("aiIntents") || []
    return intents.slice(0, limit)
  }

  /**
   * Suggest groups for organizing extensions
   */
  public async suggestGroups(options?: {
    onlyEnabled?: boolean
    onlyUngrouped?: boolean
    existingGroups?: config.IGroup[]
  }): Promise<ai.IAIGroupSuggestions> {
    logger().info("[AI] Suggesting groups for extensions")

    try {
      // Get all extensions
      const allExtensions = await chromeP.management.getAll()
      const self = await chromeP.management.getSelf()
      
      // Filter extensions
      let extensions = allExtensions.filter((ext) => ext.id !== self.id)
      
      if (options?.onlyEnabled) {
        extensions = extensions.filter((ext) => ext.enabled)
      }

      // Get existing groups to understand current organization
      const existingGroups = options?.existingGroups || []
      const groupedExtensionIds = new Set<string>()
      existingGroups.forEach((g) => {
        g.extensions?.forEach((id) => groupedExtensionIds.add(id))
      })

      if (options?.onlyUngrouped) {
        extensions = extensions.filter((ext) => !groupedExtensionIds.has(ext.id))
      }

      // Get knowledge for all extensions
      const knowledgeMap = new Map<string, ai.IExtensionKnowledge>()
      for (const ext of extensions) {
        const knowledge = await this.knowledgeBase.getKnowledge(ext.id)
        if (knowledge) {
          knowledgeMap.set(ext.id, knowledge)
        }
      }

      // Build context for grouping
      const groupingContext = {
        extensions: extensions.map((ext) => {
          const knowledge = knowledgeMap.get(ext.id)
          return {
            id: ext.id,
            name: ext.name,
            description: ext.description || "",
            enrichedDescription: knowledge?.enrichedDescription || ext.description || "",
            useCases: knowledge?.useCases || [],
            categories: knowledge?.categories || [],
            permissions: ext.permissions || [],
            hostPermissions: ext.hostPermissions || [],
            aliasHistory: knowledge?.aliasHistory || [],
            enabled: ext.enabled
          }
        }),
        existingGroups: existingGroups.map((g) => ({
          id: g.id,
          name: g.name,
          desc: g.desc,
          extensionIds: g.extensions || []
        }))
      }

      // Call LLM to generate group suggestions
      const suggestions = await this.callLLMForGrouping(groupingContext)

      logger().info(`[AI] Generated ${suggestions.groups.length} group suggestions`)

      return suggestions
    } catch (error) {
      logger().error("[AI] Error suggesting groups", error)
      throw error
    }
  }

  /**
   * Call LLM to generate group suggestions
   */
  private async callLLMForGrouping(context: any): Promise<ai.IAIGroupSuggestions> {
    // Get model config
    const modelConfig = await this.getModelConfig()
    
    if (!modelConfig.enabled || !modelConfig.apiKey) {
      // Fallback to rule-based grouping
      return this.fallbackGrouping(context)
    }

    try {
      const systemPrompt = `You are an AI assistant that helps organize browser extensions into logical groups.
Analyze the extensions and suggest meaningful groups based on their functionality, use cases, and categories.
Return a JSON object with this structure:
{
  "groups": [
    {
      "id": "suggested_1",
      "name": "Group Name",
      "description": "What this group is for",
      "extensionIds": ["ext-id-1", "ext-id-2"],
      "rationale": "Why these extensions belong together",
      "confidence": 0.85
    }
  ],
  "confidence": 0.8,
  "explanation": "Overall grouping strategy"
}

Create 3-8 groups. Each group should have at least 2 extensions. Extensions can only be in one group.`

      const extensionsList = context.extensions.map((ext: any) => 
        `- ${ext.name} (${ext.id}): ${ext.enrichedDescription || ext.description || "No description"}
  Use cases: ${ext.useCases?.join(", ") || "None"}
  Categories: ${ext.categories?.join(", ") || "None"}
  Permissions: ${ext.permissions?.join(", ") || "None"}`
      ).join("\n\n")

      const existingGroupsInfo = context.existingGroups.length > 0
        ? `\n\nExisting groups (for reference, don't duplicate):\n${context.existingGroups.map((g: any) => `- ${g.name}: ${g.extensionIds?.length || 0} extensions`).join("\n")}`
        : ""

      const userPrompt = `Analyze these browser extensions and suggest logical groups:

${extensionsList}${existingGroupsInfo}

Suggest groups that make sense based on functionality, use cases, and workflow. Return only valid JSON.`

      const response = await this.llmClient.call(userPrompt, systemPrompt, modelConfig)
      const suggestions = this.llmClient.parseJSONResponse(response)

      // Validate and normalize the response
      const groups: ai.IAISuggestedGroup[] = (suggestions.groups || []).map((g: any, index: number) => ({
        id: g.id || `suggested_${Date.now()}_${index}`,
        name: g.name || `Group ${index + 1}`,
        description: g.description || "",
        extensionIds: Array.isArray(g.extensionIds) ? g.extensionIds : [],
        rationale: g.rationale || "",
        confidence: typeof g.confidence === "number" ? Math.max(0, Math.min(1, g.confidence)) : 0.6,
        aiCreated: true,
        createdAt: Date.now()
      })).filter((g: ai.IAISuggestedGroup) => g.extensionIds.length >= 2)

      return {
        groups,
        confidence: typeof suggestions.confidence === "number" ? Math.max(0, Math.min(1, suggestions.confidence)) : 0.6,
        explanation: suggestions.explanation || `Generated ${groups.length} group suggestions`
      }
    } catch (error) {
      logger().error("[AI] LLM grouping call failed, using fallback", error)
      return this.fallbackGrouping(context)
    }
  }

  /**
   * Fallback grouping when AI is disabled or unavailable
   */
  private async fallbackGrouping(context: any): Promise<ai.IAIGroupSuggestions> {
    const extensions = context.extensions || []
    const existingGroups = context.existingGroups || []
    
    // Simple clustering based on keywords in names/descriptions
    const groups: ai.IAISuggestedGroup[] = []
    const usedExtensionIds = new Set<string>()
    
    // Common category keywords
    const categories = [
      { name: "Developer Tools", keywords: ["dev", "developer", "code", "git", "github", "debug", "console"] },
      { name: "Productivity", keywords: ["todo", "task", "note", "calendar", "reminder", "productivity"] },
      { name: "Writing & Editing", keywords: ["write", "grammar", "spell", "text", "editor", "writing"] },
      { name: "Shopping & Deals", keywords: ["shop", "price", "deal", "coupon", "discount", "buy"] },
      { name: "Social Media", keywords: ["social", "twitter", "facebook", "instagram", "share"] },
      { name: "Security & Privacy", keywords: ["security", "privacy", "password", "vpn", "block", "ad"] }
    ]

    for (const category of categories) {
      const matchingExtensions = extensions.filter((ext) => {
        if (usedExtensionIds.has(ext.id)) return false
        
        const searchText = [
          ext.name,
          ext.description,
          ext.enrichedDescription,
          ...ext.useCases
        ].join(" ").toLowerCase()

        return category.keywords.some((keyword) => searchText.includes(keyword))
      })

      if (matchingExtensions.length >= 2) {
        matchingExtensions.forEach((ext) => usedExtensionIds.add(ext.id))
        
        groups.push({
          id: `suggested_${Date.now()}_${groups.length}`,
          name: category.name,
          description: `Extensions related to ${category.name.toLowerCase()}`,
          extensionIds: matchingExtensions.map((e) => e.id),
          rationale: `Grouped based on keywords: ${category.keywords.join(", ")}`,
          confidence: 0.6,
          aiCreated: true,
          createdAt: Date.now()
        })
      }
    }

    // Create "Other" group for remaining extensions
    const remainingExtensions = extensions.filter((ext) => !usedExtensionIds.has(ext.id))
    if (remainingExtensions.length > 0) {
      groups.push({
        id: `suggested_${Date.now()}_other`,
        name: "Other",
        description: "Miscellaneous extensions",
        extensionIds: remainingExtensions.map((e) => e.id),
        rationale: "Extensions that don't fit into other categories",
        confidence: 0.3,
        aiCreated: true,
        createdAt: Date.now()
      })
    }

    return {
      groups,
      confidence: groups.length > 0 ? 0.5 : 0,
      explanation: `Grouped ${extensions.length} extensions into ${groups.length} categories using keyword matching`
    }
  }

  /**
   * Apply suggested groups (create actual groups in storage)
   */
  public async applySuggestedGroups(
    suggestedGroups: ai.IAISuggestedGroup[],
    options?: {
      renameMap?: Record<string, string> // Map of suggested group ID to new name
      excludeExtensionIds?: string[] // Extensions to exclude from all groups
    }
  ): Promise<config.IGroup[]> {
    logger().info(`[AI] Applying ${suggestedGroups.length} suggested groups`)

    const createdGroups: config.IGroup[] = []
    const excludeSet = new Set(options?.excludeExtensionIds || [])

    for (const suggested of suggestedGroups) {
      // Filter out excluded extensions
      const extensionIds = suggested.extensionIds.filter((id) => !excludeSet.has(id))
      
      if (extensionIds.length === 0) {
        continue
      }

      // Use renamed name if provided
      const groupName = options?.renameMap?.[suggested.id] || suggested.name

      // Create group using storage API
      const group: config.IGroup = {
        id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: groupName,
        desc: suggested.description,
        extensions: extensionIds
      }

      // Store group creation metadata
      await this.EM.LocalOptions.setValue(`ai_group_${group.id}`, {
        suggestedGroupId: suggested.id,
        createdAt: Date.now(),
        aiCreated: true,
        rationale: suggested.rationale
      })

      createdGroups.push(group)
    }

    return createdGroups
  }
}

