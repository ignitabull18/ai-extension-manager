import storage from ".../storage/sync"
import { downloadFile, formatDate } from ".../utils/utils"
import ConvertRuleToV2 from "../../Background/rule/RuleConverter"
import { DomainRuleOptions } from ".../storage/sync/DomainRuleOptions"

/**
 * Config export schema version
 */
const CONFIG_VERSION = "1.0.0"

/**
 * Extension info included in config export
 */
export interface IExtensionInfo {
  id: string
  name: string
  description?: string
  version?: string
  enabled?: boolean
  homepageUrl?: string
  webStoreUrl?: string
}

/**
 * Extension Manager config bundle schema
 */
export interface IConfigBundle {
  version: string
  exportDate: string
  extensionVersion?: string
  setting?: config.ISetting
  groups?: config.IGroup[]
  scenes?: config.IScene[]
  ruleConfig?: ruleV2.IRuleConfig[]
  domainRules?: ruleV2.IRuleConfig[]
  management?: config.IManagement
  extensions?: IExtensionInfo[]
}

/**
 * Export configuration including all sync data and extension list
 */
export async function exportConfig() {
  const config = await storage.options.getAll()
  const domainRules = await storage.domainRule.get()

  // Get all installed extensions
  const allExtensions = await chrome.management.getAll()
  const extensionList: IExtensionInfo[] = allExtensions
    .filter((ext) => ext.type === "extension" && !ext.id.startsWith("chrome://") && !ext.id.startsWith("edge://"))
    .map((ext) => ({
      id: ext.id,
      name: ext.name,
      description: ext.description,
      version: ext.version,
      enabled: ext.enabled,
      homepageUrl: ext.homepageUrl,
      webStoreUrl: ext.webStoreUrl
    }))

  const data: IConfigBundle = {
    version: CONFIG_VERSION,
    exportDate: new Date().toISOString(),
    extensionVersion: chrome.runtime.getManifest().version,
    setting: config.setting,
    groups: config.groups,
    scenes: config.scenes,
    ruleConfig: config.ruleConfig.filter((r) => r.source !== "domainAuto"), // Exclude domain rules (they're separate)
    domainRules: domainRules, // Include domain rules separately
    management: config.management,
    extensions: extensionList // Include all installed extensions
  }
  exportToJsonFile(data, `ext_manager_config_${formatDate(new Date())}.json`)
}

/**
 * Preview import without applying changes
 */
export async function previewImport(): Promise<IImportPreview | null> {
  try {
    const data = await importFromJsonFile()
    if (!validateConfig(data)) {
      return null
    }

    const config = await storage.options.getAll()
    const currentDomainRules = await storage.domainRule.get()

    // Collect all extension IDs referenced in config
    const referencedExtIds = new Set<string>()
    data.groups?.forEach((g) => g.extensions?.forEach((id) => referencedExtIds.add(id)))
    data.ruleConfig?.forEach((r) => r.target?.extensions?.forEach((id) => referencedExtIds.add(id)))
    data.domainRules?.forEach((r) => r.target?.extensions?.forEach((id) => referencedExtIds.add(id)))

    // Check which referenced extensions are missing from exported list
    const exportedExtIds = new Set(data.extensions?.map((e) => e.id) || [])
    const missingExtensions = Array.from(referencedExtIds).filter((id) => !exportedExtIds.has(id))

    // Also check against currently installed extensions
    const currentExtensions = await chrome.management.getAll()
    const currentExtIds = new Set(currentExtensions.map((e) => e.id))
    const actuallyMissing = missingExtensions.filter((id) => !currentExtIds.has(id))

    const preview: IImportPreview = {
      settings: !!data.setting,
      groupsCount: data.groups?.length || 0,
      scenesCount: data.scenes?.length || 0,
      rulesCount: data.ruleConfig?.length || 0,
      domainRulesCount: data.domainRules?.length || 0,
      managementExtensionsCount: data.management?.extensions?.length || 0,
      extensionsCount: data.extensions?.length || 0,
      missingExtensions: actuallyMissing,
      willOverwrite: {
        groups: data.groups?.filter((g) => config.groups.findIndex((g2) => g2.id === g.id) >= 0).length || 0,
        scenes: data.scenes?.filter((s) => config.scenes.findIndex((s2) => s2.id === s.id) >= 0).length || 0,
        rules: data.ruleConfig?.filter((r) => config.ruleConfig.findIndex((r2) => r2.id === r.id) >= 0).length || 0,
        domainRules: data.domainRules?.filter((r) => currentDomainRules.findIndex((r2) => r2.id === r.id) >= 0).length || 0
      },
      version: data.version || "unknown",
      extensionVersion: data.extensionVersion
    }

    return preview
  } catch (error) {
    console.error("Preview import error", error)
    return null
  }
}

/**
 * Import configuration with validation
 */
export async function importConfig(overwrite: boolean = false): Promise<boolean> {
  try {
    const data = await importFromJsonFile()
    if (!validateConfig(data)) {
      return false
    }

    const config = await storage.options.getAll()
    const currentDomainRules = await storage.domainRule.get()

    if (mergeConfig(data as ImportData, config as any as ImportData, overwrite)) {
      await storage.options.setAll(config)

      // Handle domain rules separately
      if (data.domainRules && data.domainRules.length > 0) {
        if (overwrite) {
          // Clear existing domain rules and import new ones
          for (const rule of currentDomainRules) {
            await storage.domainRule.deleteOne(rule.id!)
          }
        }
        for (const rule of data.domainRules) {
          // Check if rule already exists (if not overwriting)
          if (!overwrite && currentDomainRules.findIndex((r) => r.id === rule.id) >= 0) {
            continue // Skip existing rules
          }
          await storage.domainRule.addOne(rule)
        }
      }

      return true
    }
    return false
  } catch (error) {
    console.error("Import config error", error)
    return false
  }
}

/**
 * Validate imported config structure
 */
function validateConfig(data: any): data is IConfigBundle {
  if (!data || typeof data !== "object") {
    return false
  }

  // Check for required fields (at least one data section)
  const hasData =
    data.setting ||
    (data.groups && Array.isArray(data.groups)) ||
    (data.scenes && Array.isArray(data.scenes)) ||
    (data.ruleConfig && Array.isArray(data.ruleConfig)) ||
    (data.domainRules && Array.isArray(data.domainRules)) ||
    (data.management && typeof data.management === "object") ||
    (data.extensions && Array.isArray(data.extensions))

  if (!hasData) {
    return false
  }

  // Validate structure
  if (data.groups && !Array.isArray(data.groups)) return false
  if (data.scenes && !Array.isArray(data.scenes)) return false
  if (data.ruleConfig && !Array.isArray(data.ruleConfig)) return false
  if (data.domainRules && !Array.isArray(data.domainRules)) return false
  if (data.extensions && !Array.isArray(data.extensions)) return false

  return true
}

type ImportData = IConfigBundle

/**
 * Preview of what will be imported
 */
export interface IImportPreview {
  settings: boolean
  groupsCount: number
  scenesCount: number
  rulesCount: number
  domainRulesCount: number
  managementExtensionsCount: number
  extensionsCount: number
  missingExtensions: string[] // Extension IDs referenced but not in exported list
  willOverwrite: {
    groups: number
    scenes: number
    rules: number
    domainRules: number
  }
  version: string
  extensionVersion?: string
}

function mergeConfig(importData: ImportData, config: ImportData, overwrite: boolean = false): boolean {
  if (!importData || !config) {
    return false
  }

  // Merge settings (always merge, not replace)
  if (importData.setting) {
    const setting = { ...config.setting, ...importData.setting }
    config.setting = setting
  }

  // Merge groups
  if (importData.groups) {
    if (overwrite) {
      // Replace existing groups with same ID, add new ones
      const existingIds = new Set(config.groups.map((g) => g.id))
      const newGroups = importData.groups.filter((g) => !existingIds.has(g.id))
      const updatedGroups = config.groups.map((g) => {
        const imported = importData.groups!.find((ig) => ig.id === g.id)
        return imported || g
      })
      config.groups = [...updatedGroups, ...newGroups]
    } else {
      // Only add groups that don't exist
      const newGroups = importData.groups.filter(
        (g) => config.groups.findIndex((g2) => g2.id === g.id) < 0
      )
      config.groups.push(...newGroups)
    }
  }

  // Merge scenes
  if (importData.scenes) {
    if (overwrite) {
      const existingIds = new Set(config.scenes.map((s) => s.id))
      const newScenes = importData.scenes.filter((s) => !existingIds.has(s.id))
      const updatedScenes = config.scenes.map((s) => {
        const imported = importData.scenes!.find((is) => is.id === s.id)
        return imported || s
      })
      config.scenes = [...updatedScenes, ...newScenes]
    } else {
      const newScenes = importData.scenes.filter(
        (s) => config.scenes.findIndex((s2) => s2.id === s.id) < 0
      )
      config.scenes.push(...newScenes)
    }
  }

  // Merge rules (excluding domain rules - they're handled separately)
  if (importData.ruleConfig) {
    if (overwrite) {
      const existingIds = new Set(config.ruleConfig.map((r) => r.id))
      const newRules = importData.ruleConfig.filter((r) => !existingIds.has(r.id))
      const updatedRules = config.ruleConfig.map((r) => {
        const imported = importData.ruleConfig!.find((ir) => ir.id === r.id)
        return imported || r
      })
      const configV2 = newRules.map((c) => ConvertRuleToV2(c as any)).filter((c) => c)
      config.ruleConfig = [...updatedRules, ...(configV2 as any)]
    } else {
      const newConfigs = importData.ruleConfig.filter(
        (r) => config.ruleConfig.findIndex((r2) => r2.id === r.id) < 0
      )
      const configV2 = newConfigs.map((c) => ConvertRuleToV2(c as any)).filter((c) => c)
      config.ruleConfig.push(...(configV2 as any))
    }
  }

  // Merge management (extensions metadata)
  if (importData.management) {
    let extensionAttachInfos: config.IExtensionAttachInfo[] = []
    if (importData.management.extensions) {
      if (overwrite) {
        // Replace existing, add new
        const existingIds = new Set(config.management.extensions.map((e) => e.extId))
        const newExtensions = importData.management.extensions.filter((e) => !existingIds.has(e.extId))
        const updatedExtensions = config.management.extensions.map((e) => {
          const imported = importData.management.extensions!.find((ie) => ie.extId === e.extId)
          return imported || e
        })
        extensionAttachInfos = [...updatedExtensions, ...newExtensions]
      } else {
        // Merge: keep existing, add new
        const remain = config.management.extensions.filter(
          (e) => importData.management.extensions.findIndex((e2) => e2.extId === e.extId) < 0
        )
        extensionAttachInfos = [...remain, ...importData.management.extensions]
      }
    }
    config.management.extensions = extensionAttachInfos
  }

  return true
}

async function importFromJsonFile() {
  const inputElement = document.createElement("input")
  inputElement.setAttribute("type", "file")
  inputElement.setAttribute("accept", ".json")
  inputElement.click()

  return await new Promise((resolve, reject) => {
    inputElement.onchange = (event: any) => {
      const selectedFile = event.target?.files[0]
      if (selectedFile) {
        readJsonFile(selectedFile).then((data) => {
          resolve(data)
        })
      }
    }
  })
}

async function readJsonFile(file: Blob) {
  const reader = new FileReader()

  const waiter = new Promise((resolve, reject) => {
    reader.onload = function (event: any) {
      const jsonText = event.target.result
      const jsonData = JSON.parse(jsonText)
      resolve(jsonData)
    }
  })

  reader.readAsText(file)
  return await waiter
}

function exportToJsonFile(data: any, filename: string) {
  const jsonStr = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonStr], { type: "application/json" })

  downloadFile(blob, filename)
}
