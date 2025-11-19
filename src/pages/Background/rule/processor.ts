import type { IExtensionManager } from ".../types/global"
import logger from ".../utils/logger"
import { ExecuteTaskHandler, ExecuteTaskPriority } from "./ExecuteTaskHandler"
import isMatch, { IMatchResult } from "./handlers/matchHandler"
import getTarget from "./handlers/targetHandler"

/**
 * 根据当前情景模式，标签页信息，规则信息，处理扩展的打开或关闭
 */

export type ProcessContext = {
  /**
   * 自身插件的信息
   */
  self: chrome.management.ExtensionInfo
  /**
   * 当前激活的 tab
   */
  tab: chrome.tabs.Tab | null
  /**
   * 当前浏览器打开的全部 tab
   */
  tabs: chrome.tabs.Tab[]

  /**
   * 当前正在执行的规则
   */
  rule?: ruleV2.IRuleConfig

  /**
   * 全局对象
   */
  EM?: IExtensionManager
}

type ProcessItem = {
  /**
   * 当前场景
   */
  scene: config.IScene | undefined
  /**
   * 用户配置的分组数据
   */
  groups: config.IGroup[] | undefined
  /**
   * 所有规则
   */
  rules: ruleV2.IRuleConfig[] | undefined
  /**
   * 执行上下文
   */
  ctx: ProcessContext
}

export type RunningProcessContext = ProcessContext & {
  /**
   * 最终的执行 Handler
   */
  executeTaskHandler: ExecuteTaskHandler

  /**
   * 匹配结果
   */
  matchResult: IMatchResult | null
}

async function processRule({ scene, rules, groups, ctx }: ProcessItem) {
  if (!rules) {
    return
  }

  // Use indexer if available to filter rules by URL/scene/OS
  // This optimization reduces the number of rules we need to check
  let rulesToProcess: ruleV2.IRuleConfig[] = rules

  // Only use indexer if we have many rules (optimization threshold)
  // For small rule sets, the overhead of indexing isn't worth it
  if (rules.length > 10 && ctx.EM?.Rule?.handler?.indexer) {
    const indexer = ctx.EM.Rule.handler.indexer
    const candidateRuleIds = new Set<string>()

    // Get rules matching current URL
    if (ctx.tab?.url) {
      const urlRules = indexer.getRulesForUrl(ctx.tab.url)
      urlRules.forEach((id) => candidateRuleIds.add(id))
    }

    // Get rules matching current scene
    if (scene?.id) {
      const sceneRules = indexer.getRulesForScene(scene.id)
      sceneRules.forEach((id) => candidateRuleIds.add(id))
    }

    // Get rules matching current OS
    try {
      const platform = chrome.runtime.getPlatformInfo ? await chrome.runtime.getPlatformInfo() : null
      if (platform?.os) {
        const osRules = indexer.getRulesForOS(platform.os)
        osRules.forEach((id) => candidateRuleIds.add(id))
      }
    } catch (error) {
      // Platform info not available, skip OS indexing
    }

    // If we have candidate rules from index, use them; otherwise fall back to all rules
    // This ensures we don't miss rules that might match via other triggers (e.g., period triggers)
    if (candidateRuleIds.size > 0 && candidateRuleIds.size < rules.length) {
      // Only use indexed rules if we've filtered down the set significantly
      const indexedRules = Array.from(candidateRuleIds)
        .map((id) => indexer.getRule(id))
        .filter((r): r is ruleV2.IRuleConfig => r !== undefined)
      
      // Merge with rules that don't have URL/scene/OS triggers (they won't be in index)
      // This ensures we don't miss period-only rules or rules with no triggers
      const nonIndexedRules = rules.filter((r) => {
        const hasUrlTrigger = r.match?.triggers?.some((t) => t.trigger === "urlTrigger")
        const hasSceneTrigger = r.match?.triggers?.some((t) => t.trigger === "sceneTrigger")
        const hasOsTrigger = r.match?.triggers?.some((t) => t.trigger === "osTrigger")
        return !hasUrlTrigger && !hasSceneTrigger && !hasOsTrigger
      })
      
      rulesToProcess = [...indexedRules, ...nonIndexedRules]
    }
    // If no indexed matches or index didn't help, fall back to all rules
  }

  // Sort rules by priority (higher priority = executed later, wins conflicts)
  // Rules without priority default to 0
  const sortedRules = [...rulesToProcess].sort((a, b) => {
    const priorityA = a.priority ?? 0
    const priorityB = b.priority ?? 0
    return priorityA - priorityB
  })

  // 每一轮规则的执行，使用同一个 handler 实例
  let executeTaskHandler = new ExecuteTaskHandler()

  for (const rule of sortedRules) {
    try {
      // 每条规则处理的 rule 数据是不用的，这里需要对 ctx 拷贝一个副本，每个实例都是不同的 rule 数据
      const copyCtx = { ...ctx, rule, executeTaskHandler, matchResult: null }
      await process(rule, scene, groups, copyCtx)
    } catch (error) {
      console.error("[规则预执行失败]", rules, error)
    }
  }

  try {
    await executeTaskHandler.execute()
  } catch (error) {
    console.error("[规则执行失败]", rules, error)
  }
}

async function process(
  rule: ruleV2.IRuleConfig,
  scene: config.IScene | undefined,
  groups: config.IGroup[] | undefined,
  ctx: RunningProcessContext
) {
  // 规则没有生效
  if (!rule.enable) {
    return
  }

  ctx.matchResult = await isMatch(scene, rule, ctx)

  const targetIdArray = getTarget(groups, rule)
  if (!targetIdArray || targetIdArray.length === 0) {
    return
  }
  // 执行目标中，过滤掉自己
  const targetExtensionIds = targetIdArray.filter((id) => id !== ctx.self.id)

  handle(targetExtensionIds, rule, ctx)
}

function handle(
  targetExtensions: string[],
  config: ruleV2.IRuleConfig,
  ctx: RunningProcessContext
) {
  const matchResult = ctx.matchResult
  if (!matchResult) {
    return
  }
  const action = config.action
  if (!action) {
    return
  }

  if (action.actionType === "none") {
    return
  }

  logger().debug(
    `[Rule] handle start. match, target, config`,
    matchResult,
    targetExtensions,
    config
  )

  if (action.actionType === "custom") {
    handleAdvanceMode(matchResult, targetExtensions, action, ctx)
  } else {
    handleSimpleMode(matchResult, targetExtensions, action, ctx)
  }
}

/**
 * 简单模式下的动作执行
 */
function handleSimpleMode(
  matchResult: IMatchResult,
  targetExtensions: string[],
  action: ruleV2.IAction,
  ctx: RunningProcessContext
) {
  const actionType = action.actionType
  const isMatch = matchResult.isCurrentMatch

  const baseInfo = {
    targetExtensions: targetExtensions,
    tabInfo: ctx.tab,
    ctx: ctx
  }

  // Set priority based on rule priority (domain rules with override mode have higher priority)
  const taskPriority = new ExecuteTaskPriority()
  if (ctx.rule?.priority !== undefined) {
    taskPriority.setPriority(ctx.rule.priority)
  }

  if (isMatch && actionType === "closeWhenMatched") {
    ctx.executeTaskHandler.close({
      ...baseInfo,
      reload: action.reloadAfterDisable,
      priority: taskPriority
    })
  }

  if (isMatch && actionType === "openWhenMatched") {
    ctx.executeTaskHandler.open({
      ...baseInfo,
      reload: action.reloadAfterEnable,
      priority: taskPriority
    })
  }

  if (actionType === "closeOnlyWhenMatched") {
    if (isMatch) {
      ctx.executeTaskHandler.close({
        ...baseInfo,
        reload: action.reloadAfterDisable,
        priority: taskPriority
      })
    } else {
      let priority = new ExecuteTaskPriority()
      if (ctx.rule?.priority !== undefined) {
        priority.setPriority(ctx.rule.priority)
      }
      priority.setNotMatch()
      ctx.executeTaskHandler.open({
        ...baseInfo,
        reload: action.reloadAfterEnable,
        priority: priority
      })
    }
  }

  if (actionType === "openOnlyWhenMatched") {
    if (isMatch) {
      ctx.executeTaskHandler.open({
        ...baseInfo,
        reload: action.reloadAfterEnable,
        priority: taskPriority
      })
    } else {
      let priority = new ExecuteTaskPriority()
      if (ctx.rule?.priority !== undefined) {
        priority.setPriority(ctx.rule.priority)
      }
      priority.setNotMatch()
      ctx.executeTaskHandler.close({
        ...baseInfo,
        reload: action.reloadAfterDisable,
        priority: priority
      })
    }
  }
}

/**
 * 高级模式下的动作执行
 */
async function handleAdvanceMode(
  matchResult: IMatchResult,
  targetExtensions: string[],
  action: ruleV2.IAction,
  ctx: RunningProcessContext
) {
  if (!action.custom) {
    return
  }
  const customRule = action.custom

  const baseInfo = {
    targetExtensions: targetExtensions,
    tabInfo: ctx.tab,
    ctx: ctx
  }

  const open = (
    reload: boolean | undefined,
    priority: ExecuteTaskPriority = new ExecuteTaskPriority()
  ) => {
    ctx.executeTaskHandler.open({
      ...baseInfo,
      reload: reload,
      priority: priority
    })
  }

  const close = (
    reload: boolean | undefined,
    priority: ExecuteTaskPriority = new ExecuteTaskPriority()
  ) => {
    ctx.executeTaskHandler.close({
      ...baseInfo,
      reload: reload,
      priority: priority
    })
  }

  // 开启插件的判断
  if (
    customRule.timeWhenEnable === "match" &&
    customRule.urlMatchWhenEnable === "currentMatch" &&
    matchResult.isCurrentMatch
  ) {
    open(action.reloadAfterEnable)
  }

  if (
    customRule.timeWhenEnable === "match" &&
    customRule.urlMatchWhenEnable === "anyMatch" &&
    matchResult.isAnyMatch
  ) {
    open(matchResult.isCurrentMatch && action.reloadAfterEnable)
  }

  if (
    customRule.timeWhenEnable === "notMatch" &&
    customRule.urlMatchWhenEnable === "currentNotMatch" &&
    !matchResult.isCurrentMatch
  ) {
    let priority = new ExecuteTaskPriority()
    priority.setNotMatch()
    open(action.reloadAfterEnable, priority)
  }

  if (
    customRule.timeWhenEnable === "notMatch" &&
    customRule.urlMatchWhenEnable === "allNotMatch" &&
    !matchResult.isAnyMatch
  ) {
    let priority = new ExecuteTaskPriority()
    priority.setNotMatch()
    open(action.reloadAfterEnable, priority)
  }

  // 禁用插件的判断

  if (
    customRule.timeWhenDisable === "match" &&
    customRule.urlMatchWhenDisable === "currentMatch" &&
    matchResult.isCurrentMatch
  ) {
    close(action.reloadAfterDisable)
  }

  if (
    customRule.timeWhenDisable === "match" &&
    customRule.urlMatchWhenDisable === "anyMatch" &&
    matchResult.isAnyMatch
  ) {
    close(matchResult.isCurrentMatch && action.reloadAfterDisable)
  }

  if (
    customRule.timeWhenDisable === "notMatch" &&
    customRule.urlMatchWhenDisable === "currentNotMatch" &&
    !matchResult.isCurrentMatch
  ) {
    let priority = new ExecuteTaskPriority()
    priority.setNotMatch()
    close(action.reloadAfterDisable, priority)
  }

  if (
    customRule.timeWhenDisable === "notMatch" &&
    customRule.urlMatchWhenDisable === "allNotMatch" &&
    !matchResult.isAnyMatch
  ) {
    let priority = new ExecuteTaskPriority()
    priority.setNotMatch()
    close(action.reloadAfterDisable, priority)
  }

  if (customRule.timeWhenDisable === "closeWindow") {
    // 暂未实现
  }
}

export default processRule
