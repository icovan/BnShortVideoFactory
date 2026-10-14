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

/**
 * 历史 hashed 碎片由 build 开头的 clean-dist-electron.mjs 清理。
 * 切勿在 beforePack 再删 main-*.js / Parser-*.js：
 * vite 打出的 main.js 会 require("./main-HASH.js")，删掉后安装包启动会弹
 * 「A JavaScript error occurred in the main process / Cannot find module」。
 * （0.1.x 瘦身包踩过这个坑。）
 */
function assertMainChunkPresent() {
  const dir = path.join(__dirname, '../../dist-electron')
  const mainJs = path.join(dir, 'main.js')
  if (!fs.existsSync(mainJs)) {
    throw new Error('[beforePack] missing dist-electron/main.js — run vite build first')
  }
  const src = fs.readFileSync(mainJs, 'utf8')
  const refs = [...src.matchAll(/require\(["']\.\/(main-[^"']+\.js)["']\)/g)].map((m) => m[1])
  for (const rel of refs) {
    const p = path.join(dir, rel)
    if (!fs.existsSync(p)) {
      throw new Error(
        `[beforePack] main.js requires ./${rel} but file is missing — refuse to pack a broken app`,
      )
    }
  }
  if (refs.length) {
    console.log('[beforePack] main chunk ok:', refs.join(', '))
  } else {
    console.log('[beforePack] main.js is self-contained (no hashed chunk)')
  }
}

module.exports = function beforePack(context) {
  const platform = context.packager.platform.nodeName
  const arch = Arch[context.arch]

  copyNativeFileSync(
    `better-sqlite3/better-sqlite3-v9.6.0-electron-v110-${platform}-${arch}.node`,
    `better-sqlite3.node`,
  )

  if (platform === 'win32') ensureWinIcon()
  assertMainChunkPresent()
  stageEngine()
}
