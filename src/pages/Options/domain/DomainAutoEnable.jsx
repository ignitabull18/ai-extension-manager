import React, { useEffect, useState } from "react"

import { Button, Card, message, Select, Space, Switch, Table, Tag, Input, Modal, Form } from "antd"
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined } from "@ant-design/icons"
import chromeP from "webext-polyfill-kinda"

import storage from ".../storage/sync"
import { filterExtensions, isExtExtension, appendAdditionInfo } from ".../utils/extensionHelper"
import { getLang } from ".../utils/utils"
import Title from "../Title.jsx"

const { Option } = Select
const { TextArea } = Input

function DomainAutoEnable() {
  const [domainRules, setDomainRules] = useState([])
  const [extensions, setExtensions] = useState([])
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [editingRule, setEditingRule] = useState(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const rules = await storage.domainRule.get()
    setDomainRules(rules)

    const allExts = await chromeP.management.getAll()
    const filtered = filterExtensions(allExts, isExtExtension)
    const manageOptions = await storage.management.get()
    appendAdditionInfo(filtered, manageOptions)
    setExtensions(filtered)
  }

  const handleAdd = () => {
    setEditingRule(null)
    form.resetFields()
    setIsModalVisible(true)
  }

  const handleEdit = (rule) => {
    setEditingRule(rule)
    // Extract domain patterns from rule
    const urlTrigger = rule.match?.triggers?.find((t) => t.trigger === "urlTrigger")
    const urlConfig = urlTrigger?.config || {}
    const patterns = urlConfig.matchUrl || []
    const matchMethod = urlConfig.matchMethod || "wildcard"
    const extensions = rule.target?.extensions || []
    const overrideMode = rule.overrideMode || "soft"
    const enable = rule.enable !== false

    form.setFieldsValue({
      patterns: patterns.join("\n"),
      matchMethod,
      extensions,
      overrideMode,
      enable
    })
    setIsModalVisible(true)
  }

  const handleDelete = async (id) => {
    Modal.confirm({
      title: getLang("delete") || "Delete",
      content: getLang("domain_rule_delete_confirm") || "Are you sure you want to delete this domain rule?",
      onOk: async () => {
        await storage.domainRule.deleteOne(id)
        loadData()
        message.success(getLang("domain_rule_deleted") || "Domain rule deleted")
      }
    })
  }

  const handleCopyCurrentDomain = async () => {
    try {
      const tabs = await chromeP.tabs.query({ active: true, currentWindow: true })
      if (tabs[0]?.url) {
        const url = new URL(tabs[0].url)
        const domain = url.hostname
        const currentPatterns = form.getFieldValue("patterns") || ""
        form.setFieldsValue({
          patterns: currentPatterns ? `${currentPatterns}\n*${domain}*` : `*${domain}*`
        })
        message.success(getLang("domain_rule_domain_copied") || "Domain copied")
      }
    } catch (err) {
      message.error(getLang("domain_rule_copy_failed") || "Failed to copy domain")
    }
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const patterns = values.patterns
        .split("\n")
        .map((p) => p.trim())
        .filter((p) => p.length > 0)

      if (patterns.length === 0) {
        message.error(getLang("domain_rule_patterns_required") || "At least one domain pattern is required")
        return
      }

      if (!values.extensions || values.extensions.length === 0) {
        message.error(getLang("domain_rule_extensions_required") || "At least one extension is required")
        return
      }

      const rule = {
        id: editingRule?.id,
        version: 2,
        enable: values.enable !== false,
        source: "domainAuto",
        overrideMode: values.overrideMode || "soft",
        match: {
          relationship: "and",
          triggers: [
            {
              trigger: "urlTrigger",
              config: {
                matchMethod: values.matchMethod || "wildcard",
                matchUrl: patterns,
                useFullUrl: false
              }
            }
          ]
        },
        target: {
          groups: [],
          extensions: values.extensions || []
        },
        action: {
          actionType: "openWhenMatched"
        }
      }

      if (editingRule) {
        await storage.domainRule.update(rule)
        message.success(getLang("domain_rule_updated") || "Domain rule updated")
      } else {
        await storage.domainRule.addOne(rule)
        message.success(getLang("domain_rule_added") || "Domain rule added")
      }

      setIsModalVisible(false)
      loadData()
    } catch (error) {
      console.error("Save domain rule error", error)
      message.error(error.message || getLang("domain_rule_save_failed") || "Failed to save domain rule")
    }
  }

  const columns = [
    {
      title: getLang("domain_rule_domains") || "Domains/Patterns",
      dataIndex: "domains",
      key: "domains",
      render: (_, record) => {
        const urlTrigger = record.match?.triggers?.find((t) => t.trigger === "urlTrigger")
        const patterns = urlTrigger?.config?.matchUrl || []
        const matchMethod = urlTrigger?.config?.matchMethod || "wildcard"
        return (
          <div>
            <Tag color={matchMethod === "regex" ? "purple" : "blue"}>{matchMethod}</Tag>
            <span>{patterns.slice(0, 2).join(", ")}</span>
            {patterns.length > 2 && <span>...</span>}
          </div>
        )
      }
    },
    {
      title: getLang("domain_rule_extensions") || "Extensions",
      dataIndex: "extensions",
      key: "extensions",
      render: (_, record) => {
        const extIds = record.target?.extensions || []
        return <span>{extIds.length} {getLang("domain_rule_extensions_count") || "extensions"}</span>
      }
    },
    {
      title: getLang("domain_rule_override") || "Override",
      dataIndex: "overrideMode",
      key: "overrideMode",
      render: (_, record) => {
        const mode = record.overrideMode || "soft"
        return <Tag color={mode === "override" ? "red" : "default"}>{mode}</Tag>
      }
    },
    {
      title: getLang("domain_rule_enabled") || "Enabled",
      dataIndex: "enable",
      key: "enable",
      render: (_, record) => (record.enable !== false ? "Yes" : "No")
    },
    {
      title: getLang("operation") || "Operation",
      key: "operation",
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small">
            {getLang("edit") || "Edit"}
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
            size="small">
            {getLang("delete") || "Delete"}
          </Button>
        </Space>
      )
    }
  ]

  return (
    <div style={{ padding: "20px" }}>
      <Title title={getLang("domain_auto_enable_title") || "Domain Auto-Enable"} />
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            {getLang("domain_rule_add") || "Add Domain Rule"}
          </Button>
        </div>
        <div style={{ marginBottom: 16, color: "#666", fontSize: "14px" }}>
          {getLang("domain_auto_enable_description") ||
            "Configure extensions to automatically enable when visiting specific domains. Domain rules work with individual extensions, not groups."}
        </div>
        <Table
          columns={columns}
          dataSource={domainRules}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingRule ? getLang("domain_rule_edit") || "Edit Domain Rule" : getLang("domain_rule_add") || "Add Domain Rule"}
        open={isModalVisible}
        onOk={handleSave}
        onCancel={() => setIsModalVisible(false)}
        width={800}
        okText={getLang("save") || "Save"}
        cancelText={getLang("cancel") || "Cancel"}>
        <Form form={form} layout="vertical">
          <Form.Item
            label={getLang("domain_rule_patterns") || "Domain/URL Patterns"}
            name="patterns"
            rules={[{ required: true, message: getLang("domain_rule_patterns_required") || "Patterns required" }]}
            extra={
              <div>
                <Button
                  type="link"
                  icon={<CopyOutlined />}
                  onClick={handleCopyCurrentDomain}
                  size="small">
                  {getLang("domain_rule_copy_current_domain") || "Copy Current Tab Domain"}
                </Button>
                <div style={{ marginTop: 4, fontSize: "12px", color: "#999" }}>
                  {getLang("domain_rule_patterns_help") ||
                    "One pattern per line. Use wildcard (*) or regex. Example: *example.com*, *github.com/*"}
                </div>
              </div>
            }>
            <TextArea rows={4} placeholder="*example.com*&#10;*github.com/*" />
          </Form.Item>

          <Form.Item
            label={getLang("domain_rule_match_method") || "Match Method"}
            name="matchMethod"
            rules={[{ required: true }]}>
            <Select>
              <Option value="wildcard">{getLang("domain_rule_wildcard") || "Wildcard"}</Option>
              <Option value="regex">{getLang("domain_rule_regex") || "Regex"}</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label={getLang("domain_rule_extensions") || "Extensions to Auto-Enable"}
            name="extensions"
            rules={[{ required: true, message: getLang("domain_rule_extensions_required") || "At least one extension required" }]}>
            <Select
              mode="multiple"
              placeholder={getLang("domain_rule_select_extensions") || "Select extensions"}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
              }
              style={{ width: "100%" }}>
              {extensions.map((ext) => {
                const displayName = ext.__attach__?.alias || ext.name
                return (
                  <Option key={ext.id} value={ext.id} label={displayName}>
                    {displayName}
                  </Option>
                )
              })}
            </Select>
          </Form.Item>

          <Form.Item
            label={getLang("domain_rule_override_mode") || "Override Mode"}
            name="overrideMode"
            extra={
              <div style={{ fontSize: "12px", color: "#999" }}>
                {getLang("domain_rule_override_help") ||
                  "Override: Domain rule wins over other rules. Soft: Domain rule works alongside other rules."}
              </div>
            }>
            <Select>
              <Option value="soft">{getLang("domain_rule_soft") || "Soft (Default Priority)"}</Option>
              <Option value="override">{getLang("domain_rule_override") || "Override (Higher Priority)"}</Option>
            </Select>
          </Form.Item>

          <Form.Item label={getLang("domain_rule_enabled") || "Enabled"} name="enable" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default DomainAutoEnable

