import { describe, expect, it } from 'vitest'
import { decodePreviewMp3 } from '../../src/lib/speech-preview-audio'

describe('speech preview audio', () => {
  it('rejects empty or non-mp3 payloads', () => {
    expect(() => decodePreviewMp3('')).toThrow(/为空/)
    expect(() => decodePreviewMp3(btoa('not-audio-at-all-padding-xxxx-more-bytes-here!!!!'))).toThrow(/MP3/)
  })

  it('accepts a tiny mpeg frame as base64', () => {
    const frame = new Uint8Array(300)
    frame[0] = 0xff
    frame[1] = 0xfb
    frame[2] = 0x90
    frame[3] = 0x64
    let bin = ''
    for (const b of frame) bin += String.fromCharCode(b)
    const bytes = decodePreviewMp3(btoa(bin))
    expect(bytes[0]).toBe(0xff)
    expect(bytes.length).toBe(300)
  })
})
