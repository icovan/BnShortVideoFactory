/**
 * 启动本仓 packages/create-core（Remotion / Manim）。
 * 依赖不自动静默安装：缺依赖时返回 needsInstall，由 UI 一键安装。
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { app } from 'electron'
import { findTsxCli, probeEngineDeps, type EngineDepsStatus } from './deps'
import { applyRuntimeBinEnv, resolveNodeBinary } from './runtimeBins'
import { probeSkillsPack, resolveActiveSkillsDir, type SkillsPackStatus } from '../skills-pack'
import { resolveCommerceUrl } from '../commerce-url'

export type EngineRuntimeState = {
  ready: boolean
  url: string
  port: number
  root: string
  error?: string
  pid?: number
  /** 缺 node_modules / tsx，需用户点一键安装 */
  needsInstall?: boolean
  deps?: EngineDepsStatus
  skills?: SkillsPackStatus
}

const DEFAULT_PORT = 3040
let child: ChildProcess | null = null
let state: EngineRuntimeState = {
  ready: false,
  url: `http://127.0.0.1:${DEFAULT_PORT}`,
  port: DEFAULT_PORT,
  root: '',
}
let starting: Promise<EngineRuntimeState> | null = null

function hasEntry(productRoot: string) {
  return existsSync(path.join(productRoot, 'packages', 'create-core', 'src', 'server.ts'))
}

/** 产品根：含 packages/create-core + packages/remotion-explainer */
export function resolveProductRoot(): string {
  const env = (process.env.BIUNOW_ENGINE_ROOT || '').trim()
  if (env && hasEntry(env)) return env

  const bundled = path.join(process.resourcesPath, 'create-core')
  if (app.isPackaged && hasEntry(bundled)) return bundled

  const appRoot = process.env.APP_ROOT || app.getAppPath()
  if (hasEntry(appRoot)) return appRoot

  if (hasEntry(bundled)) return bundled
  return appRoot
}

function pingHealthOnce(baseUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    const u = new URL(`${baseUrl.replace(/\/$/, '')}/api/health`)
    const req = http.get(
      { hostname: u.hostname, port: u.port || 80, path: u.pathname, timeout: 1500 },
      (res) => {
        res.resume()
        resolve((res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300)
      },
    )
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

async function waitHealth(url: string, timeoutMs = 90_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await pingHealthOnce(url)) return true
    await new Promise((r) => setTimeout(r, 400))
  }
  return false
}

export function getEngineState(): EngineRuntimeState {
  const root = state.root || resolveProductRoot()
  return {
    ...state,
    root,
    deps: probeEngineDeps(root),
    skills: probeSkillsPack(root),
  }
}

export function probeRuntime(): EngineRuntimeState {
  const root = resolveProductRoot()
  const deps = probeEngineDeps(root)
  const skills = probeSkillsPack(root)
  state = {
    ...state,
    root,
    deps,
    skills,
    needsInstall: !deps.ok,
  }
  return getEngineState()
}

async function startOnce(): Promise<EngineRuntimeState> {
  const root = resolveProductRoot()
  const port = Number(process.env.FACTORY_PORT || DEFAULT_PORT) || DEFAULT_PORT
  const url = `http://127.0.0.1:${port}`
  const deps = probeEngineDeps(root)
  const skills = probeSkillsPack(root)
  state = {
    ...state,
    url,
    port,
    root,
    error: undefined,
    deps,
    skills,
    needsInstall: !deps.ok,
  }

  if (await waitHealth(url, 2000)) {
    state.ready = true
    console.info('[create-core] reuse existing', url)
    return getEngineState()
  }

  if (child && !child.killed) {
    const ok = await waitHealth(url, 120_000)
    state.ready = ok
    if (!ok) state.error = '成片核心启动超时'
    return getEngineState()
  }

  const entry = path.join(root, 'packages', 'create-core', 'src', 'server.ts')
  if (!existsSync(entry)) {
    state.ready = false
    state.error = `未找到成片核心：${entry}`
    console.error('[create-core]', state.error)
    return getEngineState()
  }

  if (!deps.ok) {
    state.ready = false
    state.needsInstall = true
    state.error = '运行环境未安装，请点击「一键安装」（将自动准备 Node、FFmpeg 与引擎依赖）'
    return getEngineState()
  }

  const tsx = findTsxCli(root)
  if (!tsx) {
    state.ready = false
    state.needsInstall = true
    state.error = '未找到 tsx，请一键安装运行环境'
    return getEngineState()
  }

  const skillsResolved = resolveActiveSkillsDir(root)
  const nodeBin = resolveNodeBinary() || process.env.BIUNOW_NODE || 'node'
  const commerceUrl = resolveCommerceUrl()
  const childEnv = applyRuntimeBinEnv({
    ...process.env,
    PORT: String(port),
    HOST: '127.0.0.1',
    FACTORY_RUNTIME: 'pc',
    FACTORY_ROLE: 'monolith',
    FACTORY_LOCAL_OPEN: '1',
    FACTORY_ORCHESTRATOR_URL: '',
    BIUNOW_SKILLS_DIR: skillsResolved.dir,
    ...(commerceUrl
      ? {
        BN_COMMERCE_URL: commerceUrl,
        BIUNOW_COMMERCE_URL: commerceUrl,
        FACTORY_COMMERCE_URL: commerceUrl,
      }
      : {}),
  })
  console.info('[create-core] spawning', {
    root,
    entry,
    node: nodeBin,
    skills: skillsResolved.dir,
    commerce: commerceUrl || '(unset)',
  })
  const proc = spawn(nodeBin, [tsx, entry], {
    cwd: root,
    env: childEnv,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child = proc
  state.pid = proc.pid
  state.ready = false

  proc.stdout?.on('data', (d) => console.info('[create-core]', String(d).trimEnd()))
  proc.stderr?.on('data', (d) => console.warn('[create-core]', String(d).trimEnd()))
  proc.on('exit', (code) => {
    console.warn('[create-core] exited', code)
    child = null
    state.ready = false
    if (!state.error) state.error = `成片核心退出 code=${code ?? '?'}（可点创作重试，主窗口不会退出）`
  })

  const ok = await waitHealth(url, 120_000)
  state.ready = ok
  if (!ok) {
    state.error = state.error || '成片核心启动超时（检查 packages/create-core 依赖 / Node / 3040）'
    try {
      child?.kill()
    } catch {
      /* ignore */
    }
    child = null
  } else {
    state.error = undefined
    console.info('[create-core] ready (Remotion/Manim)', url)
  }
  return getEngineState()
}

export async function startEngineRuntime(): Promise<EngineRuntimeState> {
  if (state.ready && (await waitHealth(state.url, 800))) return getEngineState()
  if (starting) return starting
  starting = startOnce().finally(() => {
    starting = null
  })
  return starting
}

export function stopEngineRuntime() {
  if (!child) return
  try {
    child.kill()
  } catch {
    /* ignore */
  }
  child = null
  state.ready = false
}
