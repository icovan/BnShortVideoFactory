import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { settingsFile } from './paths'
import type { EngineSettings } from './types'

const DEFAULTS: EngineSettings = {
  llmBaseUrl: '',
  llmApiKey: '',
  llmModel: '',
  speechProvider: 'edge',
  speechVoice: 'zh-CN-XiaoxiaoNeural',
}

let cached: EngineSettings | null = null

export function loadSettings(): EngineSettings {
  if (cached) return { ...cached }
  try {
    if (existsSync(settingsFile())) {
      cached = { ...DEFAULTS, ...JSON.parse(readFileSync(settingsFile(), 'utf8')) }
      return { ...cached! }
    }
  } catch {
    /* ignore */
  }
  cached = { ...DEFAULTS }
  return { ...cached }
}

export function saveSettings(patch: Partial<EngineSettings>): EngineSettings {
  const next = { ...loadSettings(), ...patch }
  cached = next
  writeFileSync(settingsFile(), JSON.stringify(next, null, 2), 'utf8')
  return { ...next }
}

export function maskSettings(s: EngineSettings): EngineSettings {
  return {
    ...s,
    llmApiKey: s.llmApiKey ? '********' : '',
  }
}
