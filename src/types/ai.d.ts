declare namespace ai {

  /**
   * AI Profile - Natural language workflow description
   */
  export interface IAIPProfile {
    /**
     * Profile ID
     */
    id: string

    /**
     * Profile name
     */
    name: string

    /**
     * Natural language description of the workflow/task
     */
    description: string

    /**
     * Associated group IDs
     */
    groupIds: string[]

    /**
     * Associated scene ID
     */
    sceneId?: string

    /**
     * Extension IDs that should be enabled for this profile
     */
    extensionIds: string[]

    /**
     * Created timestamp
     */
    createdAt: number

    /**
     * Last used timestamp
     */
    lastUsed?: number
  }

  /**
   * AI Assistant intent/request
   */
  export interface IAIIntent {
    /**
     * Intent ID
     */
    id: string

    /**
     * User's natural language request
     */
    query: string

    /**
     * Timestamp
     */
    timestamp: number

    /**
     * Action plan returned by AI
     */
    actionPlan?: IAIActionPlan

    /**
     * Whether the action was executed
     */
    executed: boolean
  }

  /**
   * AI-generated action plan
   */
  export interface IAIActionPlan {
    /**
     * Extensions to enable
     */
    enable: string[]

    /**
     * Extensions to disable
     */
    disable: string[]

    /**
     * Groups to activate
     */
    activateGroups: string[]

    /**
     * Scene to switch to
     */
    switchScene?: string

    /**
     * Explanation of why these actions were chosen
     */
    explanation: string

    /**
     * Confidence score (0-1)
     */
    confidence: number
  }

  /**
   * AI model configuration
   */
  export interface IAIModelConfig {
    /**
     * Primary model to use (OpenAI only)
     */
    primary: "gpt-5.1"

    /**
     * Fallback models in order (OpenAI only)
     */
    fallback: Array<"gpt-5.1">

    /**
     * API key for the primary model (stored securely)
     */
    apiKey?: string

    /**
     * API endpoint (if custom)
     */
    endpoint?: string

    /**
     * Whether AI features are enabled
     */
    enabled: boolean
  }

  /**
   * AI-suggested extension group
   */
  export interface IAISuggestedGroup {
    /**
     * Suggested group ID (temporary, until applied)
     */
    id: string

    /**
     * Suggested group name
     */
    name: string

    /**
     * Description of what this group is for
     */
    description: string

    /**
     * Extension IDs that should be in this group
     */
    extensionIds: string[]

    /**
     * Rationale for why these extensions were grouped together
     */
    rationale: string

    /**
     * Confidence score for this suggestion (0-1)
     */
    confidence: number

    /**
     * Whether this group was created by AI
     */
    aiCreated?: boolean

    /**
     * Timestamp when this suggestion was created
     */
    createdAt?: number
  }

  /**
   * AI group suggestion response
   */
  export interface IAIGroupSuggestions {
    /**
     * List of suggested groups
     */
    groups: IAISuggestedGroup[]

    /**
     * Overall confidence score
     */
    confidence: number

    /**
     * Explanation of the grouping strategy
     */
    explanation: string
  }

  /**
   * Extension knowledge with category tags
   */
  export interface IExtensionKnowledge {
    /**
     * Extension ID
     */
    extId: string

    /**
     * Enriched description combining name, description, and use cases
     */
    enrichedDescription: string

    /**
     * Permission summary for context
     */
    permissionSummary: string

    /**
     * User-entered use cases
     */
    useCases: string[]

    /**
     * Historical alias names used
     */
    aliasHistory: string[]

    /**
     * Last time knowledge was updated
     */
    lastUpdated: number

    /**
     * Embedding vector for semantic search (optional, stored separately if needed)
     */
    embedding?: number[]

    /**
     * AI-generated category tags (e.g. "developer-tools", "writing", "shopping")
     */
    categories?: string[]

    /**
     * AI-generated description (if original was missing/poor)
     */
    aiGeneratedDescription?: string

    /**
     * Whether description was enriched by AI
     */
    descriptionEnriched?: boolean
  }
}

