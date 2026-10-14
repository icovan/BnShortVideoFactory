/**
 * P2: After Remotion stills, map frames → beats (using render scene durations)
 * and require skill fingerprints for craft. Coverage is relative to sampled
 * stills — never demand half of a 20+ beat film from ~8–12 frames.
 */
import { existsSync, readdirSync } from 'node:fs';
import type { SkillName } from '../llm.ts';
import { SKILL_CONTRACTS, SOFT_CRAFT_SKILLS } from './registry.ts';

export type StillSkillBeat = {
  skill: string;
  durationSec: number;
  job?: string;
};

export type StillSkillMap = {
  still: string;
  beatIndex: number;
  frame: number;
  skill: string;
};

export type StillSkillReport = {
  ok: boolean;
  issues: string[];
  /** Fingerprint / catastrophic mapping — blocks encode */
  hardIssues: string[];
  /** Coverage notes — reported but do not block when sampling is sparse */
  softIssues: string[];
  mapped: StillSkillMap[];
  stillCount: number;
  beatCount: number;
  coveredBeats: number;
};

const STILL_RE = /^f-(\d+)-frame(\d+)\.png$/i;

/** Same mid-hold heuristic as remotionBridge still sampling. */
export function beatHoldFrames(
  beats: { durationSec: number }[],
  fps = 30,
): number[] {
  const holds: number[] = [];
  let acc = 0;
  for (let si = 0; si < beats.length; si++) {
    const dur = Math.max(1, Math.round(beats[si].durationSec * fps));
    const mid = acc + Math.max(si === 0 ? 12 : 4, Math.floor(dur * 0.45));
    holds.push(Math.min(acc + dur - 1, mid));
    acc += dur;
  }
  return holds;
}

export function beatIndexForFrame(
  frame: number,
  beats: { durationSec: number }[],
  fps = 30,
): number {
  let acc = 0;
  for (let i = 0; i < beats.length; i++) {
    const dur = Math.max(1, Math.round(beats[i].durationSec * fps));
    if (frame < acc + dur) return i;
    acc += dur;
  }
  return Math.max(0, beats.length - 1);
}

/**
 * Align plan beat skills with render scene durations (VO-driven).
 * Prefer scenes[i].durationSec — never invent a flat 2.5s timeline.
 */
export function beatsForStillVerify(
  planBeats: { skill: string; durationSec?: number; job?: string }[],
  scenes?: { durationSec?: number }[],
): StillSkillBeat[] {
  return planBeats.map((b, i) => {
    const fromScene = scenes?.[i]?.durationSec;
    const dur = Number(fromScene) > 0.2
      ? Number(fromScene)
      : (Number(b.durationSec) > 0.2 ? Number(b.durationSec) : 2.5);
    return {
      skill: String(b.skill || ''),
      durationSec: dur,
      job: b.job,
    };
  });
}

export function listStillPngs(stillsDir: string): string[] {
  if (!existsSync(stillsDir)) return [];
  return readdirSync(stillsDir)
    .filter((f) => STILL_RE.test(f))
    .sort((a, b) => {
      const ma = a.match(STILL_RE);
      const mb = b.match(STILL_RE);
      return Number(ma?.[1] || 0) - Number(mb?.[1] || 0);
    });
}

function isChassisPrimary(id: string): boolean {
  return (
    id === 'explainer-video'
    || id === 'short-form-video'
    || id === 'launch-video'
    || id === 'remotion-video'
    || id === 'presentation-video'
    || id === 'promo-video'
  );
}

function craftGateOk(skill: SkillName, tsx: string): boolean {
  if (SOFT_CRAFT_SKILLS.includes(skill)) return true;
  const c = SKILL_CONTRACTS[skill];
  if (!c?.gates?.length) return true;
  const gates = c.gates.filter((g) => g.id !== 'no-timers');
  if (!gates.length) return true;
  return gates.some((g) => g.re.test(tsx));
}

/** True when issues need ActiveDirected repair (not coverage/sampling). */
export function stillIssuesNeedCodeRepair(report: StillSkillReport): boolean {
  return report.hardIssues.some((i) => /fingerprint|technique fingerprint|empty frame/i.test(i));
}

/**
 * Map still files to beats; verify craft fingerprints for sampled beats.
 */
export function verifyStillSkillBeats(opts: {
  stillsDir: string;
  tsx: string;
  beats: StillSkillBeat[];
  craftIds: SkillName[];
  /** Stickman soft path / pose-floor — report only, do not hard-fail */
  soft?: boolean;
}): StillSkillReport {
  const hardIssues: string[] = [];
  const softIssues: string[] = [];
  const stills = listStillPngs(opts.stillsDir);
  const beats = opts.beats;
  const mapped: StillSkillMap[] = [];
  const craftSet = new Set(opts.craftIds);

  const minStills = Math.min(3, Math.max(1, beats.length));
  if (stills.length < minStills) {
    hardIssues.push(`too few stills (${stills.length}) for ${beats.length} beats (need ≥${minStills})`);
  }

  for (const still of stills) {
    const m = still.match(STILL_RE);
    if (!m) continue;
    const frame = Number(m[2]);
    const beatIndex = beatIndexForFrame(frame, beats);
    const skill = String(beats[beatIndex]?.skill || '');
    mapped.push({ still, beatIndex, frame, skill });
  }

  const coveredBeats = new Set(mapped.map((x) => x.beatIndex));
  const lastIdx = Math.max(0, beats.length - 1);
  const onLast = mapped.filter((x) => x.beatIndex === lastIdx).length;
  // Remotion appends an end-hold still — allow pile-up on final beat
  const maxUniquePossible = Math.max(1, stills.length - Math.max(0, onLast - 1));
  // Relative to samples, not half the beat sheet
  const wantCover = Math.min(
    beats.length,
    maxUniquePossible,
    Math.max(2, Math.ceil(stills.length * 0.65)),
  );

  // Collapse = most samples piled on last beat (classic plan-duration ≠ scene-duration bug)
  const collapsed =
    stills.length >= 5
    && onLast >= Math.ceil(stills.length * 0.5)
    && coveredBeats.size < Math.min(3, beats.length);
  if (stills.length >= minStills && coveredBeats.size < 2 && beats.length >= 2) {
    hardIssues.push(
      `still beat coverage collapsed ${coveredBeats.size}/${beats.length} (sampling/duration map broken)`,
    );
  } else if (collapsed) {
    hardIssues.push(
      `still beat coverage collapsed ${coveredBeats.size}/${beats.length} (${onLast}/${stills.length} on last beat — use scene durations)`,
    );
  } else if (stills.length >= minStills && coveredBeats.size < wantCover) {
    softIssues.push(
      `still beat coverage ${coveredBeats.size}/${beats.length} (want ≥${wantCover} of ${stills.length} samples)`,
    );
  }

  // Narration layouts draw the picture in NarrationFilm. Token fingerprints live there.
  const layoutFilm = /narration-layout/.test(opts.tsx);
  const sampledLeaf = new Set<string>();
  if (!layoutFilm) {
  for (const row of mapped) {
    if (!row.skill || !craftSet.has(row.skill as SkillName)) continue;
    if (SOFT_CRAFT_SKILLS.includes(row.skill as SkillName)) continue;
    if (isChassisPrimary(row.skill)) continue;
    sampledLeaf.add(row.skill);
    if (!craftGateOk(row.skill as SkillName, opts.tsx)) {
      const job = beats[row.beatIndex]?.job;
      hardIssues.push(
        `beat[${row.beatIndex}]${job ? ` ${job}` : ''} skill=${row.skill}: fingerprint missing (still ${row.still})`,
      );
    }
  }

  // Film-wide: every leaf craft in craftIds that appears on beats must fingerprint
  const onBeats = [...new Set(beats.map((b) => b.skill).filter(Boolean))];
  for (const id of onBeats) {
    if (!craftSet.has(id as SkillName)) continue;
    if (SOFT_CRAFT_SKILLS.includes(id as SkillName)) continue;
    if (isChassisPrimary(id)) continue;
    if (!craftGateOk(id as SkillName, opts.tsx)) {
      hardIssues.push(`skill ${id}: assigned on beats but technique fingerprint missing (still gate)`);
    }
  }

  const leafOnBeats = onBeats.filter(
    (id) =>
      craftSet.has(id as SkillName)
      && !SOFT_CRAFT_SKILLS.includes(id as SkillName)
      && !isChassisPrimary(id),
  );
  if (leafOnBeats.length && stills.length >= minStills && sampledLeaf.size === 0) {
    softIssues.push('stills did not land on any craft-leaf beat — check duration/sample mapping');
  }

  // 导演工具箱：主技法应在采样镜中出现且过指纹（缺失 → soft，避免误杀连续母题片）
  const mainTech = (() => {
    const counts = new Map<string, number>();
    for (const id of leafOnBeats) counts.set(id, (counts.get(id) || 0) + 1);
    let best = '';
    let n = 0;
    counts.forEach((c, id) => {
      if (c > n) {
        n = c;
        best = id;
      }
    });
    return best;
  })();
  if (mainTech && stills.length >= minStills && !sampledLeaf.has(mainTech)) {
    softIssues.push(`mainTechnique ${mainTech} not in sampled still beats — check duration map`);
  } else if (mainTech && !craftGateOk(mainTech as SkillName, opts.tsx)) {
    hardIssues.push(`mainTechnique ${mainTech}: technique fingerprint missing (director toolkit)`);
  }
  }

  const hard = [...new Set(hardIssues)].slice(0, 14);
  const soft = [...new Set(softIssues)].slice(0, 8);
  const issues = [...hard, ...soft];
  return {
    ok: opts.soft ? true : hard.length === 0,
    issues,
    hardIssues: hard,
    softIssues: soft,
    mapped,
    stillCount: stills.length,
    beatCount: beats.length,
    coveredBeats: coveredBeats.size,
  };
}
