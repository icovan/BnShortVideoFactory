/** 把引擎/接口原文收成用户能看懂的四类。原文只留在日志里。 */
export type NoticeKind = 'network' | 'billing' | 'voice' | 'other'

const LICENSE =
  /激活|体验已结束|请先激活|activation code|trial has ended/i

const BILLING =
  /insufficient[_\s-]?quota|quota exceeded|billing|arrearage|insufficient balance|out of (?:credit|balance)|payment required|credit balance|余额|欠费|额度|配额|\b402\b/i

const VOICE =
  /edge[-_]?tts|配音|语音合成|试听|cosyvoice|fish\.audio|speech synthesis|\btts\b|voice[-_]?over|WebSocket 连接|WEBSOCKET_|speech\.platform\.bing|msedgeservices|音色不可用|NoAudioReceived|INVALID_AUDIO|未收到 audio/i

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

/** Edge / 云配音试听、出片：左下角用的文案键（比四类更细）。 */
export function voiceNoticeKey(raw: string): string {
  const s = raw || ''
  if (/\b403\b|WEBSOCKET_CONNECTION_FAILED|Sec-MS-GEC/i.test(s)) return 'notice.voiceBlocked'
  if (/\b503\b|WEBSOCKET_503/i.test(s)) return 'notice.voiceBusy'
  if (/UNSUPPORTED_VOICE|音色不可用|Unsupported voice/i.test(s)) return 'notice.voiceGone'
  if (/无法播放|NotSupportedError|no supported source|格式不被支持|试听不是可播放/i.test(s)) {
    return 'notice.voicePlay'
  }
  if (/超时|timeout|WEBSOCKET_CLOSED_EARLY|长时间未收到/i.test(s)) return 'notice.voiceTimeout'
  if (/试听音频为空|未收到 audio|NO_AUDIO|INVALID_AUDIO|该音色当前不可用/i.test(s)) {
    return 'notice.voice'
  }
  return 'notice.voice'
}
