import { ExtensionKnowledgeBase } from "./ExtensionKnowledgeBase"
import { AIAssistantService } from "./AIAssistantService"
import { ExternalKnowledgeClient } from "./ExternalKnowledgeClient"
import type { IExtensionManager } from ".../types/global"

const createAI = async (EM: IExtensionManager) => {
  if (!EM.Extension.repo) {
    throw new Error("Extension repo is required for AI service")
  }

  const knowledgeBase = new ExtensionKnowledgeBase(EM.Extension.repo, EM)
  
  // Get external metadata URL from config (if set)
  const externalUrl = await EM.LocalOptions.getValue<string>("aiExternalMetadataUrl")
  const externalClient = new ExternalKnowledgeClient(externalUrl || undefined)
  
  const assistant = new AIAssistantService(EM, knowledgeBase)

  // Initialize (refresh knowledge if needed)
  await assistant.initialize()

  return {
    knowledgeBase,
    assistant,
    externalClient
  }
}

export default createAI

