/**
 * 素材混剪：口播硬锁 → TTS → 随机切素材 → FFmpeg 合成（+ SRT 字幕）。
 * 画面主体是用户视频；Remotion 不参与。
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { basename, extname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { Aspect, Project, Quality, Settings } from '../../../shared/src/index.ts';
import { listFiles, newProjectDir } from '../paths.ts';
import { finishPipeline, resetPipeline, setPipelineStep } from '../pipeline.ts';
import { store } from '../store.ts';
import { speak } from '../tts.ts';
import { probeAudioDuration, probeMp4 } from '../probe.ts';
import {
  detectContentLang,
  isContentLang,
  stripFactoryPackLines,
  type ContentLang,
} from './contentLang.ts';
import {
  joinDocsText,
  polishScriptForFilm,
  resolveScriptDrive,
  splitVerbatimScript,
  synthesizeScriptFromAsk,
  type ScriptDriveMode,
} from './scriptDrive.ts';
import { docsBriefBlock, extractDocText, type IncomingUserAsset } from './userAssets.ts';
import { snapshotProjectVersion, labelInitial } from './projectVersions.ts';

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.mkv', '.m4v']);
const MIN_SEG = 2;
const MAX_SEG = 12;

export type RemixBrief = {
  topic?: string;
  brand?: string;
  sellingPoints?: string;
  theme?: string;
};

export type FootageRemixOpts = {
  aspect?: Aspect;
  quality?: Quality;
  scriptDrive?: ScriptDriveMode;
  contentLang?: ContentLang;
  userAssets?: IncomingUserAsset[];
  /** 本机素材文件夹（Electron 绝对路径） */
  footageFolder?: string;
  /** 显式 mp4 路径列表 */
  footagePaths?: string[];
  /** 话题字段：品牌/卖点/主题，约束口播策划 */
  remixBrief?: RemixBrief;
};

function remixBriefBlock(brief?: RemixBrief): string {
  if (!brief) return '';
  const lines: string[] = ['【混剪策划约束 — 口播必须遵守，勿编造未给出的品牌/卖点】'];
  if (brief.topic === 'promo') {
    lines.push('片型：产品种草');
    if (brief.brand?.trim()) lines.push(`品牌（硬事实）：${brief.brand.trim()}`);
    if (brief.sellingPoints?.trim()) lines.push(`产品卖点（硬事实）：${brief.sellingPoints.trim()}`);
    lines.push('口播围绕品牌与卖点展开：痛点 → 解决 → CTA；自然口语，勿广告腔。');
  } else if (brief.topic === 'story') {
    lines.push('片型：故事口播');
    if (brief.theme?.trim()) lines.push(`主题（硬事实）：${brief.theme.trim()}`);
    lines.push('弧线：钩子 → 过程细节 → 反转/收获；一句一意。');
  } else if (brief.topic === 'tips') {
    lines.push('片型：干货清单');
    if (brief.theme?.trim()) lines.push(`主题（硬事实）：${brief.theme.trim()}`);
    lines.push('列出约 3 个立刻能用的小技巧，每点一句口播。');
  } else {
    if (brief.brand?.trim()) lines.push(`品牌：${brief.brand.trim()}`);
    if (brief.sellingPoints?.trim()) lines.push(`卖点：${brief.sellingPoints.trim()}`);
    if (brief.theme?.trim()) lines.push(`主题：${brief.theme.trim()}`);
  }
  return lines.length > 1 ? lines.join('\n') : '';
}

type Seg = { path: string; start: number; end: number };

function earlyExtractDocs(assets?: IncomingUserAsset[]) {
  if (!assets?.length) return [] as { name: string; text: string }[];
  const out: { name: string; text: string }[] = [];
  for (const a of assets) {
    const isDoc = a.kind === 'doc'
      || /\.(pdf|txt|md|csv|json)$/i.test(a.name)
      || a.dataUrl.startsWith('data:text/')
      || a.dataUrl.startsWith('data:application/pdf')
      || a.dataUrl.startsWith('data:application/json');
    if (!isDoc) continue;
    const m = a.dataUrl.match(/^data:([^;,]+)?(;base64)?,([\s\S]+)$/i);
    if (!m) continue;
    const mime = (m[1] || '').toLowerCase();
    const isB64 = Boolean(m[2]);
    const payload = m[3] || '';
    try {
      const buf = isB64
        ? Buffer.from(payload, 'base64')
        : Buffer.from(decodeURIComponent(payload), 'utf8');
      const text = extractDocText(a.name, mime || 'application/octet-stream', buf);
      if (text.trim()) out.push({ name: a.name, text });
    } catch {
      /* skip */
    }
  }
  return out;
}

function listFootageFiles(folder?: string, paths?: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (p: string) => {
    const abs = (p || '').trim();
    if (!abs || seen.has(abs) || !existsSync(abs)) return;
    if (!VIDEO_EXTS.has(extname(abs).toLowerCase())) return;
    seen.add(abs);
    out.push(abs);
  };
  for (const p of paths || []) push(p);
  if (folder && existsSync(folder)) {
    for (const name of readdirSync(folder)) {
      push(join(folder, name));
    }
  }
  return out;
}

function wrapCaption(vo: string) {
  const t = (vo || '').trim();
  if (t.length <= 18) return t;
  const mid = Math.ceil(t.length / 2);
  let cut = t.lastIndexOf('，', mid);
  if (cut < 4) cut = t.lastIndexOf(' ', mid);
  if (cut < 4) cut = mid;
  return `${t.slice(0, cut).trim()}\n${t.slice(cut).replace(/^[，,\s]+/, '').trim()}`;
}

function srtTime(sec: number) {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function toSrt(cues: { from: number; to: number; text: string }[]) {
  return cues
    .map((c, i) => `${i + 1}\n${srtTime(c.from)} --> ${srtTime(c.to)}\n${c.text}\n`)
    .join('\n');
}

function rand(min: number, max: number) {
  if (max <= min) return min;
  return min + Math.random() * (max - min);
}

/** 随机切段铺满目标时长（对齐 short-video-factory 思路） */
function pickSegments(files: string[], targetSec: number): Seg[] {
  const usable: { path: string; dur: number }[] = [];
  for (const p of files) {
    try {
      const d = probeMp4(p).duration;
      if (d > 0.4) usable.push({ path: p, dur: d });
    } catch {
      /* skip */
    }
  }
  if (!usable.length) throw new Error('素材库里没有可用的视频文件（需 mp4/mov 等）');

  const target = Math.max(1, targetSec);
  const segs: Seg[] = [];
  let filled = 0;
  let guard = 0;
  let pool = [...usable];

  while (filled < target - 0.05 && guard < 400) {
    guard += 1;
    if (!pool.length) pool = [...usable];
    const i = Math.floor(Math.random() * pool.length);
    const [hit] = pool.splice(i, 1);
    if (!hit) continue;
    const remain = target - filled;
    const segDur = hit.dur < MIN_SEG
      ? Math.min(hit.dur, remain)
      : Math.min(remain, Math.max(0.5, rand(MIN_SEG, Math.min(MAX_SEG, hit.dur))));
    const maxStart = Math.max(0, hit.dur - segDur);
    const start = maxStart > 0 ? rand(0, maxStart) : 0;
    const end = start + segDur;
    segs.push({ path: hit.path, start: Number(start.toFixed(3)), end: Number(end.toFixed(3)) });
    filled += segDur;
  }
  if (!segs.length) throw new Error('未能从素材切出分镜片段');
  return segs;
}

function aspectSize(aspect: Aspect, quality: Quality): { w: number; h: number } {
  const short = quality === '720p' ? 720 : 1080;
  if (aspect === '9:16') return { w: short, h: Math.round((short * 16) / 9) };
  if (aspect === '3:4') return { w: short, h: Math.round((short * 4) / 3) };
  if (aspect === '1:1') return { w: short, h: short };
  return { w: Math.round((short * 16) / 9), h: short };
}

function escapeSubPath(p: string) {
  return p
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'");
}

function concatVoClips(clips: string[], listFile: string, outFile: string) {
  writeFileSync(
    listFile,
    clips.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'),
    'utf8',
  );
  const r = spawnSync(
    'ffmpeg',
    ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outFile],
    { windowsHide: true, encoding: 'utf8' },
  );
  if (r.status !== 0 && clips[0]) copyFileSync(clips[0], outFile);
}

function renderRemixFfmpeg(opts: {
  segs: Seg[];
  voice: string;
  srt: string;
  out: string;
  w: number;
  h: number;
  durationSec: number;
}) {
  const args: string[] = ['-y'];
  for (const s of opts.segs) {
    args.push('-i', s.path);
  }
  args.push('-i', opts.voice);

  const filters: string[] = [];
  const labels: string[] = [];
  opts.segs.forEach((s, i) => {
    const lab = `v${i}`;
    labels.push(lab);
    filters.push(
      `[${i}:v]trim=start=${s.start}:end=${s.end},setpts=PTS-STARTPTS,`
      + `scale=${opts.w}:${opts.h}:force_original_aspect_ratio=decrease,`
      + `pad=${opts.w}:${opts.h}:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p,setsar=1[${lab}]`,
    );
  });
  filters.push(`[${labels.join('][')}]concat=n=${opts.segs.length}:v=1:a=0[vconcat]`);
  filters.push(`[vconcat]fps=30,format=yuv420p,setpts=PTS-STARTPTS[vout]`);

  const voiceIdx = opts.segs.length;
  const srtEsc = escapeSubPath(opts.srt);
  // 竖屏偏下安全区：MarginV 约 12% 高
  const marginV = Math.round(opts.h * 0.12);
  const fontSize = opts.w >= 1080 ? 42 : 36;
  filters.push(
    `[vout]subtitles='${srtEsc}':force_style='FontName=Microsoft YaHei,FontSize=${fontSize},`
    + `PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=3,Outline=2,Shadow=0,`
    + `Alignment=2,MarginV=${marginV}'[with_subs]`,
  );
  filters.push(`[${voiceIdx}:a]loudnorm=I=-16:TP=-1.5:LRA=11,atrim=0:${opts.durationSec},asetpts=PTS-STARTPTS[final_audio]`);

  args.push(
    '-filter_complex', filters.join(';'),
    '-map', '[with_subs]',
    '-map', '[final_audio]',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '23',
    '-r', '30',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-fps_mode', 'cfr',
    '-t', String(opts.durationSec),
    opts.out,
  );

  let r = spawnSync('ffmpeg', args, { windowsHide: true, encoding: 'utf8', maxBuffer: 20_000_000 });
  if (r.status !== 0) {
    // 字幕滤镜/字体失败时降级：无字幕仍出片
    const filtersNoSub: string[] = [];
    const labels2: string[] = [];
    opts.segs.forEach((s, i) => {
      const lab = `v${i}`;
      labels2.push(lab);
      filtersNoSub.push(
        `[${i}:v]trim=start=${s.start}:end=${s.end},setpts=PTS-STARTPTS,`
        + `scale=${opts.w}:${opts.h}:force_original_aspect_ratio=decrease,`
        + `pad=${opts.w}:${opts.h}:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p,setsar=1[${lab}]`,
      );
    });
    filtersNoSub.push(`[${labels2.join('][')}]concat=n=${opts.segs.length}:v=1:a=0[vconcat]`);
    filtersNoSub.push(`[vconcat]fps=30,format=yuv420p,setpts=PTS-STARTPTS[with_subs]`);
    filtersNoSub.push(`[${voiceIdx}:a]loudnorm=I=-16:TP=-1.5:LRA=11,atrim=0:${opts.durationSec},asetpts=PTS-STARTPTS[final_audio]`);
    const args2: string[] = ['-y'];
    for (const s of opts.segs) args2.push('-i', s.path);
    args2.push('-i', opts.voice);
    args2.push(
      '-filter_complex', filtersNoSub.join(';'),
      '-map', '[with_subs]',
      '-map', '[final_audio]',
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      '-r', '30',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-fps_mode', 'cfr',
      '-t', String(opts.durationSec),
      opts.out,
    );
    r = spawnSync('ffmpeg', args2, { windowsHide: true, encoding: 'utf8', maxBuffer: 20_000_000 });
    if (r.status !== 0) {
      const err = (r.stderr || r.stdout || '').slice(-800);
      throw new Error(`混剪 FFmpeg 失败：${err || `exit ${r.status}`}`);
    }
  }
  if (!existsSync(opts.out)) throw new Error('混剪导出失败：未生成 final.mp4');
}

export async function makeFootageRemix(
  prompt: string,
  settings: Settings,
  projectId: string,
  opts?: FootageRemixOpts,
): Promise<Project> {
  const aspect: Aspect = opts?.aspect || '9:16';
  const quality: Quality = opts?.quality === '720p' ? '720p' : '1080p';
  const ask = stripFactoryPackLines(prompt).trim() || prompt.trim();
  if (!ask) throw new Error('请先填写混剪需求或上传口播文稿');

  const footage = listFootageFiles(opts?.footageFolder, opts?.footagePaths);
  if (!footage.length) {
    throw new Error('请先选择分镜素材文件夹（内含 mp4 等视频）');
  }

  resetPipeline(projectId, 'footage-remix', 'footage-remix', {
    engine: 'footage-remix',
    stylePack: 'footage-remix',
    aspect,
    quality,
    title: ask.slice(0, 28) || '素材混剪',
  });

  const docTexts = earlyExtractDocs(opts?.userAssets);
  const scriptMode = resolveScriptDrive({
    uiMode: opts?.scriptDrive ?? 'auto',
    hasDocs: docTexts.length > 0,
  });

  setPipelineStep(projectId, 'plan', 'running', '业务口播文案');
  const contentLang: ContentLang = opts?.contentLang && isContentLang(opts.contentLang)
    ? opts.contentLang
    : detectContentLang(ask);
  const briefBlock = remixBriefBlock(opts?.remixBrief);
  const askWithBrief = [ask, briefBlock].filter(Boolean).join('\n\n');

  let voLines: string[] = [];
  if (docTexts.length && scriptMode !== 'off') {
    const sourceText = joinDocsText(docTexts);
    if (scriptMode === 'verbatim') {
      voLines = splitVerbatimScript(sourceText).slice(0, 40);
    } else {
      const beats = await polishScriptForFilm(settings, {
        sourceText,
        contentLang,
        aspect,
        userAsk: askWithBrief,
      });
      voLines = beats.map((b) => b.vo).filter((s) => s.length >= 2);
    }
  }
  if (voLines.length < 3) {
    const synth = await synthesizeScriptFromAsk(settings, {
      userAsk: [askWithBrief, docsBriefBlock(docTexts)].filter(Boolean).join('\n\n'),
      contentLang,
      aspect,
    });
    if (synth.length >= 3) voLines = synth.map((b) => b.vo);
  }
  if (voLines.length < 2) {
    voLines = splitVerbatimScript(ask).slice(0, 24);
  }
  if (voLines.length < 2) throw new Error('未能生成可用口播文案，请补充需求或上传文稿');

  const driveLabel = docTexts.length
    ? (scriptMode === 'off' ? 'polish' : scriptMode)
    : 'synthesize';

  const { dir, dirName } = newProjectDir('remix', ask);
  store.patchProject(projectId, { dir: dirName, title: ask.slice(0, 28) || '素材混剪' });
  const publicDir = join(dir, 'public');
  mkdirSync(publicDir, { recursive: true });
  writeFileSync(
    join(dir, 'prompt.md'),
    `# ${ask}\n\nfootage: ${footage.length}\n\n${briefBlock}\n`,
    'utf8',
  );
  writeFileSync(join(dir, 'script-vo.md'), voLines.map((v, i) => `${i + 1}. ${v}`).join('\n'), 'utf8');
  writeFileSync(
    join(dir, 'content-lang.json'),
    JSON.stringify({
      contentLang,
      scriptDrive: driveLabel,
      formMode: 'remix',
      remixBrief: opts?.remixBrief || null,
    }, null, 2),
    'utf8',
  );
  // 工位可读的分镜骨架（时长在 TTS 后回写）
  writeFileSync(
    join(dir, 'storyboard.json'),
    JSON.stringify({
      aspect,
      contentLang,
      scenes: voLines.map((vo, i) => ({
        job: `beat-${i}`,
        vo,
        headline: vo.slice(0, 16),
        visualIntent: 'footage cut',
        keyMotion: 'hard cut',
        durationSec: 2,
      })),
    }, null, 2),
    'utf8',
  );
  setPipelineStep(projectId, 'plan', 'done', `口播 ${voLines.length} 句`);

  setPipelineStep(projectId, 'brief', 'running', `素材 ${footage.length} 条`);
  writeFileSync(
    join(dir, 'footage-index.json'),
    JSON.stringify(
      {
        folder: opts?.footageFolder || null,
        files: footage.map((p) => ({ path: p, name: basename(p) })),
      },
      null,
      2,
    ),
    'utf8',
  );
  setPipelineStep(projectId, 'brief', 'done', `${footage.length} 条可用`);

  setPipelineStep(projectId, 'voice', 'running', 'TTS per line');
  const captions: { from: number; to: number; text: string }[] = [];
  const clips: string[] = [];
  let t = 0;
  for (let i = 0; i < voLines.length; i++) {
    const vo = voLines[i];
    const clip = join(publicDir, `vo-${i}.mp3`);
    await speak(vo, clip, settings, { contentLang });
    const dur = existsSync(clip) ? probeAudioDuration(clip) : 1.2;
    const hold = Math.max(0.8, dur + 0.12);
    captions.push({ from: t + 0.05, to: t + Math.max(0.8, dur), text: wrapCaption(vo) });
    clips.push(clip);
    t += hold;
    setPipelineStep(projectId, 'voice', 'running', `TTS ${i + 1}/${voLines.length}`);
  }
  const narr = join(dir, 'narration.mp3');
  concatVoClips(clips, join(dir, 'concat-vo.txt'), narr);
  const voiceDur = probeAudioDuration(narr) || t;
  writeFileSync(join(dir, 'captions.srt'), toSrt(captions), 'utf8');
  // 回写真实镜长，供工作台 seek
  const sceneDurs = captions.map((c, i) => {
    const next = captions[i + 1]?.from ?? voiceDur;
    return Math.max(0.8, Number((next - c.from + 0.05).toFixed(3)));
  });
  const propsJson = JSON.stringify({
    aspect,
    contentLang,
    coreIdea: ask.slice(0, 80),
    scenes: voLines.map((vo, i) => ({
      job: `beat-${i}`,
      vo,
      headline: vo.slice(0, 16),
      visualIntent: 'footage cut',
      keyMotion: 'hard cut',
      durationSec: sceneDurs[i] || 2,
      narrationFile: `vo-${i}.mp3`,
    })),
  }, null, 2);
  writeFileSync(join(dir, 'props.json'), propsJson, 'utf8');
  writeFileSync(join(dir, 'storyboard.json'), propsJson, 'utf8');
  setPipelineStep(projectId, 'voice', 'done', `${voiceDur.toFixed(1)}s`);

  setPipelineStep(projectId, 'encode', 'running', '切素材…');
  const segs = pickSegments(footage, voiceDur);
  writeFileSync(
    join(dir, 'segments.json'),
    JSON.stringify({ targetSec: voiceDur, segments: segs }, null, 2),
    'utf8',
  );
  const { w, h } = aspectSize(aspect, quality);
  const finalMp4 = join(dir, 'final.mp4');
  setPipelineStep(projectId, 'encode', 'running', `FFmpeg · ${segs.length} 段`);
  renderRemixFfmpeg({
    segs,
    voice: narr,
    srt: join(dir, 'captions.srt'),
    out: finalMp4,
    w,
    h,
    durationSec: Number(voiceDur.toFixed(3)),
  });

  // 封面：首帧
  try {
    spawnSync(
      'ffmpeg',
      ['-y', '-ss', '0.2', '-i', finalMp4, '-frames:v', '1', join(dir, 'poster.jpg')],
      { windowsHide: true },
    );
  } catch {
    /* ignore */
  }

  const lang = contentLang === 'en' ? 'en' : 'zh';
  let versions = store.getProject(projectId)?.versions || [];
  if (existsSync(finalMp4) && !versions.length) {
    try {
      const initial = await snapshotProjectVersion(dir, {
        label: labelInitial(lang),
        kind: 'initial',
        note: '混剪成片',
        durationSec: Math.round(voiceDur),
      });
      versions = [initial];
    } catch {
      /* ignore */
    }
  }

  return finishPipeline(projectId, {
    title: ask.slice(0, 28) || '素材混剪',
    kind: 'explainer',
    engine: 'footage-remix',
    stylePack: 'footage-remix',
    dir: dirName,
    durationSec: Math.round(voiceDur),
    aspect,
    quality,
    files: listFiles(dir),
    versions,
    currentVersionId: versions[0]?.id,
  }) || store.getProject(projectId)!;
}

/** 供 fromPrompt 判断是否走混剪 */
export function isRemixFormMode(formMode?: string) {
  return formMode === 'remix' || formMode === 'footage-remix';
}
