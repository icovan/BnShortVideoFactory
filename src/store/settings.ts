import { defineStore } from 'pinia'
import { ref } from 'vue'
import { defaultLlmConfig, normalizeLlmConfig } from '@/lib/llm/config'
import type { LlmConfig } from '@/lib/llm/types'
import {
  defaultEdgeVoice,
  voiceMatchesUiLang,
  type UiVoiceLang,
} from '@/lib/voices'

export type SpeechProvider = 'auto' | 'edge' | 'windows'
export type CloneProvider = 'none' | 'dashscope' | 'minimax' | 'fish'

export type MyVoice = {
  id: string
  name: string
  provider: Exclude<CloneProvider, 'none'>
  voiceId: string
}

export type SpeechSettings = {
  provider: SpeechProvider
  /** 当前生效音色（跟界面语种槽位同步） */
  voice: string
  /** 中文界面下的默认配音 */
  voiceZh: string
  /** 英文界面下的默认配音 */
  voiceEn: string
  cloneProvider: CloneProvider
  cloneApiKey: string
  cloneBaseUrl: string
  speechModel: string
  myVoices: MyVoice[]
}

export const CLONE_DEFAULTS: Record<
  Exclude<CloneProvider, 'none'>,
  { base: string; model: string }
> = {
  dashscope: {
    base: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'cosyvoice-v2',
  },
  minimax: {
    base: 'https://api.minimax.chat/v1',
    model: 'speech-02-hd',
  },
  fish: {
    base: 'https://api.fish.audio/v1',
    model: 's1',
  },
}

export {
  EDGE_VOICES,
  defaultEdgeVoice,
  edgeVoiceLabel,
  edgeVoicesForLang,
  uiVoiceLang,
  voiceMatchesUiLang,
} from '@/lib/voices'
export type { EdgeVoice, UiVoiceLang } from '@/lib/voices'

function defaultSpeech(): SpeechSettings {
  const zh = defaultEdgeVoice('zh')
  const en = defaultEdgeVoice('en')
  return {
    provider: 'auto',
    voice: zh,
    voiceZh: zh,
    voiceEn: en,
    cloneProvider: 'none',
    cloneApiKey: '',
    cloneBaseUrl: '',
    speechModel: 'edge-tts',
    myVoices: [],
  }
}

/** 按界面语种取已配置的默认配音（含旧数据迁移） */
export function speechVoiceForLang(
  s: Pick<SpeechSettings, 'voice' | 'voiceZh' | 'voiceEn' | 'myVoices'>,
  lang: UiVoiceLang,
): string {
  const slot = lang === 'en' ? s.voiceEn : s.voiceZh
  if (slot && voiceMatchesUiLang(slot, lang)) return slot
  if (s.voice && voiceMatchesUiLang(s.voice, lang)) return s.voice
  return defaultEdgeVoice(lang)
}

function applyVoiceToSlots(
  voice: string,
  voiceZh: string,
  voiceEn: string,
  langHint?: UiVoiceLang,
): { voice: string; voiceZh: string; voiceEn: string } {
  if (voice.startsWith('my:')) {
    // 复刻音色两边都可用；写入当前语种槽，另一侧保留
    if (langHint === 'en') return { voice, voiceZh, voiceEn: voice }
    if (langHint === 'zh') return { voice, voiceZh: voice, voiceEn }
    return { voice, voiceZh: voice, voiceEn: voice }
  }
  if (voiceMatchesUiLang(voice, 'zh')) return { voice, voiceZh: voice, voiceEn }
  if (voiceMatchesUiLang(voice, 'en')) return { voice, voiceZh, voiceEn: voice }
  return { voice, voiceZh, voiceEn }
}

export const useSettingsStore = defineStore(
  'settings',
  () => {
    const llm = ref<LlmConfig>(defaultLlmConfig())
    const speech = ref<SpeechSettings>(defaultSpeech())
    function updateLlm(patch: Partial<LlmConfig>) {
      llm.value = normalizeLlmConfig({ ...llm.value, ...patch })
    }
    function updateSpeech(patch: Partial<SpeechSettings> & { langHint?: UiVoiceLang }) {
      const raw = patch as Partial<SpeechSettings> & {
        myVoiceId?: string
        provider?: string
        langHint?: UiVoiceLang
      }
      let provider = (raw.provider || speech.value.provider) as SpeechProvider | 'my-voice'
      let voice = raw.voice ?? speech.value.voice
      let voiceZh = raw.voiceZh ?? speech.value.voiceZh ?? defaultEdgeVoice('zh')
      let voiceEn = raw.voiceEn ?? speech.value.voiceEn ?? defaultEdgeVoice('en')
      let myVoices = Array.isArray(raw.myVoices) ? raw.myVoices : speech.value.myVoices
      // 旧版「我的声音」provider 迁移
      if (provider === 'my-voice') {
        provider = 'auto'
        if (raw.myVoiceId && !voice.startsWith('my:')) {
          const id = `legacy-${Date.now().toString(36)}`
          myVoices = [
            ...myVoices,
            {
              id,
              name: '我的声音',
              provider: speech.value.cloneProvider !== 'none' ? speech.value.cloneProvider : 'dashscope',
              voiceId: String(raw.myVoiceId),
            },
          ]
          voice = `my:${id}`
        }
      }
      // 旧持久化无 voiceZh/voiceEn：从 voice 回填对应语种
      if (!speech.value.voiceZh && !raw.voiceZh && voiceMatchesUiLang(voice, 'zh')) voiceZh = voice
      if (!speech.value.voiceEn && !raw.voiceEn && voiceMatchesUiLang(voice, 'en')) voiceEn = voice
      if (raw.voice !== undefined) {
        const slotted = applyVoiceToSlots(voice, voiceZh, voiceEn, raw.langHint)
        voice = slotted.voice
        voiceZh = slotted.voiceZh
        voiceEn = slotted.voiceEn
      }
      const { langHint: _langHint, myVoiceId: _myVoiceId, ...rest } = raw
      void _langHint
      void _myVoiceId
      speech.value = {
        ...speech.value,
        ...rest,
        provider: provider === 'edge' || provider === 'windows' || provider === 'auto' ? provider : 'auto',
        voice,
        voiceZh,
        voiceEn,
        myVoices,
      }
    }
    function addMyVoice(row: Omit<MyVoice, 'id'> & { id?: string }) {
      const id = row.id || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
      const next = [...speech.value.myVoices, { ...row, id }].slice(0, 8)
      speech.value = { ...speech.value, myVoices: next }
      return id
    }

    function removeMyVoice(id: string) {
      const fallbackZh = defaultEdgeVoice('zh')
      const fallbackEn = defaultEdgeVoice('en')
      const gone = `my:${id}`
      speech.value = {
        ...speech.value,
        myVoices: speech.value.myVoices.filter((v) => v.id !== id),
        voice: speech.value.voice === gone ? fallbackZh : speech.value.voice,
        voiceZh: speech.value.voiceZh === gone ? fallbackZh : speech.value.voiceZh,
        voiceEn: speech.value.voiceEn === gone ? fallbackEn : speech.value.voiceEn,
      }
    }

    /** 切换界面语种时切到该语种已保存的默认配音（不覆盖另一语种） */
    function applyVoiceForUiLang(lang: UiVoiceLang) {
      const next = speechVoiceForLang(speech.value, lang)
      if (speech.value.voice === next) return next
      speech.value = { ...speech.value, voice: next }
      return next
    }

    return {
      llm,
      speech,
      updateLlm,
      updateSpeech,
      addMyVoice,
      removeMyVoice,
      applyVoiceForUiLang,
    }
  },
  { persist: true },
)
