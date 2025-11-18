import React, { memo, useCallback, useEffect, useState } from "react"

import { QuestionCircleOutlined } from "@ant-design/icons"
import { Button, Modal, Popconfirm, Radio, Slider, Switch, Tooltip, message, Descriptions } from "antd"

import storage from ".../storage/sync"
import { getLang } from ".../utils/utils"
import Title from "../Title.jsx"
import { exportConfig, importConfig, previewImport, IImportPreview } from "./ConfigFileBackup.ts"
import { SettingStyle } from "./SettingStyle.js"
import ContentViewSetting from "./components/ContentViewSetting.jsx"
import FunctionSetting from "./components/FunctionSetting.jsx"
import GroupAndSortSetting from "./components/GroupAndSortSetting.jsx"
import SearchSetting from "./components/SearchSetting.jsx"
import ViewOtherSetting from "./components/ViewOtherSetting.jsx"

function Settings() {
  const [setting, setSetting] = useState({})

  const [messageApi, contextHolder] = message.useMessage()

  // 初始化，从配置中读取设置
  useEffect(() => {
    storage.options.getAll().then((options) => {
      setSetting(options.setting)
    })
  }, [])

  // 选项变化时调用，用于保存配置
  const onSettingChange = useCallback((value, settingHandler, optionKey) => {
    // 更新 UI 上选项的值（受控组件）
    settingHandler?.(value)
    storage.options.getAll().then((options) => {
      // 将新配置，合并到已经存在的 setting中，然后更新到 storage 中
      const setting = { ...options.setting, [optionKey]: value }
      storage.options.set({ setting: setting })
    })
  }, [])

  const [importPreview, setImportPreview] = useState<IImportPreview | null>(null)
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [importOverwrite, setImportOverwrite] = useState(false)

  const onPreviewImport = async () => {
    const preview = await previewImport()
    if (preview) {
      setImportPreview(preview)
      setImportModalVisible(true)
    } else {
      messageApi.error(getLang("setting_import_invalid") || "Invalid configuration file")
    }
  }

  const onImportConfig = async (overwrite: boolean = false) => {
    setImportModalVisible(false)
    if (await importConfig(overwrite)) {
      messageApi.open({
        type: "success",
        content: getLang("setting_import_finish")
      })
      storage.options.getAll().then((options) => {
        setSetting(options.setting)
      })
    } else {
      messageApi.open({
        type: "error",
        content: getLang("setting_import_fail")
      })
    }
    setImportPreview(null)
  }

  const onExportConfig = () => {
    exportConfig()
  }

  /**
   * 恢复默认，将通用设置恢复成默认配置
   */
  const onRestoreDefault = () => {
    storage.options.set({ setting: {} })
    setSetting({})
  }

  /**
   * 清空所有配置
   */
  const onClearAllOptions = async () => {
    await chrome.storage.sync.clear()
    chrome.tabs.reload()
  }

  return (
    <SettingStyle>
      {contextHolder}
      <Title title={getLang("setting_title")}></Title>

      <h2 className="setting-sub-title">{getLang("setting_popup_ui_setting")}</h2>

      {/* 搜索 */}
      <h3 className="setting-space-title">{getLang("setting_popup_setting_search")}</h3>
      <div className="container">
        <SearchSetting setting={setting} onSettingChange={onSettingChange}></SearchSetting>
      </div>

      {/* 内容显示 */}
      <h3 className="setting-space-title">{getLang("setting_popup_setting_display")}</h3>
      <div className="container">
        <ContentViewSetting
          setting={setting}
          onSettingChange={onSettingChange}></ContentViewSetting>
      </div>

      {/* 分组与排序 */}
      <h3 className="setting-space-title">{getLang("setting_popup_setting_group_sort")}</h3>
      <div className="container">
        <GroupAndSortSetting
          setting={setting}
          onSettingChange={onSettingChange}></GroupAndSortSetting>
      </div>

      {/* 其它 */}
      <h3 className="setting-space-title">{getLang("setting_popup_setting_other")}</h3>
      <div className="container">
        <ViewOtherSetting setting={setting} onSettingChange={onSettingChange}></ViewOtherSetting>
      </div>

      <h2 className="setting-sub-title">{getLang("setting_popup_function_setting")}</h2>

      <div className="container">
        <FunctionSetting setting={setting} onSettingChange={onSettingChange}></FunctionSetting>
      </div>

      <div className="import-export-container">
        <Button onClick={onPreviewImport}>{getLang("setting_import_config")}</Button>
        <Button onClick={onExportConfig}>{getLang("setting_export_config")}</Button>
        <Tooltip placement="top" title={getLang("setting_restore_default_tip")}>
          <Button onClick={onRestoreDefault}>{getLang("setting_restore_default")}</Button>
        </Tooltip>

        <Popconfirm
          title={getLang("setting_clear_confirm_title")}
          description={getLang("setting_clear_confirm_content")}
          onConfirm={onClearAllOptions}
          onCancel={(e) => e.stopPropagation()}
          okText="Yes"
          cancelText="Cancel"
          onClick={(e) => e.stopPropagation()}>
          <Button danger>{getLang("setting_clear_title")}</Button>
        </Popconfirm>
      </div>

      <Modal
        title={getLang("setting_import_preview") || "Import Preview"}
        open={importModalVisible}
        onOk={() => onImportConfig(importOverwrite)}
        onCancel={() => {
          setImportModalVisible(false)
          setImportPreview(null)
        }}
        okText={getLang("setting_import_confirm") || "Import"}
        cancelText={getLang("cancel") || "Cancel"}
        width={600}>
        {importPreview && (
          <div>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label={getLang("setting_import_version") || "Config Version"}>
                {importPreview.version}
                {importPreview.extensionVersion && ` (Extension ${importPreview.extensionVersion})`}
              </Descriptions.Item>
              <Descriptions.Item label={getLang("setting_import_settings") || "Settings"}>
                {importPreview.settings ? getLang("yes") || "Yes" : getLang("no") || "No"}
              </Descriptions.Item>
              <Descriptions.Item label={getLang("setting_import_groups") || "Groups"}>
                {importPreview.groupsCount} {importPreview.willOverwrite.groups > 0 && `(${importPreview.willOverwrite.groups} will overwrite)`}
              </Descriptions.Item>
              <Descriptions.Item label={getLang("setting_import_scenes") || "Scenes"}>
                {importPreview.scenesCount} {importPreview.willOverwrite.scenes > 0 && `(${importPreview.willOverwrite.scenes} will overwrite)`}
              </Descriptions.Item>
              <Descriptions.Item label={getLang("setting_import_rules") || "Rules"}>
                {importPreview.rulesCount} {importPreview.willOverwrite.rules > 0 && `(${importPreview.willOverwrite.rules} will overwrite)`}
              </Descriptions.Item>
              <Descriptions.Item label={getLang("setting_import_domain_rules") || "Domain Rules"}>
                {importPreview.domainRulesCount} {importPreview.willOverwrite.domainRules > 0 && `(${importPreview.willOverwrite.domainRules} will overwrite)`}
              </Descriptions.Item>
              <Descriptions.Item label={getLang("setting_import_extensions") || "Extension Metadata"}>
                {importPreview.managementExtensionsCount}
              </Descriptions.Item>
              <Descriptions.Item label={getLang("setting_import_extension_list") || "Extensions List"}>
                {importPreview.extensionsCount} {getLang("setting_import_extensions_exported") || "extensions exported"}
              </Descriptions.Item>
              {importPreview.missingExtensions.length > 0 && (
                <Descriptions.Item label={getLang("setting_import_missing_extensions") || "Missing Extensions"}>
                  <div style={{ color: "#ff4d4f" }}>
                    {importPreview.missingExtensions.length} {getLang("setting_import_extensions_not_found") || "extensions referenced but not found"}
                    <div style={{ fontSize: "12px", marginTop: "4px", maxHeight: "100px", overflowY: "auto" }}>
                      {importPreview.missingExtensions.slice(0, 10).join(", ")}
                      {importPreview.missingExtensions.length > 10 && "..."}
                    </div>
                  </div>
                </Descriptions.Item>
              )}
            </Descriptions>
            <div style={{ marginTop: 16 }}>
              <Radio.Group
                value={importOverwrite}
                onChange={(e) => setImportOverwrite(e.target.value)}>
                <Radio value={false}>
                  {getLang("setting_import_merge") || "Merge (skip existing items)"}
                </Radio>
                <Radio value={true}>
                  {getLang("setting_import_overwrite") || "Overwrite (replace existing items)"}
                </Radio>
              </Radio.Group>
            </div>
          </div>
        )}
      </Modal>
    </SettingStyle>
  )
}

export default memo(Settings)
