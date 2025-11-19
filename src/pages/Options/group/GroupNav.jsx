import React, { useEffect, useState } from "react"

import { DeleteFilled, EditFilled, PlusOutlined, ThunderboltOutlined } from "@ant-design/icons"
import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Popconfirm, message, Tag } from "antd"
import classNames from "classnames"

import { storage } from ".../storage/sync"
import { getLang } from "../../../utils/utils"
import { GroupNavStyle } from "./GroupNavStyle"
import { AddNewNavItem } from "./helpers"

function GroupNav({
  groupInfo,
  current,
  onSelectedChanged,
  onGroupItemDeleted,
  onGroupItemEdit,
  onGroupOrdered
}) {
  const [messageApi, contextHolder] = message.useMessage()

  const [groupItems, setGroupItems] = useState([])

  // 初始化
  useEffect(() => {
    let showGroupItems = []

    const hiddenGroup = groupInfo.find((g) => g.id === "hidden")
    if (hiddenGroup) {
      hiddenGroup.name = getLang("group_hidden_name")
      hiddenGroup.desc = getLang("group_hidden_desc")
    }
    const fixedGroup = groupInfo.find((g) => g.id === "fixed")
    if (fixedGroup) {
      fixedGroup.name = getLang("group_fixed_name")
      fixedGroup.desc = getLang("group_fixed_desc")
    }

    showGroupItems = groupInfo.filter(Boolean)

    setGroupItems(showGroupItems)
  }, [groupInfo])

  const onGroupTabClick = (e, item) => {
    onSelectedChanged?.(item)
  }

  const onAddNewGroupClick = (e) => {
    onSelectedChanged?.(AddNewNavItem)
  }

  const onEditGroupClick = (e, group) => {
    e.stopPropagation()
    if (storage.helper.isSpecialGroup(group)) {
      messageApi.warning(getLang("group_inner_cannot_edit"))
      return
    }
    onGroupItemEdit?.(group)
  }

  function selectFirstGroupTab(except) {
    if (!groupInfo) {
      onSelectedChanged?.()
      return
    }

    // 没有排除项，则指定为第一个
    if (!except && groupInfo[0]) {
      onSelectedChanged?.(groupInfo[0])
      return
    }

    // 有排除项，则选择排除项之外的第一个
    if (except) {
      const one = groupInfo.filter((g) => g.id !== except.id)[0]
      if (one) {
        onSelectedChanged?.(one)
        return
      }
    }
    onSelectedChanged?.()
  }

  const onDeleteGroupClick = async (e, group) => {
    e.stopPropagation()

    if (storage.helper.isSpecialGroup(group)) {
      messageApi.warning(getLang("group_inner_cannot_delete"))
      return
    }

    await storage.group.deleteGroup(group.id)
    if (group.id === current?.id) {
      selectFirstGroupTab(group)
    }

    onGroupItemDeleted?.(group)

    messageApi.info(`delete ${group.name}`)
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleDragEnd = (event) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    // Prevent dragging fixed group
    if (active.id === "fixed" || over.id === "fixed") {
      return
    }

    const oldIndex = groupItems.findIndex((item) => item.id === active.id)
    const newIndex = groupItems.findIndex((item) => item.id === over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      const updatedList = arrayMove(groupItems, oldIndex, newIndex)
      setGroupItems(updatedList)
      onGroupOrdered?.(updatedList)
    }
  }

  // Sortable Group Item Component
  const SortableGroupItem = ({ group }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: group.id,
      disabled: group.id === "fixed" || storage.helper.isSpecialGroup(group)
    })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1
    }

    return (
      <div className="item-container" ref={setNodeRef} style={style}>
        <div onClick={(e) => onGroupTabClick(e, group)}>
          <div
            className={classNames([
              "tab-container",
              { "selected-group-item": group.id === current?.id }
            ])}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3>{group.name}</h3>
              {group.isMutex && (
                <Tag color="purple" icon={<ThunderboltOutlined />} style={{ marginLeft: 8 }}>
                  {getLang("group_mutex") || "Mutex"}
                </Tag>
              )}
              {group.alwaysOn && (
                <Tag color="orange" icon={<ThunderboltOutlined />} title={getLang("group_always_on") || "Always On"}>
                  {getLang("group_always_on") || "Always On"}
                </Tag>
              )}
            </div>

            {storage.helper.isSpecialGroup(group) || (
              <div className="tab-operation">
                <EditFilled
                  onClick={(e) => onEditGroupClick(e, group)}
                  className="tab-operation-item"
                />

                <Popconfirm
                  className="tab-operation-item"
                  title={getLang("group_delete_title")}
                  description={getLang("group_delete_confirm", group.name)}
                  onConfirm={(e) => onDeleteGroupClick(e, group)}
                  onCancel={(e) => e.stopPropagation()}
                  okText="Yes"
                  cancelText="Cancel"
                  onClick={(e) => e.stopPropagation()}>
                  <DeleteFilled />
                </Popconfirm>
              </div>
            )}
          </div>
        </div>
        {!storage.helper.isSpecialGroup(group) && group.id !== "fixed" && (
          <div className="drag-handle" {...attributes} {...listeners}>
            <svg viewBox="0 0 20 20" width="12">
              <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"></path>
            </svg>
          </div>
        )}
      </div>
    )
  }

  // 单个 Group Item 的显示
  const buildGroupItemView = (group) => {
    return <SortableGroupItem key={group.id} group={group} />
  }

  return (
    <GroupNavStyle>
      {contextHolder}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={groupItems.map((g) => g.id)}>
          <div>
            {groupItems.map((group) => buildGroupItemView(group))}
          </div>
        </SortableContext>
      </DndContext>

      <div
        className={classNames([
          "tab-container",
          "add-new-group",
          {
            "selected-group-item": current?.id === AddNewNavItem.id
          }
        ])}
        onClick={(e) => onAddNewGroupClick(e)}>
        <PlusOutlined />
      </div>
    </GroupNavStyle>
  )
}

export default GroupNav
