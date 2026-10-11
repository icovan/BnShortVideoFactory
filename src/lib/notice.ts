import { reactive } from 'vue'

export type NoticeTone = 'ok' | 'attention'

export type NoticeItem = {
  id: number
  tone: NoticeTone
  text: string
}

const OK_MS = 2400

export const noticeState = reactive<{ item: NoticeItem | null }>({ item: null })

let seq = 0
let timer: ReturnType<typeof setTimeout> | null = null
let lastText = ''
let lastAt = 0
let langToastArmed = false

export function armLanguageNotice() {
  langToastArmed = true
}

export function disarmLanguageNotice() {
  langToastArmed = false
}

export function takeLanguageNotice() {
  const armed = langToastArmed
  langToastArmed = false
  return armed
}

export function dismissNotice() {
  if (timer) clearTimeout(timer)
  timer = null
  noticeState.item = null
}

/** 成功类自动收起；需要处理的留到用户关掉。短时间重复的同一句只显示一次。 */
export function pushNotice(tone: NoticeTone, text: string) {
  const line = text.trim()
  if (!line) return
  const now = Date.now()
  if (line === lastText && now - lastAt < 800) return
  lastText = line
  lastAt = now
  if (timer) clearTimeout(timer)
  timer = null
  const id = ++seq
  noticeState.item = { id, tone, text: line }
  if (tone === 'ok') {
    timer = setTimeout(() => {
      if (noticeState.item?.id === id) noticeState.item = null
    }, OK_MS)
  }
}
