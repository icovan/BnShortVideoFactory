/**
 * Biunow 独立成片引擎（进程内）——不 spawn 旧 factory。
 */
import { optimizePrompt } from './llm'
import { getProject, listProjects } from './store'
import { loadSettings, maskSettings, saveSettings } from './settings'
import { pathToMediaUrl, startMake, startRemake, toPublicProject } from './pipeline'
import type { Aspect, EngineHttpResult, MakeInput, RemakeInput } from './types'

export type { EngineHttpResult } from './types'

export type EngineRuntimeState = {
  ready: boolean
  url: string
  port: number
  root: string
  error?: string
}

export function getEngineState(): EngineRuntimeState {
  return {
    ready: true,
    url: 'biunow://create-engine',
    port: 0,
    root: 'electron/create-engine',
  }
}

export async function startEngineRuntime(): Promise<EngineRuntimeState> {
  return getEngineState()
}

export function stopEngineRuntime() {
  /* in-process: nothing to kill */
}

function ok(data: unknown, status = 200): EngineHttpResult {
  return {
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  }
}

function fail(error: string, status = 400): EngineHttpResult {
  return ok({ error }, status)
}

export async function handleEngineHttp(input: {
  path: string
  method?: string
  body?: string | null
}): Promise<EngineHttpResult> {
  const method = (input.method || 'GET').toUpperCase()
  const url = new URL(input.path, 'http://biunow.local')
  const p = url.pathname
  let body: any = {}
  if (input.body) {
    try {
      body = JSON.parse(input.body)
    } catch {
      body = {}
    }
  }

  try {
    if (p === '/api/health' && method === 'GET') {
      const s = loadSettings()
      return ok({
        ok: true,
        name: 'Biunow Create Engine',
        llmConfigured: Boolean(s.llmApiKey && s.llmBaseUrl && s.llmModel),
        engine: 'biunow-native',
      })
    }

    if (p === '/api/settings' && method === 'GET') return ok(maskSettings(loadSettings()))
    if (p === '/api/settings' && method === 'PUT') {
      const saved = saveSettings(body)
      return ok(maskSettings(saved))
    }

    if (p === '/api/prompt/optimize' && method === 'POST') {
      const prompt = String(body.prompt || '').trim()
      if (!prompt) return fail('请先填写需求')
      const next = await optimizePrompt(prompt)
      return ok({ prompt: next })
    }

    if (p === '/api/make' && method === 'POST') {
      const prompt = String(body.prompt || '').trim()
      if (!prompt) return fail('请先填写需求')
      const project = startMake({
        prompt,
        aspect: body.aspect as Aspect,
        quality: body.quality,
        formMode: body.formMode,
        voMode: body.voMode,
        scriptDrive: body.scriptDrive,
      } as MakeInput)
      return ok(toPublicProject(project))
    }

    if (p === '/api/projects' && method === 'GET') {
      return ok(listProjects().map(toPublicProject))
    }

    const mProj = p.match(/^\/api\/projects\/([^/]+)$/)
    if (mProj && method === 'GET') {
      const proj = getProject(mProj[1])
      if (!proj) return fail('项目不存在', 404)
      return ok(toPublicProject(proj))
    }

    const mPipe = p.match(/^\/api\/projects\/([^/]+)\/pipeline$/)
    if (mPipe && method === 'GET') {
      const proj = getProject(mPipe[1])
      if (!proj) return fail('项目不存在', 404)
      return ok(proj.pipeline)
    }

    const mBoard = p.match(/^\/api\/projects\/([^/]+)\/storyboard$/)
    if (mBoard && method === 'GET') {
      const proj = getProject(mBoard[1])
      if (!proj) return fail('项目不存在', 404)
      return ok({
        projectId: proj.id,
        beats: proj.beats.map((b) => ({
          ...b,
          stillUrl: b.stillPath ? pathToMediaUrl(b.stillPath) : undefined,
        })),
      })
    }

    const mRemake = p.match(/^\/api\/projects\/([^/]+)\/remake-beats$/)
    if (mRemake && method === 'POST') {
      const proj = startRemake(mRemake[1], body as RemakeInput)
      return ok(toPublicProject(proj))
    }

    return fail(`Unknown route ${method} ${p}`, 404)
  } catch (e: any) {
    return fail(e?.message || String(e), 500)
  }
}
