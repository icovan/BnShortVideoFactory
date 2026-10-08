/**
 * 私有 skills 包：探测 / 导入到 userData（开源仓不含 skill 正文）
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { app, dialog, BrowserWindow } from 'electron'

export type SkillsPackStatus = {
  ready: boolean
  dir: string
  source: 'bundled' | 'userData' | 'dev' | 'missing'
  present: string[]
  missingRequired: string[]
  required: string[]
}

function loadRequired(productRoot: string): string[] {
  const candidates = [
    path.join(productRoot, 'vendor', 'skills-manifest.json'),
    path.join(app.getAppPath(), 'vendor', 'skills-manifest.json'),
  ]
  for (const p of candidates) {
    if (!existsSync(p)) continue
    try {
      const j = JSON.parse(readFileSync(p, 'utf8')) as { required?: string[] }
      if (j.required?.length) return j.required
    } catch {
      /* skip */
    }
  }
  return [
    'creative-brief',
    'motion-art-direction',
    'remotion-video',
    'kinetic-typography',
    'diagram-animation',
    'explainer-video',
  ]
}

function listSkillIds(dir: string): string[] {
  if (!existsSync(dir)) return []
  try {
    return readdirSync(dir).filter((n) => existsSync(path.join(dir, n, 'SKILL.md')))
  } catch {
    return []
  }
}

export function userSkillsDir() {
  return path.join(app.getPath('userData'), 'skills')
}

export function bundledSkillsDir(productRoot: string) {
  return path.join(productRoot, 'vendor', 'skills')
}

export function resolveActiveSkillsDir(productRoot: string): {
  dir: string
  source: SkillsPackStatus['source']
} {
  const env = (process.env.BIUNOW_SKILLS_DIR || '').trim()
  if (env && listSkillIds(env).length) return { dir: env, source: 'dev' }

  const user = userSkillsDir()
  if (listSkillIds(user).length) return { dir: user, source: 'userData' }

  const bundled = bundledSkillsDir(productRoot)
  if (listSkillIds(bundled).length) {
    return { dir: bundled, source: app.isPackaged ? 'bundled' : 'dev' }
  }

  return { dir: bundled, source: 'missing' }
}

export function probeSkillsPack(productRoot: string): SkillsPackStatus {
  const required = loadRequired(productRoot)
  const { dir, source } = resolveActiveSkillsDir(productRoot)
  const present = listSkillIds(dir)
  const missingRequired = required.filter((id) => !present.includes(id))
  return {
    ready: missingRequired.length === 0,
    dir,
    source: present.length ? source : 'missing',
    present,
    missingRequired,
    required,
  }
}

function copySkillsTree(from: string, to: string) {
  mkdirSync(to, { recursive: true })
  for (const name of readdirSync(from)) {
    if (name === 'README.md' || name.startsWith('.')) continue
    const src = path.join(from, name)
    const dest = path.join(to, name)
    cpSync(src, dest, { recursive: true })
  }
}

/** 从文件夹或 zip 导入到 userData/skills */
export async function importSkillsPack(productRoot: string): Promise<SkillsPackStatus> {
  const win = BrowserWindow.getFocusedWindow()
  const picked = await dialog.showOpenDialog(win || undefined, {
    title: '选择私有 Skills 包（文件夹或 zip）',
    properties: ['openFile', 'openDirectory'],
    filters: [
      { name: 'Skills pack', extensions: ['zip'] },
      { name: 'All', extensions: ['*'] },
    ],
  })
  if (picked.canceled || !picked.filePaths[0]) {
    return probeSkillsPack(productRoot)
  }

  const src = picked.filePaths[0]
  const dest = userSkillsDir()
  const staging = path.join(app.getPath('temp'), `biunow-skills-${Date.now()}`)
  try {
    rmSync(staging, { recursive: true, force: true })
    mkdirSync(staging, { recursive: true })

    if (src.toLowerCase().endsWith('.zip')) {
      if (process.platform === 'win32') {
        const r = spawnSync(
          'powershell.exe',
          [
            '-NoProfile',
            '-Command',
            `Expand-Archive -LiteralPath '${src.replace(/'/g, "''")}' -DestinationPath '${staging.replace(/'/g, "''")}' -Force`,
          ],
          { encoding: 'utf8', windowsHide: true, timeout: 120_000 },
        )
        if (r.status !== 0) {
          throw new Error((r.stderr || r.stdout || 'unzip failed').slice(0, 400))
        }
      } else {
        const r = spawnSync('unzip', ['-o', src, '-d', staging], {
          encoding: 'utf8',
          timeout: 120_000,
        })
        if (r.status !== 0) {
          throw new Error((r.stderr || r.stdout || 'unzip failed').slice(0, 400))
        }
      }
    } else {
      copySkillsTree(src, staging)
    }

    // zip 可能多一层目录
    let root = staging
    const kids = readdirSync(staging)
    if (kids.length === 1 && !existsSync(path.join(staging, kids[0], 'SKILL.md'))) {
      const nested = path.join(staging, kids[0])
      if (listSkillIds(nested).length || existsSync(path.join(nested, 'creative-brief'))) {
        root = nested
      }
    }
    if (!listSkillIds(root).length) {
      // 也可能 skills 在 root/skills
      const alt = path.join(root, 'skills')
      if (listSkillIds(alt).length) root = alt
    }
    if (!listSkillIds(root).length) {
      throw new Error('未在所选内容中找到 SKILL.md')
    }

    rmSync(dest, { recursive: true, force: true })
    mkdirSync(dest, { recursive: true })
    copySkillsTree(root, dest)
    writeFileSync(
      path.join(dest, '.imported.json'),
      JSON.stringify({ at: new Date().toISOString(), from: src }, null, 2),
      'utf8',
    )
  } finally {
    try {
      rmSync(staging, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }

  return probeSkillsPack(productRoot)
}
