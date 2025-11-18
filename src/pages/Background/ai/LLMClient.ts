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
    
    // Map model names to actual API model names
    // Verify exact model names at: https://platform.openai.com/docs/models
    // OpenAI 5.1 series models
    const modelMap: Record<string, string> = {
      "gpt-5.1": "gpt-5.1",
      "gpt-5.1-nano": "gpt-5.1-nano"
    }
    const apiModelName = modelMap[config.primary] || config.primary
    
    const messages: Array<{ role: string; content: string }> = []
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt })
    }
    messages.push({ role: "user", content: prompt })

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: apiModelName,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger().error(`[LLM] OpenAI API error: ${response.status}`, errorText)
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || ""
  }


  /**
   * Parse JSON response from LLM (handles markdown code blocks)
   */
  public parseJSONResponse(text: string): any {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1])
      } catch (e) {
        // Fall through to try parsing the whole text
      }
    }

    // Try parsing the whole text as JSON
    try {
      return JSON.parse(text)
    } catch (e) {
      logger().warn("[LLM] Failed to parse JSON response", text)
      throw new Error("Invalid JSON response from LLM")
    }
  }
}

