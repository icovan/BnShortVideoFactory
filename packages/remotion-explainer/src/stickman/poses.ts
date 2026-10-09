import type { PoseName, StickPose } from './types';

const H = (headTilt = 0): Pick<StickPose, 'headTilt'> => ({ headTilt });

export const POSES: Record<PoseName, StickPose> = {
  idle: {
    shoulderL: 12, shoulderR: -12,
    elbowL: 6, elbowR: -6,
    hipL: 6, hipR: -6,
    kneeL: 3, kneeR: -3,
    torsoTilt: 0, ...H(),
  },
  stand: {
    shoulderL: 18, shoulderR: -18,
    elbowL: 8, elbowR: -8,
    hipL: 8, hipR: -8,
    kneeL: 4, kneeR: -4,
    torsoTilt: 0, ...H(),
  },
  'walk-l': {
    shoulderL: -28, shoulderR: 28,
    elbowL: 12, elbowR: -8,
    hipL: 28, hipR: -28,
    kneeL: 22, kneeR: 6,
    torsoTilt: 2, ...H(2),
  },
  'walk-r': {
    shoulderL: 28, shoulderR: -28,
    elbowL: -8, elbowR: 12,
    hipL: -28, hipR: 28,
    kneeL: 6, kneeR: 22,
    torsoTilt: -2, ...H(-2),
  },
  'run-l': {
    shoulderL: -48, shoulderR: 52,
    elbowL: 35, elbowR: -20,
    hipL: 42, hipR: -38,
    kneeL: 48, kneeR: 12,
    torsoTilt: 8, ...H(4),
  },
  'run-r': {
    shoulderL: 52, shoulderR: -48,
    elbowL: -20, elbowR: 35,
    hipL: -38, hipR: 42,
    kneeL: 12, kneeR: 48,
    torsoTilt: 8, ...H(4),
  },
  sit: {
    shoulderL: 42, shoulderR: -38,
    elbowL: 55, elbowR: -40,
    hipL: 88, hipR: 92,
    kneeL: 92, kneeR: 88,
    torsoTilt: 0, ...H(),
  },
  crouch: {
    shoulderL: 35, shoulderR: -35,
    elbowL: 40, elbowR: -40,
    hipL: 55, hipR: 58,
    kneeL: 95, kneeR: 92,
    torsoTilt: 12, ...H(8),
  },
  kneel: {
    shoulderL: 20, shoulderR: -20,
    elbowL: 12, elbowR: -12,
    hipL: 20, hipR: 95,
    kneeL: 10, kneeR: 100,
    torsoTilt: 0, ...H(),
  },
  jump: {
    shoulderL: -40, shoulderR: 40,
    elbowL: -15, elbowR: 15,
    hipL: -18, hipR: 18,
    kneeL: 25, kneeR: 25,
    torsoTilt: -4, ...H(-4),
  },
  land: {
    shoulderL: 30, shoulderR: -30,
    elbowL: 25, elbowR: -25,
    hipL: 35, hipR: 38,
    kneeL: 70, kneeR: 72,
    torsoTilt: 8, ...H(6),
  },
  'pushup-up': {
    shoulderL: 105, shoulderR: 115,
    elbowL: 8, elbowR: 8,
    hipL: 4, hipR: 8,
    kneeL: 2, kneeR: 2,
    torsoTilt: -22, ...H(-8),
  },
  'pushup-down': {
    shoulderL: 60, shoulderR: 70,
    elbowL: 75, elbowR: 75,
    hipL: 50, hipR: 56,
    kneeL: 8, kneeR: 8,
    torsoTilt: 2, ...H(4),
  },
  'reach-up': {
    shoulderL: -150, shoulderR: -20,
    elbowL: -10, elbowR: -8,
    hipL: 10, hipR: -6,
    kneeL: 8, kneeR: 4,
    torsoTilt: -6, ...H(-10),
  },
  'reach-out': {
    shoulderL: 10, shoulderR: -100,
    elbowL: 8, elbowR: -5,
    hipL: 12, hipR: -8,
    kneeL: 8, kneeR: -4,
    torsoTilt: -6, ...H(-2),
  },
  climb: {
    shoulderL: -110, shoulderR: -40,
    elbowL: -25, elbowR: 20,
    hipL: 35, hipR: -15,
    kneeL: 55, kneeR: 20,
    torsoTilt: -4, ...H(-6),
  },
  'hold-object': {
    shoulderL: 35, shoulderR: -55,
    elbowL: 50, elbowR: -70,
    hipL: 8, hipR: -8,
    kneeL: 4, kneeR: -4,
    torsoTilt: 0, ...H(),
  },
  present: {
    shoulderL: 25, shoulderR: -85,
    elbowL: 20, elbowR: -55,
    hipL: 10, hipR: -10,
    kneeL: 6, kneeR: -4,
    torsoTilt: -4, ...H(-2),
  },
  'look-down': {
    shoulderL: 25, shoulderR: -25,
    elbowL: 15, elbowR: -15,
    hipL: 12, hipR: -8,
    kneeL: 10, kneeR: 4,
    torsoTilt: 12, ...H(18),
  },
  think: {
    shoulderL: 15, shoulderR: -70,
    elbowL: 10, elbowR: -95,
    hipL: 8, hipR: -8,
    kneeL: 4, kneeR: -4,
    torsoTilt: -4, ...H(6),
  },
  phone: {
    shoulderL: 20, shoulderR: -55,
    elbowL: 12, elbowR: -100,
    hipL: 8, hipR: -6,
    kneeL: 4, kneeR: -4,
    torsoTilt: 4, ...H(10),
  },
  wave: {
    shoulderL: 18, shoulderR: -140,
    elbowL: 10, elbowR: -35,
    hipL: 8, hipR: -8,
    kneeL: 4, kneeR: -4,
    torsoTilt: -2, ...H(-4),
  },
  shrug: {
    shoulderL: -55, shoulderR: 55,
    elbowL: 70, elbowR: -70,
    hipL: 10, hipR: -10,
    kneeL: 6, kneeR: -6,
    torsoTilt: 0, ...H(4),
  },
  point: {
    shoulderL: 15, shoulderR: -95,
    elbowL: 8, elbowR: -5,
    hipL: 10, hipR: -10,
    kneeL: 6, kneeR: -4,
    torsoTilt: -4, ...H(-4),
  },
  cheer: {
    shoulderL: -160, shoulderR: 160,
    elbowL: -20, elbowR: 20,
    hipL: 12, hipR: -12,
    kneeL: 8, kneeR: -8,
    torsoTilt: -4, ...H(-8),
  },
  bow: {
    shoulderL: 40, shoulderR: -40,
    elbowL: 20, elbowR: -20,
    hipL: 18, hipR: -12,
    kneeL: 12, kneeR: 8,
    torsoTilt: 42, ...H(20),
  },
  'lean-l': {
    shoulderL: 30, shoulderR: -25,
    elbowL: 15, elbowR: -10,
    hipL: 18, hipR: -5,
    kneeL: 10, kneeR: 4,
    torsoTilt: -14, ...H(-4),
  },
  'lean-r': {
    shoulderL: 25, shoulderR: -30,
    elbowL: 10, elbowR: -15,
    hipL: 5, hipR: -18,
    kneeL: 4, kneeR: 10,
    torsoTilt: 14, ...H(4),
  },
  kick: {
    shoulderL: -35, shoulderR: 40,
    elbowL: 20, elbowR: -15,
    hipL: -10, hipR: -70,
    kneeL: 8, kneeR: 35,
    torsoTilt: -8, ...H(-4),
  },
  struggle: {
    shoulderL: -40, shoulderR: 70,
    elbowL: 35, elbowR: 55,
    hipL: 22, hipR: -18,
    kneeL: 35, kneeR: 10,
    torsoTilt: 8, ...H(6),
  },
  fall: {
    shoulderL: -120, shoulderR: 100,
    elbowL: -20, elbowR: 30,
    hipL: -40, hipR: 55,
    kneeL: 30, kneeR: 60,
    torsoTilt: 55, ...H(15),
  },
  lie: {
    shoulderL: -20, shoulderR: 90,
    elbowL: 10, elbowR: 40,
    hipL: 5, hipR: 70,
    kneeL: 10, kneeR: 40,
    torsoTilt: 90, ...H(0),
  },
  /** Lean into a shove — pair with PropBlock */
  push: {
    shoulderL: -95, shoulderR: -85,
    elbowL: -8, elbowR: -5,
    hipL: 22, hipR: -10,
    kneeL: 35, kneeR: 12,
    torsoTilt: -18, ...H(-6),
  },
  /** Lean back hauling — mirror of push energy */
  pull: {
    shoulderL: 55, shoulderR: 70,
    elbowL: 75, elbowR: 85,
    hipL: -8, hipR: 28,
    kneeL: 18, kneeR: 40,
    torsoTilt: 16, ...H(8),
  },
  /** Both arms cradle a box / board in front */
  carry: {
    shoulderL: 45, shoulderR: -45,
    elbowL: 70, elbowR: -70,
    hipL: 14, hipR: -10,
    kneeL: 18, kneeR: 12,
    torsoTilt: 6, ...H(4),
  },
  /** Mid hand-off: one arm extended, other still holding */
  handoff: {
    shoulderL: 30, shoulderR: -105,
    elbowL: 45, elbowR: -15,
    hipL: 10, hipR: -12,
    kneeL: 8, kneeR: -4,
    torsoTilt: -6, ...H(-2),
  },
  /** Seated at a desk / laptop — lower than sit, arms forward */
  desk: {
    shoulderL: 55, shoulderR: -50,
    elbowL: 70, elbowR: -65,
    hipL: 85, hipR: 90,
    kneeL: 95, kneeR: 92,
    torsoTilt: 10, ...H(8),
  },
};

const KEYS: (keyof StickPose)[] = [
  'shoulderL', 'shoulderR', 'elbowL', 'elbowR',
  'hipL', 'hipR', 'kneeL', 'kneeR', 'torsoTilt', 'headTilt',
];

const DEFAULT_POSE: StickPose = POSES.stand;

/** Coerce undefined / partial / invented objects into a full StickPose (avoids headTilt crashes). */
export function ensurePose(p?: Partial<StickPose> | StickPose | null): StickPose {
  if (!p || typeof p !== 'object') return { ...DEFAULT_POSE };
  return {
    ...DEFAULT_POSE,
    ...p,
    headTilt: typeof p.headTilt === 'number' && Number.isFinite(p.headTilt) ? p.headTilt : 0,
  };
}

export function lerpPose(a: StickPose, b: StickPose, t: number): StickPose {
  const A = ensurePose(a);
  const B = ensurePose(b);
  const u = Math.max(0, Math.min(1, t));
  const out = { ...A };
  for (const k of KEYS) out[k] = A[k] + (B[k] - A[k]) * u;
  return out;
}

/** Swap L/R joints — useful when `face={-1}` alone isn't enough for asymmetric beats. */
export function mirrorPose(p: StickPose): StickPose {
  const pose = ensurePose(p);
  return {
    shoulderL: -pose.shoulderR,
    shoulderR: -pose.shoulderL,
    elbowL: -pose.elbowR,
    elbowR: -pose.elbowL,
    hipL: -pose.hipR,
    hipR: -pose.hipL,
    kneeL: pose.kneeR,
    kneeR: pose.kneeL,
    torsoTilt: -pose.torsoTilt,
    headTilt: -pose.headTilt,
  };
}

export function poseByName(name: PoseName | string): StickPose {
  if (name in POSES) return POSES[name as PoseName];
  return POSES.stand;
}

/** Walk cycle: phase 0..1 over one stride. */
export function walkPose(phase: number): StickPose {
  const t = ((phase % 1) + 1) % 1;
  return t < 0.5
    ? lerpPose(POSES['walk-l'], POSES['walk-r'], t * 2)
    : lerpPose(POSES['walk-r'], POSES['walk-l'], (t - 0.5) * 2);
}

/** Run cycle: phase 0..1 — higher knee drive than walk. */
export function runPose(phase: number): StickPose {
  const t = ((phase % 1) + 1) % 1;
  return t < 0.5
    ? lerpPose(POSES['run-l'], POSES['run-r'], t * 2)
    : lerpPose(POSES['run-r'], POSES['run-l'], (t - 0.5) * 2);
}

/** Soft idle breathe: slight arm/leg/head sway. */
export function idleBob(base: StickPose, frame: number, fps: number): StickPose {
  const pose = ensurePose(base);
  const s = Math.sin((frame / fps) * Math.PI * 2 * 0.45);
  return {
    ...pose,
    shoulderL: pose.shoulderL + s * 3,
    shoulderR: pose.shoulderR - s * 3,
    hipL: pose.hipL + s * 2,
    hipR: pose.hipR - s * 2,
    headTilt: pose.headTilt + s * 1.5,
  };
}

/** Push-up rep: t 0 = up, 1 = down. */
export function pushupPose(t: number): StickPose {
  return lerpPose(POSES['pushup-up'], POSES['pushup-down'], t);
}

/**
 * Jump body pose: t 0 crouch → 0.45 air → 1 land.
 * Pair with `jumpHipY(baseY, t, height)` for root lift.
 */
export function jumpPose(t: number): StickPose {
  const u = Math.max(0, Math.min(1, t));
  if (u < 0.35) return lerpPose(POSES.crouch, POSES.jump, u / 0.35);
  if (u < 0.7) return lerpPose(POSES.jump, POSES.jump, (u - 0.35) / 0.35);
  return lerpPose(POSES.jump, POSES.land, (u - 0.7) / 0.3);
}

/** Parabolic hip lift for jump (px). Peak near t≈0.5. */
export function jumpHipY(baseY: number, t: number, height = 90): number {
  const u = Math.max(0, Math.min(1, t));
  const lift = Math.sin(u * Math.PI) * height;
  return baseY - lift;
}

/** Wave: oscillate the raised arm from `wave` pose. */
export function wavePose(frame: number, fps: number, base: StickPose = POSES.wave): StickPose {
  const pose = ensurePose(base);
  const s = Math.sin((frame / fps) * Math.PI * 2 * 2.2);
  return {
    ...pose,
    shoulderR: pose.shoulderR + s * 18,
    elbowR: pose.elbowR + s * 12,
  };
}

/** Climb cycle: alternate reach on phase 0..1. */
export function climbPose(phase: number): StickPose {
  const t = ((phase % 1) + 1) % 1;
  const a = POSES.climb;
  const b: StickPose = {
    ...a,
    shoulderL: a.shoulderR,
    shoulderR: a.shoulderL,
    elbowL: a.elbowR,
    elbowR: a.elbowL,
    hipL: a.hipR,
    hipR: a.hipL,
    kneeL: a.kneeR,
    kneeR: a.kneeL,
  };
  return t < 0.5 ? lerpPose(a, b, t * 2) : lerpPose(b, a, (t - 0.5) * 2);
}
