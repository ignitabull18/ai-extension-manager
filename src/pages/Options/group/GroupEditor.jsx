import React, { useEffect, useState } from "react"

import { Button, Form, Input, message, Switch } from "antd"

import { storage } from ".../storage/sync"
import { getLang, isStringEmpty } from ".../utils/utils"
import ModalEditorWrapper from "../utils/ModalEditorWrapper"
import { AddNewNavItem } from "./helpers"

const { TextArea } = Input

function GroupEditor({ editType, groupInfo, editCallback }) {
  const [messageApi, contextHolder] = message.useMessage()

  const [name, setGroupName] = useState("")
  const [desc, setGroupDesc] = useState("")
  const [alwaysOn, setAlwaysOn] = useState(false)
  const [isMutex, setIsMutex] = useState(false)

  let title = ""
  if (editType === "new") {
    title = getLang("group_new")
  } else if (editType === "edit") {
    title = getLang("group_edit")
  }

  useEffect(() => {
    if (editType === "edit") {
      setGroupName(groupInfo.name)
      setGroupDesc(groupInfo.desc)
      setAlwaysOn(groupInfo.alwaysOn === true)
      setIsMutex(groupInfo.isMutex === true)
    } else {
      setGroupName("")
      setGroupDesc("")
      setAlwaysOn(false)
      setIsMutex(false)
    }
  }, [editType, groupInfo])

  const onNameChanged = (e) => {
    console.log(e)
    setGroupName(e.target.value)
  }
  const onDescChanged = (e) => {
    setGroupDesc(e.target.value)
  }

  const onSummitClick = async (e) => {
    if (isStringEmpty(name)) {
      messageApi.warning(getLang("group_name_cannot_empty"))
      return
    }

    try {
      if (editType === "new") {
        const group = {
          name,
          desc,
          alwaysOn,
          isMutex
        }
        await storage.group.addGroup(group)
        setGroupName("")
        setGroupDesc("")
        setAlwaysOn(false)
        setIsMutex(false)
        editCallback?.(editType, group)
      } else if (editType === "edit") {
        let info = groupInfo ?? {}
        info = { ...info }
        Object.assign(info, { name, desc, alwaysOn, isMutex })
        await storage.group.update(info)
        editCallback?.(editType, info)
      }
    } catch (error) {
      messageApi.error(error.message)
    }
  }

  const onCancelClick = (e) => {
    if (editType === "new") {
      editCallback?.("cancel", AddNewNavItem)
    } else {
      editCallback?.("cancel", groupInfo)
    }
  }

  return (
    <ModalEditorWrapper title={title}>
      {contextHolder}
      <Form labelCol={{ span: 4 }}>
        <Form.Item label={getLang("group_name")}>
          <Input maxLength={50} value={name} onChange={(e) => onNameChanged(e)} />
        </Form.Item>
        <Form.Item label={getLang("group_desc")}>
          <TextArea
            rows={3}
            showCount
            maxLength={200}
            value={desc}
            onChange={(e) => onDescChanged(e)}
          />
        </Form.Item>
        <Form.Item label={getLang("group_always_on") || "Always On"}>
          <Switch
            checked={alwaysOn}
            onChange={(checked) => setAlwaysOn(checked)}
          />
          <div style={{ marginTop: 4, fontSize: "12px", color: "#999" }}>
            {getLang("group_always_on_help") ||
              "Extensions in this group will be default-enabled on startup and context changes, but can still be disabled by rules."}
          </div>
        </Form.Item>
        <Form.Item label={getLang("group_mutex") || "Mutual Exclusion"}>
          <Switch
            checked={isMutex}
            onChange={(checked) => setIsMutex(checked)}
          />
          <div style={{ marginTop: 4, fontSize: "12px", color: "#999" }}>
            {getLang("group_mutex_help") ||
              "Only one extension in this group can be enabled at a time. Enabling one will automatically disable others."}
          </div>
        </Form.Item>
        <Form.Item wrapperCol={{ offset: 4, span: 4 }}>
          <div style={{ display: "flex" }}>
            <Button type="primary" onClick={(e) => onSummitClick(e)}>
              {editType === "new" ? getLang("add") : getLang("update")}
            </Button>
            <Button style={{ marginLeft: 10 }} onClick={(e) => onCancelClick(e)}>
              {getLang("cancel")}
            </Button>
          </div>
        </Form.Item>
      </Form>
    </ModalEditorWrapper>
  )
}

export default GroupEditor
