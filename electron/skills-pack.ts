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

function findSkillsRoot(staging: string): string | null {
  const queue = [staging]
  const seen = new Set<string>()
  while (queue.length) {
    const dir = queue.shift()!
    if (seen.has(dir)) continue
    seen.add(dir)
    if (listSkillIds(dir).length) return dir
    let kids: string[] = []
    try {
      kids = readdirSync(dir)
    } catch {
      continue
    }
    for (const name of kids) {
      if (name.startsWith('.') || name === '__MACOSX') continue
      const p = path.join(dir, name)
      if (existsSync(path.join(p, 'SKILL.md')) || name === 'skills') {
        queue.unshift(p)
      } else {
        try {
          // 只下钻一层目录，避免扫整盘
          const st = readdirSync(p)
          if (st.some((n) => existsSync(path.join(p, n, 'SKILL.md')))) queue.push(p)
        } catch {
          /* not a dir */
        }
      }
    }
    if (seen.size > 40) break
  }
  return null
}

/** 从 zip 或 skills 文件夹导入到 userData/skills */
export async function importSkillsPack(productRoot: string): Promise<SkillsPackStatus> {
  const win = BrowserWindow.getFocusedWindow()
  // Windows/Linux：openFile 与 openDirectory 不能同时设，否则只能选文件夹、看不到 zip
  const isMac = process.platform === 'darwin'
  const defaultPath = (() => {
    const candidates = [
      path.join(process.cwd(), 'release', 'skills'),
      path.join(app.getAppPath(), '..', 'release', 'skills'),
    ]
    for (const p of candidates) {
      if (existsSync(p)) return p
    }
    return undefined
  })()

  const dialogOpts = {
    title: isMac ? '选择 Skills 包（zip 或文件夹）' : '选择 Skills 包（zip）',
    defaultPath,
    properties: (isMac
      ? ['openFile', 'openDirectory']
      : ['openFile']) as Array<'openFile' | 'openDirectory'>,
    filters: [
      { name: 'Skills pack (zip)', extensions: ['zip'] },
      { name: 'All files', extensions: ['*'] },
    ],
  }
  const picked = win
    ? await dialog.showOpenDialog(win, dialogOpts)
    : await dialog.showOpenDialog(dialogOpts)
  if (picked.canceled || !picked.filePaths[0]) {
    return probeSkillsPack(productRoot)
  }

  const src = picked.filePaths[0]
  const dest = userSkillsDir()
  const staging = path.join(app.getPath('temp'), `biunow-skills-${Date.now()}`)
  try {
    rmSync(staging, { recursive: true, force: true })
    mkdirSync(staging, { recursive: true })

    const isZip = src.toLowerCase().endsWith('.zip')
    if (isZip) {
      if (process.platform === 'win32') {
        // 避免路径含空格/中文时 Expand-Archive 解析失败：用 -File 参数风格
        const ps = [
          `$ErrorActionPreference='Stop'`,
          `Expand-Archive -LiteralPath ${JSON.stringify(src)} -DestinationPath ${JSON.stringify(staging)} -Force`,
        ].join('; ')
        const r = spawnSync('powershell.exe', ['-NoProfile', '-Command', ps], {
          encoding: 'utf8',
          windowsHide: true,
          timeout: 120_000,
        })
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
      // 选中单技能目录或其父目录
      if (existsSync(path.join(src, 'SKILL.md'))) {
        mkdirSync(path.join(staging, path.basename(src)), { recursive: true })
        cpSync(src, path.join(staging, path.basename(src)), { recursive: true })
      } else {
        copySkillsTree(src, staging)
      }
    }

    const root = findSkillsRoot(staging)
    if (!root) {
      throw new Error(
        '未在所选 zip/文件夹中找到 SKILL.md。请选择 pnpm pack:skills 生成的 biunow-skills-*.zip',
      )
    }

    rmSync(dest, { recursive: true, force: true })
    mkdirSync(dest, { recursive: true })
    copySkillsTree(root, dest)
    writeFileSync(
      path.join(dest, '.imported.json'),
      JSON.stringify({ at: new Date().toISOString(), from: src, skillsRoot: root }, null, 2),
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
