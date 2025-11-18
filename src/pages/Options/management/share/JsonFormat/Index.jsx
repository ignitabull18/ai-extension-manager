import React, { forwardRef, lazy, memo, Suspense, useEffect, useImperativeHandle, useState } from "react"

import { Input, Spin } from "antd"
import styled from "styled-components"

const { TextArea } = Input

// Lazy load JsonView component and its utilities
const JsonViewLazy = lazy(async () => {
  const [module, css] = await Promise.all([
    import("react-json-view-lite"),
    import("react-json-view-lite/dist/index.css")
  ])
  return { default: module.JsonView }
})

// Pre-load utilities (they're small)
let jsonViewUtils = null
const getJsonViewUtils = async () => {
  if (!jsonViewUtils) {
    const module = await import("react-json-view-lite")
    jsonViewUtils = {
      allExpanded: module.allExpanded,
      defaultStyles: module.defaultStyles
    }
  }
  return jsonViewUtils
}
// exportRange: ["alias", "remark"]

const Index = ({ extensions, options, exportRange, targetExtensionIds }, ref) => {
  const [records, setRecords] = useState([])
  const [jsonViewUtils, setJsonViewUtils] = useState(null)

  useImperativeHandle(ref, () => ({
    getValue: () => {
      if (records.length === 0) {
        return ""
      }
      return JSON.stringify(records, null, 2)
    }
  }))

  useEffect(() => {
    getJsonViewUtils().then(setJsonViewUtils)
  }, [])

  useEffect(() => {
    if (!extensions || extensions.length === 0) {
      return
    }

    setRecords(
      extensions
        .filter((ext) => targetExtensionIds.includes(ext.id))
        .map((ext) => {
          const result = {
            id: ext.id,
            name: ext.name,
            description: ext.description,
            version: ext.version,
            homepageUrl: ext.homepageUrl,
            channel: ext.channel,
            type: ext.type
          }
          if (ext.webStoreUrl) {
            result.webStoreUrl = ext.webStoreUrl
          }
          if (ext.alias && exportRange.includes("alias")) {
            result.alias = ext.alias
          }
          if (ext.remark && exportRange.includes("remark")) {
            result.remark = ext.remark
          }
          return result
        })
    )
  }, [extensions, exportRange, targetExtensionIds])

  if (!options) {
    return null
  }

  if (!jsonViewUtils) {
    return (
      <Style>
        <Spin style={{ display: "block", textAlign: "center", padding: "20px" }} />
      </Style>
    )
  }

  return (
    <Style>
      <Suspense fallback={<Spin style={{ display: "block", textAlign: "center", padding: "20px" }} />}>
        <JsonViewLazy
          style={{
            ...jsonViewUtils.defaultStyles,
            container: "json-view-container",
            undefinedValue: "json-view-undefined"
          }}
          data={records}
          shouldExpandNode={jsonViewUtils.allExpanded}
        />
      </Suspense>
    </Style>
  )
}

export default memo(forwardRef(Index))

const Style = styled.div`
  .json-view-container {
    height: 320px;

    margin: 12px 0;
    padding: 8px 0;
    border: 1px solid #eee;
    border-radius: 4px;

    font-family: "Courier New", Courier, monospace;

    & > div {
      height: 100%;
      overflow-y: scroll;
    }
  }
`
