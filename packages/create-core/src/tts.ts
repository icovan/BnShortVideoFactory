import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Settings } from '../../shared/src/index.ts';
import { detectContentLang, resolveEdgeVoice, type ContentLang } from './make/contentLang.ts';
import { EdgeTTS, EdgeTTSError } from './lib/edge-tts.ts';

/** 本仓纯 TS EdgeTTS（WebSocket），与 Electron UI 试听同一实现；不依赖 Python / biunow-main。 */
const edgeTts = new EdgeTTS();

/** 微软已下线但仍可能残留在本机设置里的音色 → 就近可用替代 */
const RETIRED_VOICE_ALIASES: Record<string, string> = {
  'zh-CN-XiaohanNeural': 'zh-CN-XiaoxiaoNeural',
  'zh-CN-XiaomengNeural': 'zh-CN-XiaoxiaoNeural',
  'zh-CN-XiaomoNeural': 'zh-CN-XiaoyiNeural',
  'zh-CN-XiaoqiuNeural': 'zh-CN-XiaoxiaoNeural',
  'zh-CN-XiaoruiNeural': 'zh-CN-XiaoyiNeural',
  'zh-CN-XiaoshuangNeural': 'zh-CN-YunxiaNeural',
  'zh-CN-XiaoxuanNeural': 'zh-CN-XiaoxiaoNeural',
  'zh-CN-XiaoyanNeural': 'zh-CN-XiaoyiNeural',
  'zh-CN-XiaoyouNeural': 'zh-CN-YunxiaNeural',
  'zh-CN-XiaozhenNeural': 'zh-CN-XiaoxiaoNeural',
  'zh-CN-YunyeNeural': 'zh-CN-YunxiNeural',
  'zh-CN-YunzeNeural': 'zh-CN-YunyangNeural',
  'zh-CN-YunhaoNeural': 'zh-CN-YunjianNeural',
  'zh-CN-YunfengNeural': 'zh-CN-YunxiNeural',
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeEdgeVoice(voice: string): string {
  return RETIRED_VOICE_ALIASES[voice] || voice;
}

function isUnsupportedVoice(err: unknown): boolean {
  if (err instanceof EdgeTTSError && err.code === 'UNSUPPORTED_VOICE') return true;
  const msg = err instanceof Error ? err.message : String(err || '');
  return /Unsupported voice|音色不可用/i.test(msg);
}

/** 可换音色 / 再试：无音频、不支持音色，或上游可重试错误 */
function isFallbackError(err: unknown): boolean {
  if (isUnsupportedVoice(err)) return true;
  if (err instanceof EdgeTTSError) {
    return err.retryable || err.code === 'NO_AUDIO_RECEIVED';
  }
  const msg = err instanceof Error ? err.message : String(err || '');
  return /该音色当前不可用|NoAudioReceived|NO_AUDIO_RECEIVED|WebSocket|超时|timeout/i.test(msg);
}

/** 同语种备用音色：Edge 偶发 NoAudioReceived 时换线重试 */
function edgeVoiceFallbacks(primary: string): string[] {
  const zh = [
    'zh-CN-YunxiNeural',
    'zh-CN-XiaoxiaoNeural',
    'zh-CN-YunyangNeural',
    'zh-CN-YunjianNeural',
    'zh-CN-XiaoyiNeural',
  ];
  const en = [
    'en-US-JennyNeural',
    'en-US-GuyNeural',
    'en-GB-SoniaNeural',
    'en-US-AriaNeural',
  ];
  const pool = /^en-/i.test(primary) ? en : zh;
  return [primary, ...pool.filter((v) => v !== primary)];
}

function resolveCloneSettings(settings: Settings): Settings | null {
  const raw = settings.speechVoice || '';
  if (!raw.startsWith('my:')) return null;
  const id = raw.slice(3);
  const mine = (settings.myVoices || []).find((v) => v.id === id);
  if (!mine) throw new Error('未找到我的声音，请先在出片通道配置');
  const key = settings.cloneApiKey || settings.speechApiKey;
  if (!key) throw new Error('请先在出片通道填写复刻 API Key');
  const base =
    settings.cloneBaseUrl
    || (mine.provider === 'dashscope' ? 'https://dashscope.aliyuncs.com/compatible-mode/v1' : '')
    || (mine.provider === 'minimax' ? 'https://api.minimax.chat/v1' : '')
    || (mine.provider === 'fish' ? 'https://api.fish.audio/v1' : '')
    || settings.speechBaseUrl;
  if (!base) throw new Error('请先填写复刻 Base URL');
  return {
    ...settings,
    speechProvider: 'openai',
    speechApiKey: key,
    speechBaseUrl: base,
    speechModel: settings.speechModel && settings.speechModel !== 'edge-tts' ? settings.speechModel : 'cosyvoice-v2',
    speechVoice: mine.voiceId,
  };
}

export type SpeakOpts = {
  /** Audience language → picks Edge Neural voice when settings voice mismatches. */
  contentLang?: ContentLang;
  /** 试听：强制使用 settings.speechVoice，不做语种换声 */
  lockVoice?: boolean;
};

async function edgeSpeakOnce(text: string, outFile: string, voice: string): Promise<void> {
  const result = await edgeTts.synthesize(text, voice, {});
  const audio = result.getBuffer();
  if (!audio.length) {
    throw new Error('该音色当前不可用，请换一个再试听');
  }
  await result.toFile(outFile);
}

/**
 * Edge TTS：内置 idle/handshake 超时 + 重试；外层再换备用音色。
 */
async function edgeSpeakWithFallback(text: string, outFile: string, primaryVoice: string) {
  const voices = edgeVoiceFallbacks(primaryVoice);
  let lastErr: unknown;
  for (let vi = 0; vi < voices.length; vi++) {
    const voice = voices[vi]!;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (vi > 0 || attempt > 0) await sleep(350 + attempt * 250);
        await edgeSpeakOnce(text, outFile, voice);
        return outFile;
      } catch (e) {
        lastErr = e;
        if (!isFallbackError(e)) throw e;
        // 无效音色：别在同一 voice 上再打一轮，立刻换备用
        if (isUnsupportedVoice(e)) break;
      }
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error('该音色当前不可用，请换一个再试听');
}

/** 默认本仓 TS EdgeTTS；我的声音走兼容 /audio/speech。 */
export async function speak(text: string, outFile: string, settings: Settings, opts?: SpeakOpts) {
  mkdirSync(dirname(outFile), { recursive: true });
  const line = (text || '').trim();
  if (!line) throw new Error('配音文案为空');

  const resolved = resolveCloneSettings(settings) || settings;
  const contentLang = opts?.contentLang || detectContentLang(line) || 'zh';
  const picked = (resolved.speechVoice || '').trim();
  // 试听 / 显式锁音色：不做 en↔zh 换声，否则英文列表试听全变成同一个默认中文声
  const edgeVoice = opts?.lockVoice && /Neural/i.test(picked) && !picked.startsWith('my:')
    ? picked
    : resolveEdgeVoice(resolved, contentLang);
  const voice = normalizeEdgeVoice(
    edgeVoice.includes('Neural')
      ? edgeVoice
      : (picked.includes('Neural') ? picked : 'zh-CN-YunxiNeural'),
  );

  if (resolved.speechProvider === 'openai' && (resolved.speechApiKey || resolved.llmApiKey)) {
    const key = resolved.speechApiKey || resolved.llmApiKey;
    const base = (resolved.speechBaseUrl || resolved.llmBaseUrl).replace(/\/$/, '');
    const res = await fetch(`${base}/audio/speech`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: resolved.speechModel || 'tts-1',
        voice: resolved.speechVoice || 'alloy',
        input: line,
      }),
    });
    if (!res.ok) throw new Error(`云配音失败 ${res.status}`);
    writeFileSync(outFile, Buffer.from(await res.arrayBuffer()));
    return outFile;
  }

  return edgeSpeakWithFallback(line, outFile, voice);
}
