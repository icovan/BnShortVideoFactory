export type ContentLang = 'zh' | 'en' | 'bilingual'

const BILINGUAL_RE =
  /双语|中英|英中|中英文|bilingual|zh\s*[\+/&]\s*en|en\s*[\+/&]\s*zh|chinese\s+and\s+english|english\s+and\s+chinese/i
const FORCE_ZH_RE = /纯中文|只要中文|全中文|中文口播|chinese\s*only|mandarin\s*only/i
const FORCE_EN_RE = /纯英文|只要英文|全英文|english\s*only|英文口播/i

/** 去掉 UI 打包行，避免英文 ask 被中文「形态：」污染语种检测 */
export function stripFactoryPackLines(prompt: string): string {
  return (prompt || '')
    .split('\n')
    .filter((line) => {
      const t = line.trim()
      if (!t) return true
      if (/^形态[：:]/.test(t) || /^形态倾向/.test(t)) return false
      if (/^(Form|Form mode|Morphology)\b/i.test(t)) return false
      if (
        /^(Design reference|Screen assets|User music|Source docs|Web search|Auto SFX|No voice-over|Voice-over required|Script-drive)\b/i.test(
          t,
        )
      ) {
        return false
      }
      return true
    })
    .join('\n')
}

/** 按用户原文检测观众语言（不含 UI 打包行） */
export function detectContentLang(ask: string): ContentLang {
  const t = stripFactoryPackLines(ask || '').trim()
  if (!t) return 'zh'
  if (BILINGUAL_RE.test(t)) return 'bilingual'
  if (FORCE_ZH_RE.test(t)) return 'zh'
  if (FORCE_EN_RE.test(t)) return 'en'

  const cjk = (t.match(/[\u4e00-\u9fff]/g) || []).length
  const latin = (t.match(/[A-Za-z]/g) || []).length
  if (cjk === 0 && latin === 0) return 'zh'
  if (cjk === 0) return 'en'
  if (latin === 0) return 'zh'
  return cjk >= latin * 0.35 ? 'zh' : 'en'
}

/** 提交前粗估成片时长与等待分钟 */
export function estimateCreate(
  promptText: string,
  hasDoc: boolean,
  formMode: string,
): { durationSec: number; waitMinLow: number; waitMinHigh: number } {
  const chars = promptText.replace(/\s+/g, '').length + (hasDoc ? 1200 : 0)
  let durationSec = Math.round(chars / 4)
  if (formMode === 'logo' || formMode === 'stickman') {
    durationSec = Math.max(6, Math.min(12, Math.round(chars / 10) || 8))
  } else if (formMode === 'showreel') {
    durationSec = Math.max(12, Math.min(18, Math.round(chars / 8) || 14))
  } else if (formMode === 'launch') {
    durationSec = Math.max(15, Math.min(45, Math.round(chars / 8) || 20))
  } else if (formMode === 'remix') {
    durationSec = Math.max(20, Math.min(180, Math.round(chars / 5) || 45))
  } else if (formMode === 'short') {
    durationSec = Math.max(12, Math.min(60, Math.round(chars / 6) || 20))
  } else {
    durationSec = Math.max(20, Math.min(300, durationSec || 45))
  }
  const waitMinLow = Math.max(1, Math.round(durationSec / 12))
  const waitMinHigh = Math.max(waitMinLow + 1, Math.round(durationSec / 6))
  return { durationSec, waitMinLow, waitMinHigh }
}
