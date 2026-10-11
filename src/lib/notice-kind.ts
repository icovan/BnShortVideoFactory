/** 把引擎/接口原文收成用户能看懂的四类。原文只留在日志里。 */
export type NoticeKind = 'network' | 'billing' | 'voice' | 'other'

const LICENSE =
  /激活|体验已结束|请先激活|activation code|trial has ended/i

const BILLING =
  /insufficient[_\s-]?quota|quota exceeded|billing|arrearage|insufficient balance|out of (?:credit|balance)|payment required|credit balance|余额|欠费|额度|配额|\b402\b/i

const VOICE =
  /edge[-_]?tts|配音|语音合成|cosyvoice|fish\.audio|speech synthesis|\btts\b|voice[-_]?over/i

const NETWORK =
  /ECONNRESET|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|EHOSTUNREACH|ENETUNREACH|UND_ERR_|fetch failed|failed to fetch|networkerror|socket hang up|getaddrinfo|超时|网络|连接失败|\bnetwork\b/i

export function classifyTaskError(raw: string): NoticeKind {
  const s = raw || ''
  if (LICENSE.test(s)) return 'other'
  if (BILLING.test(s)) return 'billing'
  if (VOICE.test(s)) return 'voice'
  if (NETWORK.test(s)) return 'network'
  return 'other'
}
