const path = require('node:path')
const fs = require('node:fs')
const { spawnSync } = require('node:child_process')

const Arch = {
  0: 'ia32',
  1: 'x64',
  2: 'armv7l',
  3: 'arm64',
  4: 'universal',
}

function copyNativeFileSync(sourceDir, targetDir) {
  const sourcePath = path.join(__dirname, `../../native/${sourceDir}`)
  const targetPath = path.join(__dirname, `../../dist-native/${targetDir}`)
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Native binary not found at: ${sourcePath}`)
  }
  if (!fs.existsSync(path.join(__dirname, `../../dist-native`))) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  }
  fs.copyFileSync(sourcePath, targetPath)
}

function stageEngine() {
  const script = path.join(__dirname, 'stage-engine.mjs')
  console.log('[beforePack] staging engine (Remotion/Manim core)…')
  const r = spawnSync(process.execPath, [script], {
    cwd: path.join(__dirname, '../..'),
    stdio: 'inherit',
    env: process.env,
  })
  if (r.status !== 0) throw new Error('stage-engine.mjs failed')
}

function ensureWinIcon() {
  const ico = path.join(__dirname, '../icons/icon.ico')
  if (fs.existsSync(ico) && fs.statSync(ico).size > 1000) return
  console.log('[beforePack] generating Windows icon.ico…')
  const script = path.join(__dirname, 'gen-icons.mjs')
  const r = spawnSync(process.execPath, [script], {
    cwd: path.join(__dirname, '../..'),
    stdio: 'inherit',
  })
  if (r.status !== 0) throw new Error('gen-icons.mjs failed')
}

function cleanDistElectron() {
  const dir = path.join(__dirname, '../../dist-electron')
  if (!fs.existsSync(dir)) return
  // 只保留当前入口：main.js / preload.js（及同目录非哈希碎片）
  const keep = new Set(['main.js', 'preload.js', 'main.js.map', 'preload.js.map'])
  for (const name of fs.readdirSync(dir)) {
    if (keep.has(name)) continue
    // 清掉历史 hashed chunks：main-XXXX.js / MpegParser-*.js 等
    if (
      /^main-[A-Za-z0-9_-]+\.js(\.map)?$/.test(name)
      || /^(Mpeg|MP4|Matroska|Wave|WavPack|Musepack|Ogg|Asf|Aiff|Dsdiff|Dsf|Flac|ID3|AbstractID3)Parser-/.test(name)
    ) {
      fs.rmSync(path.join(dir, name), { force: true })
    }
  }
  console.log('[beforePack] cleaned stale dist-electron artifacts')
}

module.exports = function beforePack(context) {
  const platform = context.packager.platform.nodeName
  const arch = Arch[context.arch]

  copyNativeFileSync(
    `better-sqlite3/better-sqlite3-v9.6.0-electron-v110-${platform}-${arch}.node`,
    `better-sqlite3.node`,
  )

  if (platform === 'win32') ensureWinIcon()
  cleanDistElectron()
  stageEngine()
}
