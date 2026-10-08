import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { speak } from './tts.ts';
import { detectContentLang, type ContentLang } from './make/contentLang.ts';
import type { Settings } from '../../shared/src/index.ts';

/** 试听必须尊重所选音色，不能按默认 zh 把 en-* 全换成 Yunxi */
function contentLangForPreview(voice: string, text: string): ContentLang {
  const v = (voice || '').trim();
  if (v.startsWith('my:')) return detectContentLang(text) || 'zh';
  if (/^en-/i.test(v)) return 'en';
  if (/^zh-/i.test(v)) return 'zh';
  return detectContentLang(text);
}

function previewSample(text: string, lang: ContentLang): string {
  const t = (text || '').trim();
  if (t) return t.slice(0, 120);
  return lang === 'en'
    ? 'Hello, this is a voice preview.'
    : '你好，这是当前配音试听。';
}

/** 短句试听，返回 mp3 buffer */
export async function previewSpeech(text: string, voice: string, settings: Settings) {
  const voiceId = (voice || settings.speechVoice || '').trim();
  const lang = contentLangForPreview(voiceId, text);
  const sample = previewSample(text, lang);
  const out = join(tmpdir(), `factory-preview-${Date.now()}.mp3`);
  const next: Settings = {
    ...settings,
    speechVoice: voiceId || settings.speechVoice,
    // 系统音色试听强制走 edge，避免误用 openai 通道
    speechProvider: voiceId.startsWith('my:')
      ? settings.speechProvider
      : (settings.speechProvider === 'openai' ? 'edge' : settings.speechProvider),
  };
  try {
    await speak(sample, out, next, { contentLang: lang, lockVoice: true });
    if (!existsSync(out)) throw new Error('试听文件未生成');
    return readFileSync(out);
  } finally {
    try { unlinkSync(out); } catch { /* ignore */ }
  }
}
