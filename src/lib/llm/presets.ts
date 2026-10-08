/** 创作引擎用 OpenAI 兼容通道的常用厂商预设 */

export type LlmVendorId = 'deepseek' | 'openai' | 'qwen' | 'moonshot' | 'custom'

export type LlmVendorPreset = {
  id: LlmVendorId
  /** i18n key under studio.config.vendors.* */
  labelKey: string
  apiUrl: string
  models: { id: string; labelKey?: string }[]
  defaultModel: string
}

export const LLM_VENDORS: LlmVendorPreset[] = [
  {
    id: 'deepseek',
    labelKey: 'deepseek',
    apiUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-flash',
    models: [
      { id: 'deepseek-flash' },
      { id: 'deepseek-chat' },
      { id: 'deepseek-reasoner' },
    ],
  },
  {
    id: 'openai',
    labelKey: 'openai',
    apiUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini' },
      { id: 'gpt-4o' },
      { id: 'o4-mini' },
    ],
  },
  {
    id: 'qwen',
    labelKey: 'qwen',
    apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    models: [
      { id: 'qwen-plus' },
      { id: 'qwen-turbo' },
      { id: 'qwen-max' },
    ],
  },
  {
    id: 'moonshot',
    labelKey: 'moonshot',
    apiUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    models: [
      { id: 'moonshot-v1-8k' },
      { id: 'moonshot-v1-32k' },
      { id: 'moonshot-v1-128k' },
    ],
  },
  {
    id: 'custom',
    labelKey: 'custom',
    apiUrl: '',
    defaultModel: '',
    models: [],
  },
]

export function vendorById(id: string | undefined): LlmVendorPreset {
  return LLM_VENDORS.find((v) => v.id === id) || LLM_VENDORS[0]
}

/** 根据已有 URL 猜测厂商 */
export function detectVendor(apiUrl: string): LlmVendorId {
  const u = (apiUrl || '').toLowerCase()
  if (!u) return 'deepseek'
  if (u.includes('deepseek')) return 'deepseek'
  if (u.includes('openai.com')) return 'openai'
  if (u.includes('dashscope') || u.includes('aliyuncs')) return 'qwen'
  if (u.includes('moonshot')) return 'moonshot'
  return 'custom'
}
