/**
 * Hard skill pipeline primitives — non-negotiable rules from cankao skills,
 * enforced in code (not prompt-only).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync, copyFileSync } from 'node:fs';
// writeFileSync used by concatMp3List / skill gates
import { join } from 'node:path';

/** Planning-only pace (LLM/storyboard). Runtime picture MUST follow probed TTS, not this. */
export const VO_CHARS_PER_SEC = 5.2;
export const VO_BREATH_SEC = 0.15;
/** Tail silence after each spoken clip — keep snappy between sentences */
export const VO_TAIL_SEC = 0.12;

export type StyleLock = {
  canvas: string;
  ink: string;
  accent: string;
  muted: string;
  brandBg: string;
  easing: string;
  typeScale: { hero: number; title: number; body: number };
};

export const EXPLAINER_STYLE_LOCK: StyleLock = {
  canvas: '#FFFFFF',
  ink: '#1A1540',
  accent: '#5B4CDB',
  muted: '#6B6585',
  brandBg: '#4C3BCF',
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  typeScale: { hero: 96, title: 52, body: 28 },
};

export function estimateVoSec(text: string): number {
  const chars = text.replace(/\s+/g, '').length;
  return Math.max(1.2, Number((chars / VO_CHARS_PER_SEC + VO_BREATH_SEC).toFixed(3)));
}

/** Enforce explainer runtime shares (problem/solution/how/payoff) after VO exists */
export function assertExplainerRuntimeBudget(scenes: { stage: string; durationSec: number; vo?: string }[]) {
  const issues: string[] = [];
  const total = scenes.reduce((a, s) => a + s.durationSec, 0) || 1;
  const how = scenes.filter((s) => s.stage === 'research' || s.stage === 'design' || s.stage === 'solution');
  const howShare = how.reduce((a, s) => a + s.durationSec, 0) / total;
  if (howShare < 0.35) issues.push(`how-share ${howShare.toFixed(2)} < 0.35 (explainer skill wants ~45%)`);
  // Do NOT pad/gate against estimateVoSec — Edge/OpenAI TTS is often faster than char-budget,
  // and forcing picture ≥ estimate creates long dead air between sentences.
  for (const s of scenes) {
    if (s.vo?.trim() && s.durationSec < 1.0) {
      issues.push(`${s.stage}: picture ${s.durationSec}s too short`);
    }
  }
  return { ok: issues.length === 0, issues, totalSec: total, howShare };
}

/** Static check: generated TSX must realize technique cores */
export function assertTechniqueInTsx(
  tsx: string,
  scenes: { stage: string; technique?: string; recipeId?: string; visualIntent?: string }[],
): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const has = (re: RegExp) => re.test(tsx);

  if (scenes.some((s) => s.technique === 'diagram' || s.stage === 'research')) {
    const diagramOk =
      has(/strokeDash|path|svg|nodes?|edges?|cascade|outline/i)
      && (has(/stagger|spring\(/i) || has(/interpolate\(/));
    if (!diagramOk) issues.push('diagram skill: missing progressive disclosure (nodes/edges/svg + stagger)');
  }
  if (scenes.some((s) => s.technique === 'kinetic' || s.stage === 'problem' || s.stage === 'brand')) {
    if (!has(/split\(|KineticWords|translateY|stagger/i)) {
      issues.push('kinetic skill: missing word/line stagger motion');
    }
  }
  if (scenes.some((s) => s.technique === 'stat' || s.stage === 'proof')) {
    if (!has(/CountUp|toLocaleString|Math\.(round|floor)|interpolate\([^)]+,\s*\[[^\]]+\]\s*,\s*\[\s*0/i)) {
      issues.push('chart/stat skill: missing count-up / numeric reveal');
    }
  }
  if (scenes.some((s) => s.technique === 'chat_edit' || s.stage === 'design')) {
    if (!has(/chat|bubble|ChatPane|reply/i)) {
      issues.push('presentation/chat_edit: missing chat or slide edit UI');
    }
  }
  // Must not be a thin re-export
  if (/export\s*\{\s*NarratedExplainer\s+as\s+ActiveNarrated/.test(tsx)) {
    issues.push('hard pipeline forbids stock NarratedExplainer re-export');
  }
  if (/export\s*\{\s*LaunchShowreel\s+as\s+ActiveLaunch/.test(tsx)) {
    issues.push('hard pipeline forbids stock LaunchShowreel re-export');
  }
  // visualIntent keywords — at least half of intents should leave fingerprints in code (titles/hooks)
  const intents = scenes.map((s) => s.visualIntent).filter(Boolean) as string[];
  if (intents.length >= 3) {
    const hits = intents.filter((intent) => {
      const tokens = intent.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, ' ').split(/\s+/).filter((t) => t.length >= 2).slice(0, 4);
      return tokens.some((t) => tsx.includes(t));
    }).length;
    if (hits < Math.ceil(intents.length * 0.25)) {
      issues.push(`visualIntent barely reflected in TSX (${hits}/${intents.length}) — skill requires show-the-line`);
    }
  }
  return { ok: issues.length === 0, issues };
}

export type LaunchBeatPlan = {
  /** Music-first timeline (launch-video non-negotiable) */
  bedPath: string;
  dropSec: number;
  beats: number[];
  durationSec: number;
  bpm: number;
};

/** Synthesize a deterministic launch bed with a hard drop (ffmpeg lavfi). */
export function synthesizeLaunchBed(outMp3: string, durationSec = 30, bpm = 120, dropSec = 9): LaunchBeatPlan {
  mkdirSync(join(outMp3, '..'), { recursive: true });
  const beat = 60 / bpm;
  // Kick-ish pulse every beat; louder hit at drop
  const expr =
    `0.22*sin(2*PI*55*t)*exp(-8*mod(t\\,${beat.toFixed(4)}))` +
    `+0.35*sin(2*PI*70*t)*exp(-12*max(0\\,0.08-abs(t-${dropSec})))` +
    `+0.04*sin(2*PI*180*t)`;
  const r = spawnSync(
    'ffmpeg',
    [
      '-y', '-f', 'lavfi',
      '-i', `aevalsrc=${expr}:s=44100:d=${durationSec}`,
      '-af', 'loudnorm=I=-14:LRA=11:TP=-1.5',
      '-ac', '2', outMp3,
    ],
    { windowsHide: true, encoding: 'utf8' },
  );
  if (r.status !== 0 || !existsSync(outMp3)) {
    // ultra-fallback: plain tone
    spawnSync(
      'ffmpeg',
      ['-y', '-f', 'lavfi', '-i', `sine=frequency=100:duration=${durationSec}`, '-ac', '2', outMp3],
      { windowsHide: true },
    );
  }
  if (!existsSync(outMp3)) throw new Error('launch-video hard pipeline: failed to synthesize music bed');

  const beats: number[] = [];
  for (let t = 0; t < durationSec; t += beat) beats.push(Number(t.toFixed(3)));
  // ensure drop is a beat mark
  if (!beats.some((b) => Math.abs(b - dropSec) < 0.05)) beats.push(dropSec);
  beats.sort((a, b) => a - b);

  return { bedPath: outMp3, dropSec, beats, durationSec, bpm };
}

export function assertLaunchAudioFirst(plan: LaunchBeatPlan, tsx: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!existsSync(plan.bedPath)) issues.push('launch bed missing — sound must lead picture');
  if (!(plan.dropSec > 2 && plan.dropSec < plan.durationSec - 2)) issues.push('dropSec out of range');
  if (plan.beats.length < 8) issues.push('too few beat marks');
  // TSX must reference drop / bed
  if (!/dropSec|DROP|launchBed|bed\.mp3|musicFile/i.test(tsx)) {
    issues.push('launch TSX must sync reveal to dropSec / musicFile (skill: reveal on drop)');
  }
  return { ok: issues.length === 0, issues };
}

/** Mix bed + narration → final audio (VO duck under bed lightly). */
export function mixLaunchAudio(opts: { bed: string; narration: string; out: string }) {
  const r = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-i', opts.bed,
      '-i', opts.narration,
      '-filter_complex',
      // Keep bed under VO so speech stays continuous and clear
      '[0:a]volume=0.16[a0];[1:a]volume=1.05[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=0[a]',
      '-map', '[a]',
      '-ac', '2',
      opts.out,
    ],
    { windowsHide: true, encoding: 'utf8' },
  );
  if (r.status !== 0 || !existsSync(opts.out)) {
    if (existsSync(opts.narration)) copyFileSync(opts.narration, opts.out);
    else throw new Error(`mixLaunchAudio failed: ${(r.stderr || '').slice(-400)}`);
  }
}

/** Silent mono clip — pad VO timeline so picture and speech stay continuous. */
export function writeSilenceMp3(out: string, sec: number, rate = 24000) {
  const t = Math.max(0.05, Number(sec.toFixed(3)));
  const r = spawnSync(
    'ffmpeg',
    [
      '-y', '-f', 'lavfi',
      '-i', `anullsrc=channel_layout=mono:sample_rate=${rate}`,
      '-t', String(t),
      '-c:a', 'libmp3lame', '-q:a', '9',
      out,
    ],
    { windowsHide: true, encoding: 'utf8' },
  );
  if (r.status !== 0 || !existsSync(out)) {
    throw new Error(`writeSilenceMp3 failed (${t}s): ${(r.stderr || '').slice(-300)}`);
  }
}

/** Pad a VO clip with trailing silence to exact scene length (seamless concat). */
export function padAudioToDuration(src: string, out: string, targetSec: number) {
  const t = Math.max(0.2, Number(targetSec.toFixed(3)));
  const r = spawnSync(
    'ffmpeg',
    [
      '-y', '-i', src,
      // whole_dur: pad silence so clip length == scene slot (no mid-timeline VO gaps)
      '-af', `apad=whole_dur=${t},atrim=0:${t}`,
      '-c:a', 'libmp3lame', '-q:a', '4',
      out,
    ],
    { windowsHide: true, encoding: 'utf8' },
  );
  if (r.status !== 0 || !existsSync(out)) {
    writeSilenceMp3(out, t);
  }
}

export function concatMp3List(files: string[], listFile: string, out: string) {
  writeFileSync(listFile, files.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'), 'utf8');
  const r = spawnSync(
    'ffmpeg',
    ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', out],
    { windowsHide: true, encoding: 'utf8' },
  );
  if (r.status !== 0 || !existsSync(out)) {
    // re-encode concat fallback
    const r2 = spawnSync(
      'ffmpeg',
      ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c:a', 'libmp3lame', '-q:a', '4', out],
      { windowsHide: true, encoding: 'utf8' },
    );
    if (r2.status !== 0 || !existsSync(out)) {
      throw new Error(`concatMp3List failed: ${(r2.stderr || r.stderr || '').slice(-400)}`);
    }
  }
}

/** contact-sheet equivalent: tile stills with ffmpeg */
export function buildContactSheet(stillsDir: string, outPng: string, max = 8) {
  if (!existsSync(stillsDir)) return false;
  const files = readdirSync(stillsDir).filter((f) => f.endsWith('.png')).sort().slice(0, max);
  if (files.length < 2) return false;
  const list = join(stillsDir, '_tile.txt');
  // use hstack/vstack via xstack
  const inputs: string[] = [];
  for (const f of files) {
    inputs.push('-i', join(stillsDir, f));
  }
  const n = files.length;
  const cols = Math.min(4, n);
  const rows = Math.ceil(n / cols);
  const layout: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = (i % cols) * 480;
    const y = Math.floor(i / cols) * 270;
    layout.push(`${x}_${y}`);
  }
  const filter =
    `${files.map((_, i) => `[${i}:v]scale=480:270:force_original_aspect_ratio=decrease,pad=480:270:(ow-iw)/2:(oh-ih)/2[v${i}]`).join(';')};` +
    `${files.map((_, i) => `[v${i}]`).join('')}xstack=inputs=${n}:layout=${layout.join('|')}[out]`;
  const r = spawnSync(
    'ffmpeg',
    [...inputs, '-y', '-filter_complex', filter, '-map', '[out]', outPng],
    { windowsHide: true, encoding: 'utf8' },
  );
  writeFileSync(list, files.join('\n'), 'utf8');
  return r.status === 0 && existsSync(outPng);
}

/** Map launch-video arc → scene kinds + target start times from beats/drop */
export function launchArcFromMusic(plan: LaunchBeatPlan): {
  kind: 'hook' | 'tease' | 'reveal' | 'feature' | 'end';
  startSec: number;
  durationSec: number;
  featureIndex?: number;
}[] {
  const drop = plan.dropSec;
  const end = plan.durationSec;
  const montageStart = drop + 0.2;
  const montageEnd = Math.min(end - 3.2, drop + 14);
  const featDur = Math.max(0.7, (montageEnd - montageStart) / 4);
  return [
    { kind: 'hook', startSec: 0, durationSec: Math.min(3, drop * 0.35) },
    { kind: 'tease', startSec: Math.min(3, drop * 0.35), durationSec: Math.max(2, drop - Math.min(3, drop * 0.35) - 0.15) },
    { kind: 'reveal', startSec: drop - 0.05, durationSec: 2.4 },
    { kind: 'feature', startSec: montageStart, durationSec: featDur, featureIndex: 0 },
    { kind: 'feature', startSec: montageStart + featDur, durationSec: featDur, featureIndex: 1 },
    { kind: 'feature', startSec: montageStart + featDur * 2, durationSec: featDur, featureIndex: 2 },
    { kind: 'feature', startSec: montageStart + featDur * 3, durationSec: featDur, featureIndex: 3 },
    { kind: 'end', startSec: end - 3.2, durationSec: 3.2 },
  ];
}

export function writeSkillGateReport(dir: string, name: string, report: unknown) {
  writeFileSync(join(dir, name), JSON.stringify(report, null, 2), 'utf8');
}
