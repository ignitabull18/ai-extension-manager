import logger from ".../utils/logger"

/**
 * LLM Client for making API calls to OpenAI models
 * Currently supports OpenAI gpt-5-2025-08-07 only
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
   * Call OpenAI API (gpt-5-2025-08-07)
   */
  private async callOpenAI(
    prompt: string,
    systemPrompt: string | undefined,
    config: ai.IAIModelConfig
  ): Promise<string> {
    const endpoint = config.endpoint || "https://api.openai.com/v1/chat/completions"
    
    // Use the model name directly from config
    // gpt-5-2025-08-07 is the current OpenAI model
    const apiModelName = config.primary
    
    const messages: Array<{ role: string; content: string }> = []
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt })
    }
    messages.push({ role: "user", content: prompt })

    // Request structured JSON output for all AI calls
    const body: any = {
      model: apiModelName,
      messages: messages,
      response_format: { type: "json_object" }
    }
    
    // GPT-5 models don't support temperature/top_p parameters - only default values are allowed
    // For non-GPT-5 models, we can add temperature if needed in the future
    if (!apiModelName.startsWith("gpt-5")) {
      body.temperature = 0.7
      body.max_tokens = 2000
    } else {
      // GPT-5 series uses max_completion_tokens instead of max_tokens
      body.max_completion_tokens = 2000
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
   * Parse JSON response from LLM (handles markdown code blocks and common JSON errors)
   */
  public parseJSONResponse(text: string): any {
    if (!text || text.trim().length === 0) {
      logger().warn("[LLM] Empty response from LLM")
      throw new Error("Empty response from LLM")
    }

    // Strategy 1: Try to extract JSON from markdown code blocks
    const markdownPatterns = [
      /```json\s*(\{[\s\S]*?\})\s*```/,
      /```\s*(\{[\s\S]*?\})\s*```/,
      /```json\s*(\[[\s\S]*?\])\s*```/,
      /```\s*(\[[\s\S]*?\])\s*```/
    ]

    for (const pattern of markdownPatterns) {
      const jsonMatch = text.match(pattern)
      if (jsonMatch && jsonMatch[1]) {
        try {
          const parsed = JSON.parse(jsonMatch[1])
          logger().debug("[LLM] Successfully parsed JSON from markdown block")
          return parsed
        } catch (e) {
          logger().warn("[LLM] Failed to parse JSON from markdown block", e)
          // Continue to try other strategies
        }
      }
    }

    // Strategy 2: Fix common JSON errors and try to parse
    let cleanedText = text.trim()
    
    // Fix common errors: arrays closed with } instead of ]
    // Handle patterns like: }, "categories" or }, "useCases" after array items
    cleanedText = cleanedText.replace(/(\[[\s\S]*?)(\s*)\}(\s*,\s*"categories")/g, '$1$2]$3')
    cleanedText = cleanedText.replace(/(\[[\s\S]*?)(\s*)\}(\s*,\s*"category")/g, '$1$2]$3')
    cleanedText = cleanedText.replace(/(\[[\s\S]*?)(\s*)\}(\s*,\s*"useCases")/g, '$1$2]$3')
    // Also handle cases without comma: } "categories"
    cleanedText = cleanedText.replace(/(\[[\s\S]*?)(\s*)\}(\s*"categories")/g, '$1$2]$3')
    cleanedText = cleanedText.replace(/(\[[\s\S]*?)(\s*)\}(\s*"category")/g, '$1$2]$3')
    cleanedText = cleanedText.replace(/(\[[\s\S]*?)(\s*)\}(\s*"useCases")/g, '$1$2]$3')
    // Handle closing brace after array: } followed by newline and "categories"
    cleanedText = cleanedText.replace(/(\[[\s\S]*?)(\s*)\}(\s*\n\s*"categories")/g, '$1$2]$3')
    cleanedText = cleanedText.replace(/(\[[\s\S]*?)(\s*)\}(\s*\n\s*"useCases")/g, '$1$2]$3')
    
    // Strip leading/trailing non-JSON text by finding first { and last }
    const firstBrace = cleanedText.indexOf('{')
    const lastBrace = cleanedText.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanedText = cleanedText.substring(firstBrace, lastBrace + 1)
    }
    
    // Try parsing cleaned object
    const jsonObjectMatch = cleanedText.match(/\{[\s\S]*\}/)
    if (jsonObjectMatch) {
      try {
        const parsed = JSON.parse(jsonObjectMatch[0])
        logger().debug("[LLM] Successfully parsed JSON object after cleaning")
        return parsed
      } catch (e) {
        logger().warn("[LLM] Failed to parse cleaned JSON object, trying original", e)
        // Try original text if cleaned version failed
        const originalMatch = text.match(/\{[\s\S]*\}/)
        if (originalMatch) {
          try {
            return JSON.parse(originalMatch[0])
          } catch (e2) {
            logger().warn("[LLM] Failed to parse original JSON object", e2)
            // Continue to try array
          }
        }
      }
    }

    // Strategy 3: Try parsing as array
    const jsonArrayMatch = text.match(/\[[\s\S]*\]/)
    if (jsonArrayMatch) {
      try {
        const parsed = JSON.parse(jsonArrayMatch[0])
        logger().debug("[LLM] Successfully parsed JSON array")
        return parsed
      } catch (e) {
        logger().warn("[LLM] Failed to parse JSON array", e)
      }
    }

    // Strategy 4: Last resort - try parsing the whole text as JSON
    try {
      const parsed = JSON.parse(text.trim())
      logger().debug("[LLM] Successfully parsed entire text as JSON")
      return parsed
    } catch (e) {
      logger().error("[LLM] All parsing strategies failed. Response preview:", text.substring(0, 500))
      logger().error("[LLM] Full response:", text)
      throw new Error(`Invalid JSON response from LLM: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
}

