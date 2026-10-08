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

module.exports = function beforePack(context) {
  const platform = context.packager.platform.nodeName
  const arch = Arch[context.arch]

  copyNativeFileSync(
    `better-sqlite3/better-sqlite3-v9.6.0-electron-v110-${platform}-${arch}.node`,
    `better-sqlite3.node`,
  )

  stageEngine()
}
