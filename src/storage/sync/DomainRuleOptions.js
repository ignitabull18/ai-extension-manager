import { nanoid } from "nanoid"

import { SyncOptionsStorage } from "./options-storage"
import { RuleConfigOptions } from "./RuleConfigOptions"

/**
 * Helper functions for managing domain-based auto-enable rules
 * These rules are stored as ruleV2.IRuleConfig with source="domainAuto"
 */
export const DomainRuleOptions = {
  /**
   * Get all domain auto-enable rules
   */
  async get() {
    const allRules = await RuleConfigOptions.get()
    return allRules.filter((r) => r.source === "domainAuto")
  },

  /**
   * Add a new domain rule
   * @param {ruleV2.IRuleConfig} rule - Rule config (will be marked as domainAuto)
   */
  async addOne(rule) {
    if (!rule.id) {
      rule.id = nanoid()
    }
    rule.source = "domainAuto"
    rule.version = 2
    // Set priority based on overrideMode
    if (rule.overrideMode === "override") {
      rule.priority = 10
    } else {
      rule.priority = 0
    }
    await RuleConfigOptions.addOne(rule)
  },

  /**
   * Update an existing domain rule
   * @param {ruleV2.IRuleConfig} rule - Updated rule config
   */
  async update(rule) {
    rule.source = "domainAuto"
    // Update priority based on overrideMode
    if (rule.overrideMode === "override") {
      rule.priority = 10
    } else {
      rule.priority = 0
    }
    await RuleConfigOptions.update(rule)
  },

  /**
   * Delete a domain rule
   * @param {string} id - Rule ID
   */
  async deleteOne(id) {
    await RuleConfigOptions.deleteOne(id)
  }
}

export default DomainRuleOptions

