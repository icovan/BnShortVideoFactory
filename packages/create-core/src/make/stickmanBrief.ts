/**
 * 火柴人：机器 brief / 分镜短语锁
 * 观众原文一旦点名 stickman，就把「意图→短语」写进交给机器的提示词，避免乱点姿态名。
 */
import type { SkillName } from '../llm.ts';
import { promptForcesStickman } from './promptIntent.ts';

type PhraseBeat = {
  job: string;
  vo: string;
  headline: string;
  line?: string;
  visualIntent: string;
  keyMotion: string;
  skill: SkillName;
  durationSec?: number;
  items?: string[];
  stat?: { label: string; value: number };
};

/** Affirmed stickman ask only — 「不要火柴人」 does not count. */
export function asksForStickman(text: string): boolean {
  return promptForcesStickman(text);
}

/** English block appended to machinePrompt / planSkills router brief */
export function stickmanMachineLockBlock(): string {
  return `STICKMAN ACTOR LOCK (mixable — do not steal logo/manim/remix primary):
- stickman-animation on character beats only; other beats keep diagram/kinetic/caption/explainer skills.
- Motion = PHRASE clips (sampleClip ids), NOT raw POSES.* laundry lists.
  INTENT → CLIP:
  explain|teach|演示|讲解 → explain-board (or enter-present)
  compare|versus|对比|左右 → compare-sides
  doubt|hesitate|犹豫|疑惑 → hesitate
  win|cheer|yes|胜利|欢呼 → agree-cheer
  phone|call|电话 → phone-talk
  desk|work|type|办公|伏案 → desk-work
  give|pass|handoff|递|交接 → give-take
  push|推 → push-heavy · pull|拉 → pull-in · carry|搬|抱 → carry-across
  greet|hello|wave|招手 → greet-wave
  think|思考 → think-loop
  duo|debate|两人|辩论 → duo-debate-a + duo-debate-b (opposite face)
- Every stickman beat.visualIntent MUST begin with "clip:<id> — …staging…".
  Example: "clip:explain-board — point at chart; optional SignBoard; partner may use duo-debate-b".
- Staging > more poses: dual cast, PropBlock/SignBoard/PhoneSlab, leave center for diagram when mixed.
- Forbidden: listing POSES.walk/cheer/shrug without a clip id; every-beat idle stand.`;
}

type ClipPick = { id: string; re: RegExp };

const CLIP_RULES: ClipPick[] = [
  { id: 'compare-sides', re: /compare|versus|\bvs\b|对比|左右|还是/i },
  { id: 'duo-debate-a', re: /duo|debate|两人|辩论|对话/i },
  { id: 'explain-board', re: /explain|teach|演示|讲解|指出|板书|说明/i },
  { id: 'hesitate', re: /doubt|hesitat|confus|犹豫|疑惑|不懂|耸肩/i },
  { id: 'agree-cheer', re: /win|cheer|victory|yes|胜利|欢呼|成功/i },
  { id: 'phone-talk', re: /phone|call|电话|打电话/i },
  { id: 'desk-work', re: /desk|laptop|type|办公|电脑|伏案|打字/i },
  { id: 'give-take', re: /give|pass|handoff|递|交接|给/i },
  { id: 'push-heavy', re: /\bpush\b|推/i },
  { id: 'pull-in', re: /\bpull\b|拉/i },
  { id: 'carry-across', re: /carry|搬|扛|抱/i },
  { id: 'greet-wave', re: /greet|hello|wave|招手|打招呼|你好/i },
  { id: 'enter-present', re: /present|enter|walk|入场|亮相|展示/i },
  { id: 'think-loop', re: /think|思考|沉思/i },
];

export function pickStickmanClipId(text: string, beatIndex = 0): string {
  const hay = text || '';
  for (const r of CLIP_RULES) {
    if (r.re.test(hay)) {
      if (r.id === 'duo-debate-a' && beatIndex % 2 === 1) return 'duo-debate-b';
      return r.id;
    }
  }
  // alternate defaults so consecutive stickman beats don't all enter-present
  const fallback = ['enter-present', 'explain-board', 'think-loop', 'hesitate', 'agree-cheer'] as const;
  return fallback[beatIndex % fallback.length];
}

const CLIP_PREFIX = /^clip:\s*([a-z0-9-]+)\s*[—\-:]/i;

/** Ensure stickman beats carry clip:<id> for codegen sampleClipForIntent */
export function applyStickmanPhraseToBeats<T extends PhraseBeat>(
  beats: T[],
  opts?: { forceAllCharacterBeats?: boolean; sourceAsk?: string },
): T[] {
  const ask = opts?.sourceAsk || '';
  return beats.map((b, i) => {
    const isStick = b.skill === 'stickman-animation' || opts?.forceAllCharacterBeats;
    if (!isStick) return b;
    const hay = [b.visualIntent, b.keyMotion, b.headline, b.vo, b.job, ask].filter(Boolean).join(' ');
    const existing = b.visualIntent?.match(CLIP_PREFIX)?.[1];
    const clipId = existing && /^[a-z0-9-]+$/i.test(existing)
      ? existing.toLowerCase()
      : pickStickmanClipId(hay, i);
    const rest = (b.visualIntent || '')
      .replace(CLIP_PREFIX, '')
      .replace(/^(POSES\.[\w-]+\s*[|,/]\s*)+/i, '')
      .trim();
    const staging = rest.length >= 8
      ? rest.slice(0, 140)
      : 'capsule actor; sampleClip; prop/board optional; mix with diagram if co-planned';
    return {
      ...b,
      skill: 'stickman-animation' as SkillName,
      visualIntent: `clip:${clipId} — ${staging}`.slice(0, 160),
      keyMotion: (b.keyMotion && !/^pose/i.test(b.keyMotion) ? b.keyMotion : `sampleClip:${clipId}`).slice(0, 80),
    };
  });
}

export function withStickmanMachineLock(machinePrompt: string, sourceAsk: string): string {
  const base = (machinePrompt || '').trim();
  // Only the user's own instruction counts. A machine brief that echoes「火柴人」from narration must not re-lock.
  if (!asksForStickman(sourceAsk)) return base;
  if (/STICKMAN ACTOR LOCK/i.test(base)) return base;
  return `${base}\n\n${stickmanMachineLockBlock()}`;
}
