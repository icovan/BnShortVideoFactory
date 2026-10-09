/** 本仓 packages/create-core（Remotion/Manim）经 Electron IPC 代理 */

export type EngineState = {
  ready: boolean
  url: string
  port: number
  root: string
  error?: string
  pid?: number
}

export type EnginePipelineStep = {
  id: string
  label: string
  status: 'pending' | 'running' | 'done' | 'error'
  detail?: string
}

export type EngineBeat = {
  index: number
  job?: string
  headline?: string
  title?: string
  line?: string
  vo?: string
  narration?: string
  visualIntent?: string
  visual?: string
  keyMotion?: string
  durationSec: number
  startSec?: number
  endSec?: number
  thumbUrl?: string
  stillUrl?: string
  stillPath?: string
}

export type EngineProjectFile = {
  name: string
  rel: string
  kind?: string
}

export type EngineVersion = {
  id: string
  label: string
  createdAt?: string
  beatIndexes?: number[]
  kind?: 'initial' | 'remake'
  remakeIndex?: number
}

export type EngineProject = {
  id: string
  title: string
  prompt: string
  status: 'queued' | 'running' | 'ready' | 'error'
  engine?: string
  stylePack?: string
  aspect?: string
  dir?: string
  durationSec?: number
  error?: string
  pipeline?: EnginePipelineStep[]
  posterUrl?: string
  videoUrl?: string
  videoPath?: string
  beats?: EngineBeat[]
  files?: EngineProjectFile[]
  versions?: EngineVersion[]
  currentVersionId?: string
  /** 0=正在出片；≥1=排队位次 */
  queuePosition?: number
  /** 当前队列等待数 */
  queueWaiting?: number
}

export type EngineQueueSnapshot = {
  concurrency: number
  active: number
  running: string[]
  queued: { id: string; kind: 'make' | 'remake'; position: number }[]
}

export type EngineMyVoice = {
  id: string
  name: string
  provider: 'dashscope' | 'minimax' | 'fish'
  voiceId: string
}

export type EngineSettings = {
  llmBaseUrl: string
  llmApiKey: string
  llmModel: string
  speechProvider: string
  speechVoice: string
  speechModel?: string
  speechApiKey?: string
  speechBaseUrl?: string
  cloneProvider?: string
  cloneApiKey?: string
  cloneBaseUrl?: string
  myVoices?: EngineMyVoice[]
}

export type RemakeMode = 'both' | 'visual' | 'copy'

export type UserAsset = {
  name: string
  dataUrl: string
  kind?: 'image' | 'music' | 'doc'
  role?: 'logo' | 'product' | 'shot' | 'image'
}

export type StyleRefItem = {
  id: string
  name: string
  file: string
  url: string
}

export type StyleLook = {
  canvas?: string
  ink?: string
  accent?: string
  energy?: string
  surface?: string
}

async function req<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const method = (init?.method || 'GET').toUpperCase()
  const body = init?.body != null ? JSON.stringify(init.body) : null
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body != null) headers['Content-Type'] = 'application/json'
  const res = await window.electron.engineHttp({ path, method, headers, body })
  let data: unknown = {}
  try {
    data = res.body ? JSON.parse(res.body) : {}
  } catch {
    data = { raw: res.body }
  }
  if (res.status < 200 || res.status >= 300) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  }
  return data as T
}

export async function engineAssetUrl(relOrAbs: string): Promise<string> {
  if (!relOrAbs) return ''
  if (relOrAbs.startsWith('http') || relOrAbs.startsWith('file:') || relOrAbs.startsWith('data:')) {
    return relOrAbs
  }
  const st = await window.electron.engineGetState()
  const root = (st.url || '').replace(/\/$/, '')
  if (!root) return relOrAbs
  return relOrAbs.startsWith('/') ? `${root}${relOrAbs}` : `${root}/${relOrAbs}`
}

export const engineApi = {
  state: () => window.electron.engineGetState() as Promise<EngineState>,
  ensure: () => window.electron.engineEnsure() as Promise<EngineState>,
  health: () => req<{ ok: boolean; llmConfigured?: boolean }>('/api/health'),
  getSettings: () => req<EngineSettings>('/api/settings'),
  saveSettings: (patch: Partial<EngineSettings>) =>
    req<EngineSettings>('/api/settings', { method: 'PUT', body: patch }),
  optimizePrompt: async (prompt: string, aspect?: string) => {
    const brief = await req<{
      audiencePrompt?: string
      machinePrompt?: string
      prompt?: string
      lookLock?: string
      primaryGuess?: string
      contentLang?: string
    }>('/api/optimize-prompt', {
      method: 'POST',
      body: { prompt, aspect },
    })
    return {
      prompt: (brief.audiencePrompt || brief.prompt || brief.machinePrompt || prompt).trim(),
      audiencePrompt: (brief.audiencePrompt || '').trim(),
      lookLock: brief.lookLock,
      primaryGuess: brief.primaryGuess,
      contentLang: brief.contentLang,
    }
  },
  listStyleRefs: () => req<StyleRefItem[]>('/api/style-refs'),
  extractStyleRef: (body: { styleRefId?: string; styleRefDataUrl?: string }) =>
    req<{ look: StyleLook; source: string }>('/api/style-refs/extract', {
      method: 'POST',
      body,
    }),
  speechPreview: (body: { voice?: string; text?: string }) =>
    req<{ mime: string; base64: string }>('/api/speech/preview', { method: 'POST', body }),
  make: (body: {
    prompt: string
    aspect?: string
    quality?: string
    formMode?: string
    autoSfx?: boolean
    voMode?: 'on' | 'off' | 'auto'
    scriptDrive?: 'off' | 'auto' | 'polish' | 'verbatim'
    styleRefId?: string
    styleRefDataUrl?: string
    userAssets?: UserAsset[]
    /** 观众语言锁；避免打包英文行污染检测 */
    contentLang?: 'zh' | 'en' | 'bilingual'
    /** 真实网页检索 */
    webSearch?: boolean
    /** 混剪素材文件夹（绝对路径） */
    footageFolder?: string
    footagePaths?: string[]
    /** 混剪话题字段：品牌/卖点/主题 → 口播策划 */
    remixBrief?: {
      topic?: 'promo' | 'story' | 'tips' | string
      brand?: string
      sellingPoints?: string
      theme?: string
    }
  }) => req<EngineProject>('/api/make', { method: 'POST', body }),
  queue: () => req<EngineQueueSnapshot>('/api/queue'),
  project: (id: string) => req<EngineProject>(`/api/projects/${id}`),
  deleteProject: (id: string) =>
    req<{ ok: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),
  cancelProject: (id: string) =>
    req<EngineProject>(`/api/projects/${id}/cancel`, { method: 'POST', body: {} }),
  pipeline: (id: string) => req<EnginePipelineStep[]>(`/api/projects/${id}/pipeline`),
  storyboard: (id: string) =>
    req<{
      projectId: string
      beats: EngineBeat[]
      versions?: EngineVersion[]
      currentVersionId?: string
      videoUrl?: string
      durationSec?: number
      files?: EngineProjectFile[]
    }>(`/api/projects/${id}/storyboard`),
  remakeBeats: (
    id: string,
    body: { beatIndexes: number[]; note: string; mode?: RemakeMode },
  ) => req<EngineProject>(`/api/projects/${id}/remake-beats`, { method: 'POST', body }),
  restoreVersion: (id: string, versionId: string) =>
    req<EngineProject>(`/api/projects/${id}/restore-version`, {
      method: 'POST',
      body: { versionId },
    }),
  videoUrl: async (project: EngineProject, bust?: number) => {
    const st = await window.electron.engineGetState()
    const root = (st.url || '').replace(/\/$/, '')
    let url: string | null = null
    if (project.videoUrl) {
      if (project.videoUrl.startsWith('http') || project.videoUrl.startsWith('file:')) {
        url = project.videoUrl
      } else {
        url = root ? `${root}${project.videoUrl}` : project.videoUrl
      }
    } else if (project.dir && root) {
      url = `${root}/outputs/${project.dir}/final.mp4`
    }
    if (!url) return null
    if (bust) {
      const sep = url.includes('?') ? '&' : '?'
      return `${url}${sep}v=${bust}`
    }
    return url
  },
}
