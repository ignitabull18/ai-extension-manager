import chromeP from "webext-polyfill-kinda"

import { ExtensionRepo } from "./ExtensionRepo"
import { ExtensionService } from "./ExtensionService"

const createExtension = async (EM) => {
  const repo = new ExtensionRepo()
  const service = new ExtensionService(EM, repo)

  // Use cached method for initial load
  const exts = await service.getAllExtensions()

  service.initial()

  return {
    items: exts,
    service: service,
    repo: repo,
    getAllExtensions: () => service.getAllExtensions()
  }
}

export default createExtension
