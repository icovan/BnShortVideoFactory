import { spawn } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  statSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { REMOTION_PKG } from '../paths.ts';
import { probeMp4 } from '../probe.ts';
import { sumSceneFrames } from '../make/sceneFrames.ts';

const requireFromPkg = createRequire(join(REMOTION_PKG, 'package.json'));

function remotionCliJs() {
  const pkgJson = requireFromPkg.resolve('@remotion/cli/package.json');
  return join(dirname(pkgJson), 'remotion-cli.js');
}

function browserExe() {
  const candidates = [
    process.env.REMOTION_BROWSER_EXECUTABLE,
    process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean) as string[];
  return candidates.find((p) => existsSync(p));
}

function run(bin: string, args: string[], cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd,
      windowsHide: true,
      shell: false,
      env: { ...process.env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += String(d); });
    child.stderr.on('data', (d) => { stderr += String(d); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

/** 优先保留 esbuild/webpack 的 ERROR 行，避免只截到 addChunk 栈尾 */
function remotionFailSnippet(stderr: string, stdout: string): string {
  const plain = `${stderr || ''}\n${stdout || ''}`.replace(/\x1b\[[0-9;]*m/g, '');
  const lines = plain.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const key = lines.filter((l) =>
    /ERROR:|Error:|Transform failed|Module build failed|Expected |Cannot find/i.test(l),
  );
  const pick = (key.length ? key : lines).slice(0, 10).join('\n');
  return (pick || plain).slice(0, 1200);
}

async function remotion(args: string[], cwd: string) {
  const cli = remotionCliJs();
  const browser = browserExe();
  const full = [cli, ...args];
  if (browser) full.push(`--browser-executable=${browser}`);
  const r = await run(process.execPath, full, cwd);
  if (r.code !== 0) throw new Error(`Remotion 失败：${remotionFailSnippet(r.stderr, r.stdout)}`);
  return r;
}

const MEDIA_FILE_RE = /\.(mp3|wav|ogg|json|png|jpe?g|webp|gif|svg)$/i;

/** Mirror project public media into Remotion package public/ so staticFile resolves. */
function syncPublicMedia(publicDir: string) {
  const pkgPublic = join(REMOTION_PKG, 'public');
  mkdirSync(pkgPublic, { recursive: true });
  mkdirSync(join(pkgPublic, 'sfx'), { recursive: true });
  if (!existsSync(publicDir)) return;
  for (const name of readdirSync(publicDir)) {
    const src = join(publicDir, name);
    if (name === 'sfx' && existsSync(src)) {
      mkdirSync(join(pkgPublic, 'sfx'), { recursive: true });
      for (const f of readdirSync(src)) {
        if (/\.(mp3|wav|ogg)$/i.test(f)) {
          copyFileSync(join(src, f), join(pkgPublic, 'sfx', f));
        }
      }
      continue;
    }
    // User logo/product/shots live under public/assets/
    if (name === 'assets' && existsSync(src)) {
      const destAssets = join(pkgPublic, 'assets');
      mkdirSync(destAssets, { recursive: true });
      for (const f of readdirSync(src)) {
        if (MEDIA_FILE_RE.test(f)) {
          copyFileSync(join(src, f), join(destAssets, f));
        }
      }
      continue;
    }
    if (MEDIA_FILE_RE.test(name)) {
      copyFileSync(src, join(pkgPublic, name));
    }
  }
}

type SceneTiming = { durationSec: number };

export type RemotionCompositionId =
  | 'LaunchShowreel'
  | 'NarratedExplainer'
  | 'GeneratedLaunch'
  | 'GeneratedNarrated'
  | 'NextWordLoop'
  | 'GeneratedNextWord'
  | 'GeneratedDirected';

/** Skill verify：still → render → probe */
export async function renderRemotionComposition(opts: {
  compositionId: RemotionCompositionId;
  propsPath: string;
  outMp4: string;
  publicDir: string;
  stillsDir: string;
  scenes: SceneTiming[];
  narrationPath?: string;
  onPhase?: (phase: 'stills' | 'encode', detail?: string) => void;
  /** default both */
  phases?: Array<'stills' | 'encode'>;
  /** ffprobe expectation; default 1920x1080 landscape */
  probeRes?: string;
}) {
  mkdirSync(opts.publicDir, { recursive: true });
  mkdirSync(opts.stillsDir, { recursive: true });
  const phases = opts.phases?.length ? opts.phases : ['stills', 'encode'];

  const props = JSON.parse(readFileSync(opts.propsPath, 'utf8')) as Record<string, unknown>;
  if (opts.narrationPath && existsSync(opts.narrationPath)) {
    const narrName = 'narration.mp3';
    copyFileSync(opts.narrationPath, join(opts.publicDir, narrName));
    props.narrationFile = narrName;
  }

  syncPublicMedia(opts.publicDir);

  const propsForRender = join(opts.publicDir, 'props.render.json');
  writeFileSync(propsForRender, JSON.stringify(props), 'utf8');
  copyFileSync(propsForRender, join(REMOTION_PKG, 'public', 'props.render.json'));

  const FPS = 30;
  const totalFrames = sumSceneFrames(opts.scenes, FPS);

  if (phases.includes('stills')) {
    // Drop stale f-*-frame*.png so remaps / shorter samples cannot ghost prior runs
    for (const f of readdirSync(opts.stillsDir)) {
      if (/^f-\d+-frame\d+\.png$/i.test(f)) {
        try { unlinkSync(join(opts.stillsDir, f)); } catch { /* ignore */ }
      }
    }

    const holds: number[] = [];
    let acc = 0;
    for (let si = 0; si < opts.scenes.length; si++) {
      const dur = Math.max(1, Math.round(opts.scenes[si].durationSec * FPS));
      // Avoid empty enter frames (esp. problem DotGrid at f=0)
      const mid = acc + Math.max(si === 0 ? 12 : 4, Math.floor(dur * 0.45));
      holds.push(Math.min(acc + dur - 1, mid));
      acc += dur;
    }
    const seriesFrames = Math.min(totalFrames, acc || totalFrames);
    if (seriesFrames > 1) holds.push(seriesFrames - 1);

    const uniqueFrames = [...new Set(holds.filter((f) => f >= 0 && f < seriesFrames))];
    const sample = uniqueFrames.length <= 8
      ? uniqueFrames
      : [uniqueFrames[0], ...uniqueFrames.filter((_, i) => i % 2 === 0).slice(1, -1), uniqueFrames[uniqueFrames.length - 1]];

    opts.onPhase?.('stills', `still 0/${sample.length}`);
    for (let i = 0; i < sample.length; i++) {
      const frame = sample[i];
      const outPng = join(opts.stillsDir, `f-${i}-frame${frame}.png`);
      opts.onPhase?.('stills', `still ${i + 1}/${sample.length} · frame ${frame}`);
      await remotion([
        'still', 'src/index.ts', opts.compositionId, outPng,
        `--frame=${frame}`,
        `--props=${propsForRender}`,
        '--overwrite',
      ], REMOTION_PKG);
      if (!existsSync(outPng)) throw new Error(`验帧失败：未写出 ${outPng}`);
    }
  }

  if (phases.includes('encode')) {
    opts.onPhase?.('encode', 'remotion render');
    // 原子写出：先渲染到 .next.mp4，再替换 final.mp4。
    // 避免「文件已存在 / 被占用」时 Remotion 看似成功但成片仍是旧的。
    const prevStat = existsSync(opts.outMp4) ? statSync(opts.outMp4) : null;
    const tmpOut = `${opts.outMp4}.next.mp4`;
    try {
      if (existsSync(tmpOut)) unlinkSync(tmpOut);
    } catch {
      /* ignore */
    }
    await remotion([
      'render', 'src/index.ts', opts.compositionId, tmpOut,
      `--props=${propsForRender}`,
      '--overwrite',
    ], REMOTION_PKG);

    if (!existsSync(tmpOut) || statSync(tmpOut).size < 1024) {
      throw new Error('Remotion 未产出有效临时成片');
    }
    probeMp4(tmpOut, { res: opts.probeRes || '1920x1080', fps: 30 });

    let replaced = false;
    let lastErr: unknown;
    for (let i = 0; i < 12; i++) {
      try {
        if (existsSync(opts.outMp4)) {
          try {
            unlinkSync(opts.outMp4);
          } catch {
            // 占用时直接 rename 覆盖（Win 上同卷 rename 可替换）
          }
        }
        renameSync(tmpOut, opts.outMp4);
        replaced = true;
        break;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 200 + i * 150));
      }
    }
    if (!replaced) {
      // 最后兜底：copy + 删临时
      try {
        copyFileSync(tmpOut, opts.outMp4);
        try {
          unlinkSync(tmpOut);
        } catch {
          /* ignore */
        }
        replaced = true;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!replaced || !existsSync(opts.outMp4)) {
      throw new Error(
        `成片替换失败（文件可能被播放器占用）：${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
      );
    }
    const nextStat = statSync(opts.outMp4);
    if (
      prevStat
      && nextStat.size === prevStat.size
      && Math.abs(nextStat.mtimeMs - prevStat.mtimeMs) < 5
    ) {
      throw new Error('成片未更新（仍是旧文件），请关闭预览后重试二次创作');
    }
  }
  return opts.outMp4;
}

/** @deprecated 用 renderRemotionComposition */
export async function renderExplainer(opts: {
  propsPath: string;
  narrationPath: string;
  outMp4: string;
  publicDir: string;
  stillsDir: string;
  scenes: SceneTiming[];
}) {
  return renderRemotionComposition({
    compositionId: 'NarratedExplainer',
    ...opts,
  });
}
