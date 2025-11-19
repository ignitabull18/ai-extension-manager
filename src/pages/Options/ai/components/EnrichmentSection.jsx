import React, { useEffect, useState } from "react"
import chromeP from "webext-polyfill-kinda"

import { Button, Card, Checkbox, Input, message, Progress, Space, Table, Tag, Typography } from "antd"
import { ThunderboltOutlined } from "@ant-design/icons"

import { sendMessage } from ".../utils/messageHelper"

const { Text, Paragraph } = Typography

export default function EnrichmentSection() {
  const [enrichmentLoading, setEnrichmentLoading] = useState(false)
  const [enrichmentProgress, setEnrichmentProgress] = useState({ current: 0, total: 0 })
  const [extensionList, setExtensionList] = useState([])
  const [selectedExtensions, setSelectedExtensions] = useState(new Set())
  const [enrichmentStatuses, setEnrichmentStatuses] = useState(new Map())
  const [enrichmentSearchText, setEnrichmentSearchText] = useState("")

  useEffect(() => {
    loadExtensionList()
    loadEnrichmentStatuses()
  }, [])

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
          message.success(`Successfully enriched ${success} extension${success > 1 ? "s" : ""}`)
        }
        if (failed > 0) {
          message.warning(`${failed} extension${failed > 1 ? "s" : ""} failed to enrich`)
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
          message.success(`Successfully enriched ${success} extension${success > 1 ? "s" : ""}`)
        }
        if (failed > 0) {
          message.warning(`${failed} extension${failed > 1 ? "s" : ""} failed to enrich`)
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

  return (
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
                      <Text type="secondary">
                        No enrichment data available yet. Click 'Enrich All' or select this extension and click 'Enrich Selected' to generate AI descriptions.
                      </Text>
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
                                <Tag key={idx} color="green">
                                  {useCase}
                                </Tag>
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
                                <Tag key={idx} color="blue">
                                  {category}
                                </Tag>
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
                render: (_, record) => <Text>{record.name}</Text>
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
                  return count > 0 ? <Tag>{count} use case{count > 1 ? "s" : ""}</Tag> : <Text type="secondary">-</Text>
                }
              },
              {
                title: "Categories",
                render: (_, record) => {
                  const status = enrichmentStatuses.get(record.id)
                  const count = status?.categories?.length || 0
                  return count > 0 ? <Tag>{count} categor{count > 1 ? "ies" : "y"}</Tag> : <Text type="secondary">-</Text>
                }
              }
            ]}
          />
        </div>
      </Space>
    </Card>
  )
}

