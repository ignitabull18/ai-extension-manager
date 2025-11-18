import logger from ".../utils/logger"

/**
 * External Knowledge Client
 * Fetches extension metadata from external APIs or databases
 */
export class ExternalKnowledgeClient {
  private baseUrl?: string
  private enabled: boolean = false

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl
    this.enabled = !!baseUrl
  }

  /**
   * Set the base URL for external metadata API
   */
  public setBaseUrl(url: string | undefined) {
    this.baseUrl = url
    this.enabled = !!url
  }

  /**
   * Check if external metadata is enabled
   */
  public isEnabled(): boolean {
    return this.enabled && !!this.baseUrl
  }

  /**
   * Fetch extension metadata from external API
   */
  public async fetchExtensionMetadata(extId: string): Promise<{
    description?: string
    categories?: string[]
    useCases?: string[]
    popularity?: number
  } | null> {
    if (!this.isEnabled() || !this.baseUrl) {
      return null
    }

    try {
      const url = `${this.baseUrl}/extensions/${extId}`
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      })

      if (!response.ok) {
        if (response.status === 404) {
          // Extension not found in external DB - this is fine
          return null
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      return {
        description: data.description,
        categories: data.categories,
        useCases: data.useCases,
        popularity: data.popularity
      }
    } catch (error) {
      logger().warn(`[AI] Failed to fetch external metadata for ${extId}`, error)
      return null
    }
  }

  /**
   * Batch fetch metadata for multiple extensions
   */
  public async fetchBatchMetadata(extIds: string[]): Promise<Map<string, {
    description?: string
    categories?: string[]
    useCases?: string[]
    popularity?: number
  }>> {
    const results = new Map()

    if (!this.isEnabled() || !this.baseUrl) {
      return results
    }

    // Fetch in parallel with rate limiting (max 5 concurrent)
    const BATCH_SIZE = 5
    for (let i = 0; i < extIds.length; i += BATCH_SIZE) {
      const batch = extIds.slice(i, i + BATCH_SIZE)
      const promises = batch.map(async (extId) => {
        const metadata = await this.fetchExtensionMetadata(extId)
        if (metadata) {
          results.set(extId, metadata)
        }
      })
      await Promise.all(promises)
    }

    return results
  }
}

