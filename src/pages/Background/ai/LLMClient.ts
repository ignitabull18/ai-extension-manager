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
        case "gpt-5-2025-08-07":
          return await this.callOpenAI(prompt, systemPrompt, config)
        case "claude-sonnet-4-5-20250929":
          return await this.callAnthropic(prompt, systemPrompt, config)
        case "gemini-2.5-pro":
          return await this.callGoogle(prompt, systemPrompt, config)
        default:
          throw new Error(`Unsupported model: ${config.primary}`)
      }
    } catch (error) {
      logger().warn(`[LLM] Primary model ${config.primary} failed, trying fallbacks`, error)
      
      // Try fallback models
      for (const fallbackModel of config.fallback || []) {
        try {
          switch (fallbackModel) {
            case "gpt-5-2025-08-07":
              return await this.callOpenAI(prompt, systemPrompt, config)
            case "claude-sonnet-4-5-20250929":
              return await this.callAnthropic(prompt, systemPrompt, config)
            case "gemini-2.5-pro":
              return await this.callGoogle(prompt, systemPrompt, config)
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
   * Call OpenAI API (GPT-5)
   */
  private async callOpenAI(
    prompt: string,
    systemPrompt: string | undefined,
    config: ai.IAIModelConfig
  ): Promise<string> {
    const endpoint = config.endpoint || "https://api.openai.com/v1/chat/completions"
    
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
        model: "gpt-5-2025-08-07",
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
    
    const messages: Array<{ role: string; content: string }> = [
      { role: "user", content: prompt }
    ]

    const body: any = {
      model: "claude-sonnet-4-5-20250929",
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
   * Call Google API (Gemini)
   */
  private async callGoogle(
    prompt: string,
    systemPrompt: string | undefined,
    config: ai.IAIModelConfig
  ): Promise<string> {
    // Google Gemini API uses API key in query parameter
    const baseEndpoint = config.endpoint || "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent"
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

