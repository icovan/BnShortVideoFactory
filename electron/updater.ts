import axios from 'axios'
import { BrowserWindow } from 'electron'

/** GitHub 优先，Gitee 回落（国内）——可用环境变量覆盖 */
const GITHUB_RELEASE_URL =
  process.env.BIUNOW_UPDATE_GITHUB ||
  'https://api.github.com/repos/biunow/BiunowFactory/releases/latest'
const GITEE_RELEASE_URL =
  process.env.BIUNOW_UPDATE_GITEE ||
  'https://gitee.com/api/v5/repos/biunow/BiunowFactory/releases/latest'

export interface UpdateInfo {
  version: string
  releaseNotes: Record<string, string>
  releaseDate: string
}

export type UpdateCheckResult =
  | { status: 'available'; info: UpdateInfo }
  | { status: 'up-to-date' }
  | { status: 'error'; message: string }

interface GitHubLatestRelease {
  tag_name: string
  body: string | null
  published_at: string | null
}

let mainWindow: BrowserWindow | null = null
let checking: Promise<UpdateCheckResult> | null = null

function parseReleaseNotes(body: string | null): Record<string, string> {
  const notes = body || ''
  const pattern = /<!-- i18n:([A-Za-z0-9-]+):start -->\s*([\s\S]*?)\s*<!-- i18n:\1:end -->/g
  const parts: Array<{ locale?: string; content: string }> = []
  const locales = new Set<string>()
  let lastIndex = 0

  for (const match of notes.matchAll(pattern)) {
    const [, locale, content] = match
    const startIndex = match.index ?? lastIndex
    const commonContent = notes.slice(lastIndex, startIndex).trim()
    if (commonContent) parts.push({ content: commonContent })
    if (locale && content?.trim()) {
      locales.add(locale)
      parts.push({ locale, content: content.trim() })
    }
    lastIndex = startIndex + match[0].length
  }

  const commonContent = notes.slice(lastIndex).trim()
  if (commonContent) parts.push({ content: commonContent })
  if (locales.size === 0) return { en: notes }

  return Object.fromEntries(
    [...locales].map((locale) => [
      locale,
      parts
        .filter((part) => !part.locale || part.locale === locale)
        .map((part) => part.content)
        .join('\n\n'),
    ]),
  )
}

function compareVersions(current: string, latest: string): number {
  const normalize = (version: string) => version.replace(/^v/, '').split('-')[0]
  const currentParts = normalize(current)
    .split('.')
    .map((part) => Number(part) || 0)
  const latestParts = normalize(latest)
    .split('.')
    .map((part) => Number(part) || 0)
  const length = Math.max(currentParts.length, latestParts.length)

  for (let index = 0; index < length; index++) {
    const difference = (latestParts[index] ?? 0) - (currentParts[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

export function initUpdateChecker(win: BrowserWindow) {
  mainWindow = win
}

async function fetchLatest(url: string): Promise<GitHubLatestRelease> {
  const { data } = await axios.get<GitHubLatestRelease>(url, {
    timeout: 10000,
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'BiunowFactory',
    },
  })
  return data
}

export async function checkForUpdates(currentVersion: string): Promise<UpdateCheckResult> {
  if (checking) return checking

  checking = (async () => {
    const errors: string[] = []
    for (const url of [GITHUB_RELEASE_URL, GITEE_RELEASE_URL]) {
      try {
        const data = await fetchLatest(url)
        const version = String(data.tag_name || '').replace(/^v/, '')
        if (!version) {
          errors.push(`${url}: empty tag`)
          continue
        }
        if (compareVersions(currentVersion, version) <= 0) {
          return { status: 'up-to-date' }
        }
        const info: UpdateInfo = {
          version,
          releaseNotes: parseReleaseNotes(data.body),
          releaseDate: data.published_at || '',
        }
        mainWindow?.webContents.send('update-available', info)
        return { status: 'available', info }
      } catch (error: any) {
        const status = error?.response?.status
        const message = error instanceof Error ? error.message : String(error)
        errors.push(`${url}: ${message}`)
        // 仓库尚未建 / 无 Release：不当成硬错误
        if (status === 404) {
          console.info('[Updater] no release yet', url)
        } else {
          console.warn('[Updater] source failed', url, message)
        }
      }
    }
    if (errors.every((e) => /status code 404|404/.test(e))) {
      return { status: 'up-to-date' }
    }
    const message = errors.join(' | ') || 'update check failed'
    console.error('[Updater] Failed to check for updates:', message)
    return { status: 'error', message }
  })().finally(() => {
    checking = null
  })

  return checking
}
