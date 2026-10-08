import { loadSettings } from './settings'

function extractJsonObject(text: string): string {
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) return trimmed
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) return fence[1].trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1)
  return trimmed
}

async function postChat(body: Record<string, unknown>): Promise<string> {
  const s = loadSettings()
  if (!s.llmApiKey || !s.llmBaseUrl || !s.llmModel) {
    throw new Error('还没有配置大模型。请在顶部「配置」中填写 API URL / Key / 模型。')
  }
  const base = s.llmBaseUrl.replace(/\/$/, '')
  const url = /\/chat\/completions$/i.test(base) ? base : `${base}/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${s.llmApiKey}`,
    },
    body: JSON.stringify({ model: s.llmModel, temperature: 0.6, ...body }),
  })
  const text = await res.text()
  if (!res.ok) {
    let msg = text
    try {
      msg = (JSON.parse(text) as { error?: { message?: string } }).error?.message || text
    } catch {
      /* ignore */
    }
    throw new Error(`大模型请求失败：${msg}`)
  }
  const data = JSON.parse(text) as { choices?: { message?: { content?: string } }[] }
  return data.choices?.[0]?.message?.content || '{}'
}

export async function chatJson<T>(system: string, user: string): Promise<T> {
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]

  // 部分兼容网关不支持 response_format，失败则降级
  let content: string
  try {
    content = await postChat({
      messages,
      response_format: { type: 'json_object' },
    })
  } catch (e: any) {
    const msg = String(e?.message || e)
    if (/response_format|json_object|unsupported/i.test(msg)) {
      content = await postChat({ messages })
    } else {
      // 有的服务直接 400，再试无 format
      try {
        content = await postChat({ messages })
      } catch {
        throw e
      }
    }
  }

  try {
    return JSON.parse(extractJsonObject(content)) as T
  } catch {
    throw new Error(`大模型返回不是合法 JSON：${content.slice(0, 200)}`)
  }
}

export async function optimizePrompt(prompt: string): Promise<string> {
  const out = await chatJson<{ prompt: string }>(
    'You polish video-creation prompts. Reply JSON: {"prompt":"..."} only. Keep the user language.',
    `Polish this creation prompt, keep intent, make it clearer for animation production:\n\n${prompt}`,
  )
  return (out.prompt || prompt).trim()
}
