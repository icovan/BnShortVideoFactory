/** 与微软 Edge 当前仍可用的 Neural 音色对齐（写死已下线 ID 会 Unsupported voice） */
export type EdgeVoice = {
  id: string
  /** 简短显示名 */
  name: string
  /** 气质说明 */
  desc: string
  lang: 'zh' | 'en'
}

export const EDGE_VOICES: EdgeVoice[] = [
  // —— 中文（普通话 / 方言 / 台粤）——
  { id: 'zh-CN-YunxiNeural', name: '云希', desc: '男 · 平静旁白', lang: 'zh' },
  { id: 'zh-CN-YunyangNeural', name: '云扬', desc: '男 · 专业播报', lang: 'zh' },
  { id: 'zh-CN-YunjianNeural', name: '云健', desc: '男 · 沉稳解说', lang: 'zh' },
  { id: 'zh-CN-YunxiaNeural', name: '云夏', desc: '男 · 童声趣味', lang: 'zh' },
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓', desc: '女 · 温暖通用', lang: 'zh' },
  { id: 'zh-CN-XiaoyiNeural', name: '晓伊', desc: '女 · 活泼口播', lang: 'zh' },
  { id: 'zh-CN-liaoning-XiaobeiNeural', name: '晓北', desc: '女 · 东北生活', lang: 'zh' },
  { id: 'zh-CN-shaanxi-XiaoniNeural', name: '晓妮', desc: '女 · 陕西方言', lang: 'zh' },
  { id: 'zh-TW-HsiaoChenNeural', name: '曉臻', desc: '女 · 台湾国语', lang: 'zh' },
  { id: 'zh-TW-YunJheNeural', name: '雲哲', desc: '男 · 台湾国语', lang: 'zh' },
  { id: 'zh-HK-HiuMaanNeural', name: '曉曼', desc: '女 · 粤语', lang: 'zh' },
  { id: 'zh-HK-WanLungNeural', name: '雲龍', desc: '男 · 粤语', lang: 'zh' },

  // —— English (US / UK / AU / CA) ——
  { id: 'en-US-JennyNeural', name: 'Jenny', desc: 'F · US narrator', lang: 'en' },
  { id: 'en-US-GuyNeural', name: 'Guy', desc: 'M · US narrator', lang: 'en' },
  { id: 'en-US-AriaNeural', name: 'Aria', desc: 'F · US warm', lang: 'en' },
  { id: 'en-US-AnaNeural', name: 'Ana', desc: 'F · US child', lang: 'en' },
  { id: 'en-US-ChristopherNeural', name: 'Christopher', desc: 'M · US clear', lang: 'en' },
  { id: 'en-US-EricNeural', name: 'Eric', desc: 'M · US news', lang: 'en' },
  { id: 'en-US-MichelleNeural', name: 'Michelle', desc: 'F · US friendly', lang: 'en' },
  { id: 'en-US-RogerNeural', name: 'Roger', desc: 'M · US deep', lang: 'en' },
  { id: 'en-US-SteffanNeural', name: 'Steffan', desc: 'M · US calm', lang: 'en' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia', desc: 'F · UK English', lang: 'en' },
  { id: 'en-GB-RyanNeural', name: 'Ryan', desc: 'M · UK English', lang: 'en' },
  { id: 'en-GB-LibbyNeural', name: 'Libby', desc: 'F · UK warm', lang: 'en' },
  { id: 'en-GB-ThomasNeural', name: 'Thomas', desc: 'M · UK clear', lang: 'en' },
  { id: 'en-AU-NatashaNeural', name: 'Natasha', desc: 'F · AU English', lang: 'en' },
  { id: 'en-AU-WilliamNeural', name: 'William', desc: 'M · AU English', lang: 'en' },
  { id: 'en-CA-ClaraNeural', name: 'Clara', desc: 'F · CA English', lang: 'en' },
  { id: 'en-CA-LiamNeural', name: 'Liam', desc: 'M · CA English', lang: 'en' },
]

export type UiVoiceLang = 'zh' | 'en'

export function uiVoiceLang(lng?: string | null): UiVoiceLang {
  const l = (lng || '').toLowerCase()
  return l.startsWith('zh') ? 'zh' : 'en'
}

export function edgeVoicesForLang(lang: UiVoiceLang): EdgeVoice[] {
  return EDGE_VOICES.filter((v) => v.lang === lang)
}

export function edgeVoiceLabel(v: EdgeVoice): string {
  return `${v.name} · ${v.desc}`
}

export function defaultEdgeVoice(lang: UiVoiceLang): string {
  return lang === 'en' ? 'en-US-JennyNeural' : 'zh-CN-YunxiNeural'
}

/** 系统音色是否属于当前 UI 语言组（my: 复刻音色始终保留） */
export function voiceMatchesUiLang(voiceId: string, lang: UiVoiceLang): boolean {
  if (!voiceId || voiceId.startsWith('my:')) return true
  const hit = EDGE_VOICES.find((v) => v.id === voiceId)
  if (hit) return hit.lang === lang
  if (lang === 'zh') return /^zh-/i.test(voiceId)
  return /^en-/i.test(voiceId)
}
