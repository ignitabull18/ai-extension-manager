import React, { useEffect, useState } from "react"
import chromeP from "webext-polyfill-kinda"

import { Button, Card, Checkbox, Input, message, Space, Table, Tag, Typography } from "antd"
import { CheckOutlined, FolderAddOutlined } from "@ant-design/icons"

import { sendMessage } from ".../utils/messageHelper"

const { Text } = Typography

export default function SmartGroupSection() {
  const [suggestedGroups, setSuggestedGroups] = useState([])
  const [groupLoading, setGroupLoading] = useState(false)
  const [onlyEnabled, setOnlyEnabled] = useState(false)
  const [onlyUngrouped, setOnlyUngrouped] = useState(true)
  const [editingGroupNames, setEditingGroupNames] = useState({})
  const [selectedGroups, setSelectedGroups] = useState(new Set())
  const [expandedRows, setExpandedRows] = useState(new Set())
  const [extensionMap, setExtensionMap] = useState(new Map())

  useEffect(() => {
    loadExtensionMap()
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

  const handleSuggestGroups = async () => {
    setGroupLoading(true)

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
      }
    } catch (error) {
      console.error("[AI] Failed to suggest groups", error)
      message.error("Failed to suggest groups: " + (error?.message || String(error)))
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
              <Button
                onClick={() => {
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
                                <Tag key={idx} color="blue">
                                  {name}
                                </Tag>
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
                        {editedName !== undefined && editedName !== record.name && <Tag color="blue">Edited</Tag>}
                      </Space>
                    )
                  }
                },
                {
                  title: "Extensions",
                  render: (_, record) => <Tag>{record.extensionIds.length} extensions</Tag>
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
              {groupLoading
                ? "Generating group suggestions..."
                : "No group suggestions yet. Click 'Suggest Groups' to generate suggestions based on your extensions."}
            </Text>
          </div>
        )}
      </Space>
    </Card>
  )
}

