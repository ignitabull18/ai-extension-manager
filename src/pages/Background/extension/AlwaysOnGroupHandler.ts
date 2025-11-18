import chromeP from "webext-polyfill-kinda"

import type { IExtensionManager } from ".../types/global"
import { GroupOptions } from ".../storage/sync/GroupOptions"
import { ExecuteTaskHandler, ExecuteTaskPriority } from "../rule/ExecuteTaskHandler"
import logger from ".../utils/logger"

/**
 * Handles always-on group behavior: ensures extensions in always-on groups
 * are enabled on startup and context changes (but can still be disabled by rules)
 */
export class AlwaysOnGroupHandler {
  constructor(private EM: IExtensionManager) {}

  /**
   * Enable all extensions in always-on groups
   * Called on startup and when scene/group changes
   */
  async enableAlwaysOnExtensions() {
    try {
      const groups = await GroupOptions.getGroups()
      const alwaysOnGroups = groups.filter((g) => g.alwaysOn === true)

      if (alwaysOnGroups.length === 0) {
        return
      }

      // Collect all extension IDs from always-on groups
      const extensionIds = new Set<string>()
      for (const group of alwaysOnGroups) {
        if (group.extensions && group.extensions.length > 0) {
          group.extensions.forEach((extId) => extensionIds.add(extId))
        }
      }

      if (extensionIds.size === 0) {
        return
      }

      // Get self extension ID to exclude it
      const self = await chromeP.management.getSelf()

      // Filter out self and already enabled extensions
      const extensionsToEnable: string[] = []
      for (const extId of extensionIds) {
        if (extId === self.id) {
          continue // Skip self
        }

        try {
          const info = await chromeP.management.get(extId)
          if (info && !info.enabled) {
            extensionsToEnable.push(extId)
          }
        } catch (err) {
          // Extension might not exist, skip it
          logger().warn(`[AlwaysOnGroup] Extension ${extId} not found`, err)
        }
      }

      if (extensionsToEnable.length === 0) {
        return
      }

      // Use ExecuteTaskHandler to enable extensions (respects existing priority system)
      const executeTaskHandler = new ExecuteTaskHandler()
      const tabs = await chromeP.tabs.query({})
      const currentTab = tabs.find((t) => t.active) || tabs[0] || null

      executeTaskHandler.open({
        targetExtensions: extensionsToEnable,
        reload: false,
        tabInfo: currentTab,
        ctx: {
          self,
          tabs,
          tab: currentTab,
          EM: this.EM,
          executeTaskHandler,
          matchResult: null
        },
        priority: new ExecuteTaskPriority()
      })

      await executeTaskHandler.execute()

      logger().debug(`[AlwaysOnGroup] Enabled ${extensionsToEnable.length} extensions from always-on groups`)
    } catch (error) {
      logger().error("[AlwaysOnGroup] Failed to enable always-on extensions", error)
    }
  }
}

