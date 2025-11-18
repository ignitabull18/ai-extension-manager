import chromeP from "webext-polyfill-kinda"

import { ExtensionRepo } from "./ExtensionRepo"
import { ExtensionService } from "./ExtensionService"
import { AlwaysOnGroupHandler } from "./AlwaysOnGroupHandler"

const createExtension = async (EM) => {
  const repo = new ExtensionRepo()
  const service = new ExtensionService(EM, repo)
  const alwaysOnHandler = new AlwaysOnGroupHandler(EM)

  // Use cached method for initial load
  const exts = await service.getAllExtensions()

  service.initial()

  // Enable always-on extensions on startup (after a short delay to ensure everything is initialized)
  setTimeout(() => {
    alwaysOnHandler.enableAlwaysOnExtensions().catch((err) => {
      console.error("[Extension] Failed to enable always-on extensions on startup", err)
    })
  }, 500)

  return {
    items: exts,
    service: service,
    repo: repo,
    alwaysOnHandler: alwaysOnHandler,
    getAllExtensions: () => service.getAllExtensions()
  }
}

export default createExtension
