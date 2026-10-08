import { defineStore } from 'pinia'
import { ref } from 'vue'
import { defaultLlmConfig, normalizeLlmConfig } from '@/lib/llm/config'
import type { LlmConfig } from '@/lib/llm/types'

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
  voice: string
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

export const useSettingsStore = defineStore(
  'settings',
  () => {
    const llm = ref<LlmConfig>(defaultLlmConfig())
    const speech = ref<SpeechSettings>({
      provider: 'auto',
      voice: 'zh-CN-YunxiNeural',
      cloneProvider: 'none',
      cloneApiKey: '',
      cloneBaseUrl: '',
      speechModel: 'edge-tts',
      myVoices: [],
    })
    function updateLlm(patch: Partial<LlmConfig>) {
      llm.value = normalizeLlmConfig({ ...llm.value, ...patch })
    }
    function updateSpeech(patch: Partial<SpeechSettings>) {
      const raw = patch as Partial<SpeechSettings> & { myVoiceId?: string; provider?: string }
      let provider = (raw.provider || speech.value.provider) as SpeechProvider | 'my-voice'
      let voice = raw.voice ?? speech.value.voice
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
      speech.value = {
        ...speech.value,
        ...patch,
        provider: provider === 'edge' || provider === 'windows' || provider === 'auto' ? provider : 'auto',
        voice,
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
      speech.value = {
        ...speech.value,
        myVoices: speech.value.myVoices.filter((v) => v.id !== id),
        voice: speech.value.voice === `my:${id}` ? 'zh-CN-YunxiNeural' : speech.value.voice,
      }
    }

    return {
      llm,
      speech,
      updateLlm,
      updateSpeech,
      addMyVoice,
      removeMyVoice,
    }
  },
  { persist: true },
)
