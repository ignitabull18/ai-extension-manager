import chromeP from "webext-polyfill-kinda"

import type { IExtensionManager } from ".../types/global"
import logger from ".../utils/logger"
import { GroupOptions } from ".../storage/sync/GroupOptions"

/**
 * Handler for mutual exclusion groups
 * Ensures only one extension in a mutex group can be enabled at a time
 */
export class MutexGroupHandler {
  constructor(private EM: IExtensionManager) {
    this.setupListeners()
  }

  /**
   * Set up listeners for extension enable events
   */
  private setupListeners(): void {
    chromeP.management.onEnabled.addListener((info: chrome.management.ExtensionInfo) => {
      this.handleExtensionEnabled(info.id).catch((err) => {
        logger().warn("[MutexGroup] Failed to handle extension enabled", err)
      })
    })
  }

  /**
   * Handle when an extension is enabled
   * If it belongs to a mutex group, disable other extensions in that group
   */
  private async handleExtensionEnabled(enabledExtensionId: string): Promise<void> {
    try {
      // Get self extension ID to exclude it
      const self = await chromeP.management.getSelf()
      if (enabledExtensionId === self.id) {
        return // Don't process self
      }

      // Get all groups
      const groups = await GroupOptions.getGroups()
      const mutexGroups = groups.filter((g) => g.isMutex === true)

      if (mutexGroups.length === 0) {
        return
      }

      // Find which mutex group(s) contain this extension
      for (const group of mutexGroups) {
        if (!group.extensions || group.extensions.length === 0) {
          continue
        }

        if (group.extensions.includes(enabledExtensionId)) {
          // This extension belongs to a mutex group
          // Disable all other extensions in this group
          const otherExtensions = group.extensions.filter((id) => id !== enabledExtensionId && id !== self.id)

          for (const extId of otherExtensions) {
            try {
              const info = await chromeP.management.get(extId)
              if (info && info.enabled) {
                logger().debug(`[MutexGroup] Disabling ${info.name} (${extId}) because ${enabledExtensionId} was enabled`)
                await chromeP.management.setEnabled(extId, false)
              }
            } catch (err) {
              // Extension might not exist, skip it
              logger().warn(`[MutexGroup] Extension ${extId} not found`, err)
            }
          }
        }
      }
    } catch (error) {
      logger().error("[MutexGroup] Error handling extension enabled", error)
    }
  }
}

