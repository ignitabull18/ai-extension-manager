import React, { Suspense, lazy } from "react"
import { Navigate, Route, Routes } from "react-router-dom"

import { ConfigProvider, Spin } from "antd"

import "./Options.css"
import "./index.css"

import About from "./about/About.jsx"
import GroupManagement from "./group/IndexGroup.jsx"
import Navigation from "./navigation/Navigation.jsx"
import Scene from "./scene/IndexScene.jsx"
import Settings from "./settings/Settings.jsx"

// Lazy load heavy routes
const AIProfiles = lazy(() => import("./ai/AIProfiles.jsx"))
const ExtensionHistoryIndex = lazy(() => import("./history/ExtensionHistoryIndex"))
const ExtensionManageIndex = lazy(() => import("./management/ExtensionManageIndex.jsx"))
const ExtensionManageTable = lazy(() => import("./management/ExtensionManageTable"))
const ExtensionImport = lazy(() => import("./management/import/ExtensionImport"))
const ExtensionShare = lazy(() => import("./management/share/ExtensionShare"))
const RuleSetting = lazy(() => import("./rule/RuleSetting.jsx"))

function Options() {
  return (
    <div className="option-container">
      <div className="option-nav">
        <Navigation></Navigation>
      </div>

      <div className="option-content">
        <ConfigProvider
          theme={{
            token: {
              colorPrimary: "#337ab7"
            }
          }}>
          <Suspense
            fallback={
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
                <Spin size="large" />
              </div>
            }>
            <Routes>
              <Route path="/" element={<Navigate to="/about" replace />}></Route>
              <Route path="/about" element={<About />} />
              <Route path="/setting" element={<Settings />} />
              <Route path="/scene" element={<Scene />} />
              <Route path="/group" element={<GroupManagement />} />
              <Route path="/management" element={<ExtensionManageIndex />}>
                <Route index element={<ExtensionManageTable />} />
                <Route path="share" element={<ExtensionShare />} />
                <Route path="import" element={<ExtensionImport />} />
              </Route>
              <Route path="/rule" element={<RuleSetting />} />
              <Route path="/history" element={<ExtensionHistoryIndex />} />
              <Route path="/ai" element={<AIProfiles />} />
            </Routes>
          </Suspense>
        </ConfigProvider>
      </div>
    </div>
  )
}

export default Options
