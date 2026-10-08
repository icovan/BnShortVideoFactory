import { engineApi } from '@/lib/engine-api'
import { useSettingsStore } from '@/store/settings'

/** 把全局配置同步到本机成片引擎（含复刻 / 我的声音） */
export async function syncSettingsToEngine() {
  const s = useSettingsStore()
  await engineApi.ensure()
  const provider =
    s.speech.provider === 'windows' || s.speech.provider === 'edge' || s.speech.provider === 'auto'
      ? s.speech.provider
      : 'auto'
  await engineApi.saveSettings({
    llmBaseUrl: s.llm.apiUrl,
    llmApiKey: s.llm.apiKey,
    llmModel: s.llm.modelName,
    speechProvider: provider,
    speechVoice: s.speech.voice,
    speechModel: s.speech.speechModel || 'edge-tts',
    speechApiKey: '',
    speechBaseUrl: '',
    cloneProvider: s.speech.cloneProvider,
    cloneApiKey: s.speech.cloneApiKey,
    cloneBaseUrl: s.speech.cloneBaseUrl,
    myVoices: s.speech.myVoices,
  })
}
