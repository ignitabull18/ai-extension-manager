import React, { useEffect, useState } from "react"

import { Button, Card, Input, List, message, Space, Tag, Typography } from "antd"
import { RobotOutlined, SendOutlined } from "@ant-design/icons"

import { sendMessage } from ".../utils/messageHelper"
import Title from "../Title.jsx"
import EnrichmentSection from "./components/EnrichmentSection"
import SmartGroupSection from "./components/SmartGroupSection"
import AISettings from "./components/AISettings"

const { TextArea } = Input
const { Text } = Typography

function AIProfiles() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [actionPlan, setActionPlan] = useState(null)
  const [recentIntents, setRecentIntents] = useState([])

  useEffect(() => {
    loadRecentIntents()
  }, [])


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

      <EnrichmentSection />

      <SmartGroupSection />

      <AISettings />
    </div>
  )
}

export default AIProfiles

