import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  engineApi,
  type EnginePipelineStep,
  type EngineProject,
  type EngineProjectFile,
  type EngineVersion,
  type UserAsset,
} from '@/lib/engine-api'

export type Aspect = '16:9' | '9:16' | '1:1' | '3:4'
export type FormMode = 'prompt' | 'narrate' | 'short' | 'logo' | 'showreel' | 'launch' | 'remix'

/** 旧任务 formMode=stickman 曾表示品牌/Logo 片 */
export function coerceFormMode(v: unknown): FormMode {
  if (v === 'stickman') return 'logo'
  if (v === 'footage-remix') return 'remix'
  if (v === 'mg') return 'showreel'
  if (
    v === 'prompt'
    || v === 'narrate'
    || v === 'short'
    || v === 'logo'
    || v === 'showreel'
    || v === 'launch'
    || v === 'remix'
  ) {
    return v
  }
  return 'prompt'
}
export type TaskStatus = 'queued' | 'running' | 'ready' | 'error'

export type PipelineStep = {
  id: string
  label: string
  detail?: string
  status: 'pending' | 'running' | 'done' | 'error'
}

export type StudioTask = {
  id: string
  title: string
  prompt: string
  formMode: FormMode
  aspect: Aspect
  quality: '1080p' | '720p'
  mediaKind: 'animation' | 'ai-video'
  status: TaskStatus
  createdAt: number
  updatedAt: number
  videoPath?: string
  error?: string
  pipeline: PipelineStep[]
  /** 引擎侧项目 id（与本地 id 通常相同） */
  engineProjectId?: string
  files?: EngineProjectFile[]
  versions?: EngineVersion[]
  currentVersionId?: string
  dir?: string
  /** 0=出片中；≥1=排队位次 */
  queuePosition?: number
  queueWaiting?: number
}

function mapPipeline(steps?: EnginePipelineStep[]): PipelineStep[] {
  return (steps || []).map((s) => ({
    id: s.id,
    label: s.label,
    detail: s.detail,
    status: s.status,
  }))
}

function mapStatus(s: EngineProject['status']): TaskStatus {
  if (s === 'queued' || s === 'running' || s === 'ready' || s === 'error') return s
  return 'running'
}

function titleFromPrompt(prompt: string, formMode: FormMode) {
  const t = prompt.trim().replace(/\s+/g, ' ')
  if (t) return t.length > 24 ? `${t.slice(0, 24)}…` : t
  const map: Record<FormMode, string> = {
    prompt: '自由创作',
    narrate: '讲解科普样片',
    short: '短视频样片',
    logo: 'Logo片样片',
    showreel: '动效展片样片',
    launch: '素材叙事样片',
    remix: '素材混剪样片',
  }
  return map[formMode]
}

function voModeFor(formMode: FormMode): 'on' | 'off' | 'auto' {
  if (formMode === 'narrate' || formMode === 'launch' || formMode === 'short' || formMode === 'remix') {
    return 'on'
  }
  if (formMode === 'logo' || formMode === 'showreel') return 'off'
  return 'auto'
}

function scriptDriveFor(formMode: FormMode): 'off' | 'auto' | 'polish' | 'verbatim' {
  if (formMode === 'logo' || formMode === 'showreel') return 'off'
  return 'auto'
}

export const useStudioStore = defineStore(
  'studio',
  () => {
    const tasks = ref<StudioTask[]>([])
    const activeTaskId = ref<string | null>(null)
    const engineReady = ref(false)
    const engineError = ref('')

    const activeTask = computed(() => tasks.value.find((t) => t.id === activeTaskId.value) || null)
    const latestReady = computed(() => {
      const list = [...tasks.value].sort((a, b) => b.createdAt - a.createdAt)
      return list.find((t) => t.status === 'ready' && t.videoPath) || list[0] || null
    })
    /** 历史按创建时间稳定排序；预览/刷新不得靠改 updatedAt 置顶 */
    const history = computed(() => [...tasks.value].sort((a, b) => b.createdAt - a.createdAt))

    async function ensureEngine() {
      const st = await engineApi.ensure()
      engineReady.value = !!st.ready
      engineError.value = st.error || ''
      if (!st.ready) throw new Error(st.error || '成片引擎未就绪')
      return st
    }

    function upsertFromEngine(
      localMeta: Pick<StudioTask, 'formMode' | 'quality' | 'mediaKind' | 'createdAt'> & {
        aspect: Aspect
      },
      p: EngineProject,
      videoPath?: string | null,
      opts?: { activate?: boolean },
    ) {
      const now = Date.now()
      const i = tasks.value.findIndex((t) => t.id === p.id)
      const prev = i >= 0 ? tasks.value[i] : null
      const status = mapStatus(p.status)
      const nextVideo = videoPath || undefined
      const sameVideoFile =
        (prev?.videoPath || '').split('?')[0] === (nextVideo || '').split('?')[0]
      const meaningfulChange =
        !prev ||
        prev.status !== status ||
        prev.error !== p.error ||
        !sameVideoFile ||
        prev.currentVersionId !== p.currentVersionId ||
        (prev.versions?.length || 0) !== (p.versions?.length || 0)
      const mapped: StudioTask = {
        id: p.id,
        engineProjectId: p.id,
        title: p.title || titleFromPrompt(p.prompt, localMeta.formMode),
        prompt: p.prompt,
        formMode: coerceFormMode(localMeta.formMode),
        aspect: (p.aspect as Aspect) || localMeta.aspect,
        quality: localMeta.quality,
        mediaKind: localMeta.mediaKind,
        status,
        createdAt: localMeta.createdAt,
        updatedAt: meaningfulChange ? now : prev!.updatedAt,
        videoPath: nextVideo,
        error: p.error,
        pipeline: mapPipeline(p.pipeline),
        files: p.files,
        versions: p.versions,
        currentVersionId: p.currentVersionId,
        dir: p.dir,
        queuePosition: p.queuePosition,
        queueWaiting: p.queueWaiting,
      }
      if (i >= 0) tasks.value[i] = { ...tasks.value[i], ...mapped }
      else tasks.value.unshift(mapped)
      // 仅新建或显式激活时抢焦点；轮询刷新不得把用户正在预览的条目顶掉
      if (opts?.activate || i < 0) activeTaskId.value = p.id
      return mapped
    }

    async function createAndMake(input: {
      prompt: string
      formMode: FormMode
      aspect: Aspect
      quality: '1080p' | '720p'
      mediaKind: 'animation' | 'ai-video'
      autoSfx?: boolean
      voMode?: 'on' | 'off' | 'auto'
      scriptDrive?: 'off' | 'auto' | 'polish' | 'verbatim'
      styleRefId?: string
      styleRefDataUrl?: string
      userAssets?: UserAsset[]
      contentLang?: 'zh' | 'en' | 'bilingual'
      webSearch?: boolean
      footageFolder?: string
      footagePaths?: string[]
      remixBrief?: {
        topic?: 'promo' | 'story' | 'tips' | string
        brand?: string
        sellingPoints?: string
        theme?: string
      }
    }) {
      await ensureEngine()
      const createdAt = Date.now()
      const p = await engineApi.make({
        prompt: input.prompt.trim(),
        aspect: input.aspect,
        quality: input.quality,
        formMode: input.formMode,
        autoSfx: input.autoSfx === true,
        voMode: input.voMode || voModeFor(input.formMode),
        scriptDrive: input.scriptDrive || scriptDriveFor(input.formMode),
        styleRefId: input.styleRefId,
        styleRefDataUrl: input.styleRefDataUrl,
        userAssets: input.userAssets,
        contentLang: input.contentLang,
        webSearch: input.webSearch === true,
        footageFolder: input.footageFolder,
        footagePaths: input.footagePaths,
        remixBrief: input.remixBrief,
      })
      const task = upsertFromEngine(
        {
          formMode: input.formMode,
          aspect: input.aspect,
          quality: input.quality,
          mediaKind: input.mediaKind,
          createdAt,
        },
        p,
        null,
        { activate: true },
      )
      void pollTask(p.id)
      return task
    }

    async function refreshTask(id: string) {
      try {
        const [p, pipe] = await Promise.all([engineApi.project(id), engineApi.pipeline(id)])
        p.pipeline = pipe
        const videoPath =
          p.status === 'ready' ? await engineApi.videoUrl(p, Date.now()) : null
        const prev = tasks.value.find((t) => t.id === id)
        upsertFromEngine(
          {
            formMode: prev?.formMode || 'prompt',
            aspect: (prev?.aspect || p.aspect || '16:9') as Aspect,
            quality: prev?.quality || '1080p',
            mediaKind: prev?.mediaKind || 'animation',
            createdAt: prev?.createdAt || Date.now(),
          },
          p,
          videoPath,
        )
        return p
      } catch (e: any) {
        const i = tasks.value.findIndex((t) => t.id === id)
        if (i >= 0 && tasks.value[i].status !== 'error') {
          tasks.value[i] = {
            ...tasks.value[i],
            error: e?.message || String(e),
            status: tasks.value[i].status === 'ready' ? 'ready' : 'error',
            updatedAt: Date.now(),
          }
        }
        throw e
      }
    }

    const polling = new Set<string>()
    async function pollTask(id: string) {
      if (polling.has(id)) return
      polling.add(id)
      try {
        for (let i = 0; i < 600; i++) {
          const p = await refreshTask(id)
          if (p.status === 'ready' || p.status === 'error') break
          await new Promise((r) => setTimeout(r, 1500))
        }
      } finally {
        polling.delete(id)
      }
    }

    /** 选中任务驱动播放器；已完成的不轮询，避免列表跳动 */
    function openTask(id: string) {
      const task = tasks.value.find((t) => t.id === id)
      if (!task) return
      activeTaskId.value = id
      if (task.status === 'running' || task.status === 'queued') {
        void pollTask(id)
      }
    }

    async function deleteTask(id: string) {
      try {
        await ensureEngine()
        await engineApi.deleteProject(id)
      } catch {
        /* 引擎未就绪时仍移除本地列表 */
      }
      tasks.value = tasks.value.filter((t) => t.id !== id)
      if (activeTaskId.value === id) {
        activeTaskId.value = tasks.value[0]?.id || null
      }
    }

    async function cancelQueuedTask(id: string) {
      await ensureEngine()
      const p = await engineApi.cancelProject(id)
      const prev = tasks.value.find((t) => t.id === id)
      upsertFromEngine(
        {
          formMode: prev?.formMode || 'prompt',
          aspect: (prev?.aspect || p.aspect || '16:9') as Aspect,
          quality: prev?.quality || '1080p',
          mediaKind: prev?.mediaKind || 'animation',
          createdAt: prev?.createdAt || Date.now(),
        },
        p,
      )
      return p
    }

    const queueWaiting = computed(
      () => tasks.value.filter((t) => t.status === 'queued' || t.status === 'running').length,
    )

    return {
      tasks,
      activeTaskId,
      activeTask,
      latestReady,
      history,
      engineReady,
      engineError,
      queueWaiting,
      ensureEngine,
      createAndMake,
      refreshTask,
      pollTask,
      openTask,
      deleteTask,
      cancelQueuedTask,
    }
  },
  {
    persist: {
      pick: ['tasks', 'activeTaskId'],
      afterHydrate: (ctx) => {
        const store = ctx.store as { tasks: StudioTask[] }
        store.tasks = (store.tasks || []).map((t) => ({
          ...t,
          formMode: coerceFormMode(t.formMode),
        }))
      },
    },
  },
)
