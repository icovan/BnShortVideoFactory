import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

declare const __BN_COMMERCE_URL__: string

function strip(raw: string) {
  return raw.trim().replace(/\/$/, '')
}

function fromEnv() {
  return strip(
    process.env.BN_COMMERCE_URL
    || process.env.BIUNOW_COMMERCE_URL
    || process.env.FACTORY_COMMERCE_URL
    || '',
  )
}

function fromJson(file: string) {
  if (!existsSync(file)) return ''
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as { url?: string; BN_COMMERCE_URL?: string }
    return strip(String(raw.url || raw.BN_COMMERCE_URL || ''))
  } catch {
    return ''
  }
}

function bundledConfigPath() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'config', 'commerce.json')
  const appRoot = process.env.APP_ROOT || app.getAppPath()
  return path.join(appRoot, 'config', 'commerce.json')
}

/** 优先级：环境变量 > 用户目录 commerce.json > 安装包内配置 > 打包时打入的默认地址 */
export function resolveCommerceUrl(): string {
  const env = fromEnv()
  if (env) return env
  const user = fromJson(path.join(app.getPath('userData'), 'commerce.json'))
  if (user) return user
  const bundled = fromJson(bundledConfigPath())
  if (bundled) return bundled
  const baked = typeof __BN_COMMERCE_URL__ === 'string' ? strip(__BN_COMMERCE_URL__) : ''
  return baked
}
