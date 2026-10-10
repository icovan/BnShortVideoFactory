/// <reference types="vite-plugin-electron/electron-env" />

declare const __BN_COMMERCE_URL__: string

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * 已构建的目录结构
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// 在渲染器进程中使用，在 `preload.ts` 中暴露方法
interface Window {
  ipcRenderer: Pick<import('electron').IpcRenderer, 'on' | 'once' | 'off' | 'send' | 'invoke'>
  i18n: {
    getLocalesPath: () => Promise<string>
    getLanguage: () => Promise<string>
    changeLanguage: (lng: string) => Promise<string>
  }
  electron: {
    platform: NodeJS.Platform
    isWinMaxed: () => Promise<boolean>
    winMin: () => void
    winMax: () => void
    winClose: () => void
    toggleWindowMaximize: () => void
    prepareWindowDrag: () => Promise<{
      bounds: import('electron').Rectangle
      wasMaximized: boolean
    } | null>
    getWindowBounds: () => Promise<import('electron').Rectangle | undefined>
    setWindowPosition: (x: number, y: number) => void
    setZoomFactor: (factor: number) => void
    openExternal: (params: import('./types').OpenExternalParams) => Promise<void>
    selectFolder: (params: import('./types').SelectFolderParams) => Promise<string>
    listFilesFromFolder: (
      params: import('./types').ListFilesFromFolderParams,
    ) => Promise<import('./types').ListFilesFromFolderRecord[]>
    edgeTtsGetVoiceList: () => Promise<import('./lib/edge-tts').EdgeTTSVoice[]>
    edgeTtsSynthesizeToBase64: (
      params: import('./tts/types').EdgeTtsSynthesizeCommonParams,
    ) => Promise<string>
    edgeTtsSynthesizeToFile: (
      params: import('./tts/types').EdgeTtsSynthesizeToFileParams,
    ) => Promise<import('./tts/types').EdgeTtsSynthesizeToFileResult>
    renderVideo: (
      params: import('./ffmpeg/types').RenderVideoParams,
    ) => Promise<import('./ffmpeg/types').ExecuteFFmpegResult>
    statTrack: (params: import('./types').StatEventParams) => Promise<void>
    checkForUpdates: () => Promise<import('./updater').UpdateCheckResult>
    exportDiagnostics: () => Promise<string | null>
    log: (level: import('./logger').AppLogLevel, ...args: unknown[]) => void
    engineGetState: () => Promise<import('./engine/runtime').EngineRuntimeState>
    engineEnsure: () => Promise<import('./engine/runtime').EngineRuntimeState>
    engineProbe: () => Promise<import('./engine/runtime').EngineRuntimeState>
    engineInstallDeps: () => Promise<{
      ok: boolean
      error?: string
      status: import('./engine/deps').EngineDepsStatus
    }>
    skillsProbe: () => Promise<import('./skills-pack').SkillsPackStatus>
    skillsImport: () => Promise<import('./skills-pack').SkillsPackStatus>
    engineHttp: (params: {
      path: string
      method?: string
      headers?: Record<string, string>
      body?: string | null
    }) => Promise<{ status: number; headers: Record<string, string>; body: string }>
  }
  sqlite: {
    query: (param: import('./sqlite/types').QueryParams) => Promise<any>
    insert: (param: import('./sqlite/types').InsertParams) => Promise<number>
    update: (param: import('./sqlite/types').UpdateParams) => Promise<number>
    delete: (param: import('./sqlite/types').DeleteParams) => Promise<void>
    bulkInsertOrUpdate: (param: import('./sqlite/types').BulkInsertOrUpdateParams) => Promise<void>
  }
}
