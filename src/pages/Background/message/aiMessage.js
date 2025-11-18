import chromeP from "webext-polyfill-kinda"
import logger from ".../utils/logger"
import storage from ".../storage/sync"
import { GroupOptions } from ".../storage/sync/GroupOptions"

export const createAIIntentHandler = (EM) => {
  return async (ctx) => {
    if (!EM.AI || !EM.AI.assistant) {
      ctx.sendResponse({
        state: "error",
        error: "AI assistant not available"
      })
      return
    }

    try {
      const { params } = ctx
      const { query, context } = params || {}

      if (!query) {
        ctx.sendResponse({
          state: "error",
          error: "Query is required"
        })
        return
      }

      // Get current context
      const tabs = await chromeP.tabs.query({ active: true })
      const allTabs = await chromeP.tabs.query({})

      // Get current scene and groups from storage
      const options = await storage.options.getAll()
      const activeSceneId = await EM.LocalOptions.getActiveSceneId()
      const activeGroupId = await EM.LocalOptions.getActiveGroupId()

      const currentScene = options.scenes?.find((s) => s.id === activeSceneId)
      const activeGroups = options.groups?.filter((g) => g.id === activeGroupId) || []

      const aiContext = {
        activeTabs: allTabs,
        currentScene,
        activeGroups
      }

      // Process intent
      const actionPlan = await EM.AI.assistant.processIntent(query, aiContext)

      ctx.sendResponse({
        state: "success",
        actionPlan
      })
    } catch (error) {
      logger().error("[AI] Error processing intent", error)
      ctx.sendResponse({
        state: "error",
        error: error.message
      })
    }
  }
}

export const createAIExecuteHandler = (EM) => {
  return async (ctx) => {
    if (!EM.AI || !EM.AI.assistant) {
      ctx.sendResponse({
        state: "error",
        error: "AI assistant not available"
      })
      return
    }

    try {
      const { params } = ctx
      const { actionPlan, explanation } = params || {}

      if (!actionPlan) {
        ctx.sendResponse({
          state: "error",
          error: "Action plan is required"
        })
        return
      }

      // Execute action plan
      await EM.AI.assistant.executeActionPlan(actionPlan, explanation)

      ctx.sendResponse({
        state: "success"
      })
    } catch (error) {
      logger().error("[AI] Error executing action plan", error)
      ctx.sendResponse({
        state: "error",
        error: error.message
      })
    }
  }
}

export const createAIGetIntentsHandler = (EM) => {
  return async (ctx) => {
    if (!EM.AI || !EM.AI.assistant) {
      ctx.sendResponse({
        state: "error",
        error: "AI assistant not available"
      })
      return
    }

    try {
      const { params } = ctx
      const limit = params?.limit || 10

      const intents = await EM.AI.assistant.getRecentIntents(limit)

      ctx.sendResponse({
        state: "success",
        intents
      })
    } catch (error) {
      logger().error("[AI] Error getting intents", error)
      ctx.sendResponse({
        state: "error",
        error: error.message
      })
    }
  }
}

export const createAIUpdateKnowledgeHandler = (EM) => {
  return async (ctx) => {
    if (!EM.AI || !EM.AI.knowledgeBase) {
      ctx.sendResponse({
        state: "error",
        error: "AI knowledge base not available"
      })
      return
    }

    try {
      const { params } = ctx
      const { extId, useCases, alias } = params || {}

      if (!extId) {
        ctx.sendResponse({
          state: "error",
          error: "Extension ID is required"
        })
        return
      }

      if (useCases) {
        await EM.AI.knowledgeBase.updateUseCases(extId, useCases)
      }

      if (alias) {
        await EM.AI.knowledgeBase.addAliasToHistory(extId, alias)
      }

      ctx.sendResponse({
        state: "success"
      })
    } catch (error) {
      logger().error("[AI] Error updating knowledge", error)
      ctx.sendResponse({
        state: "error",
        error: error.message
      })
    }
  }
}

export const createAISuggestGroupsHandler = (EM) => {
  return async (ctx) => {
    if (!EM.AI || !EM.AI.assistant) {
      ctx.sendResponse({
        state: "error",
        error: "AI assistant not available"
      })
      return
    }

    try {
      const { params } = ctx
      const options = params?.options || {}

      // Get existing groups from storage
      const allOptions = await storage.options.getAll()
      options.existingGroups = allOptions.groups || []

      // Suggest groups
      const suggestions = await EM.AI.assistant.suggestGroups(options)

      ctx.sendResponse({
        state: "success",
        suggestions
      })
    } catch (error) {
      logger().error("[AI] Error suggesting groups", error)
      ctx.sendResponse({
        state: "error",
        error: error.message
      })
    }
  }
}

export const createAIApplyGroupsHandler = (EM) => {
  return async (ctx) => {
    if (!EM.AI || !EM.AI.assistant) {
      ctx.sendResponse({
        state: "error",
        error: "AI assistant not available"
      })
      return
    }

    try {
      const { params } = ctx
      const { suggestedGroups, options } = params || {}

      if (!suggestedGroups || !Array.isArray(suggestedGroups)) {
        ctx.sendResponse({
          state: "error",
          error: "Suggested groups array is required"
        })
        return
      }

      // Apply suggested groups (creates group objects)
      const createdGroups = await EM.AI.assistant.applySuggestedGroups(suggestedGroups, options)

      // Save groups to storage using GroupOptions
      for (const group of createdGroups) {
        try {
          await GroupOptions.addGroup(group)
        } catch (error) {
          logger().warn(`[AI] Failed to add group ${group.name}`, error)
        }
      }

      ctx.sendResponse({
        state: "success",
        createdGroups
      })
    } catch (error) {
      logger().error("[AI] Error applying groups", error)
      ctx.sendResponse({
        state: "error",
        error: error.message
      })
    }
  }
}

export const createAIRefreshEnrichmentHandler = (EM) => {
  return async (ctx) => {
    if (!EM.AI || !EM.AI.knowledgeBase) {
      ctx.sendResponse({
        state: "error",
        error: "AI knowledge base not available"
      })
      return
    }

    try {
      const { params } = ctx
      const enabled = params?.enabled !== false // Default to true if not specified

      // Get existing groups and external client
      const allOptions = await storage.options.getAll()
      const externalClient = EM.AI.externalClient

      // Get model config from assistant (if available)
      let modelConfig = null
      if (EM.AI.assistant) {
        try {
          modelConfig = await EM.AI.assistant.getModelConfig()
        } catch (e) {
          logger().warn("[AI] Could not get model config for enrichment", e)
        }
      }

      // Refresh with enrichment
      await EM.AI.knowledgeBase.refreshWithEnrichment(enabled, {
        existingGroups: allOptions.groups || [],
        externalClient,
        modelConfig: modelConfig || undefined
      })

      ctx.sendResponse({
        state: "success"
      })
    } catch (error) {
      logger().error("[AI] Error refreshing enrichment", error)
      ctx.sendResponse({
        state: "error",
        error: error.message
      })
    }
  }
}

export const createAIGetSettingsHandler = (EM) => {
  return async (ctx) => {
    try {
      const aiDescriptionEnrichment = await EM.LocalOptions.getValue("aiDescriptionEnrichment") ?? false
      const aiExternalMetadataEnabled = await EM.LocalOptions.getValue("aiExternalMetadataEnabled") ?? false
      const aiExternalMetadataUrl = await EM.LocalOptions.getValue("aiExternalMetadataUrl") || ""
      
      // Get model config
      let modelConfig = await EM.LocalOptions.getValue("aiModelConfig")
      if (!modelConfig) {
        modelConfig = {
          primary: "gpt-5.1",
          fallback: [], // gpt-5.1-nano doesn't exist
          enabled: false,
          apiKey: "",
          endpoint: ""
        }
      }

      ctx.sendResponse({
        state: "success",
        settings: {
          aiDescriptionEnrichment,
          aiExternalMetadataEnabled,
          aiExternalMetadataUrl,
          modelConfig: {
            enabled: modelConfig.enabled || false,
            primary: modelConfig.primary || "gpt-5.1",
            fallback: modelConfig.fallback || [], // gpt-5.1-nano doesn't exist
            apiKey: modelConfig.apiKey ? "***" + modelConfig.apiKey.slice(-4) : "", // Masked for display
            endpoint: modelConfig.endpoint || ""
          }
        }
      })
    } catch (error) {
      logger().error("[AI] Error getting settings", error)
      ctx.sendResponse({
        state: "error",
        error: error.message
      })
    }
  }
}

export const createAISetSettingsHandler = (EM) => {
  return async (ctx) => {
    try {
      const { params } = ctx
      const { settings } = params || {}

      if (!settings) {
        ctx.sendResponse({
          state: "error",
          error: "Settings object is required"
        })
        return
      }

      if (settings.aiDescriptionEnrichment !== undefined) {
        await EM.LocalOptions.setValue("aiDescriptionEnrichment", settings.aiDescriptionEnrichment)
      }

      if (settings.aiExternalMetadataEnabled !== undefined) {
        await EM.LocalOptions.setValue("aiExternalMetadataEnabled", settings.aiExternalMetadataEnabled)
      }

      if (settings.aiExternalMetadataUrl !== undefined) {
        await EM.LocalOptions.setValue("aiExternalMetadataUrl", settings.aiExternalMetadataUrl)
        
        // Update external client URL if AI is initialized
        if (EM.AI?.externalClient) {
          EM.AI.externalClient.setBaseUrl(settings.aiExternalMetadataUrl || undefined)
        }
      }

      // Handle model config
      if (settings.modelConfig !== undefined) {
        const currentModelConfig = await EM.LocalOptions.getValue("aiModelConfig") || {
          primary: "gpt-5.1",
          fallback: [], // gpt-5.1-nano doesn't exist
          enabled: false,
          apiKey: "",
          endpoint: ""
        }

        const updatedModelConfig = { ...currentModelConfig }

        if (settings.modelConfig.enabled !== undefined) {
          updatedModelConfig.enabled = settings.modelConfig.enabled
        }
        if (settings.modelConfig.primary !== undefined) {
          updatedModelConfig.primary = settings.modelConfig.primary
        }
        if (settings.modelConfig.fallback !== undefined) {
          updatedModelConfig.fallback = settings.modelConfig.fallback
        }
        if (settings.modelConfig.endpoint !== undefined) {
          updatedModelConfig.endpoint = settings.modelConfig.endpoint
        }
        
        // Only update API key if a new one was provided (not masked)
        if (settings.modelConfig.apiKey !== undefined && !settings.modelConfig.apiKey.startsWith("***")) {
          updatedModelConfig.apiKey = settings.modelConfig.apiKey
        }

        await EM.LocalOptions.setValue("aiModelConfig", updatedModelConfig)
      }

      ctx.sendResponse({
        state: "success"
      })
    } catch (error) {
      logger().error("[AI] Error setting settings", error)
      ctx.sendResponse({
        state: "error",
        error: error.message
      })
    }
  }
}

