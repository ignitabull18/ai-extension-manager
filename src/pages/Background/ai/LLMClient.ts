import logger from ".../utils/logger"

/**
 * LLM Client for making API calls to OpenAI models
 * Currently supports OpenAI GPT-5.1 series only
 */
export class LLMClient {
  /**
   * Call LLM API with prompt and return response
   */
  public async call(
    prompt: string,
    config: ai.IAIModelConfig,
    systemPrompt?: string
  ): Promise<string> {
    if (!config.enabled || !config.apiKey) {
      throw new Error("LLM is not enabled or API key is missing")
    }

    try {
      // Only OpenAI models are supported
      logger().info(`[LLM] Calling OpenAI with model: ${config.primary}`)
      return await this.callOpenAI(prompt, systemPrompt, config)
    } catch (error: any) {
      logger().error(`[LLM] Primary model ${config.primary} failed:`, error?.message || error)
      
      // Try fallback models (OpenAI only)
      for (const fallbackModel of config.fallback || []) {
        try {
          logger().info(`[LLM] Trying fallback model: ${fallbackModel}`)
          // Create a modified config with the fallback model as primary
          const fallbackConfig = { ...config, primary: fallbackModel }
          return await this.callOpenAI(prompt, systemPrompt, fallbackConfig)
        } catch (fallbackError: any) {
          logger().error(`[LLM] Fallback model ${fallbackModel} also failed:`, fallbackError?.message || fallbackError)
          continue
        }
      }
      
      throw new Error(`All LLM models failed. Last error: ${error?.message || error}`)
    }
  }

  /**
   * Call OpenAI API (GPT-5.1 or GPT-5.1 Nano)
   */
  private async callOpenAI(
    prompt: string,
    systemPrompt: string | undefined,
    config: ai.IAIModelConfig
  ): Promise<string> {
    const endpoint = config.endpoint || "https://api.openai.com/v1/chat/completions"
    
    // Use the model name directly from config
    // GPT-5.1 is the current OpenAI model
    const apiModelName = config.primary
    
    const messages: Array<{ role: string; content: string }> = []
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt })
    }
    messages.push({ role: "user", content: prompt })

    // GPT-5.1 models use max_completion_tokens instead of max_tokens
    const body: any = {
      model: apiModelName,
      messages: messages,
      temperature: 0.7
    }
    
    // Use max_completion_tokens for GPT-5.1 series, max_tokens for older models
    if (apiModelName.startsWith("gpt-5")) {
      body.max_completion_tokens = 2000
    } else {
      body.max_tokens = 2000
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger().error(`[LLM] OpenAI API error: ${response.status}`, errorText)
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ""
    logger().debug(`[LLM] OpenAI response length: ${content.length} chars`)
    return content
  }


  /**
   * Parse JSON response from LLM (handles markdown code blocks)
   */
  public parseJSONResponse(text: string): any {
    if (!text || text.trim().length === 0) {
      logger().warn("[LLM] Empty response from LLM")
      throw new Error("Empty response from LLM")
    }

    // Try to extract JSON from markdown code blocks (multiple patterns)
    const patterns = [
      /```json\s*(\{[\s\S]*?\})\s*```/,
      /```\s*(\{[\s\S]*?\})\s*```/,
      /```json\s*(\[[\s\S]*?\])\s*```/,
      /```\s*(\[[\s\S]*?\])\s*```/
    ]

    for (const pattern of patterns) {
      const jsonMatch = text.match(pattern)
      if (jsonMatch && jsonMatch[1]) {
        try {
          const parsed = JSON.parse(jsonMatch[1])
          logger().debug("[LLM] Successfully parsed JSON from markdown block")
          return parsed
        } catch (e) {
          logger().warn("[LLM] Failed to parse JSON from markdown block", e)
          // Continue to try other patterns
        }
      }
    }

    // Try to find JSON object/array in the text (more flexible)
    // First try to fix common JSON errors
    let cleanedText = text.trim()
    
    // Fix common GPT errors: replace } with ] before closing brace of arrays
    // Pattern: array items followed by } instead of ]
    cleanedText = cleanedText.replace(/(\[[\s\S]*?)(\s*)\}(\s*"categories")/g, '$1$2]$3')
    cleanedText = cleanedText.replace(/(\[[\s\S]*?)(\s*)\}(\s*"category")/g, '$1$2]$3')
    cleanedText = cleanedText.replace(/(\[[\s\S]*?)(\s*)\}(\s*"useCases")/g, '$1$2]$3')
    
    const jsonObjectMatch = cleanedText.match(/\{[\s\S]*\}/)
    if (jsonObjectMatch) {
      try {
        const parsed = JSON.parse(jsonObjectMatch[0])
        logger().debug("[LLM] Successfully parsed JSON object from text")
        return parsed
      } catch (e) {
        // Try original text if cleaned version failed
        try {
          const originalMatch = text.match(/\{[\s\S]*\}/)
          if (originalMatch) {
            return JSON.parse(originalMatch[0])
          }
        } catch (e2) {
          // Continue to try array
        }
      }
    }

    const jsonArrayMatch = text.match(/\[[\s\S]*\]/)
    if (jsonArrayMatch) {
      try {
        const parsed = JSON.parse(jsonArrayMatch[0])
        logger().debug("[LLM] Successfully parsed JSON array from text")
        return parsed
      } catch (e) {
        // Continue
      }
    }

    // Try parsing the whole text as JSON (last resort)
    try {
      const parsed = JSON.parse(text.trim())
      logger().debug("[LLM] Successfully parsed entire text as JSON")
      return parsed
    } catch (e) {
      logger().error("[LLM] Failed to parse JSON response. Response preview:", text.substring(0, 500))
      logger().error("[LLM] Full response:", text)
      throw new Error(`Invalid JSON response from LLM: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
}

