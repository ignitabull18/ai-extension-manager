import type { ruleV2 } from ".../types/rule"

/**
 * Inverted index for efficient rule matching
 * Maps domains/URL patterns to rule IDs for O(1) lookup instead of O(n) iteration
 */
export class RuleIndexer {
  private domainIndex: Map<string, Set<string>> = new Map() // domain -> rule IDs
  private sceneIndex: Map<string, Set<string>> = new Map() // scene ID -> rule IDs
  private osIndex: Map<string, Set<string>> = new Map() // OS -> rule IDs
  private allRules: Map<string, ruleV2.IRuleConfig> = new Map() // rule ID -> rule config

  /**
   * Rebuild the index from all rules
   */
  rebuildIndex(rules: ruleV2.IRuleConfig[]): void {
    // Clear existing indices
    this.domainIndex.clear()
    this.sceneIndex.clear()
    this.osIndex.clear()
    this.allRules.clear()

    for (const rule of rules) {
      if (!rule.enable || !rule.id) {
        continue
      }

      this.allRules.set(rule.id, rule)

      // Index by URL patterns (check triggers array)
      if (rule.match?.triggers) {
        for (const trigger of rule.match.triggers) {
          if (trigger.trigger === "urlTrigger" && trigger.config) {
            const urlConfig = trigger.config as ruleV2.IUrlTriggerConfig
            const patterns = urlConfig.matchUrl || []
            for (const pattern of patterns) {
              // Extract domain from pattern (simplified - could be improved)
              const domain = this.extractDomainFromPattern(pattern)
              if (domain) {
                if (!this.domainIndex.has(domain)) {
                  this.domainIndex.set(domain, new Set())
                }
                this.domainIndex.get(domain)!.add(rule.id)
              }
            }
          } else if (trigger.trigger === "sceneTrigger" && trigger.config) {
            const sceneConfig = trigger.config as ruleV2.ISceneTriggerConfig
            // Scene trigger can have either sceneId (single) or sceneIds (array)
            const sceneIds: string[] = []
            if (sceneConfig.sceneId) {
              sceneIds.push(sceneConfig.sceneId)
            }
            if (sceneConfig.sceneIds) {
              sceneIds.push(...sceneConfig.sceneIds)
            }
            for (const sceneId of sceneIds) {
              if (!this.sceneIndex.has(sceneId)) {
                this.sceneIndex.set(sceneId, new Set())
              }
              this.sceneIndex.get(sceneId)!.add(rule.id)
            }
          } else if (trigger.trigger === "osTrigger" && trigger.config) {
            const osConfig = trigger.config as ruleV2.IOsTriggerConfig
            const osTypes = osConfig.os || []
            for (const osType of osTypes) {
              if (!this.osIndex.has(osType)) {
                this.osIndex.set(osType, new Set())
              }
              this.osIndex.get(osType)!.add(rule.id)
            }
          }
        }
      }
    }
  }

  /**
   * Extract domain from URL pattern (wildcard or regex)
   * This is a simplified extraction - for full accuracy, we'd need to parse the pattern
   */
  private extractDomainFromPattern(pattern: string): string | null {
    // Remove wildcards and regex markers
    let domain = pattern
      .replace(/^\*+/, "")
      .replace(/\*+$/, "")
      .replace(/^\/.*\/$/, "") // Remove regex delimiters
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "") // Remove path

    // Extract base domain
    const parts = domain.split(".")
    if (parts.length >= 2) {
      // Return second-level domain (e.g., "example.com" from "*.example.com")
      return parts.slice(-2).join(".")
    }

    return domain || null
  }

  /**
   * Get rules that might match a given URL
   * Returns rule IDs that should be checked
   */
  getRulesForUrl(url: string): string[] {
    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname
      const domain = this.extractDomain(hostname)

      const candidateRuleIds = new Set<string>()

      // Add rules indexed for this domain
      if (domain && this.domainIndex.has(domain)) {
        this.domainIndex.get(domain)!.forEach((ruleId) => candidateRuleIds.add(ruleId))
      }

      // Also check full hostname
      if (this.domainIndex.has(hostname)) {
        this.domainIndex.get(hostname)!.forEach((ruleId) => candidateRuleIds.add(ruleId))
      }

      return Array.from(candidateRuleIds)
    } catch (error) {
      // Invalid URL, return empty array
      return []
    }
  }

  /**
   * Extract domain from hostname
   */
  private extractDomain(hostname: string): string {
    const parts = hostname.split(".")
    if (parts.length >= 2) {
      return parts.slice(-2).join(".")
    }
    return hostname
  }

  /**
   * Get rules for a given scene ID
   */
  getRulesForScene(sceneId: string): string[] {
    if (this.sceneIndex.has(sceneId)) {
      return Array.from(this.sceneIndex.get(sceneId)!)
    }
    return []
  }

  /**
   * Get rules for a given OS
   */
  getRulesForOS(osType: string): string[] {
    if (this.osIndex.has(osType)) {
      return Array.from(this.osIndex.get(osType)!)
    }
    return []
  }

  /**
   * Get rule by ID
   */
  getRule(ruleId: string): ruleV2.IRuleConfig | undefined {
    return this.allRules.get(ruleId)
  }

  /**
   * Get all rules (fallback when index doesn't help)
   */
  getAllRules(): ruleV2.IRuleConfig[] {
    return Array.from(this.allRules.values())
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.domainIndex.clear()
    this.sceneIndex.clear()
    this.osIndex.clear()
    this.allRules.clear()
  }
}

