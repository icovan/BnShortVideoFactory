/**
 * Stickman motion phrases — poses are letters; clips are words.
 * Prefer sampleClip() over inventing one-off pose sequences.
 */
import type { StickPose } from './types';
import {
  POSES,
  ensurePose,
  idleBob,
  lerpPose,
  mirrorPose,
  walkPose,
  wavePose,
} from './poses';

export type StickClipId =
  | 'enter-present'
  | 'explain-board'
  | 'compare-sides'
  | 'hesitate'
  | 'agree-cheer'
  | 'phone-talk'
  | 'desk-work'
  | 'give-take'
  | 'push-heavy'
  | 'pull-in'
  | 'carry-across'
  | 'greet-wave'
  | 'think-loop'
  | 'duo-debate-a'
  | 'duo-debate-b';

export type ClipSample = {
  pose: StickPose;
  /** Hip X offset from staging base (walk-in / carry travel). */
  dx?: number;
  /** Hip Y offset (sit/desk settle). */
  dy?: number;
  face?: 1 | -1;
};

export type ClipMeta = {
  id: StickClipId;
  /** One-line what it shows */
  when: string;
  /** Suggested duration in seconds */
  durSec: number;
};

export const STICK_CLIPS: ClipMeta[] = [
  { id: 'enter-present', when: 'Walk in then open arms / present', durSec: 2.2 },
  { id: 'explain-board', when: 'Present → point at board → settle think', durSec: 2.8 },
  { id: 'compare-sides', when: 'Lean/point left then right (A vs B)', durSec: 2.4 },
  { id: 'hesitate', when: 'Shrug → think → shrug (doubt)', durSec: 2.2 },
  { id: 'agree-cheer', when: 'Nod-ish stand → cheer (win / yes)', durSec: 1.8 },
  { id: 'phone-talk', when: 'Phone pose with idle breathe', durSec: 2.0 },
  { id: 'desk-work', when: 'Sit at desk, light typing bob', durSec: 2.4 },
  { id: 'give-take', when: 'Hold → handoff extend (pass object)', durSec: 2.0 },
  { id: 'push-heavy', when: 'Push into a prop / wall', durSec: 1.8 },
  { id: 'pull-in', when: 'Pull something toward self', durSec: 1.8 },
  { id: 'carry-across', when: 'Carry object while crossing', durSec: 2.4 },
  { id: 'greet-wave', when: 'Enter wave hello', durSec: 1.8 },
  { id: 'think-loop', when: 'Idle think breathe', durSec: 2.0 },
  { id: 'duo-debate-a', when: 'Left speaker: present then point (face right)', durSec: 2.4 },
  { id: 'duo-debate-b', when: 'Right speaker: shrug then present (face left)', durSec: 2.4 },
];

/**
 * Narrative intent → preferred clips (use first match that fits the beat).
 * Keys are English stems; match case-insensitively against visualIntent / VO.
 */
export const INTENT_TO_CLIPS: Record<string, StickClipId[]> = {
  explain: ['explain-board', 'enter-present'],
  teach: ['explain-board', 'enter-present'],
  present: ['enter-present', 'explain-board'],
  compare: ['compare-sides'],
  versus: ['compare-sides', 'duo-debate-a'],
  debate: ['duo-debate-a', 'duo-debate-b'],
  doubt: ['hesitate', 'think-loop'],
  hesitate: ['hesitate'],
  confuse: ['hesitate', 'think-loop'],
  win: ['agree-cheer'],
  cheer: ['agree-cheer'],
  yes: ['agree-cheer'],
  phone: ['phone-talk'],
  call: ['phone-talk'],
  desk: ['desk-work'],
  work: ['desk-work'],
  type: ['desk-work'],
  give: ['give-take'],
  pass: ['give-take'],
  handoff: ['give-take'],
  push: ['push-heavy'],
  pull: ['pull-in'],
  carry: ['carry-across'],
  greet: ['greet-wave'],
  hello: ['greet-wave'],
  wave: ['greet-wave'],
  think: ['think-loop', 'hesitate'],
  walk: ['enter-present', 'carry-across'],
};

function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}

function seg(
  t: number,
  a: number,
  b: number,
): number {
  if (t <= a) return 0;
  if (t >= b) return 1;
  return (t - a) / (b - a);
}

/** Pick best clip ids for a free-text beat intent. */
export function clipsForIntent(text: string): StickClipId[] {
  const s = (text || '').toLowerCase();
  const hits: StickClipId[] = [];
  for (const [key, ids] of Object.entries(INTENT_TO_CLIPS)) {
    if (s.includes(key)) {
      for (const id of ids) {
        if (!hits.includes(id)) hits.push(id);
      }
    }
  }
  // zh stems
  if (/讲解|说明|指出|板书|演示/.test(text || '')) {
    for (const id of ['explain-board', 'enter-present'] as StickClipId[]) {
      if (!hits.includes(id)) hits.push(id);
    }
  }
  if (/对比|左右|vs|还是/.test(text || '')) {
    if (!hits.includes('compare-sides')) hits.unshift('compare-sides');
  }
  if (/犹豫|疑惑|不懂|耸肩/.test(text || '')) {
    if (!hits.includes('hesitate')) hits.unshift('hesitate');
  }
  if (/欢呼|胜利|成功|点赞/.test(text || '')) {
    if (!hits.includes('agree-cheer')) hits.unshift('agree-cheer');
  }
  if (/电话|打电话/.test(text || '')) {
    if (!hits.includes('phone-talk')) hits.unshift('phone-talk');
  }
  if (/办公|电脑|伏案|打字/.test(text || '')) {
    if (!hits.includes('desk-work')) hits.unshift('desk-work');
  }
  if (/推/.test(text || '') && !hits.includes('push-heavy')) hits.unshift('push-heavy');
  if (/拉/.test(text || '') && !hits.includes('pull-in')) hits.unshift('pull-in');
  if (/递|交接|给/.test(text || '') && !hits.includes('give-take')) hits.unshift('give-take');
  if (/搬|扛|抱/.test(text || '') && !hits.includes('carry-across')) hits.unshift('carry-across');
  if (/招手|你好|打招呼/.test(text || '') && !hits.includes('greet-wave')) hits.unshift('greet-wave');
  if (/辩论|对话|两人/.test(text || '')) {
    if (!hits.includes('duo-debate-a')) hits.push('duo-debate-a', 'duo-debate-b');
  }
  return hits.length ? hits : ['enter-present', 'think-loop'];
}

/**
 * Sample a phrase at local time t∈[0,1].
 * Pass frame/fps for loops that need idleBob / wavePose.
 */
export function sampleClip(
  id: StickClipId,
  t: number,
  opts?: { frame?: number; fps?: number; travel?: number },
): ClipSample {
  const u = clamp01(t);
  const frame = opts?.frame ?? Math.round(u * 60);
  const fps = opts?.fps ?? 30;
  const travel = opts?.travel ?? 160;

  switch (id) {
    case 'enter-present': {
      if (u < 0.55) {
        const p = walkPose(u / 0.55);
        return { pose: p, dx: -travel + travel * (u / 0.55), face: 1 };
      }
      const k = seg(u, 0.55, 1);
      return { pose: lerpPose(POSES.stand, POSES.present, k), dx: 0, face: 1 };
    }
    case 'explain-board': {
      if (u < 0.28) return { pose: lerpPose(POSES.stand, POSES.present, u / 0.28) };
      if (u < 0.62) return { pose: lerpPose(POSES.present, POSES.point, seg(u, 0.28, 0.62)) };
      return { pose: idleBob(lerpPose(POSES.point, POSES.think, seg(u, 0.62, 1)), frame, fps) };
    }
    case 'compare-sides': {
      if (u < 0.45) {
        return {
          pose: lerpPose(POSES['lean-l'], POSES.point, u / 0.45),
          face: 1,
        };
      }
      return {
        pose: lerpPose(mirrorPose(POSES.point), POSES['lean-r'], seg(u, 0.45, 1)),
        face: -1,
      };
    }
    case 'hesitate': {
      if (u < 0.35) return { pose: lerpPose(POSES.stand, POSES.shrug, u / 0.35) };
      if (u < 0.7) return { pose: idleBob(lerpPose(POSES.shrug, POSES.think, seg(u, 0.35, 0.7)), frame, fps) };
      return { pose: lerpPose(POSES.think, POSES.shrug, seg(u, 0.7, 1)) };
    }
    case 'agree-cheer': {
      if (u < 0.4) {
        const base = ensurePose(POSES.stand);
        return { pose: { ...base, headTilt: base.headTilt + (u / 0.4) * 12 } };
      }
      return { pose: lerpPose(POSES.stand, POSES.cheer, seg(u, 0.4, 1)) };
    }
    case 'phone-talk':
      return { pose: idleBob(POSES.phone, frame, fps) };
    case 'desk-work': {
      const bob = idleBob(POSES.desk, frame, fps);
      return {
        pose: {
          ...bob,
          elbowL: bob.elbowL + Math.sin(frame / fps * Math.PI * 6) * 4,
          elbowR: bob.elbowR - Math.sin(frame / fps * Math.PI * 6) * 3,
        },
        dy: 36,
      };
    }
    case 'give-take': {
      if (u < 0.45) return { pose: lerpPose(POSES.stand, POSES['hold-object'], u / 0.45) };
      return { pose: lerpPose(POSES['hold-object'], POSES.handoff, seg(u, 0.45, 1)) };
    }
    case 'push-heavy':
      return { pose: lerpPose(POSES.stand, POSES.push, Math.min(1, u * 1.2)) };
    case 'pull-in':
      return { pose: lerpPose(POSES.stand, POSES.pull, Math.min(1, u * 1.2)) };
    case 'carry-across': {
      const p = walkPose(u);
      const carried = lerpPose(p, POSES.carry, 0.65);
      return { pose: carried, dx: -travel * 0.5 + travel * u, face: 1 };
    }
    case 'greet-wave': {
      if (u < 0.35) {
        return { pose: walkPose(u / 0.35), dx: -travel * 0.4 + travel * 0.4 * (u / 0.35) };
      }
      return { pose: wavePose(frame, fps), dx: 0 };
    }
    case 'think-loop':
      return { pose: idleBob(POSES.think, frame, fps) };
    case 'duo-debate-a': {
      if (u < 0.5) return { pose: lerpPose(POSES.stand, POSES.present, u / 0.5), face: 1 };
      return { pose: lerpPose(POSES.present, POSES.point, seg(u, 0.5, 1)), face: 1 };
    }
    case 'duo-debate-b': {
      if (u < 0.5) return { pose: lerpPose(POSES.stand, POSES.shrug, u / 0.5), face: -1 };
      return { pose: lerpPose(POSES.shrug, POSES.present, seg(u, 0.5, 1)), face: -1 };
    }
    default:
      return { pose: idleBob(POSES.stand, frame, fps) };
  }
}

/** Convenience: resolve intent text → sample first recommended clip. */
export function sampleClipForIntent(
  intent: string,
  t: number,
  opts?: { frame?: number; fps?: number; travel?: number; clipIndex?: number },
): ClipSample & { clipId: StickClipId } {
  const ids = clipsForIntent(intent);
  const clipId = ids[opts?.clipIndex ?? 0] || 'enter-present';
  return { clipId, ...sampleClip(clipId, t, opts) };
}
