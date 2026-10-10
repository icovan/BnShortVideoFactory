/**
 * 便携 Node / FFmpeg：不打进安装包，首次一键安装时下载到 userData。
 */
import { spawnSync } from 'node:child_process'
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  chmodSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import https from 'node:https'
import http from 'node:http'
import { app } from 'electron'
import { BrowserWindow } from 'electron'

const NODE_VERSION = '22.17.0'
/** eugeneware/ffmpeg-static release tag used by ffmpeg-static@5.x */
const FFMPEG_RELEASE = 'b6.1.1'

export type RuntimeBinStatus = {
  nodeOk: boolean
  nodePath?: string
  nodeVersion?: string
  ffmpegOk: boolean
  ffmpegPath?: string
}

function emit(channel: string, payload: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

export function runtimeBinsRoot(): string {
  const root = path.join(app.getPath('userData'), 'runtime-bins')
  mkdirSync(root, { recursive: true })
  return root
}

function nodeInstallDir(): string {
  return path.join(runtimeBinsRoot(), `node-v${NODE_VERSION}`)
}

function ffmpegInstallDir(): string {
  return path.join(runtimeBinsRoot(), 'ffmpeg')
}

function nodeBinaryName(): string {
  return process.platform === 'win32' ? 'node.exe' : 'node'
}

function ffmpegBinaryName(): string {
  return process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
}

function findFileRecursive(dir: string, name: string, depth = 0): string | null {
  if (!existsSync(dir) || depth > 4) return null
  const direct = path.join(dir, name)
  if (existsSync(direct) && statSync(direct).isFile()) return direct
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue
    const hit = findFileRecursive(path.join(dir, ent.name), name, depth + 1)
    if (hit) return hit
  }
  return null
}

/** Prefer env override, then portable install, then PATH / ffmpeg-static (dev). */
export function resolveNodeBinary(): string | null {
  const env = (process.env.BIUNOW_NODE || '').trim()
  if (env && existsSync(env)) return env
  const portable = findFileRecursive(nodeInstallDir(), nodeBinaryName())
  if (portable) return portable
  const r = spawnSync('node', ['-v'], { encoding: 'utf8', windowsHide: true, timeout: 8_000 })
  if (r.status === 0) return 'node'
  return null
}

export function resolveFfmpegBinary(): string | null {
  const env = (process.env.BIUNOW_FFMPEG || '').trim()
  if (env && existsSync(env)) return env
  const portable = path.join(ffmpegInstallDir(), ffmpegBinaryName())
  if (existsSync(portable)) return portable
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const raw = require('ffmpeg-static') as string | null
    if (raw) {
      const p = String(raw).includes('app.asar')
        ? String(raw).replace('app.asar', 'app.asar.unpacked')
        : String(raw)
      if (existsSync(p)) return p
    }
  } catch {
    /* not bundled */
  }
  const r = spawnSync('ffmpeg', ['-version'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 8_000,
  })
  if (r.status === 0) return 'ffmpeg'
  return null
}

export function probeRuntimeBins(): RuntimeBinStatus {
  const nodePath = resolveNodeBinary()
  let nodeVersion: string | undefined
  if (nodePath) {
    const r = spawnSync(nodePath, ['-v'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 8_000,
    })
    if (r.status === 0) nodeVersion = String(r.stdout || r.stderr || '').trim()
  }
  const ffmpegPath = resolveFfmpegBinary()
  return {
    nodeOk: Boolean(nodePath && nodeVersion),
    nodePath: nodePath || undefined,
    nodeVersion,
    ffmpegOk: Boolean(ffmpegPath),
    ffmpegPath: ffmpegPath || undefined,
  }
}

/** Inject BIUNOW_NODE / BIUNOW_FFMPEG / PATH for engine child processes. */
export function applyRuntimeBinEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env = { ...base }
  const node = resolveNodeBinary()
  const ffmpeg = resolveFfmpegBinary()
  const prepend: string[] = []
  if (node && node !== 'node') {
    env.BIUNOW_NODE = node
    prepend.push(path.dirname(node))
    // npm.cmd sits next to node.exe in official zips
    const npmCmd = path.join(path.dirname(node), process.platform === 'win32' ? 'npm.cmd' : 'npm')
    if (existsSync(npmCmd)) env.BIUNOW_NPM = npmCmd
  }
  if (ffmpeg && ffmpeg !== 'ffmpeg') {
    env.BIUNOW_FFMPEG = ffmpeg
    prepend.push(path.dirname(ffmpeg))
  }
  if (prepend.length) {
    env.PATH = `${prepend.join(path.delimiter)}${path.delimiter}${env.PATH || ''}`
  }
  return env
}

function downloadFile(url: string, dest: string, onProgress?: (msg: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    mkdirSync(path.dirname(dest), { recursive: true })
    const follow = (u: string, redirects = 0) => {
      if (redirects > 8) {
        reject(new Error('too many redirects'))
        return
      }
      const mod = u.startsWith('http://') ? http : https
      const req = mod.get(u, { headers: { 'User-Agent': 'BnShortVideoFactory' } }, (res) => {
        const code = res.statusCode || 0
        if (code >= 300 && code < 400 && res.headers.location) {
          res.resume()
          follow(res.headers.location, redirects + 1)
          return
        }
        if (code !== 200) {
          res.resume()
          reject(new Error(`download failed HTTP ${code}: ${u}`))
          return
        }
        const total = Number(res.headers['content-length'] || 0)
        let got = 0
        const out = createWriteStream(dest)
        res.on('data', (chunk: Buffer) => {
          got += chunk.length
          if (total > 0 && got % (2 * 1024 * 1024) < chunk.length) {
            onProgress?.(`downloaded ${(got / 1024 / 1024).toFixed(1)} / ${(total / 1024 / 1024).toFixed(1)} MB`)
          }
        })
        res.pipe(out)
        out.on('finish', () => out.close(() => resolve()))
        out.on('error', reject)
      })
      req.on('error', reject)
    }
    follow(url)
  })
}

function nodeDistUrls(): string[] {
  const v = NODE_VERSION
  let file: string
  if (process.platform === 'win32') {
    file = `node-v${v}-win-x64.zip`
  } else if (process.platform === 'darwin') {
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
    file = `node-v${v}-darwin-${arch}.tar.gz`
  } else {
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
    file = `node-v${v}-linux-${arch}.tar.xz`
  }
  return [
    `https://npmmirror.com/mirrors/node/v${v}/${file}`,
    `https://nodejs.org/dist/v${v}/${file}`,
  ]
}

function ffmpegPlatformArch(): string {
  if (process.platform === 'darwin') {
    return process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64'
  }
  if (process.platform === 'linux') {
    return process.arch === 'arm64' ? 'linux-arm64' : 'linux-x64'
  }
  return 'win32-x64'
}

function ffmpegDistUrls(): string[] {
  const platformArch = ffmpegPlatformArch()
  return [
    `https://cdn.npmmirror.com/binaries/ffmpeg-static/${FFMPEG_RELEASE}/ffmpeg-${platformArch}.gz`,
    `https://github.com/eugeneware/ffmpeg-static/releases/download/${FFMPEG_RELEASE}/ffmpeg-${platformArch}.gz`,
  ]
}

function extractArchive(archive: string, destDir: string): void {
  mkdirSync(destDir, { recursive: true })
  if (process.platform === 'win32' && archive.endsWith('.zip')) {
    const ps = [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath '${archive.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
    ]
    const r = spawnSync('powershell', ps, { encoding: 'utf8', windowsHide: true })
    if (r.status !== 0) {
      throw new Error(`Expand-Archive failed: ${(r.stderr || r.stdout || '').slice(0, 400)}`)
    }
    return
  }
  // tar.gz / tar.xz
  const r = spawnSync('tar', ['-xf', archive, '-C', destDir], {
    encoding: 'utf8',
    windowsHide: true,
  })
  if (r.status !== 0) {
    throw new Error(`tar extract failed: ${(r.stderr || r.stdout || '').slice(0, 400)}`)
  }
}

async function gunzipFile(srcGz: string, dest: string): Promise<void> {
  const zlib = await import('node:zlib')
  const { createReadStream } = await import('node:fs')
  const { pipeline } = await import('node:stream/promises')
  mkdirSync(path.dirname(dest), { recursive: true })
  await pipeline(createReadStream(srcGz), zlib.createGunzip(), createWriteStream(dest))
}

export async function ensurePortableNode(): Promise<{ ok: boolean; path?: string; error?: string }> {
  const existing = resolveNodeBinary()
  if (existing) {
    const r = spawnSync(existing, ['-v'], { encoding: 'utf8', windowsHide: true, timeout: 8_000 })
    if (r.status === 0) {
      const ver = String(r.stdout || '').trim()
      const major = Number((ver.match(/v?(\d+)/) || [])[1] || 0)
      if (major >= 22 || existing !== 'node') {
        return { ok: true, path: existing === 'node' ? 'node' : existing }
      }
      // system node too old — fall through to portable
      if (existing === 'node' && major < 22) {
        emit('engine-install-log', { chunk: `system Node ${ver} < 22, downloading portable Node…\n` })
      }
    }
  }

  const destRoot = nodeInstallDir()
  const bin = findFileRecursive(destRoot, nodeBinaryName())
  if (bin) return { ok: true, path: bin }

  const urls = nodeDistUrls()
  const ext = process.platform === 'win32' ? '.zip' : process.platform === 'darwin' ? '.tar.gz' : '.tar.xz'
  const tmp = path.join(tmpdir(), `bn-node-${NODE_VERSION}-${Date.now()}${ext}`)
  let lastErr = ''
  try {
    emit('engine-install-progress', { phase: 'node', detail: 'download' })
    let downloaded = false
    for (const url of urls) {
      try {
        emit('engine-install-log', { chunk: `Downloading Node ${NODE_VERSION}…\n${url}\n` })
        await downloadFile(url, tmp, (m) => emit('engine-install-log', { chunk: `${m}\n` }))
        downloaded = true
        break
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e)
        emit('engine-install-log', { chunk: `mirror failed: ${lastErr}\n` })
      }
    }
    if (!downloaded) return { ok: false, error: lastErr || 'Node download failed' }
    rmSync(destRoot, { recursive: true, force: true })
    mkdirSync(destRoot, { recursive: true })
    emit('engine-install-log', { chunk: 'Extracting Node…\n' })
    extractArchive(tmp, destRoot)
    const found = findFileRecursive(destRoot, nodeBinaryName())
    if (!found) return { ok: false, error: 'Node 下载完成但未找到 node 可执行文件' }
    if (process.platform !== 'win32') {
      try {
        chmodSync(found, 0o755)
      } catch {
        /* ignore */
      }
    }
    process.env.BIUNOW_NODE = found
    applyRuntimeBinEnv(process.env)
    return { ok: true, path: found }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  } finally {
    try {
      rmSync(tmp, { force: true })
    } catch {
      /* ignore */
    }
  }
}

export async function ensureFfmpegBin(): Promise<{ ok: boolean; path?: string; error?: string }> {
  const existing = resolveFfmpegBinary()
  if (existing) return { ok: true, path: existing }

  const dest = path.join(ffmpegInstallDir(), ffmpegBinaryName())
  if (existsSync(dest)) return { ok: true, path: dest }

  const urls = ffmpegDistUrls()
  const tmpGz = path.join(tmpdir(), `bn-ffmpeg-${Date.now()}.gz`)
  let lastErr = ''
  try {
    emit('engine-install-progress', { phase: 'ffmpeg', detail: 'download' })
    let downloaded = false
    for (const url of urls) {
      try {
        emit('engine-install-log', { chunk: `Downloading FFmpeg…\n${url}\n` })
        await downloadFile(url, tmpGz, (m) => emit('engine-install-log', { chunk: `${m}\n` }))
        downloaded = true
        break
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e)
        emit('engine-install-log', { chunk: `mirror failed: ${lastErr}\n` })
      }
    }
    if (!downloaded) return { ok: false, error: lastErr || 'FFmpeg download failed' }
    mkdirSync(ffmpegInstallDir(), { recursive: true })
    const tmpBin = `${dest}.partial`
    await gunzipFile(tmpGz, tmpBin)
    try {
      renameSync(tmpBin, dest)
    } catch {
      rmSync(dest, { force: true })
      renameSync(tmpBin, dest)
    }
    if (process.platform !== 'win32') {
      try {
        chmodSync(dest, 0o755)
      } catch {
        /* ignore */
      }
    }
    process.env.BIUNOW_FFMPEG = dest
    applyRuntimeBinEnv(process.env)
    return { ok: true, path: dest }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  } finally {
    try {
      rmSync(tmpGz, { force: true })
    } catch {
      /* ignore */
    }
  }
}
