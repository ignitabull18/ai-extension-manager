import React, { useEffect, useState } from "react"
import chromeP from "webext-polyfill-kinda"

import { Button, Card, Checkbox, Input, List, message, Select, Space, Switch, Table, Tag, Typography, Progress } from "antd"
import { RobotOutlined, SendOutlined, FolderAddOutlined, CheckOutlined, EditOutlined, SettingOutlined, ReloadOutlined, KeyOutlined, ThunderboltOutlined } from "@ant-design/icons"

import { sendMessage } from ".../utils/messageHelper"
import Title from "../Title.jsx"

const { TextArea } = Input
const { Text, Paragraph } = Typography

function AIProfiles() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [actionPlan, setActionPlan] = useState(null)
  const [recentIntents, setRecentIntents] = useState([])
  
  // AI Enrichment state
  const [enrichmentLoading, setEnrichmentLoading] = useState(false)
  const [enrichmentProgress, setEnrichmentProgress] = useState({ current: 0, total: 0 })
  const [extensionList, setExtensionList] = useState([])
  const [selectedExtensions, setSelectedExtensions] = useState(new Set())
  const [enrichmentStatuses, setEnrichmentStatuses] = useState(new Map())
  const [enrichmentSearchText, setEnrichmentSearchText] = useState("")

  // Smart Organize state
  const [suggestedGroups, setSuggestedGroups] = useState([])
  const [groupLoading, setGroupLoading] = useState(false)
  const [onlyEnabled, setOnlyEnabled] = useState(false)
  const [onlyUngrouped, setOnlyUngrouped] = useState(true)
  const [editingGroupNames, setEditingGroupNames] = useState({})
  const [selectedGroups, setSelectedGroups] = useState(new Set())
  const [expandedRows, setExpandedRows] = useState(new Set())
  const [extensionMap, setExtensionMap] = useState(new Map())

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
    loadExtensionMap()
    loadExtensionList()
    loadEnrichmentStatuses()
  }, [])

  const loadExtensionMap = async () => {
    try {
      const extensions = await chromeP.management.getAll()
      const map = new Map()
      extensions.forEach((ext) => {
        map.set(ext.id, ext.name)
      })
      setExtensionMap(map)
    } catch (error) {
      console.error("[AI] Failed to load extension map", error)
    }
  }

  const loadExtensionList = async () => {
    try {
      const extensions = await chromeP.management.getAll()
      const self = await chromeP.management.getSelf()
      const filtered = extensions.filter((ext) => ext.id !== self.id)
      setExtensionList(filtered)
    } catch (error) {
      console.error("[AI] Failed to load extension list", error)
    }
  }

  const loadEnrichmentStatuses = async () => {
    try {
      const response = await sendMessage("ai-get-enrichment-status", { extensionIds: [] })
      if (response?.state === "success" && response.statuses) {
        const statusMap = new Map()
        response.statuses.forEach((status) => {
          statusMap.set(status.extId, status)
        })
        setEnrichmentStatuses(statusMap)
      }
    } catch (error) {
      console.error("[AI] Failed to load enrichment statuses", error)
    }
  }

  const handleEnrichAll = async () => {
    setEnrichmentLoading(true)
    setEnrichmentProgress({ current: 0, total: extensionList.length })

    try {
      const response = await sendMessage("ai-enrich-extensions", { extensionIds: [] })
      
      if (response?.state === "success" && response.result) {
        const { success, failed, results } = response.result
        setEnrichmentProgress({ current: results.length, total: results.length })
        
        // Reload enrichment statuses
        await loadEnrichmentStatuses()
        
        if (success > 0) {
          message.success(`Successfully enriched ${success} extension${success > 1 ? 's' : ''}`)
        }
        if (failed > 0) {
          message.warning(`${failed} extension${failed > 1 ? 's' : ''} failed to enrich`)
        }
      } else {
        message.error(response?.error || "Failed to enrich extensions")
      }
    } catch (error) {
      console.error("[AI] Failed to enrich all extensions", error)
      message.error("Failed to enrich extensions: " + (error?.message || String(error)))
    } finally {
      setEnrichmentLoading(false)
      setEnrichmentProgress({ current: 0, total: 0 })
    }
  }

  const handleEnrichSelected = async () => {
    if (selectedExtensions.size === 0) {
      message.warning("Please select at least one extension to enrich")
      return
    }

    setEnrichmentLoading(true)
    const extensionIds = Array.from(selectedExtensions)
    setEnrichmentProgress({ current: 0, total: extensionIds.length })

    try {
      const response = await sendMessage("ai-enrich-extensions", { extensionIds })
      
      if (response?.state === "success" && response.result) {
        const { success, failed, results } = response.result
        setEnrichmentProgress({ current: results.length, total: results.length })
        
        // Reload enrichment statuses
        await loadEnrichmentStatuses()
        
        if (success > 0) {
          message.success(`Successfully enriched ${success} extension${success > 1 ? 's' : ''}`)
        }
        if (failed > 0) {
          message.warning(`${failed} extension${failed > 1 ? 's' : ''} failed to enrich`)
        }
      } else {
        message.error(response?.error || "Failed to enrich selected extensions")
      }
    } catch (error) {
      console.error("[AI] Failed to enrich selected extensions", error)
      message.error("Failed to enrich extensions: " + (error?.message || String(error)))
    } finally {
      setEnrichmentLoading(false)
      setEnrichmentProgress({ current: 0, total: 0 })
    }
  }

  // Filter extensions based on search text
  const filteredExtensionList = extensionList.filter((ext) => {
    if (!enrichmentSearchText.trim()) return true
    const searchLower = enrichmentSearchText.toLowerCase()
    return ext.name.toLowerCase().includes(searchLower) || ext.id.toLowerCase().includes(searchLower)
  })

  const toggleExtensionSelection = (extId) => {
    const newSet = new Set(selectedExtensions)
    if (newSet.has(extId)) {
      newSet.delete(extId)
    } else {
      newSet.add(extId)
    }
    setSelectedExtensions(newSet)
  }

  const toggleSelectAll = () => {
    const filtered = filteredExtensionList
    if (selectedExtensions.size === filtered.length) {
      setSelectedExtensions(new Set())
    } else {
      setSelectedExtensions(new Set(filtered.map((ext) => ext.id)))
    }
  }

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
    // Don't clear existing suggestions until we have new ones - allows user to keep exploring

    try {
      const response = await sendMessage("ai-suggest-groups", {
        options: {
          onlyEnabled,
          onlyUngrouped
        }
      })
      
      console.log("[AI] Suggest groups response:", response)
      
      if (response?.state === "success" && response.suggestions) {
        const groups = response.suggestions.groups || []
        setSuggestedGroups(groups)
        setExpandedRows(new Set()) // Reset expanded rows for new suggestions
        if (groups.length > 0) {
          message.success(`Generated ${groups.length} group suggestions`)
        } else {
          message.warning("No group suggestions were generated. Try adjusting the filters or ensure you have extensions installed.")
        }
      } else {
        console.error("[AI] Suggest groups failed:", response)
        message.error(response?.error || "Failed to suggest groups")
        // Keep existing suggestions visible so user can still explore them
      }
    } catch (error) {
      console.error("[AI] Failed to suggest groups", error)
      message.error("Failed to suggest groups: " + (error?.message || String(error)))
      // Keep existing suggestions visible so user can still explore them
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
            <ThunderboltOutlined />
            <span>AI Enrichment</span>
          </Space>
        }
        style={{ marginBottom: "24px" }}>
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <div>
            <Paragraph type="secondary">
              Generate detailed AI descriptions, use cases, and categories for your extensions. This improves grouping accuracy and helps you understand what each extension does.
            </Paragraph>
          </div>

          <Space>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              loading={enrichmentLoading}
              onClick={handleEnrichAll}>
              Enrich All Extensions
            </Button>
            <Button
              icon={<ThunderboltOutlined />}
              loading={enrichmentLoading}
              onClick={handleEnrichSelected}
              disabled={selectedExtensions.size === 0}>
              Enrich Selected ({selectedExtensions.size})
            </Button>
          </Space>

          {enrichmentLoading && enrichmentProgress.total > 0 && (
            <Progress
              percent={Math.round((enrichmentProgress.current / enrichmentProgress.total) * 100)}
              status="active"
              format={(percent) => `Enriching: ${enrichmentProgress.current} / ${enrichmentProgress.total}`}
            />
          )}

          <div>
            <Space style={{ marginBottom: "12px" }}>
              <Input.Search
                placeholder="Search extensions..."
                value={enrichmentSearchText}
                onChange={(e) => setEnrichmentSearchText(e.target.value)}
                style={{ width: "300px" }}
                allowClear
              />
              <Button size="small" onClick={toggleSelectAll}>
                {selectedExtensions.size === filteredExtensionList.length ? "Deselect All" : "Select All"}
              </Button>
            </Space>

            <Table
              dataSource={filteredExtensionList}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              size="small"
              scroll={{ y: 400 }}
              expandable={{
                expandedRowRender: (record) => {
                  const status = enrichmentStatuses.get(record.id)
                  if (!status || (!status.hasDescription && status.useCases.length === 0 && status.categories.length === 0)) {
                    return (
                      <div style={{ padding: "16px", background: "#fafafa", borderRadius: "4px" }}>
                        <Text type="secondary">No enrichment data available yet. Click 'Enrich All' or select this extension and click 'Enrich Selected' to generate AI descriptions.</Text>
                      </div>
                    )
                  }

                  return (
                    <div style={{ padding: "16px", background: "#fafafa", borderRadius: "4px" }}>
                      <Space direction="vertical" style={{ width: "100%" }} size="small">
                        {status.hasDescription && status.description && (
                          <div>
                            <Text strong>AI-Generated Description: </Text>
                            <div style={{ marginTop: "8px", padding: "8px", background: "#fff", borderRadius: "4px" }}>
                              <Text>{status.description}</Text>
                            </div>
                            {status.lastUpdated && (
                              <Text type="secondary" style={{ fontSize: "12px", marginTop: "4px", display: "block" }}>
                                Updated: {new Date(status.lastUpdated).toLocaleString()}
                              </Text>
                            )}
                          </div>
                        )}
                        {status.useCases && status.useCases.length > 0 && (
                          <div>
                            <Text strong>Use Cases: </Text>
                            <div style={{ marginTop: "8px" }}>
                              <Space wrap>
                                {status.useCases.map((useCase, idx) => (
                                  <Tag key={idx} color="green">{useCase}</Tag>
                                ))}
                              </Space>
                            </div>
                          </div>
                        )}
                        {status.categories && status.categories.length > 0 && (
                          <div>
                            <Text strong>Categories: </Text>
                            <div style={{ marginTop: "8px" }}>
                              <Space wrap>
                                {status.categories.map((category, idx) => (
                                  <Tag key={idx} color="blue">{category}</Tag>
                                ))}
                              </Space>
                            </div>
                          </div>
                        )}
                      </Space>
                    </div>
                  )
                }
              }}
              columns={[
                {
                  title: "Select",
                  width: 60,
                  render: (_, record) => (
                    <Checkbox
                      checked={selectedExtensions.has(record.id)}
                      onChange={() => toggleExtensionSelection(record.id)}
                    />
                  )
                },
                {
                  title: "Extension Name",
                  render: (_, record) => (
                    <Text>{record.name}</Text>
                  )
                },
                {
                  title: "Status",
                  render: (_, record) => {
                    const status = enrichmentStatuses.get(record.id)
                    if (!status) {
                      return <Tag color="default">Not Enriched</Tag>
                    }
                    if (status.enriched) {
                      return <Tag color="green">Enriched</Tag>
                    }
                    if (status.hasDescription) {
                      return <Tag color="orange">Partial</Tag>
                    }
                    return <Tag color="default">Not Enriched</Tag>
                  }
                },
                {
                  title: "Use Cases",
                  render: (_, record) => {
                    const status = enrichmentStatuses.get(record.id)
                    const count = status?.useCases?.length || 0
                    return count > 0 ? <Tag>{count} use case{count > 1 ? 's' : ''}</Tag> : <Text type="secondary">-</Text>
                  }
                },
                {
                  title: "Categories",
                  render: (_, record) => {
                    const status = enrichmentStatuses.get(record.id)
                    const count = status?.categories?.length || 0
                    return count > 0 ? <Tag>{count} categor{count > 1 ? 'ies' : 'y'}</Tag> : <Text type="secondary">-</Text>
                  }
                }
              ]}
            />
          </div>
        </Space>
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

          {suggestedGroups.length > 0 ? (
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
                  setExpandedRows(new Set())
                }}>
                  Clear
                </Button>
              </Space>

              <Table
                dataSource={suggestedGroups}
                rowKey="id"
                pagination={false}
                size="small"
                expandable={{
                  expandedRowKeys: Array.from(expandedRows),
                  onExpand: (expanded, record) => {
                    const newExpanded = new Set(expandedRows)
                    if (expanded) {
                      newExpanded.add(record.id)
                    } else {
                      newExpanded.delete(record.id)
                    }
                    setExpandedRows(newExpanded)
                  },
                  expandedRowRender: (record) => {
                    const extensionNames = record.extensionIds
                      .map((id) => extensionMap.get(id) || id.substring(0, 8) + "...")
                      .filter(Boolean)
                    
                    return (
                      <div style={{ padding: "16px", background: "#fafafa", borderRadius: "4px" }}>
                        <Space direction="vertical" style={{ width: "100%" }} size="small">
                          {record.description && (
                            <div>
                              <Text strong>Description: </Text>
                              <Text>{record.description}</Text>
                            </div>
                          )}
                          {record.rationale && (
                            <div>
                              <Text strong>Rationale: </Text>
                              <Text type="secondary">{record.rationale}</Text>
                            </div>
                          )}
                          <div>
                            <Text strong>Extensions in this group ({extensionNames.length}):</Text>
                            <div style={{ marginTop: "8px" }}>
                              <Space wrap>
                                {extensionNames.map((name, idx) => (
                                  <Tag key={idx} color="blue">{name}</Tag>
                                ))}
                              </Space>
                            </div>
                          </div>
                        </Space>
                      </div>
                    )
                  }
                }}
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
                    title: "Description",
                    render: (_, record) => (
                      <Text type="secondary" style={{ fontSize: "12px" }} ellipsis={{ tooltip: record.description || record.rationale }}>
                        {record.description || record.rationale || "No description"}
                      </Text>
                    )
                  }
                ]}
              />
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "24px" }}>
              <Text type="secondary">
                {groupLoading ? "Generating group suggestions..." : "No group suggestions yet. Click 'Suggest Groups' to generate suggestions based on your extensions."}
              </Text>
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

