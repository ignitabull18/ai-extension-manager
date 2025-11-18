import chromeP from "webext-polyfill-kinda"
import localforage from "localforage"

import { ExtensionRepo } from "../extension/ExtensionRepo"
import { ExtensionRecord } from "../extension/ExtensionRecord"
import { LLMClient } from "./LLMClient"
import logger from ".../utils/logger"

/**
 * Extension Knowledge Base for AI processing
 * Enriches extension metadata with context, use cases, and semantic information
 */
export class ExtensionKnowledgeBase {
  private forage: LocalForage
  private repo: ExtensionRepo
  private llmClient: LLMClient

  constructor(repo: ExtensionRepo) {
    this.repo = repo
    this.llmClient = new LLMClient()
    this.forage = localforage.createInstance({
      driver: localforage.INDEXEDDB,
      name: "ExtensionManagerForage",
      version: 1.0,
      storeName: "ai_knowledge"
    })
  }

  /**
   * Get knowledge for an extension
   */
  public async getKnowledge(extId: string): Promise<ai.IExtensionKnowledge | null> {
    return await this.forage.getItem(extId)
  }

  /**
   * Set knowledge for an extension
   */
  public async setKnowledge(knowledge: ai.IExtensionKnowledge): Promise<void> {
    if (!knowledge.extId) {
      throw new Error("Extension ID is required")
    }
    knowledge.lastUpdated = Date.now()
    await this.forage.setItem(knowledge.extId, knowledge)
  }

  /**
   * Build enriched knowledge from extension metadata
   */
  public async buildKnowledge(ext: ExtensionRecord): Promise<ai.IExtensionKnowledge> {
    const existing = await this.getKnowledge(ext.id)
    
    // Build enriched description
    const parts: string[] = []
    if (ext.name) parts.push(`Name: ${ext.name}`)
    if (ext.description) parts.push(`Description: ${ext.description}`)
    if (ext.shortName) parts.push(`Short Name: ${ext.shortName}`)
    
    const enrichedDescription = parts.join(". ")

    // Build permission summary
    const permissions = ext.permissions || []
    const hostPermissions = ext.hostPermissions || []
    const permissionSummary = [
      ...permissions.map((p) => `Permission: ${p}`),
      ...hostPermissions.map((hp) => `Host: ${hp}`)
    ].join(", ")

    // Preserve existing use cases and alias history
    const useCases = existing?.useCases || []
    const aliasHistory = existing?.aliasHistory || []

    return {
      extId: ext.id,
      enrichedDescription,
      permissionSummary,
      useCases,
      aliasHistory,
      lastUpdated: Date.now()
    }
  }

  /**
   * Update knowledge with user-provided use cases
   */
  public async updateUseCases(extId: string, useCases: string[]): Promise<void> {
    const knowledge = await this.getKnowledge(extId)
    if (!knowledge) {
      throw new Error(`Knowledge not found for extension ${extId}`)
    }
    knowledge.useCases = useCases
    await this.setKnowledge(knowledge)
  }

  /**
   * Add alias to history
   */
  public async addAliasToHistory(extId: string, alias: string): Promise<void> {
    const knowledge = await this.getKnowledge(extId)
    if (knowledge) {
      if (!knowledge.aliasHistory.includes(alias)) {
        knowledge.aliasHistory.push(alias)
        // Keep only last 10 aliases
        if (knowledge.aliasHistory.length > 10) {
          knowledge.aliasHistory = knowledge.aliasHistory.slice(-10)
        }
        await this.setKnowledge(knowledge)
      }
    } else {
      // Create new knowledge entry
      const ext = await this.repo.get(extId)
      if (ext) {
        const newKnowledge = await this.buildKnowledge(ext)
        newKnowledge.aliasHistory = [alias]
        await this.setKnowledge(newKnowledge)
      }
    }
  }

  /**
   * Refresh knowledge for all extensions (nightly job)
   */
  public async refreshAllKnowledge(): Promise<void> {
    logger().info("[AI] Starting knowledge refresh for all extensions")
    
    try {
      const allExtensions = await chromeP.management.getAll()
      let updated = 0
      let created = 0

      for (const ext of allExtensions) {
        const record = await this.repo.get(ext.id)
        if (!record) {
          continue
        }

        const existing = await this.getKnowledge(ext.id)
        const knowledge = await this.buildKnowledge(record)

        // Preserve user-entered use cases
        if (existing?.useCases && existing.useCases.length > 0) {
          knowledge.useCases = existing.useCases
        }

        // Preserve alias history
        if (existing?.aliasHistory && existing.aliasHistory.length > 0) {
          knowledge.aliasHistory = existing.aliasHistory
        }

        await this.setKnowledge(knowledge)

        if (existing) {
          updated++
        } else {
          created++
        }
      }

      logger().info(`[AI] Knowledge refresh complete: ${created} created, ${updated} updated`)
    } catch (error) {
      logger().error("[AI] Error refreshing knowledge", error)
      throw error
    }
  }

  /**
   * Get all knowledge entries
   */
  public async getAllKnowledge(): Promise<ai.IExtensionKnowledge[]> {
    const keys = await this.forage.keys()
    const knowledge: ai.IExtensionKnowledge[] = []
    
    for (const key of keys) {
      const k = await this.getKnowledge(key)
      if (k) {
        knowledge.push(k)
      }
    }
    
    return knowledge
  }

  /**
   * Search knowledge by text (simple text matching for now)
   */
  public async searchKnowledge(query: string): Promise<ai.IExtensionKnowledge[]> {
    const all = await this.getAllKnowledge()
    const lowerQuery = query.toLowerCase()
    
    return all.filter((k) => {
      return (
        k.enrichedDescription.toLowerCase().includes(lowerQuery) ||
        k.permissionSummary.toLowerCase().includes(lowerQuery) ||
        k.useCases.some((uc) => uc.toLowerCase().includes(lowerQuery)) ||
        k.aliasHistory.some((ah) => ah.toLowerCase().includes(lowerQuery))
      )
    })
  }

  /**
   * Check if extension description needs enrichment
   */
  public needsEnrichment(ext: ExtensionRecord): boolean {
    const MIN_DESCRIPTION_LENGTH = 20
    const GENERIC_PATTERNS = [
      /^chrome extension$/i,
      /^extension$/i,
      /^browser extension$/i,
      /^a simple extension$/i,
      /^my extension$/i
    ]

    const description = ext.description || ""
    
    // Check if description is too short
    if (description.length < MIN_DESCRIPTION_LENGTH) {
      return true
    }

    // Check if description matches generic patterns
    if (GENERIC_PATTERNS.some((pattern) => pattern.test(description.trim()))) {
      return true
    }

    return false
  }

  /**
   * Enrich extension description, use cases, and categories using AI
   */
  public async enrichExtensionMetadata(
    ext: ExtensionRecord,
    context?: {
      existingGroups?: config.IGroup[]
      existingKnowledge?: ai.IExtensionKnowledge
      externalClient?: any // ExternalKnowledgeClient
      modelConfig?: ai.IAIModelConfig
    }
  ): Promise<{
    aiGeneratedDescription?: string
    useCases?: string[]
    categories?: string[]
  }> {
    logger().info(`[AI] Enriching metadata for extension: ${ext.name}`)

    // Try to fetch external metadata first (if available)
    let externalMetadata: {
      description?: string
      categories?: string[]
      useCases?: string[]
    } | null = null

    if (context?.externalClient && context.externalClient.isEnabled()) {
      try {
        externalMetadata = await context.externalClient.fetchExtensionMetadata(ext.id)
      } catch (error) {
        logger().warn(`[AI] Failed to fetch external metadata for ${ext.id}`, error)
      }
    }

    // Build enrichment context
    const enrichmentContext = {
      name: ext.name,
      shortName: ext.shortName || "",
      description: externalMetadata?.description || ext.description || "",
      permissions: ext.permissions || [],
      hostPermissions: ext.hostPermissions || [],
      existingUseCases: context?.existingKnowledge?.useCases || [],
      existingAliases: context?.existingKnowledge?.aliasHistory || [],
      groupMembership: context?.existingGroups
        ?.filter((g) => g.extensions?.includes(ext.id))
        .map((g) => g.name) || [],
      externalCategories: externalMetadata?.categories,
      externalUseCases: externalMetadata?.useCases
    }

    // Call AI to generate enriched metadata
    const enriched = await this.callAIForEnrichment(enrichmentContext, context?.modelConfig)

    // Merge external metadata with AI-generated (external takes priority for categories/useCases)
    if (externalMetadata) {
      if (externalMetadata.categories && externalMetadata.categories.length > 0) {
        enriched.categories = externalMetadata.categories
      }
      if (externalMetadata.useCases && externalMetadata.useCases.length > 0) {
        enriched.useCases = [...new Set([...(enriched.useCases || []), ...externalMetadata.useCases])]
      }
    }

    return enriched
  }

  /**
   * Call AI to generate enriched metadata
   */
  private async callAIForEnrichment(
    context: any,
    modelConfig?: ai.IAIModelConfig
  ): Promise<{
    aiGeneratedDescription?: string
    useCases?: string[]
    categories?: string[]
  }> {
    // If no model config or AI disabled, use rule-based fallback
    if (!modelConfig || !modelConfig.enabled || !modelConfig.apiKey) {
      return this.fallbackEnrichment(context)
    }

    try {
      const systemPrompt = `You are an AI assistant that enriches browser extension metadata.
Analyze the extension information and generate:
1. A clear, user-friendly description (1-2 sentences) if the original is missing or too generic
2. 3-5 specific use cases where this extension would be helpful
3. 1-3 category tags (e.g., "developer-tools", "productivity", "writing", "shopping", "social-media", "security-privacy")

Return a JSON object with this structure:
{
  "aiGeneratedDescription": "Clear description of what this extension does",
  "useCases": ["Use case 1", "Use case 2", "Use case 3"],
  "categories": ["category-1", "category-2"]
}

Be specific and helpful. Base your analysis on the extension name, permissions, and any existing context.`

      const permissionsList = [
        ...(context.permissions || []),
        ...(context.hostPermissions || []).map((hp: string) => `host:${hp}`)
      ].join(", ")

      const groupContext = context.groupMembership && context.groupMembership.length > 0
        ? `\nThis extension is currently in groups: ${context.groupMembership.join(", ")}`
        : ""

      const userPrompt = `Extension: ${context.name}${context.shortName ? ` (${context.shortName})` : ""}
Current description: ${context.description || "Missing"}
Permissions: ${permissionsList || "None"}${groupContext}
Existing use cases: ${context.existingUseCases?.join(", ") || "None"}
Existing aliases: ${context.existingAliases?.join(", ") || "None"}

Generate enriched metadata for this extension. Return only valid JSON.`

      const response = await this.llmClient.call(userPrompt, systemPrompt, modelConfig)
      const enriched = this.llmClient.parseJSONResponse(response)

      return {
        aiGeneratedDescription: enriched.aiGeneratedDescription || undefined,
        useCases: Array.isArray(enriched.useCases) ? enriched.useCases : undefined,
        categories: Array.isArray(enriched.categories) ? enriched.categories : undefined
      }
    } catch (error) {
      logger().warn(`[AI] LLM enrichment failed for ${context.name}, using fallback`, error)
      return this.fallbackEnrichment(context)
    }
  }

  /**
   * Fallback enrichment when AI is disabled or unavailable
   */
  private fallbackEnrichment(context: any): {
    aiGeneratedDescription?: string
    useCases?: string[]
    categories?: string[]
  } {
    const description = context.description || ""
    const name = context.name || ""
    const permissions = context.permissions || []
    
    // Generate basic description if missing
    let aiGeneratedDescription: string | undefined
    if (!description || description.length < 20) {
      aiGeneratedDescription = `${name} is a browser extension that provides functionality based on its permissions and features.`
      
      // Add context from permissions
      if (permissions.includes("tabs")) {
        aiGeneratedDescription += " It can interact with browser tabs."
      }
      if (permissions.includes("storage")) {
        aiGeneratedDescription += " It can store data locally."
      }
      if (permissions.includes("notifications")) {
        aiGeneratedDescription += " It can send notifications."
      }
    }

    // Generate use cases based on name and permissions
    const useCases: string[] = []
    const nameLower = name.toLowerCase()
    
    if (nameLower.includes("dev") || nameLower.includes("developer") || nameLower.includes("code")) {
      useCases.push("Development and coding workflows")
      useCases.push("Code review and debugging")
    }
    if (nameLower.includes("productivity") || nameLower.includes("todo") || nameLower.includes("task")) {
      useCases.push("Task management and organization")
      useCases.push("Improving productivity")
    }
    if (nameLower.includes("write") || nameLower.includes("grammar") || nameLower.includes("spell")) {
      useCases.push("Writing and text editing")
      useCases.push("Grammar and spell checking")
    }
    if (permissions.includes("tabs")) {
      useCases.push("Managing browser tabs")
    }
    if (permissions.includes("bookmarks")) {
      useCases.push("Organizing bookmarks")
    }
    if (permissions.includes("history")) {
      useCases.push("Browsing history management")
    }

    // Generate categories
    const categories: string[] = []
    if (nameLower.includes("dev") || nameLower.includes("developer") || nameLower.includes("code") || nameLower.includes("git")) {
      categories.push("developer-tools")
    }
    if (nameLower.includes("productivity") || nameLower.includes("todo") || nameLower.includes("task")) {
      categories.push("productivity")
    }
    if (nameLower.includes("write") || nameLower.includes("grammar") || nameLower.includes("spell")) {
      categories.push("writing")
    }
    if (nameLower.includes("shop") || nameLower.includes("price") || nameLower.includes("deal")) {
      categories.push("shopping")
    }
    if (nameLower.includes("social") || nameLower.includes("twitter") || nameLower.includes("facebook")) {
      categories.push("social-media")
    }
    if (nameLower.includes("security") || nameLower.includes("privacy") || nameLower.includes("password") || nameLower.includes("vpn")) {
      categories.push("security-privacy")
    }

    return {
      aiGeneratedDescription,
      useCases: useCases.length > 0 ? useCases : undefined,
      categories: categories.length > 0 ? categories : undefined
    }
  }

  /**
   * Refresh knowledge with enrichment for extensions that need it
   */
  public async refreshWithEnrichment(
    enabled: boolean = false,
    context?: {
      existingGroups?: config.IGroup[]
      externalClient?: any // ExternalKnowledgeClient
      modelConfig?: ai.IAIModelConfig
    }
  ): Promise<void> {
    if (!enabled) {
      logger().info("[AI] Description enrichment is disabled, skipping")
      return
    }

    logger().info("[AI] Starting knowledge refresh with enrichment")
    
    try {
      const allExtensions = await chromeP.management.getAll()
      let enriched = 0

      for (const ext of allExtensions) {
        const record = await this.repo.get(ext.id)
        if (!record) {
          continue
        }

        const existing = await this.getKnowledge(ext.id)
        
        // Check if enrichment is needed
        if (this.needsEnrichment(record)) {
          const enrichedData = await this.enrichExtensionMetadata(record, {
            existingGroups: context?.existingGroups,
            existingKnowledge: existing || undefined,
            externalClient: context?.externalClient,
            modelConfig: context?.modelConfig
          })

          const knowledge = existing || await this.buildKnowledge(record)
          
          // Update with enriched data
          if (enrichedData.aiGeneratedDescription) {
            knowledge.aiGeneratedDescription = enrichedData.aiGeneratedDescription
            knowledge.descriptionEnriched = true
          }
          if (enrichedData.useCases && enrichedData.useCases.length > 0) {
            // Merge with existing use cases
            const existingUseCases = knowledge.useCases || []
            knowledge.useCases = [...new Set([...existingUseCases, ...enrichedData.useCases])]
          }
          if (enrichedData.categories && enrichedData.categories.length > 0) {
            knowledge.categories = enrichedData.categories
          }

          await this.setKnowledge(knowledge)
          enriched++
        }
      }

      logger().info(`[AI] Knowledge enrichment complete: ${enriched} extensions enriched`)
    } catch (error) {
      logger().error("[AI] Error enriching knowledge", error)
      throw error
    }
  }
}

