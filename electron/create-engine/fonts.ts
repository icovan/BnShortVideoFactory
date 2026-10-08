import { existsSync } from 'node:fs'
import { platform } from 'node:os'

/** FFmpeg drawtext 在 Windows 上必须指定中文字体，否则中文会失败或方块 */
export function resolveDrawtextFont(): string | null {
  const candidates =
    platform() === 'win32'
      ? [
          'C:/Windows/Fonts/msyh.ttc',
          'C:/Windows/Fonts/msyh.ttf',
          'C:/Windows/Fonts/simhei.ttf',
          'C:/Windows/Fonts/simsun.ttc',
          'C:/Windows/Fonts/arialuni.ttf',
        ]
      : platform() === 'darwin'
        ? [
            '/System/Library/Fonts/PingFang.ttc',
            '/System/Library/Fonts/STHeiti Light.ttc',
            '/Library/Fonts/Arial Unicode.ttf',
          ]
        : [
            '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
            '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
            '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
          ]

  for (const p of candidates) {
    if (existsSync(p)) return p.replace(/\\/g, '/')
  }
  return null
}

export function fontfileFilterArg(): string {
  const font = resolveDrawtextFont()
  if (!font) return ''
  // ffmpeg filter path: escape drive colon on Windows already using forward slashes
  const escaped = font.replace(/:/g, '\\:').replace(/'/g, "\\'")
  return `fontfile='${escaped}':`
}

export function assertFontOrWarn(): string | null {
  const font = resolveDrawtextFont()
  if (!font) {
    console.warn('[create-engine] 未找到中文字体，drawtext 可能失败')
  }
  return font
}
