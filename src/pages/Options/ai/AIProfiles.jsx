import React, { useEffect, useState } from "react"
import chromeP from "webext-polyfill-kinda"

import { Button, Card, Checkbox, Input, List, message, Select, Space, Switch, Table, Tag, Typography } from "antd"
import { RobotOutlined, SendOutlined, FolderAddOutlined, CheckOutlined, EditOutlined, SettingOutlined, ReloadOutlined, KeyOutlined } from "@ant-design/icons"

import { sendMessage } from ".../utils/messageHelper"
import Title from "../Title.jsx"

const { TextArea } = Input
const { Text, Paragraph } = Typography

function AIProfiles() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [actionPlan, setActionPlan] = useState(null)
  const [recentIntents, setRecentIntents] = useState([])
  
  // Smart Organize state
  const [suggestedGroups, setSuggestedGroups] = useState([])
  const [groupLoading, setGroupLoading] = useState(false)
  const [onlyEnabled, setOnlyEnabled] = useState(false)
  const [onlyUngrouped, setOnlyUngrouped] = useState(true)
  const [editingGroupNames, setEditingGroupNames] = useState({})
  const [selectedGroups, setSelectedGroups] = useState(new Set())

  // Settings state
  const [aiSettings, setAiSettings] = useState({
    aiDescriptionEnrichment: false,
    aiExternalMetadataEnabled: false,
    aiExternalMetadataUrl: "",
    modelConfig: {
      enabled: false,
      primary: "gpt-5-2025-08-07",
      fallback: [], // No fallback models currently
      apiKey: "",
      endpoint: ""
    }
  })
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [apiKeyValue, setApiKeyValue] = useState("") // Separate state for API key input

  useEffect(() => {
    loadRecentIntents()
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
      }
      // If apiKeyValue is empty, don't include it - backend will keep existing key
      
      const response = await sendMessage("ai-set-settings", { settings: settingsToSave })
      if (response?.state === "success") {
        message.success("Settings saved successfully")
        // Clear the API key input field
        setApiKeyValue("")
        // Reload to get masked API key
        await loadAISettings()
      } else {
        message.error(response?.error || "Failed to save settings")
      }
    } catch (error) {
      console.error("Failed to save settings", error)
      message.error("Failed to save settings")
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

  const loadRecentIntents = async () => {
    try {
      const response = await sendMessage("ai-get-intents", { limit: 10 })
      if (response?.state === "success" && response.intents) {
        setRecentIntents(response.intents)
      }
    } catch (error) {
      console.error("Failed to load recent intents", error)
    }
  }

  const handleProcessIntent = async () => {
    if (!query.trim()) {
      message.warning("Please enter a task description")
      return
    }

    setLoading(true)
    setActionPlan(null)

    try {
      const response = await sendMessage("ai-process-intent", { query })
      if (response?.state === "success" && response.actionPlan) {
        setActionPlan(response.actionPlan)
        message.success("Action plan generated successfully")
      } else {
        message.error(response?.error || "Failed to process intent")
      }
    } catch (error) {
      console.error("Failed to process intent", error)
      message.error("Failed to process intent")
    } finally {
      setLoading(false)
    }
  }

  const handleExecuteAction = async () => {
    if (!actionPlan) {
      return
    }

    setLoading(true)

    try {
      const response = await sendMessage("ai-execute-action", {
        actionPlan,
        explanation: query
      })
      if (response?.state === "success") {
        message.success("Extensions updated successfully")
        setActionPlan(null)
        setQuery("")
        loadRecentIntents()
      } else {
        message.error(response?.error || "Failed to execute action")
      }
    } catch (error) {
      console.error("Failed to execute action", error)
      message.error("Failed to execute action")
    } finally {
      setLoading(false)
    }
  }

  const handleSuggestGroups = async () => {
    setGroupLoading(true)
    setSuggestedGroups([])

    try {
      const response = await sendMessage("ai-suggest-groups", {
        options: {
          onlyEnabled,
          onlyUngrouped
        }
      })
      
      if (response?.state === "success" && response.suggestions) {
        setSuggestedGroups(response.suggestions.groups || [])
        message.success(`Generated ${response.suggestions.groups?.length || 0} group suggestions`)
      } else {
        message.error(response?.error || "Failed to suggest groups")
      }
    } catch (error) {
      console.error("Failed to suggest groups", error)
      message.error("Failed to suggest groups")
    } finally {
      setGroupLoading(false)
    }
  }

  const handleApplyGroups = async () => {
    if (selectedGroups.size === 0) {
      message.warning("Please select at least one group to apply")
      return
    }

    setGroupLoading(true)

    try {
      const groupsToApply = suggestedGroups.filter((g) => selectedGroups.has(g.id))
      const renameMap = editingGroupNames

      const response = await sendMessage("ai-apply-groups", {
        suggestedGroups: groupsToApply,
        options: {
          renameMap
        }
      })

      if (response?.state === "success") {
        message.success(`Created ${response.createdGroups?.length || 0} groups successfully`)
        setSuggestedGroups([])
        setSelectedGroups(new Set())
        setEditingGroupNames({})
        // Refresh page to show new groups
        window.location.reload()
      } else {
        message.error(response?.error || "Failed to apply groups")
      }
    } catch (error) {
      console.error("Failed to apply groups", error)
      message.error("Failed to apply groups")
    } finally {
      setGroupLoading(false)
    }
  }

  const handleGroupNameEdit = (groupId, newName) => {
    setEditingGroupNames({
      ...editingGroupNames,
      [groupId]: newName
    })
  }

  const toggleGroupSelection = (groupId) => {
    const newSet = new Set(selectedGroups)
    if (newSet.has(groupId)) {
      newSet.delete(groupId)
    } else {
      newSet.add(groupId)
    }
    setSelectedGroups(newSet)
  }

  return (
    <div style={{ padding: "24px" }}>
      <Title title="AI Assistant" />

      <Card
        title={
          <Space>
            <RobotOutlined />
            <span>Natural Language Extension Management</span>
          </Space>
        }
        style={{ marginBottom: "24px" }}>
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <div>
            <Text strong>Describe your task:</Text>
            <TextArea
              rows={3}
              placeholder="e.g., 'I'm doing frontend development' or 'I need to test websites'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onPressEnter={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  handleProcessIntent()
                }
              }}
            />
            <div style={{ marginTop: "8px" }}>
              <Text type="secondary" style={{ fontSize: "12px" }}>
                Press Ctrl+Enter (Cmd+Enter on Mac) to process
              </Text>
            </div>
          </div>

          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={loading}
            onClick={handleProcessIntent}
            disabled={!query.trim()}>
            Process Intent
          </Button>

          {actionPlan && (
            <Card
              title="Generated Action Plan"
              size="small"
              extra={
                <Button type="primary" size="small" onClick={handleExecuteAction} loading={loading}>
                  Execute
                </Button>
              }>
              <Space direction="vertical" style={{ width: "100%" }}>
                {actionPlan.explanation && (
                  <div>
                    <Text strong>Explanation: </Text>
                    <Text>{actionPlan.explanation}</Text>
                  </div>
                )}

                {actionPlan.enable && actionPlan.enable.length > 0 && (
                  <div>
                    <Text strong>Enable: </Text>
                    {actionPlan.enable.map((id) => (
                      <Tag key={id} color="green" style={{ marginRight: "4px" }}>
                        {id.substring(0, 8)}...
                      </Tag>
                    ))}
                  </div>
                )}

                {actionPlan.disable && actionPlan.disable.length > 0 && (
                  <div>
                    <Text strong>Disable: </Text>
                    {actionPlan.disable.map((id) => (
                      <Tag key={id} color="red" style={{ marginRight: "4px" }}>
                        {id.substring(0, 8)}...
                      </Tag>
                    ))}
                  </div>
                )}

                {actionPlan.confidence !== undefined && (
                  <div>
                    <Text strong>Confidence: </Text>
                    <Text>{(actionPlan.confidence * 100).toFixed(0)}%</Text>
                  </div>
                )}
              </Space>
            </Card>
          )}
        </Space>
      </Card>

      <Card title="Recent AI Actions" size="small" style={{ marginBottom: "24px" }}>
        {recentIntents.length === 0 ? (
          <Text type="secondary">No recent AI actions</Text>
        ) : (
          <List
            dataSource={recentIntents}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>{item.query}</Text>
                      <Tag color={item.executed ? "green" : "default"}>
                        {item.executed ? "Executed" : "Pending"}
                      </Tag>
                    </Space>
                  }
                  description={
                    <div>
                      <Text type="secondary" style={{ fontSize: "12px" }}>
                        {new Date(item.timestamp).toLocaleString()}
                      </Text>
                      {item.actionPlan?.explanation && (
                        <div style={{ marginTop: "4px" }}>
                          <Text style={{ fontSize: "12px" }}>{item.actionPlan.explanation}</Text>
                        </div>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      <Card
        title={
          <Space>
            <FolderAddOutlined />
            <span>Smart Organize</span>
          </Space>
        }>
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <div>
            <Space>
              <Checkbox checked={onlyEnabled} onChange={(e) => setOnlyEnabled(e.target.checked)}>
                Only enabled extensions
              </Checkbox>
              <Checkbox checked={onlyUngrouped} onChange={(e) => setOnlyUngrouped(e.target.checked)}>
                Only ungrouped extensions
              </Checkbox>
            </Space>
          </div>

          <Button
            type="primary"
            icon={<FolderAddOutlined />}
            loading={groupLoading}
            onClick={handleSuggestGroups}>
            Suggest Groups
          </Button>

          {suggestedGroups.length > 0 && (
            <div>
              <Space style={{ marginBottom: "16px" }}>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={handleApplyGroups}
                  disabled={selectedGroups.size === 0}
                  loading={groupLoading}>
                  Apply Selected Groups ({selectedGroups.size})
                </Button>
                <Button onClick={() => {
                  setSuggestedGroups([])
                  setSelectedGroups(new Set())
                  setEditingGroupNames({})
                }}>
                  Clear
                </Button>
              </Space>

              <Table
                dataSource={suggestedGroups}
                rowKey="id"
                pagination={false}
                size="small"
                columns={[
                  {
                    title: "Select",
                    width: 60,
                    render: (_, record) => (
                      <Checkbox
                        checked={selectedGroups.has(record.id)}
                        onChange={() => toggleGroupSelection(record.id)}
                      />
                    )
                  },
                  {
                    title: "Group Name",
                    render: (_, record) => {
                      const editedName = editingGroupNames[record.id]
                      return (
                        <Space>
                          <Input
                            value={editedName !== undefined ? editedName : record.name}
                            onChange={(e) => handleGroupNameEdit(record.id, e.target.value)}
                            placeholder={record.name}
                            style={{ width: "200px" }}
                          />
                          {editedName !== undefined && editedName !== record.name && (
                            <Tag color="blue">Edited</Tag>
                          )}
                        </Space>
                      )
                    }
                  },
                  {
                    title: "Extensions",
                    render: (_, record) => (
                      <Tag>{record.extensionIds.length} extensions</Tag>
                    )
                  },
                  {
                    title: "Confidence",
                    render: (_, record) => (
                      <Tag color={record.confidence > 0.7 ? "green" : record.confidence > 0.5 ? "orange" : "red"}>
                        {(record.confidence * 100).toFixed(0)}%
                      </Tag>
                    )
                  },
                  {
                    title: "Rationale",
                    render: (_, record) => (
                      <Text type="secondary" style={{ fontSize: "12px" }}>
                        {record.rationale}
                      </Text>
                    )
                  }
                ]}
              />
            </div>
          )}
        </Space>
      </Card>

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
                    onChange={(checked) =>
                      setAiSettings({ ...aiSettings, aiDescriptionEnrichment: checked })
                    }
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
                    onChange={(checked) =>
                      setAiSettings({ ...aiSettings, aiExternalMetadataEnabled: checked })
                    }
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
                    onChange={(e) =>
                      setAiSettings({ ...aiSettings, aiExternalMetadataUrl: e.target.value })
                    }
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
                      <Text strong style={{ fontSize: "16px" }}>LLM API Configuration</Text>
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
                          value={aiSettings.modelConfig?.primary || "gpt-5.1"}
                          onChange={(value) =>
                            setAiSettings({
                              ...aiSettings,
                              modelConfig: { ...aiSettings.modelConfig, primary: value }
                            })
                          }
                          style={{ width: "100%", marginTop: "8px" }}
                          options={[
                            { label: "OpenAI GPT-5.1", value: "gpt-5.1" }
                          ]}
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
    </div>
  )
}

export default AIProfiles

