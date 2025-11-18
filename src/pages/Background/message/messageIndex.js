import { listen } from ".../utils/messageHelper"
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
  createAISetSettingsHandler
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

    createRuleMessage(EM.Rule.handler, ctx)
    createHistoryMessage(EM, ctx)
    createAIMessage(EM, ctx)
  })
}

/*
 * 规则处理相关的 message
 */
const createRuleMessage = (handler, ctx) => {
  // 当前情况模式发生变更
  listen("current-scene-changed", ctx, createCurrentSceneChangedHandler(handler))

  // 规则配置发生变更
  listen("rule-config-changed", ctx, createRuleConfigChangedHandler(handler))

  ctx.sendResponse({ state: "success" })
}

/**
 * 处理历史记录相关的 message
 */
const createHistoryMessage = (EM, ctx) => {
  listen("manual-change-group", ctx, createManualChangeGroupHandler(EM))

  ctx.sendResponse({ state: "success" })
}

/**
 * 处理 AI 相关的 message
 */
const createAIMessage = (EM, ctx) => {
  if (!EM.AI) {
    return
  }

  // Process AI intent
  listen("ai-process-intent", ctx, createAIIntentHandler(EM))

  // Execute AI action plan
  listen("ai-execute-action", ctx, createAIExecuteHandler(EM))

  // Get recent AI intents
  listen("ai-get-intents", ctx, createAIGetIntentsHandler(EM))

  // Update extension knowledge
  listen("ai-update-knowledge", ctx, createAIUpdateKnowledgeHandler(EM))

  // Suggest groups for organizing extensions
  listen("ai-suggest-groups", ctx, createAISuggestGroupsHandler(EM))

  // Apply suggested groups
  listen("ai-apply-groups", ctx, createAIApplyGroupsHandler(EM))

  // Refresh enrichment for extensions
  listen("ai-refresh-enrichment", ctx, createAIRefreshEnrichmentHandler(EM))

  // Get AI settings
  listen("ai-get-settings", ctx, createAIGetSettingsHandler(EM))

  // Set AI settings
  listen("ai-set-settings", ctx, createAISetSettingsHandler(EM))

  ctx.sendResponse({ state: "success" })
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
