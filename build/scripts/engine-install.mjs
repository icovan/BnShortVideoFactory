/**
 * 安装 packages/create-core + remotion-explainer 依赖
 *（Windows 下避开 pnpm 注入的 npm_config_* 与 EBUSY）
 */
import { spawnSync } from 'node:child_process'
import { existsSync, renameSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../..')
const TARGETS = [
  join(ROOT, 'packages', 'create-core'),
  join(ROOT, 'packages', 'remotion-explainer'),
]

function cleanEnv() {
  const env = { ...process.env }
  for (const key of Object.keys(env)) {
    if (/^npm_config_/i.test(key)) delete env[key]
  }
  if (!env.npm_config_registry) {
    env.npm_config_registry = process.env.BIUNOW_NPM_REGISTRY || 'https://registry.npmmirror.com'
  }
  return env
}

function runNpm(cwd, args) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  console.log('[engine:install]', cwd, npm, args.join(' '))
  return spawnSync(npm, args, {
    cwd,
    env: cleanEnv(),
    stdio: 'inherit',
    windowsHide: true,
    shell: process.platform === 'win32',
  })
}

function tryMoveAside(nm) {
  if (!existsSync(nm)) return null
  const bak = `${nm}.__old_${Date.now()}`
  try {
    renameSync(nm, bak)
    console.log('[engine:install] moved locked node_modules aside →', bak)
    return bak
  } catch (e) {
    console.warn('[engine:install] cannot move node_modules:', e?.message || e)
    return null
  }
}

let failed = false
for (const cwd of TARGETS) {
  if (!existsSync(join(cwd, 'package.json'))) {
    console.error('[engine:install] missing', cwd)
    failed = true
    continue
  }
  const nm = join(cwd, 'node_modules')
  const bak = tryMoveAside(nm)
  const hasLock = existsSync(join(cwd, 'package-lock.json'))
  let r = runNpm(cwd, hasLock ? ['ci', '--no-fund', '--no-audit'] : ['install', '--no-fund', '--no-audit'])
  if (r.status !== 0) {
    console.warn('[engine:install] ci/install failed, retry with npm install…')
    r = runNpm(cwd, ['install', '--no-fund', '--no-audit'])
  }
  if (r.status === 0 && bak) {
    try {
      rmSync(bak, { recursive: true, force: true })
    } catch {
      console.warn('[engine:install] leftover (可稍后手动删):', bak)
    }
  }
  if ((r.status ?? 1) !== 0) failed = true
}

process.exit(failed ? 1 : 0)
