import { LocalOptions } from ".../storage/local"
import logger from ".../utils/logger"
import { EventCache } from "./event/EventCache"
import createExtension from "./extension"
import createHistory from "./history"
import createMessageHandler from "./message/messageIndex.js"
import createRule from "./rule"
import createAI from "./ai"
import { getSyncStorageCache } from ".../storage/sync/SyncStorageCache"
import storage from ".../storage/sync"

console.log(`[Extension Manager] Background Run. ${new Date().toLocaleString()}`)

// 日志初始化
logger().init()

// ExtensionManager 全局对象
const EM = {}

EM.EventCache = new EventCache()

// 因为此事件的时机非常早，需要提前订阅，如果没有在初始化的主流程中执行，而在放在了微任务或者宏任务队列中，可能无法被执行
// Fired when the extension is first installed, when the extension is updated to a new version, and when Chrome is updated to a new version.
chrome.runtime.onInstalled.addListener((info) => {
  EM.EventCache.add("onInstalled", info)
})

// initial running
;(async () => {
  const local = new LocalOptions()
  await local.migrate()
  EM.LocalOptions = local

  // Initialize sync storage cache for background script
  const storageCache = getSyncStorageCache(EM)
  await storageCache.initialize()

  EM.Rule = await createRule(EM)

  EM.Extension = await createExtension(EM)

  EM.History = await createHistory(EM)

  // Initialize AI assistant (non-blocking)
  try {
    EM.AI = await createAI(EM)
  } catch (error) {
    logger().warn("[AI] Failed to initialize AI assistant", error)
    EM.AI = null
  }

  createMessageHandler(EM)

  // Set up keyboard shortcuts for scene switching
  setupKeyboardShortcuts(EM)
})()

/**
 * Set up keyboard shortcuts for scene switching
 */
async function setupKeyboardShortcuts(EM) {
  chrome.commands.onCommand.addListener(async (command) => {
    if (command === "toggle-scene-next" || command === "toggle-scene-prev") {
      try {
        const { storage } = await import(".../storage/sync")
        const options = await storage.options.getAll()
        const scenes = options.scenes || []
        
        if (scenes.length === 0) {
          logger().debug("[Keyboard] No scenes available")
          return
        }

        const currentSceneId = await EM.LocalOptions.getActiveSceneId()
        const currentIndex = scenes.findIndex((s) => s.id === currentSceneId)
        
        let nextIndex
        if (command === "toggle-scene-next") {
          // Cycle to next scene, or first if at end
          nextIndex = currentIndex >= 0 && currentIndex < scenes.length - 1 ? currentIndex + 1 : 0
        } else {
          // Cycle to previous scene, or last if at beginning
          nextIndex = currentIndex > 0 ? currentIndex - 1 : scenes.length - 1
        }

        const nextScene = scenes[nextIndex]
        
        if (nextScene) {
          await storage.scene.setActive(nextScene.id)
          
          // Trigger scene change handler
          if (EM?.Rule?.handler) {
            EM.Rule.handler.onCurrentSceneChanged(nextScene)
          }
          
          // Enable always-on extensions
          if (EM?.Extension?.alwaysOnHandler) {
            EM.Extension.alwaysOnHandler.enableAlwaysOnExtensions().catch((err) => {
              logger().warn("[Keyboard] Failed to enable always-on extensions", err)
            })
          }
          
          logger().debug(`[Keyboard] Switched to scene: ${nextScene.name}`)
        }
      } catch (error) {
        logger().error("[Keyboard] Error switching scene", error)
      }
    }
  })
}
