import logger from ".../utils/logger"

/**
 * LLM Client for making API calls to various LLM providers
 * Supports OpenAI, Anthropic, and Google models
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
      switch (config.primary) {
        case "gpt-5.1":
        case "gpt-5.1-nano":
          return await this.callOpenAI(prompt, systemPrompt, config)
        case "claude-sonnet-4-5":
        case "claude-haiku-4-5":
        case "claude-opus-4-1":
          return await this.callAnthropic(prompt, systemPrompt, config)
        case "gemini-2.5-pro":
        case "gemini-2.5-flash":
          return await this.callGoogle(prompt, systemPrompt, config)
        default:
          throw new Error(`Unsupported model: ${config.primary}`)
      }
    } catch (error) {
      logger().warn(`[LLM] Primary model ${config.primary} failed, trying fallbacks`, error)
      
      // Try fallback models
      for (const fallbackModel of config.fallback || []) {
        try {
          // Create a modified config with the fallback model as primary
          const fallbackConfig = { ...config, primary: fallbackModel }
          switch (fallbackModel) {
            case "gpt-5.1":
            case "gpt-5.1-nano":
              return await this.callOpenAI(prompt, systemPrompt, fallbackConfig)
            case "claude-sonnet-4-5":
            case "claude-haiku-4-5":
            case "claude-opus-4-1":
              return await this.callAnthropic(prompt, systemPrompt, fallbackConfig)
            case "gemini-2.5-pro":
            case "gemini-2.5-flash":
              return await this.callGoogle(prompt, systemPrompt, fallbackConfig)
          }
        } catch (fallbackError) {
          logger().warn(`[LLM] Fallback model ${fallbackModel} also failed`, fallbackError)
          continue
        }
      }
      
      throw new Error("All LLM models failed")
    }
  }

  /**
   * Call OpenAI API (GPT-5 or GPT-5 Nano)
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
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || ""
  }

  /**
   * Call Anthropic API (Claude Sonnet)
   */
  private async callAnthropic(
    prompt: string,
    systemPrompt: string | undefined,
    config: ai.IAIModelConfig
  ): Promise<string> {
    const endpoint = config.endpoint || "https://api.anthropic.com/v1/messages"
    
    // Verify exact model names at: https://docs.claude.com/en/docs/about-claude/models/overview
    // Claude 4.5 series models - aliases automatically point to latest snapshot
    const anthropicModelMap: Record<string, string> = {
      "claude-sonnet-4-5": "claude-sonnet-4-5", // Alias for claude-sonnet-4-5-20250929
      "claude-haiku-4-5": "claude-haiku-4-5", // Alias for claude-haiku-4-5-20251001
      "claude-opus-4-1": "claude-opus-4-1" // Alias for claude-opus-4-1-20250805
    }
    const apiModelName = anthropicModelMap[config.primary] || config.primary
    
    const messages: Array<{ role: string; content: string }> = [
      { role: "user", content: prompt }
    ]

    const body: any = {
      model: apiModelName,
      max_tokens: 2000,
      messages: messages
    }

    if (systemPrompt) {
      body.system = systemPrompt
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey!,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Anthropic API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    return data.content?.[0]?.text || ""
  }

  /**
   * Call Google API (Gemini Pro or Flash)
   */
  private async callGoogle(
    prompt: string,
    systemPrompt: string | undefined,
    config: ai.IAIModelConfig
  ): Promise<string> {
    // Map model names to actual API model names
    // Verified from: https://ai.google.dev/gemini-api/docs/models
    // Current models: gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash
    const modelMap: Record<string, string> = {
      "gemini-2.5-pro": "gemini-2.5-pro",
      "gemini-2.5-flash": "gemini-2.5-flash"
    }
    const apiModelName = modelMap[config.primary] || config.primary
    
    // Google Gemini API uses API key in query parameter
    const baseEndpoint = config.endpoint || `https://generativelanguage.googleapis.com/v1beta/models/${apiModelName}:generateContent`
    const endpoint = `${baseEndpoint}?key=${config.apiKey}`
    
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = []
    
    // Combine system prompt and user prompt
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt
    
    contents.push({
      role: "user",
      parts: [{ text: fullPrompt }]
    })

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Google API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ""
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

