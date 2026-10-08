/** Joint angles in degrees. Character-facing: positive ≈ clockwise on screen. */
export type StickPose = {
  shoulderL: number;
  shoulderR: number;
  elbowL: number;
  elbowR: number;
  hipL: number;
  hipR: number;
  kneeL: number;
  kneeR: number;
  /** Torso rotation around hip root (deg). */
  torsoTilt: number;
  /** Head nod relative to torso (deg). Default 0. */
  headTilt: number;
};

export type PoseName =
  | 'idle'
  | 'stand'
  | 'walk-l'
  | 'walk-r'
  | 'run-l'
  | 'run-r'
  | 'sit'
  | 'crouch'
  | 'kneel'
  | 'jump'
  | 'land'
  | 'pushup-up'
  | 'pushup-down'
  | 'reach-up'
  | 'reach-out'
  | 'climb'
  | 'hold-object'
  | 'present'
  | 'look-down'
  | 'think'
  | 'phone'
  | 'wave'
  | 'shrug'
  | 'point'
  | 'cheer'
  | 'bow'
  | 'lean-l'
  | 'lean-r'
  | 'kick'
  | 'struggle'
  | 'fall'
  | 'lie';

/** Locked Simply Animated–style proportions (hip root at 0,0). */
export const RIG = {
  armW: 15,
  legW: 17,
  upArm: 32,
  loArm: 30,
  upLeg: 36,
  loLeg: 34,
  torsoW: 26,
  torsoH: 66,
  headR: 21,
  /** Soft neck gap between torso top and head (px). */
  neck: 4,
  shoulderX: 11,
  shoulderY: -58,
  hipX: 8,
  /** Capsule end caps — hands / feet (readable silhouette, still stickman). */
  handR: 7,
  footR: 8,
} as const;

export type StickRig = { -readonly [K in keyof typeof RIG]: number };

/** Lightweight body variants — same capsule language, different silhouette. */
export type StickVariant = 'default' | 'tall' | 'compact' | 'bold';

export const VARIANTS: Record<StickVariant, Partial<StickRig>> = {
  default: {},
  tall: {
    torsoH: 78,
    upLeg: 42,
    loLeg: 40,
    upArm: 36,
    loArm: 34,
    headR: 19,
    shoulderY: -68,
    neck: 5,
  },
  compact: {
    torsoH: 52,
    torsoW: 30,
    upLeg: 28,
    loLeg: 26,
    upArm: 26,
    loArm: 24,
    headR: 24,
    shoulderY: -46,
    hipX: 9,
    neck: 3,
  },
  bold: {
    armW: 18,
    legW: 21,
    torsoW: 32,
    headR: 23,
    handR: 9,
    footR: 10,
  },
};

export function resolveRig(variant: StickVariant = 'default'): StickRig {
  return { ...RIG, ...VARIANTS[variant] };
}

/** Approximate foot plant distance below hip at scale=1 (for Ground y). */
export function footPlantOffset(rig: StickRig = RIG as StickRig): number {
  return rig.upLeg + rig.loLeg - 4;
}

/**
 * Figure tokens + fallbacks. Scene canvas comes from job look / props.canvas —
 * do NOT treat black as a genre lock. Prefer resolveStickInk(canvas) for body color.
 */
export const VISUAL_LOCK = {
  /** Fallback only when props.canvas is missing. */
  canvas: '#000000',
  /** Fallback body ink on dark canvas. */
  ink: '#FFFFFF',
  /** Body ink on light canvas. */
  inkOnLight: '#111111',
  /** Body ink on dark canvas. */
  inkOnDark: '#FFFFFF',
  prop: '#2E2E2E',
  propLight: '#3A3A3A',
  accent: '#F5C542',
  /** Matte capsules — no bloom / soft glow by default. */
  glow: 0,
  glowPx: 0,
} as const;

/** Relative luminance of #RRGGBB (0–1). */
export function luminanceHex(hex: string): number {
  const h = (hex || '').replace('#', '').trim();
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) return 0;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Pick capsule ink for contrast against canvas; explicit inkOverride always wins. */
export function resolveStickInk(canvas?: string, inkOverride?: string): string {
  if (inkOverride && /^#([0-9a-fA-F]{6})$/.test(inkOverride.trim())) return inkOverride.trim();
  if (!canvas) return VISUAL_LOCK.inkOnDark;
  return luminanceHex(canvas) > 0.55 ? VISUAL_LOCK.inkOnLight : VISUAL_LOCK.inkOnDark;
}
