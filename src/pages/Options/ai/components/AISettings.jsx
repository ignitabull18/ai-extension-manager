import React, { useEffect, useState } from "react"

import { Button, Card, Input, message, Select, Space, Switch, Typography } from "antd"
import { KeyOutlined, ReloadOutlined, SettingOutlined } from "@ant-design/icons"

import { sendMessage } from ".../utils/messageHelper"

const { Text } = Typography

export default function AISettings() {
  const [aiSettings, setAiSettings] = useState({
    aiDescriptionEnrichment: false,
    aiExternalMetadataEnabled: false,
    aiExternalMetadataUrl: "",
    modelConfig: {
      enabled: false,
      primary: "gpt-5-2025-08-07",
      fallback: [],
      apiKey: "",
      endpoint: ""
    }
  })
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [apiKeyValue, setApiKeyValue] = useState("")

  useEffect(() => {
    loadAISettings()
  }, [])

  const loadAISettings = async () => {
    try {
      const response = await sendMessage("ai-get-settings", {})
      if (response?.state === "success" && response.settings) {
        setAiSettings(response.settings)
        // If API key is masked, don't populate the input field
        if (response.settings.modelConfig?.apiKey && !response.settings.modelConfig.apiKey.startsWith("***")) {
          setApiKeyValue(response.settings.modelConfig.apiKey)
        } else {
          setApiKeyValue("")
        }
      }
    } catch (error) {
      console.error("Failed to load AI settings", error)
    }
  }

  const handleSaveSettings = async () => {
    setSettingsLoading(true)
    try {
      const settingsToSave = {
        ...aiSettings,
        modelConfig: {
          ...aiSettings.modelConfig
        }
      }

      // Only include API key if a new one was provided (not empty and not masked)
      if (apiKeyValue && apiKeyValue.trim() && !apiKeyValue.startsWith("***")) {
        settingsToSave.modelConfig.apiKey = apiKeyValue.trim()
      } else {
        // If no new API key provided, explicitly exclude it from the save
        // This prevents sending masked keys back to the backend
        delete settingsToSave.modelConfig.apiKey
      }

      const response = await sendMessage("ai-set-settings", { settings: settingsToSave })
      if (!response) {
        message.error("No response from background script. Please check the console for errors.")
        console.error("No response received from ai-set-settings")
        return
      }

      if (response?.state === "success") {
        message.success("Settings saved successfully")
        // Clear the API key input field
        setApiKeyValue("")
        // Reload to get masked API key
        await loadAISettings()
      } else {
        const errorMsg = response?.error || "Failed to save settings"
        console.error("Failed to save settings:", errorMsg, response)
        message.error(errorMsg)
      }
    } catch (error) {
      console.error("Failed to save settings", error)
      message.error(`Failed to save settings: ${error.message || error}`)
    } finally {
      setSettingsLoading(false)
    }
  }

  const handleRefreshEnrichment = async () => {
    setSettingsLoading(true)
    try {
      const response = await sendMessage("ai-refresh-enrichment", { enabled: aiSettings.aiDescriptionEnrichment })
      if (response?.state === "success") {
        message.success("Enrichment refresh completed")
      } else {
        message.error(response?.error || "Failed to refresh enrichment")
      }
    } catch (error) {
      console.error("Failed to refresh enrichment", error)
      message.error("Failed to refresh enrichment")
    } finally {
      setSettingsLoading(false)
    }
  }

  return (
    <Card
      title={
        <Space>
          <SettingOutlined />
          <span>AI Settings</span>
        </Space>
      }>
      <Space direction="vertical" style={{ width: "100%" }} size="large">
        <div>
          <Space direction="vertical" style={{ width: "100%" }}>
            <div>
              <Space>
                <Switch
                  checked={aiSettings.aiDescriptionEnrichment}
                  onChange={(checked) => setAiSettings({ ...aiSettings, aiDescriptionEnrichment: checked })}
                />
                <Text strong>Enable AI-generated descriptions</Text>
              </Space>
              <div style={{ marginLeft: "32px", marginTop: "4px" }}>
                <Text type="secondary" style={{ fontSize: "12px" }}>
                  Automatically generate descriptions, use cases, and categories for extensions with missing or poor descriptions
                </Text>
              </div>
            </div>

            <div>
              <Space>
                <Switch
                  checked={aiSettings.aiExternalMetadataEnabled}
                  onChange={(checked) => setAiSettings({ ...aiSettings, aiExternalMetadataEnabled: checked })}
                />
                <Text strong>Enable external metadata lookup</Text>
              </Space>
              <div style={{ marginLeft: "32px", marginTop: "4px" }}>
                <Text type="secondary" style={{ fontSize: "12px" }}>
                  Fetch extension metadata from external API (requires URL below)
                </Text>
              </div>
            </div>

            {aiSettings.aiExternalMetadataEnabled && (
              <div>
                <Text strong>External Metadata API URL:</Text>
                <Input
                  value={aiSettings.aiExternalMetadataUrl}
                  onChange={(e) => setAiSettings({ ...aiSettings, aiExternalMetadataUrl: e.target.value })}
                  placeholder="https://your-api.com/extensions"
                  style={{ marginTop: "8px" }}
                />
                <div style={{ marginTop: "4px" }}>
                  <Text type="secondary" style={{ fontSize: "12px" }}>
                    API should return JSON with: description, categories[], useCases[]
                  </Text>
                </div>
              </div>
            )}

            <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid #f0f0f0" }}>
              <Space direction="vertical" style={{ width: "100%" }} size="middle">
                <div>
                  <Space>
                    <KeyOutlined />
                    <Text strong style={{ fontSize: "16px" }}>
                      LLM API Configuration
                    </Text>
                  </Space>
                </div>

                <div>
                  <Space>
                    <Switch
                      checked={aiSettings.modelConfig?.enabled || false}
                      onChange={(checked) =>
                        setAiSettings({
                          ...aiSettings,
                          modelConfig: { ...aiSettings.modelConfig, enabled: checked }
                        })
                      }
                    />
                    <Text strong>Enable AI features</Text>
                  </Space>
                  <div style={{ marginLeft: "32px", marginTop: "4px" }}>
                    <Text type="secondary" style={{ fontSize: "12px" }}>
                      Enable natural language extension management, smart grouping, and description enrichment
                    </Text>
                  </div>
                </div>

                {aiSettings.modelConfig?.enabled && (
                  <>
                    <div>
                      <Text strong>Primary Model:</Text>
                      <Select
                        value={aiSettings.modelConfig?.primary || "gpt-5-2025-08-07"}
                        onChange={(value) =>
                          setAiSettings({
                            ...aiSettings,
                            modelConfig: { ...aiSettings.modelConfig, primary: value }
                          })
                        }
                        style={{ width: "100%", marginTop: "8px" }}
                        options={[{ label: "OpenAI GPT-5.1", value: "gpt-5-2025-08-07" }]}
                      />
                    </div>

                    <div>
                      <Text strong>API Key:</Text>
                      <Input.Password
                        value={apiKeyValue}
                        onChange={(e) => setApiKeyValue(e.target.value)}
                        placeholder={
                          aiSettings.modelConfig?.apiKey?.startsWith("***")
                            ? "API key is set (enter new key to update)"
                            : "Enter your API key"
                        }
                        style={{ marginTop: "8px" }}
                      />
                      <div style={{ marginTop: "4px" }}>
                        <Text type="secondary" style={{ fontSize: "12px" }}>
                          Get your API key from https://platform.openai.com/api-keys
                        </Text>
                      </div>
                    </div>

                    <div>
                      <Text strong>Custom API Endpoint (optional):</Text>
                      <Input
                        value={aiSettings.modelConfig?.endpoint || ""}
                        onChange={(e) =>
                          setAiSettings({
                            ...aiSettings,
                            modelConfig: { ...aiSettings.modelConfig, endpoint: e.target.value }
                          })
                        }
                        placeholder="Leave empty to use default endpoint"
                        style={{ marginTop: "8px" }}
                      />
                      <div style={{ marginTop: "4px" }}>
                        <Text type="secondary" style={{ fontSize: "12px" }}>
                          Use a custom endpoint (e.g., for proxy or self-hosted models)
                        </Text>
                      </div>
                    </div>
                  </>
                )}
              </Space>
            </div>
          </Space>
        </div>

        <Space>
          <Button type="primary" onClick={handleSaveSettings} loading={settingsLoading}>
            Save Settings
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefreshEnrichment}
            loading={settingsLoading}
            disabled={!aiSettings.aiDescriptionEnrichment}>
            Refresh Enrichment Now
          </Button>
        </Space>
      </Space>
    </Card>
  )
}

