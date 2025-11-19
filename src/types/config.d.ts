declare namespace config {
  export interface ISetting {
    isShowApp: boolean
    isShowItemOperationAlways: boolean
    isShowSearchBarDefault: boolean
    isRaiseEnableWhenSwitchGroup: boolean
    isShowFixedExtension: boolean
    isShowHiddenExtension: boolean
  }

  export interface IScene {
    /**
     * 场景ID
     */
    id: string
    name: string
  }

  export interface IGroup {
    name: string
    desc: string
    id: string
    extensions: string[]
    /** If true, extensions in this group are default-enabled on startup and context changes */
    alwaysOn?: boolean
    /** If true, only one extension in this group can be enabled at a time (mutual exclusion) */
    isMutex?: boolean
  }

  export interface IManagement {
    extensions: IExtensionAttachInfo[]
  }

  export interface IExtensionAttachInfo {
    extId: string
    alias: string
    remark: string
    update_time: number
  }
}
