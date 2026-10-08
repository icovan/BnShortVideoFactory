import { execSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Settings } from '../../shared/src/index.ts';
import { detectContentLang, resolveEdgeVoice, type ContentLang } from './make/contentLang.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const EASEL_PY = join(ROOT, '../Easel/.venv/Scripts/python.exe');
const EASEL_TTS = join(ROOT, '../biunow-main/vendor/easel/scripts/tts.py');

let cachedPython: string | null | undefined;

/** 解析可用 Python（Docker 用 FACTORY_PYTHON=/opt/edge-tts/bin/python） */
function pythonBin(): string {
  if (cachedPython) return cachedPython;
  const envPy = (process.env.FACTORY_PYTHON || '').trim();
  const candidates = [
    envPy,
    EASEL_PY,
    process.platform === 'win32' ? 'python' : 'python3',
    process.platform === 'win32' ? 'py' : 'python',
    'python3',
    'python',
  ].filter(Boolean);
  for (const bin of candidates) {
    if (bin.includes('/') || bin.includes('\\')) {
      if (!existsSync(bin)) continue;
    }
    const r = spawnSync(bin, ['-c', 'import sys; print(sys.executable)'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 8_000,
    });
    if (r.status === 0 && String(r.stdout || '').trim()) {
      cachedPython = bin;
      return bin;
    }
  }
  cachedPython = null;
  throw new Error(
    '配音需要 Python + edge-tts，但未找到可用解释器（spawn python3 ENOENT）。'
    + '线上请重建镜像（已含 /opt/edge-tts）；本机请安装 Python 并 pip install edge-tts。',
  );
}

function ttsError(stderr: string, stdout: string) {
  const raw = `${stderr}\n${stdout}`;
  if (/NoAudioReceived/i.test(raw)) {
    return new Error('该音色当前不可用，请换一个再试听');
  }
  const line = raw.split(/\r?\n/).find((l) => /^ERROR:/i.test(l.trim()));
  return new Error(line ? line.replace(/^ERROR:\s*/i, '').slice(0, 160) : '配音合成失败');
}

function isNoAudioError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  return /该音色当前不可用|NoAudioReceived/i.test(msg);
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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

let cachedProxy: string | undefined;
let proxyResolved = false;

function windowsSystemProxy(): string | undefined {
  if (process.platform !== 'win32') return undefined;
  try {
    const enable = execSync(
      'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable',
      { encoding: 'utf8', windowsHide: true },
    );
    if (!/ProxyEnable\s+REG_DWORD\s+0x1\b/i.test(enable)) return undefined;
    const srv = execSync(
      'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer',
      { encoding: 'utf8', windowsHide: true },
    );
    const m = srv.match(/ProxyServer\s+REG_SZ\s+(\S+)/i);
    if (!m?.[1]) return undefined;
    const raw = m[1].trim();
    const pick = raw.includes('=')
      ? (raw.split(';').find((p) => p.toLowerCase().startsWith('https='))?.slice(6)
        || raw.split(';').find((p) => p.toLowerCase().startsWith('http='))?.slice(5)
        || '')
      : raw;
    if (!pick) return undefined;
    return pick.includes('://') ? pick : `http://${pick}`;
  } catch {
    return undefined;
  }
}

function edgeProxy(): string | undefined {
  if (!proxyResolved) {
    cachedProxy = process.env.HTTPS_PROXY || process.env.https_proxy
      || process.env.HTTP_PROXY || process.env.http_proxy
      || windowsSystemProxy();
    proxyResolved = true;
  }
  return cachedProxy;
}

function run(bin: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proxy = edgeProxy();
    const child = spawn(bin, args, {
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
        ...(proxy ? {
          HTTPS_PROXY: proxy,
          https_proxy: proxy,
          HTTP_PROXY: proxy,
          http_proxy: proxy,
        } : {}),
      },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += String(d); });
    child.stderr.on('data', (d) => { stderr += String(d); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
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

async function edgeSpeakOnce(
  text: string,
  outFile: string,
  voice: string,
  useProxy: boolean,
): Promise<void> {
  const proxy = useProxy ? edgeProxy() : undefined;
  if (existsSync(EASEL_TTS)) {
    const args = [EASEL_TTS, 'speak', '--text', text, '-o', outFile, '--voice', voice];
    if (proxy) args.push('--proxy', proxy);
    const r = await run(pythonBin(), args);
    if (r.code !== 0) throw ttsError(r.stderr, r.stdout);
    return;
  }
  const args = ['-m', 'edge_tts', '--voice', voice, '--text', text, '--write-media', outFile];
  if (proxy) args.push('--proxy', proxy);
  const r = await run(pythonBin(), args);
  if (r.code !== 0) throw ttsError(r.stderr, r.stdout);
}

/**
 * Edge TTS：同音色重试 → 换备用音色 → 最后一档去掉系统代理再试。
 * 覆盖微软偶发 NoAudioReceived（「该音色当前不可用」）。
 */
async function edgeSpeakWithFallback(text: string, outFile: string, primaryVoice: string) {
  const voices = edgeVoiceFallbacks(primaryVoice);
  const hasProxy = Boolean(edgeProxy());
  let lastErr: unknown;
  for (let vi = 0; vi < voices.length; vi++) {
    const voice = voices[vi]!;
    // 每音色：带代理试 2 次；若配了代理，再无代理试 1 次
    const modes: boolean[] = hasProxy ? [true, true, false] : [true, true];
    for (let mi = 0; mi < modes.length; mi++) {
      try {
        if (vi > 0 || mi > 0) await sleep(350 + mi * 250);
        await edgeSpeakOnce(text, outFile, voice, modes[mi]!);
        return outFile;
      } catch (e) {
        lastErr = e;
        if (!isNoAudioError(e)) throw e;
      }
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error('该音色当前不可用，请换一个再试听');
}

/** 默认走 Easel tts.py（edge-tts），与 Skill 口播链路一致。我的声音走兼容 /audio/speech。 */
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
  const voice = edgeVoice.includes('Neural')
    ? edgeVoice
    : (picked.includes('Neural') ? picked : 'zh-CN-YunxiNeural');

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
