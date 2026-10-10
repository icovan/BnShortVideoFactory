/**
 * 成片引擎依赖探测 / 一键安装（Node、FFmpeg、npm 依赖 — 不打包进安装包）
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { BrowserWindow } from 'electron'
import {
  applyRuntimeBinEnv,
  ensureFfmpegBin,
  ensurePortableNode,
  probeRuntimeBins,
  resolveNodeBinary,
} from './runtimeBins'

export type EngineDepsStatus = {
  ok: boolean
  productRoot: string
  hasNode: boolean
  hasFfmpeg: boolean
  hasTsx: boolean
  createCoreNm: boolean
  remotionNm: boolean
  missing: string[]
  nodeVersion?: string
  ffmpegPath?: string
}

function npmBin(env: NodeJS.ProcessEnv = process.env) {
  const fromEnv = (env.BIUNOW_NPM || '').trim()
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  const node = resolveNodeBinary()
  if (node && node !== 'node') {
    const sibling = path.join(
      path.dirname(node),
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
    )
    if (existsSync(sibling)) return sibling
  }
  return process.platform === 'win32' ? 'npm.cmd' : 'npm'
}

function cleanEnv() {
  const env = applyRuntimeBinEnv({ ...process.env })
  for (const key of Object.keys(env)) {
    if (/^npm_config_/i.test(key)) delete env[key]
  }
  if (!env.npm_config_registry) {
    env.npm_config_registry = process.env.BIUNOW_NPM_REGISTRY || 'https://registry.npmmirror.com'
  }
  return env
}

export function findTsxCli(productRoot: string): string | null {
  const candidates = [
    path.join(productRoot, 'packages', 'create-core', 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    path.join(productRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
  ]
  return candidates.find((p) => existsSync(p)) || null
}

export function probeNode(): { ok: boolean; version?: string; path?: string } {
  const bins = probeRuntimeBins()
  if (!bins.nodeOk) return { ok: false }
  return { ok: true, version: bins.nodeVersion, path: bins.nodePath }
}

export function probeEngineDeps(productRoot: string): EngineDepsStatus {
  const core = path.join(productRoot, 'packages', 'create-core')
  const remotion = path.join(productRoot, 'packages', 'remotion-explainer')
  const createCoreNm = existsSync(path.join(core, 'node_modules'))
  const remotionNm = existsSync(path.join(remotion, 'node_modules'))
  const hasTsx = Boolean(findTsxCli(productRoot))
  const bins = probeRuntimeBins()
  const missing: string[] = []
  if (!bins.nodeOk) missing.push('node')
  if (!bins.ffmpegOk) missing.push('ffmpeg')
  if (!createCoreNm) missing.push('create-core/node_modules')
  if (!remotionNm) missing.push('remotion-explainer/node_modules')
  if (!hasTsx) missing.push('tsx')
  return {
    ok: missing.length === 0,
    productRoot,
    hasNode: bins.nodeOk,
    hasFfmpeg: bins.ffmpegOk,
    hasTsx,
    createCoreNm,
    remotionNm,
    missing,
    nodeVersion: bins.nodeVersion,
    ffmpegPath: bins.ffmpegPath,
  }
}

function emit(channel: string, payload: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

function runNpmInstall(cwd: string): Promise<{ ok: boolean; log: string }> {
  return new Promise((resolve) => {
    const env = cleanEnv()
    const args = ['install', '--no-fund', '--no-audit']
    const child: ChildProcessWithoutNullStreams = spawn(npmBin(env), args, {
      cwd,
      env,
      windowsHide: true,
      shell: process.platform === 'win32',
    }) as ChildProcessWithoutNullStreams
    let log = ''
    const push = (buf: Buffer) => {
      const s = buf.toString()
      log += s
      emit('engine-install-log', { cwd: path.basename(cwd), chunk: s })
    }
    child.stdout?.on('data', push)
    child.stderr?.on('data', push)
    child.on('error', (e) => {
      resolve({ ok: false, log: log + String(e) })
    })
    child.on('close', (code) => {
      resolve({ ok: code === 0, log })
    })
  })
}

/** 一键安装：便携 Node → FFmpeg → create-core + remotion-explainer 依赖 */
export async function installEngineDeps(productRoot: string): Promise<{
  ok: boolean
  error?: string
  status: EngineDepsStatus
}> {
  emit('engine-install-progress', { phase: 'start' })

  const nodeEnsure = await ensurePortableNode()
  if (!nodeEnsure.ok) {
    const error = `Node 准备失败：${nodeEnsure.error || 'unknown'}`
    emit('engine-install-progress', { phase: 'error', error })
    return { ok: false, error, status: probeEngineDeps(productRoot) }
  }
  applyRuntimeBinEnv(process.env)

  const ffmpegEnsure = await ensureFfmpegBin()
  if (!ffmpegEnsure.ok) {
    const error = `FFmpeg 准备失败：${ffmpegEnsure.error || 'unknown'}`
    emit('engine-install-progress', { phase: 'error', error })
    return { ok: false, error, status: probeEngineDeps(productRoot) }
  }
  applyRuntimeBinEnv(process.env)

  const targets = [
    path.join(productRoot, 'packages', 'create-core'),
    path.join(productRoot, 'packages', 'remotion-explainer'),
  ]

  for (const cwd of targets) {
    if (!existsSync(path.join(cwd, 'package.json'))) {
      const error = `缺少包目录：${cwd}`
      emit('engine-install-progress', { phase: 'error', error })
      return { ok: false, error, status: probeEngineDeps(productRoot) }
    }
    emit('engine-install-progress', {
      phase: 'install',
      target: path.basename(cwd),
    })
    const r = await runNpmInstall(cwd)
    if (!r.ok) {
      const error = `${path.basename(cwd)} 依赖安装失败：${r.log.slice(-500)}`
      emit('engine-install-progress', { phase: 'error', error })
      return { ok: false, error, status: probeEngineDeps(productRoot) }
    }
  }

  const status = probeEngineDeps(productRoot)
  if (!status.ok) {
    const error = `安装完成但仍缺少：${status.missing.join(', ')}`
    emit('engine-install-progress', { phase: 'error', error })
    return { ok: false, error, status }
  }
  emit('engine-install-progress', { phase: 'done' })
  return { ok: true, status }
}
