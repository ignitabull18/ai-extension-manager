import chromeP from "webext-polyfill-kinda"

import { IExtensionManager } from ".../types/global"
import { ExtensionRecord } from "./ExtensionRecord"
import { ExtensionRepo } from "./ExtensionRepo"

export class ExtensionService {
  private cachedExtensions: chrome.management.ExtensionInfo[] | null = null
  private cacheTimestamp: number = 0
  private readonly CACHE_TTL = 5000 // 5 seconds cache

  constructor(private EM: IExtensionManager, private repo: ExtensionRepo) {
    // Invalidate cache when extensions are enabled/disabled
    chromeP.management.onEnabled.addListener(() => {
      this.invalidateCache()
    })
    chromeP.management.onDisabled.addListener(() => {
      this.invalidateCache()
    })
    chromeP.management.onInstalled.addListener(() => {
      this.invalidateCache()
    })
    chromeP.management.onUninstalled.addListener(() => {
      this.invalidateCache()
    })
  }

  private invalidateCache() {
    this.cachedExtensions = null
    this.cacheTimestamp = 0
  }

  /**
   * Get all extensions with caching
   */
  public async getAllExtensions(): Promise<chrome.management.ExtensionInfo[]> {
    const now = Date.now()
    if (
      this.cachedExtensions &&
      this.cacheTimestamp > 0 &&
      now - this.cacheTimestamp < this.CACHE_TTL
    ) {
      return this.cachedExtensions
    }

    const extensions = await chromeP.management.getAll()
    this.cachedExtensions = extensions
    this.cacheTimestamp = now
    return extensions
  }

  /**
   * 初始化本地缓存的 Extension 信息
   */
  public async initial() {
    const lastTime = await this.EM.LocalOptions.getLastInitialTime()
    if (Date.now() - lastTime < 1000 * 60 * 60 * 24) {
      // 24 小时只批量初始化一次，其它的，靠主动更新
      return
    }
    await this.EM.LocalOptions.setLastInitialTime(Date.now())
    const list = await this.getAllExtensions()
    const now = Date.now()
    for (const item of list) {
      // const iconDataUrl = await getIconDataUrl(item)
      // 无法在 background 下获取 icon 数据
      // 初始状态就是 install，表示已经安装了
      const ext = { ...item, icon: "", state: "install", recordUpdateTime: now } as ExtensionRecord
      this.repo.set(ext)
    }
  }

  public async getExtension(id: string): Promise<ExtensionRecord | null> {
    return this.repo.get(id)
  }

  public async setExtension(extension: ExtensionRecord): Promise<void> {
    await this.repo.set(extension)
  }
}
