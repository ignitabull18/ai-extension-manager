import type { IExtensionManager } from ".../types/global"
import { SyncOptionsStorage } from "./options-storage"

/**
 * In-memory cache for sync storage in the background script
 * Listens to chrome.storage.onChanged to keep cache updated
 */
export class SyncStorageCache {
  private cache: any = null
  private cacheTimestamp: number = 0
  private readonly CACHE_TTL = 1000 // 1 second TTL as fallback
  private isInitialized = false
  private EM: IExtensionManager | null = null

  constructor(EM?: IExtensionManager) {
    this.EM = EM || null
  }

  /**
   * Check if cache is initialized
   */
  get initialized(): boolean {
    return this.isInitialized
  }

  /**
   * Initialize the cache and set up storage change listener
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    // Load initial cache
    await this.refreshCache()

    // Listen to storage changes to invalidate cache
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "sync") {
        // Invalidate cache when sync storage changes
        this.cache = null
        this.cacheTimestamp = 0
      }
    })

    this.isInitialized = true
  }

  /**
   * Refresh the cache from storage
   */
  private async refreshCache(): Promise<void> {
    this.cache = await SyncOptionsStorage.getAll()
    this.cacheTimestamp = Date.now()
  }

  /**
   * Get all options, using cache if available
   */
  async getAll(): Promise<any> {
    const now = Date.now()

    // If cache is stale or missing, refresh it
    if (
      !this.cache ||
      this.cacheTimestamp === 0 ||
      now - this.cacheTimestamp > this.CACHE_TTL
    ) {
      await this.refreshCache()
    }

    // Return a deep copy to prevent mutations
    return JSON.parse(JSON.stringify(this.cache))
  }

  /**
   * Invalidate the cache (useful for testing or manual invalidation)
   */
  invalidate(): void {
    this.cache = null
    this.cacheTimestamp = 0
  }
}

// Singleton instance for background script
let cacheInstance: SyncStorageCache | null = null

/**
 * Get or create the singleton cache instance
 */
export function getSyncStorageCache(EM?: IExtensionManager): SyncStorageCache {
  if (!cacheInstance) {
    cacheInstance = new SyncStorageCache(EM)
  }
  return cacheInstance
}

