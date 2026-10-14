/** Chromium/Electron often rejects data:audio/mpeg;base64 — play via Blob URL. */

function looksLikeMp3(bytes: Uint8Array): boolean {
  if (bytes.length < 3) return false
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true
  for (let i = 0; i < Math.min(bytes.length - 1, 64); i++) {
    if (bytes[i] === 0xff && (bytes[i + 1] & 0xe0) === 0xe0) return true
  }
  return false
}

export function decodePreviewMp3(base64: string): Uint8Array {
  const clean = String(base64 || '').replace(/\s/g, '')
  if (clean.length < 64) throw new Error('试听音频为空')
  let bin: string
  try {
    bin = atob(clean)
  } catch {
    throw new Error('试听音频损坏')
  }
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  if (bytes.length < 256 || !looksLikeMp3(bytes)) {
    throw new Error('试听不是可播放的 MP3')
  }
  return bytes
}

export function previewAudioUrl(mime: string, base64: string): { url: string; revoke: () => void } {
  const bytes = decodePreviewMp3(base64)
  // Copy into a plain ArrayBuffer — some Electron builds reject TypedArray views in Blob.
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  const blob = new Blob([ab], { type: mime || 'audio/mpeg' })
  const url = URL.createObjectURL(blob)
  return {
    url,
    revoke: () => {
      try {
        URL.revokeObjectURL(url)
      } catch {
        /* ignore */
      }
    },
  }
}
