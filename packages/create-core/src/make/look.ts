/** Prompt-driven look. Workflow locks grammar; brief locks skin. */

export type LookFamily = 'launch' | 'narrated' | 'nextword';

export type JobLook = {
  canvas: string;
  ink: string;
  accent: string;
  muted: string;
  highlight: string;
  bar: string;
  brandBg: string;
  energy: string;
  surface: 'dark' | 'light';
  motionNotes: string;
};

export const LOOK_FALLBACK: Record<LookFamily, JobLook> = {
  launch: {
    canvas: '#07070A',
    ink: '#F5F5F7',
    accent: '#5E6AD2',
    highlight: '#F2C94C',
    muted: '#8B8FA8',
    bar: '#5E6AD2',
    brandBg: '#101018',
    energy: 'precise',
    surface: 'dark',
    motionNotes: 'oversized chrome, snap on drop, sparse accent glow',
  },
  narrated: {
    canvas: '#FFFFFF',
    ink: '#1A1540',
    accent: '#5B4CDB',
    highlight: '#F2C94C',
    muted: '#6B6585',
    bar: '#5B4CDB',
    brandBg: '#4C3BCF',
    energy: 'bold',
    surface: 'light',
    motionNotes: 'kinetic type behind tilted product window, one full-bleed accent beat',
  },
  nextword: {
    canvas: '#12141C',
    ink: '#FFFFFF',
    accent: '#FFB830',
    highlight: '#FFB830',
    muted: '#8B90A8',
    bar: '#8E94F2',
    brandBg: '#1A1C28',
    energy: 'punchy',
    surface: 'dark',
    motionNotes: 'safe-area punch, persistent step bar, unequal wheel',
  },
};

const HEX = /^#([0-9a-fA-F]{6})$/;

function hex(v: unknown, fallback: string) {
  if (typeof v !== 'string') return fallback;
  const s = v.trim();
  return HEX.test(s) ? s : fallback;
}

export function normalizeLook(raw: Partial<JobLook> | undefined, family: LookFamily): JobLook {
  const fb = LOOK_FALLBACK[family];
  const surface = raw?.surface === 'light' || raw?.surface === 'dark' ? raw.surface : fb.surface;
  return {
    canvas: hex(raw?.canvas, fb.canvas),
    ink: hex(raw?.ink, fb.ink),
    accent: hex(raw?.accent, fb.accent),
    muted: hex(raw?.muted, fb.muted),
    highlight: hex(raw?.highlight, fb.highlight),
    bar: hex(raw?.bar, fb.bar),
    brandBg: hex(raw?.brandBg, fb.brandBg),
    energy: (raw?.energy || fb.energy).toString().slice(0, 24),
    surface,
    motionNotes: (raw?.motionNotes || fb.motionNotes).toString().slice(0, 160),
  };
}

/** Inject into pack / codegen system prompts. */
export function lookBrief(family: LookFamily) {
  return `LOOK (must follow THIS brief, not the official demo skin):
- Invent canvas/ink/accent/muted hex from the topic (kids/edu ≠ cyber/launch ≠ finance).
- Do NOT default to Linear #5E6AD2, PageOn #5B4CDB, or sandwich #FFB830 unless the brief asks for that brand.
- surface: dark for hype/night/tooling unless brief is paper/daylight; light for explainer/print unless brief is nocturnal.
- motionNotes: 8–16 words on material + motion for THIS topic.
- Family "${family}" only constrains grammar (arc/VO/aspect), not palette.
Return hex fields canvas, ink, accent, muted, highlight, bar, brandBg, plus energy, surface, motionNotes.`;
}

export function lookLockLine(look: JobLook) {
  return `JOB LOOK LOCK: surface=${look.surface} energy=${look.energy} canvas=${look.canvas} ink=${look.ink} accent=${look.accent} muted=${look.muted} highlight=${look.highlight} brandBg=${look.brandBg}. ${look.motionNotes}
Use these colors in every scene (AbsoluteFill background = canvas). Do NOT fall back to Linear / PageOn / sandwich chrome unless the brief names them.
If stickman-animation is on: capsule body ink = ink (or contrast vs canvas) — white on dark, dark on light. Never hardcode #000 canvas when this look says otherwise.
Craft floor (canvas/motion): spring kinetic, large hero type, perspective/layered depth, drawn reveals when needed — the SKIN is this look.`;
}

/** 提示词明确要求单色 / 木刻 / 禁止彩色时，设计参考不得注入高饱和 accent */
export function promptForcesMono(text: string): boolean {
  const t = text || '';
  return /黑白|纯黑白|单色|木刻|版画|线刻|墨线|水墨|无彩色|不要彩|禁止.*彩|不要颜色|black[\s-]?and[\s-]?white|\bb\s*&\s*w\b|monochrome|greyscale|grayscale|woodcut|ink[- ]only|no\s+colou?r|without\s+colou?r|pure\s+ink|carved\s+lines?\s+on\s+.*paper/i.test(
    t,
  );
}

function hexLum(h: string): number {
  const m = /^#([0-9a-fA-F]{6})$/.exec(h.trim());
  if (!m) return 0.5;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function hexChroma(h: string): number {
  const m = /^#([0-9a-fA-F]{6})$/.exec(h.trim());
  if (!m) return 0;
  const n = parseInt(m[1]!, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function greyBetween(a: string, b: string, t = 0.45): string {
  const parse = (h: string) => {
    const m = /^#([0-9a-fA-F]{6})$/.exec(h.trim());
    const n = m ? parseInt(m[1]!, 16) : 0x888888;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
  };
  const A = parse(a);
  const B = parse(b);
  const mix = (i: number) => Math.round(A[i]! * (1 - t) + B[i]! * t);
  const to = (x: number) => x.toString(16).padStart(2, '0');
  const g = mix(0);
  // force near-grey
  return `#${to(g)}${to(g)}${to(g)}`;
}

/**
 * 设计参考锁皮 × 提示词 brief look。
 * 单色/木刻等硬约束时：只借参考的纸色/墨色明度，丢掉高彩 accent 与 collage motionNotes。
 */
export function reconcileStyleLook(
  briefLook: JobLook,
  styleLook: JobLook | undefined,
  texts: string[],
  family: LookFamily,
): JobLook {
  const brief = normalizeLook(briefLook, family);
  if (!styleLook) return brief;
  const style = normalizeLook(styleLook, family);
  const blob = texts.filter(Boolean).join('\n');
  if (!promptForcesMono(blob)) {
    // 参考图仍可锁皮；若 brief 已写清 motionNotes 且更贴题，保留 brief 的 motion 句
    const keepBriefMotion =
      brief.motionNotes.length >= 24
      && /woodcut|ink|paper|carved|hatch|grain|kinetic|slam/i.test(brief.motionNotes)
      && /collage|halftone|editorial|wipe|geometric/i.test(style.motionNotes);
    return normalizeLook({
      ...style,
      motionNotes: keepBriefMotion ? brief.motionNotes : style.motionNotes,
    }, family);
  }

  // 单色：纸/墨优先 brief（densify 已按文案写好），否则用参考明度
  const paperAsk = /off[- ]white|纸白|米白|宣纸|paper|浅底|白底/i.test(blob);
  const nightAsk = /night|nocturnal|暗夜|黑底|纯黑/i.test(blob);
  let canvas = brief.canvas;
  let ink = brief.ink;
  if (paperAsk || (!nightAsk && hexLum(style.canvas) > 0.55)) {
    canvas = hexLum(brief.canvas) > 0.5 ? brief.canvas : (hexLum(style.canvas) > 0.5 ? style.canvas : '#F2EDE2');
    ink = hexLum(brief.ink) < 0.35 ? brief.ink : (hexLum(style.ink) < 0.35 ? style.ink : '#0E0E0C');
  } else if (nightAsk || hexLum(style.canvas) < 0.35) {
    canvas = hexLum(brief.canvas) < 0.4 ? brief.canvas : '#0E0E0C';
    ink = hexLum(brief.ink) > 0.6 ? brief.ink : '#F2EDE2';
  }
  // 丢掉高饱和 accent（如参考图红块）
  const accent = hexChroma(style.accent) > 0.25 || hexChroma(brief.accent) > 0.25
    ? ink
    : (hexChroma(brief.accent) <= 0.25 ? brief.accent : ink);
  const muted = greyBetween(canvas, ink, 0.55);
  const motion =
    /woodcut|ink|carved|hatch|grain|gouge|stipple/i.test(brief.motionNotes)
      ? brief.motionNotes
      : 'monochrome ink woodcut; crosshatch + stipple only; no chroma accent; paper grain'.slice(0, 160);

  return normalizeLook({
    canvas,
    ink,
    accent,
    muted,
    highlight: hexLum(canvas) > 0.5 ? '#FFFFFF' : ink,
    bar: accent,
    brandBg: canvas,
    energy: brief.energy || 'hushed',
    surface: hexLum(canvas) > 0.5 ? 'light' : 'dark',
    motionNotes: motion,
  }, family);
}
