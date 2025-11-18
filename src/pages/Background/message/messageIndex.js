import { listen } from ".../utils/messageHelper"
import logger from ".../utils/logger"
import { createManualChangeGroupHandler } from "./historyMessage"
import { createCurrentSceneChangedHandler, createRuleConfigChangedHandler } from "./ruleMessage"
import {
  createAIIntentHandler,
  createAIExecuteHandler,
  createAIGetIntentsHandler,
  createAIUpdateKnowledgeHandler,
  createAISuggestGroupsHandler,
  createAIApplyGroupsHandler,
  createAIRefreshEnrichmentHandler,
  createAIGetSettingsHandler,
  createAISetSettingsHandler,
  createAIEnrichExtensionsHandler,
  createAIGetEnrichmentStatusHandler
} from "./aiMessage"

/**
 * 自定义 message 的处理（popup / options 页面发送过来的 message）
 */
const createMessageHandler = (EM) => {
  const ruleHandler = EM.Rule.handler
  if (!ruleHandler) {
    throw new Error("Rule handler is not defined")
  }

  // 监听其它页面（popup / options）发送给 background 的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const ctx = {
      message,
      sender,
      sendResponse
    }

    // Parse message ID first to route appropriately
    let msgId = null
    try {
      const msg = JSON.parse(message)
      msgId = msg.id
    } catch (e) {
      // Invalid message format
      return false
    }

    // Route to appropriate handler based on message ID
    // Return true immediately to keep port open for async handlers
    if (msgId?.startsWith("ai-")) {
      // AI messages - handled by createAIMessage
      createAIMessage(EM, ctx).catch((error) => {
        logger().error("[Message] Error in AI message handler", error)
        ctx.sendResponse({
          state: "error",
          error: error.message || "Unknown error"
        })
      })
      return true // Keep port open for async response
    } else if (msgId === "current-scene-changed" || msgId === "rule-config-changed") {
      // Rule messages
      createRuleMessage(EM.Rule.handler, ctx).catch((error) => {
        logger().error("[Message] Error in rule message handler", error)
      })
      return true // Keep port open for async response
    } else if (msgId === "manual-change-group") {
      // History messages
      createHistoryMessage(EM, ctx).catch((error) => {
        logger().error("[Message] Error in history message handler", error)
      })
      return true // Keep port open for async response
    } else {
      // Unknown message - try all handlers (fallback for backwards compatibility)
      createRuleMessage(EM.Rule.handler, ctx).catch((error) => {
        logger().error("[Message] Error in rule message handler", error)
      })
      createHistoryMessage(EM, ctx).catch((error) => {
        logger().error("[Message] Error in history message handler", error)
      })
      createAIMessage(EM, ctx).catch((error) => {
        logger().error("[Message] Error in AI message handler", error)
      })
      return true // Keep port open for async response
    }
  })
}

/*
 * 规则处理相关的 message
 */
const createRuleMessage = async (handler, ctx) => {
  // 当前情况模式发生变更
  if (await listen("current-scene-changed", ctx, createCurrentSceneChangedHandler(handler))) return

  // 规则配置发生变更
  if (await listen("rule-config-changed", ctx, createRuleConfigChangedHandler(handler))) return

  // If no handler matched, don't send a response (rule messages may not need responses)
  // Note: Handlers above send their own responses via ctx.sendResponse()
}

/**
 * 处理历史记录相关的 message
 */
const createHistoryMessage = async (EM, ctx) => {
  if (await listen("manual-change-group", ctx, createManualChangeGroupHandler(EM))) return

  // If no handler matched, don't send a response (history messages may not need responses)
  // Note: Handler above sends its own response via ctx.sendResponse()
}

/**
 * 处理 AI 相关的 message
 */
const createAIMessage = async (EM, ctx) => {
  if (!EM.AI) {
    // AI not initialized - send error response
    ctx.sendResponse({
      state: "error",
      error: "AI service is not available. Please reload the extension."
    })
    return
  }

  // Try each handler until one matches (listen returns true when matched)
  // Process AI intent
  if (await listen("ai-process-intent", ctx, createAIIntentHandler(EM))) return

  // Execute AI action plan
  if (await listen("ai-execute-action", ctx, createAIExecuteHandler(EM))) return

  // Get recent AI intents
  if (await listen("ai-get-intents", ctx, createAIGetIntentsHandler(EM))) return

  // Update extension knowledge
  if (await listen("ai-update-knowledge", ctx, createAIUpdateKnowledgeHandler(EM))) return

  // Suggest groups for organizing extensions
  if (await listen("ai-suggest-groups", ctx, createAISuggestGroupsHandler(EM))) return

  // Apply suggested groups
  if (await listen("ai-apply-groups", ctx, createAIApplyGroupsHandler(EM))) return

  // Refresh enrichment for extensions
  if (await listen("ai-refresh-enrichment", ctx, createAIRefreshEnrichmentHandler(EM))) return

  // Get AI settings
  if (await listen("ai-get-settings", ctx, createAIGetSettingsHandler(EM))) return

  // Set AI settings
  if (await listen("ai-set-settings", ctx, createAISetSettingsHandler(EM))) return

  // Enrich extensions (all or selected)
  if (await listen("ai-enrich-extensions", ctx, createAIEnrichExtensionsHandler(EM))) return

  // Get enrichment status for extensions
  if (await listen("ai-get-enrichment-status", ctx, createAIGetEnrichmentStatusHandler(EM))) return

  // If no handler matched, send error response
  // This shouldn't happen for valid AI messages, but handle it gracefully
  ctx.sendResponse({
    state: "error",
    error: `Unknown AI message type: ${ctx.id || "unknown"}`
  })
}

export default createMessageHandler

/*
  listen("message id", ctx, OnMessageCallback)
  OnMessageCallback is a function that takes the message and sender as parameters, like
  OnMessageCallback(ctx),
  ctx:
  {
    "message": "{\"id\":\"current-scene-changed\",\"params\":{\"name\":\"开发模式\",\"id\":\"10LNWD41eerhzEbvnoJwL\"}}",
    "sender": {
        "id": "ildkgigifaagohmoehgmhapickcnlefd",
        "url": "chrome-extension://ildkgigifaagohmoehgmhapickcnlefd/popup.html",
        "origin": "chrome-extension://ildkgigifaagohmoehgmhapickcnlefd"
    },
    "id": "current-scene-changed",
    "params": {
        "name": "开发模式",
        "id": "10LNWD41eerhzEbvnoJwL"
    },
    sendResponse: ƒ()
  }
*/
