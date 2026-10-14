import { describe, expect, it } from 'vitest'
import { classifyTaskError, voiceNoticeKey } from '@/lib/notice-kind'

describe('classifyTaskError', () => {
  it('maps connection failures to network', () => {
    expect(classifyTaskError('fetch failed')).toBe('network')
    expect(classifyTaskError('getaddrinfo ENOTFOUND api.example.com')).toBe('network')
    expect(classifyTaskError('请求超时')).toBe('network')
  })

  it('maps quota and balance to billing', () => {
    expect(classifyTaskError('Error: insufficient_quota')).toBe('billing')
    expect(classifyTaskError('账户余额不足')).toBe('billing')
    expect(classifyTaskError('HTTP 402 Payment Required')).toBe('billing')
  })

  it('maps speech failures to voice', () => {
    expect(classifyTaskError('edge-tts exited 1')).toBe('voice')
    expect(classifyTaskError('配音合成失败')).toBe('voice')
    expect(classifyTaskError('WebSocket 连接失败（HTTP 403）；诊断：{"voice":"zh-CN-XiaoyiNeural"}')).toBe('voice')
  })

  it('keeps license and unknown failures out of billing', () => {
    expect(classifyTaskError('体验已结束，请输入激活码')).toBe('other')
    expect(classifyTaskError('Remotion 失败：fps must be positive')).toBe('other')
  })

  it('prefers billing when a voice call is out of quota', () => {
    expect(classifyTaskError('tts insufficient_quota')).toBe('billing')
  })

  it('maps Edge TTS cases to specific voice toasts', () => {
    expect(voiceNoticeKey('WebSocket 连接失败（HTTP 403）')).toBe('notice.voiceBlocked')
    expect(voiceNoticeKey('WEBSOCKET_503')).toBe('notice.voiceBusy')
    expect(voiceNoticeKey('音色不可用：zh-CN-XiaohanNeural')).toBe('notice.voiceGone')
    expect(voiceNoticeKey('WebSocket 长时间未收到上游消息')).toBe('notice.voiceTimeout')
    expect(voiceNoticeKey('Failed to load because no supported source was found.')).toBe('notice.voicePlay')
    expect(voiceNoticeKey('试听音频为空')).toBe('notice.voice')
    expect(classifyTaskError('试听音频为空')).toBe('voice')
  })
})
