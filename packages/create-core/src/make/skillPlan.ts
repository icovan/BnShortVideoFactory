import { chatJson } from '../llm.ts';
import type { SkillName } from '../llm.ts';
import type { Aspect, Engine } from '../../../shared/src/index.ts';
import type { Settings } from '../../../shared/src/index.ts';
import { lookBrief, normalizeLook, type JobLook, type LookFamily } from './look.ts';
import {
  CHASSIS_SKILLS,
  PRIMARY_SKILLS,
  SUPPORT_SKILLS,
  isSkillName,
} from '../skills/registry.ts';
import {
  isContentLang,
  planLanguageRules,
  resolveVoMode,
  textLangMismatch,
  type ContentLang,
  type VoMode,
} from './contentLang.ts';

export type DirectedBeat = {
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

export type SkillPlan = {
  aspect: Aspect;
  engine: Engine;
  primary: SkillName;
  support: SkillName[];
  skills: SkillName[];
  coreIdea: string;
  look: JobLook;
  beats: DirectedBeat[];
  hint?: string;
  /** Audience language lock for VO + on-screen copy. */
  contentLang: ContentLang;
  /** Hard VO policy after resolve. */
  voMode: VoMode;
  /** 旁白驱动：off 或 polish/verbatim（有文稿时） */
  scriptDrive?: 'off' | 'polish' | 'verbatim';
};

function scrubBeatLanguage(beat: DirectedBeat, contentLang: ContentLang): DirectedBeat {
  let { vo, headline, line } = beat;
  if (contentLang === 'zh' || contentLang === 'bilingual') {
    // Drop English-only VO on Chinese films (avoid EN TTS / captions)
    if (vo && textLangMismatch(vo, 'zh')) {
      vo = /[\u4e00-\u9fff]/.test(headline) ? headline : '';
    }
    if (headline && textLangMismatch(headline, 'zh') && contentLang === 'zh') {
      line = line || headline.slice(0, 48);
      headline = beat.job || '画面';
    }
  }
  if (contentLang === 'en') {
    if (vo && textLangMismatch(vo, 'en')) vo = /[A-Za-z]{3,}/.test(headline) ? headline : '';
    if (headline && textLangMismatch(headline, 'en')) {
      headline = beat.job || 'Beat';
    }
  }
  return { ...beat, vo, headline, line };
}

function applyVoMode(beats: DirectedBeat[], voMode: VoMode): DirectedBeat[] {
  if (voMode === 'off') {
    return beats.map((b) => ({
      ...b,
      vo: '',
      durationSec: b.durationSec && b.durationSec > 0.4 ? b.durationSec : 2.5,
    }));
  }
  if (voMode === 'on') {
    return beats.map((b) => {
      if (b.vo.trim().length >= 2) return b;
      const fallback = (b.headline || b.line || '').trim();
      return {
        ...b,
        vo: fallback.length >= 2 ? fallback.slice(0, 36) : '看这里',
      };
    });
  }
  return beats;
}

function promptForcesMix(text: string): boolean {
  return /混剪|素材混剪|批量剪辑|footage\s*remix|batch\s*cut|raw\s*footage|分镜素材成片/i.test(text || '');
}

const LAUNCH_LIKE: SkillName[] = [
  'launch-video', 'promo-video', 'ad-creative-video', 'product-demo-video',
  'youtube-intro-outro', 'countdown-video', 'logo-animation',
];

/** Brief-driven surface for stickman — never force black just because actors are stickmen. */
function briefSurfaceHint(text: string): 'light' | 'dark' | null {
  const t = text || '';
  if (/白底|浅底|浅色|纸白|白背景|白色背景|light\s*(bg|background|canvas|surface)|white\s*(bg|background|canvas)|#fff(?:fff)?\b|canvas\s*[:=]\s*['"]?#f/i.test(t)) {
    return 'light';
  }
  if (/纯黑|黑底|黑色背景|暗底|dark[- ]leaning|pure\s*black|black\s*#?0{3,6}\b|#000(?:000)?\b|1-bit\s*mono|monochrome\s*dark/i.test(t)) {
    return 'dark';
  }
  return null;
}

function lookFamily(
  primary: SkillName,
  aspect: Aspect,
  opts?: { sourcePrompt?: string; surface?: 'light' | 'dark' },
): LookFamily {
  if (LAUNCH_LIKE.includes(primary)) return 'launch';
  // Stickman = actor layer only. Surface from brief / LLM look, not a black-canvas genre lock.
  if (primary === 'stickman-animation') {
    const hint = opts?.surface || briefSurfaceHint(opts?.sourcePrompt || '');
    if (hint === 'light') return 'narrated';
    if (hint === 'dark') return 'nextword';
    // Soft default: vertical often dark; landscape explainer-like stays narrated (light) unless brief says otherwise.
    return aspect === '9:16' || aspect === '3:4' ? 'nextword' : 'narrated';
  }
  if (primary === 'short-form-video' || aspect === '9:16' || aspect === '3:4') return 'nextword';
  return 'narrated';
}

function supportForPrimary(primary: SkillName, support: SkillName[]): SkillName[] {
  const add = (id: SkillName) => {
    if (!support.includes(id) && SUPPORT_SKILLS.includes(id)) support.push(id);
  };
  if (primary === 'explainer-video') add('diagram-animation');
  if (primary === 'presentation-video' || primary === 'launch-video') add('kinetic-typography');
  if (primary === 'launch-video') add('beat-sync-editing');
  if (primary === 'text-message-animation') add('kinetic-typography');
  if (primary === 'whiteboard-animation') add('diagram-animation');
  if (primary === 'stickman-animation') {
    // Actor layer only — do not force kinetic/lower-thirds/motivation chrome.
    // Captions stay optional via LLM plan / intertitles; beat-sync helps music-led shorts.
    add('beat-sync-editing');
  }
  if (primary === 'wrapped-video' || primary === 'animated-infographic') {
    add('chart-animation');
    add('kinetic-typography');
  }
  if (primary === 'promo-video' || primary === 'ad-creative-video') add('kinetic-typography');
  if (primary === 'product-demo-video') add('kinetic-typography');
  if (primary === 'photo-slideshow') add('caption-animation');
  if (primary === 'testimonial-video') {
    add('lower-thirds');
    add('kinetic-typography');
  }
  if (primary === 'countdown-video' || primary === 'logo-animation' || primary === 'youtube-intro-outro') {
    add('kinetic-typography');
  }
  if (primary === 'isometric-animation' || primary === 'map-animation') add('diagram-animation');
  if (primary === 'audiogram') add('caption-animation');
  add('motion-art-direction');
  return support;
}

function uniqueSkills(ids: SkillName[]): SkillName[] {
  const seen = new Set<SkillName>();
  const out: SkillName[] = [];
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** prompt 硬锁：火柴人题材不得被 9:16/short-form 抢走 primary */
export function promptForcesStickman(text: string): boolean {
  return /stickman|stick[\s-]?fig(?:ure|ural)?|火柴人|胶囊(?:人|火柴)|motivation\s*vs\s*discipline|discipline\s*vs\s*motivation|simply\s*animated/i
    .test(text || '');
}

export function normalizeSkillPlan(
  raw: Partial<Omit<SkillPlan, 'look' | 'beats'>> & {
    look?: Partial<JobLook>;
    beats?: DirectedBeat[];
  },
  aspect: Aspect,
  hint?: SkillName,
  opts?: {
    forcePrimary?: SkillName;
    sourcePrompt?: string;
    contentLang?: ContentLang;
    voMode?: VoMode;
    uiVoMode?: unknown;
    /** 云端编排 / PC 壳：禁止 Manim，几何题改走 Remotion */
    forceRemotion?: boolean;
  },
): SkillPlan {
  const forceStickman = opts?.forcePrimary === 'stickman-animation'
    || promptForcesStickman(opts?.sourcePrompt || '');
  const contentLang: ContentLang = isContentLang(opts?.contentLang)
    ? opts!.contentLang!
    : (isContentLang(raw.contentLang) ? raw.contentLang : 'zh');

  let primary = isSkillName(raw.primary) && PRIMARY_SKILLS.includes(raw.primary)
    ? raw.primary
    : (hint && PRIMARY_SKILLS.includes(hint) ? hint : 'explainer-video');
  if (aspect === '9:16' && primary === 'manim') primary = 'short-form-video';
  if (opts?.forceRemotion && primary === 'manim') {
    primary = aspect === '9:16' || aspect === '3:4' ? 'short-form-video' : 'explainer-video';
  }
  // 硬锁：stickman 关键词 → 强制 primary（覆盖 short-form / explainer 误路由）
  if (forceStickman) primary = 'stickman-animation';
  if (promptForcesMix(opts?.sourcePrompt || '') || opts?.forcePrimary === 'footage-remix') {
    primary = 'footage-remix';
  }

  const voMode = resolveVoMode({
    ask: opts?.sourcePrompt || '',
    uiMode: opts?.uiVoMode ?? opts?.voMode,
    primary,
  });

  const engine: Engine = primary === 'manim'
    ? 'manim'
    : primary === 'footage-remix'
      ? 'footage-remix'
      : 'explainer-remotion';
  let support = (raw.support || []).filter(isSkillName).filter((s) => SUPPORT_SKILLS.includes(s)).slice(0, 4);
  // Vertical caption/kinetic kit is for short-form — do not auto-inject onto stickman character films.
  if (aspect === '9:16' && primary !== 'stickman-animation' && primary !== 'footage-remix') {
    if (!support.includes('caption-animation')) support.unshift('caption-animation');
    if (!support.includes('kinetic-typography')) support.push('kinetic-typography');
  }
  support = uniqueSkills(supportForPrimary(primary, support)).slice(0, 5);

  const chassis = engine === 'explainer-remotion'
    ? [...CHASSIS_SKILLS, ...(aspect === '9:16' && primary !== 'stickman-animation' ? ['short-form-video' as SkillName] : [])]
    : [];
  const skills = uniqueSkills(
    engine === 'manim' ? ['manim'] : engine === 'footage-remix' ? ['footage-remix'] : [primary, ...support, ...chassis],
  );

  const surfaceHint = raw.look?.surface === 'light' || raw.look?.surface === 'dark'
    ? raw.look.surface
    : briefSurfaceHint(opts?.sourcePrompt || '') || undefined;
  const look = normalizeLook(
    raw.look as Partial<JobLook> | undefined,
    lookFamily(primary, aspect, { sourcePrompt: opts?.sourcePrompt, surface: surfaceHint }),
  );
  let beats = (raw.beats || []).slice(0, 10).map((b, i) => {
    let skill: SkillName = isSkillName(b.skill) ? b.skill : (support[i % Math.max(support.length, 1)] || primary);
    // 硬锁 stickman：≥80% 主戏挂 stickman；仅偶数中段允许 caption 辅戏
    if (forceStickman) {
      const n = raw.beats?.length || 1;
      const allowCaption = (skill === 'caption-animation' || skill === 'kinetic-typography')
        && i > 0 && i < n - 1 && i % 3 === 1;
      if (!allowCaption) skill = 'stickman-animation';
    }
    const beat: DirectedBeat = {
      job: (b.job || `beat-${i}`).toString().slice(0, 24),
      vo: (b.vo || '').toString().trim(),
      headline: (b.headline || '').toString().slice(0, 48),
      line: b.line?.toString().slice(0, 80),
      visualIntent: (b.visualIntent || b.headline || 'full-frame kinetic beat').toString().slice(0, 160),
      keyMotion: (b.keyMotion || 'spring slam').toString().slice(0, 80),
      skill,
      durationSec: Number(b.durationSec) > 0.4 ? Number(Number(b.durationSec).toFixed(2)) : undefined,
      items: Array.isArray(b.items) ? b.items.map(String).slice(0, 6) : undefined,
      stat: b.stat && typeof b.stat.value === 'number'
        ? { label: String(b.stat.label || 'stat'), value: b.stat.value }
        : undefined,
    };
    return scrubBeatLanguage(beat, contentLang);
  }).filter((b) => b.vo.length >= 2 || b.headline.length >= 2 || b.visualIntent.length >= 8);

  beats = applyVoMode(beats, voMode);

  // 硬锁兜底：一个 stickman 分镜都没有时，全部改挂
  if (forceStickman && beats.length && !beats.some((b) => b.skill === 'stickman-animation')) {
    beats = beats.map((b) => ({ ...b, skill: 'stickman-animation' as SkillName }));
  }

  if (opts?.forceRemotion) {
    const fallback: SkillName = support.includes('diagram-animation')
      ? 'diagram-animation'
      : primary;
    beats = beats.map((b) => (b.skill === 'manim' ? { ...b, skill: fallback } : b));
  }

  return {
    aspect,
    engine,
    primary,
    support,
    skills,
    coreIdea: (raw.coreIdea || '').toString().slice(0, 120),
    look,
    beats,
    hint,
    contentLang,
    voMode,
  };
}

export async function planSkills(
  /** English machine brief — used for routing / beat writing. */
  prompt: string,
  aspect: Aspect,
  settings: Settings,
  _templateId?: string,
  contentLang: ContentLang = 'zh',
  uiVoMode?: VoMode,
  /** Original audience ask — used for stickman / VO keyword locks. */
  sourceAsk?: string,
  opts?: { forceRemotion?: boolean },
): Promise<SkillPlan> {
  const seed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const lockAsk = (sourceAsk || prompt).trim();
  const voHint = resolveVoMode({ ask: lockAsk, uiMode: uiVoMode });
  const manimRule = opts?.forceRemotion
    ? '- Formula / theorem / axes / geometry → explainer-video + diagram-animation (Remotion). NEVER pick manim.'
    : '- Formula / theorem / axes / 3B1B → manim';
  const raw = await chatJson<Partial<SkillPlan>>(settings, `You are the SKILL ROUTER for a video factory.
Pick skills from the vendored set, then write beats. Do NOT invent new skill names.

PRIMARY (exactly one): ${PRIMARY_SKILLS.filter((s) => !(opts?.forceRemotion && s === 'manim')).join(' | ')}
SUPPORT (0–5): ${SUPPORT_SKILLS.join(' | ')}
CHASSIS is added in code. Never pick chassis or creative-brief as primary.

ROUTING (prompt wins; template is a PRESET):
${manimRule}
- Raw footage / 混剪 / 素材成片 / batch cut from clip folder → footage-remix
- Chat / iMessage / WhatsApp script → text-message-animation
- Hand-drawn / ink / woodcut / whiteboard stroke → whiteboard-animation
- Stickman / 火柴人 / capsule stick figure / Simply Animated characters → stickman-animation (any track: explainer, short, promo, slapstick, diagram-led, …). Stickman owns figure+motion ONLY; scene/genre/canvas from brief + support skills — not fixed templates, not forced black stage.
  HARD LOCK: if the brief mentions stickman / stick-figure / 火柴人 / capsule stickman, primary MUST be stickman-animation — never short-form-video, even for 9:16 music-led shorts.
  LOOK: invent canvas/ink from THIS brief (white comic → light surface + dark ink; pure black demo → dark surface + white ink). Never default every stickman film to #000.
- Year-in-review / wrapped stats → wrapped-video
- Sale / % off / promo price → promo-video
- UI walkthrough / cursor on product → product-demo-video
- Photo Ken Burns slideshow → photo-slideshow
- Paid social ad / CTA → ad-creative-video
- Quote / review / stars → testimonial-video
- Countdown clock / drop timer → countdown-video
- Infographic cascade of facts → animated-infographic
- Map / city / route / marker → map-animation
- Logo sting / brand mark → logo-animation
- Podcast waveform / audiogram → audiogram
- YouTube intro or outro sting → youtube-intro-outro
- Isometric city / stack / 3D-flat → isometric-animation
- Product hype / drop / sizzle / no-VO music film → launch-video
- Pitch deck / slides rebuilt as motion → presentation-video
- 9:16 retention short / hook / loop → short-form-video
- How-it-works / onboarding / concept with VO spine → explainer-video
Aspect is LOCKED: ${aspect}. Invent look from THIS brief (stickman does NOT force black).
CRAFT FLOOR for every beat.visualIntent / keyMotion (canvas/type/motion/draw ONLY — not VO/SKU):
- Type: hero kinetic scale; Motion: spring slam / camera push; Depth: perspective, rotateX/Y, parallax, or layered plates — not flat slides.
- Draw: stroke/count-up/shape reveal when the beat is diagrammatic; forbid "hold static card".
- Frame: full-bleed or oversized subject; palette invent from THIS brief (never default Linear/PageOn purple unless named).
Forbid timid inset micro-UI in empty void (brand-faithful materials OK).
${lookBrief(
    briefSurfaceHint(lockAsk) === 'light'
      ? 'narrated'
      : briefSurfaceHint(lockAsk) === 'dark' || aspect === '9:16' || aspect === '3:4'
        ? 'nextword'
        : 'launch',
  )}
${planLanguageRules(contentLang)}
VO MODE (LOCKED): ${voHint}
${voHint === 'off' ? '- Set EVERY beat.vo to "" and set durationSec (sum ≈ requested length). Music/SFX only.' : ''}
${voHint === 'on' ? '- EVERY beat.vo MUST be non-empty short line in contentLang (zh ≈ 10–22 chars; en ≈ 6–14 words).' : ''}
${voHint === 'auto' ? '- Prefer VO for explainer; prefer vo="" + durationSec for stickman / launch / short-form music films.' : ''}
Always 5–8 beats. Each beat names one skill it must SHOW.
The machine brief above may be English — IGNORE that for VO/headline language; follow contentLang=${contentLang} only.
Seed ${seed}. JSON only.`, `Brief:
${prompt}

contentLang (LOCKED): ${contentLang}
voMode (LOCKED): ${voHint}
No template — route from the brief only.

Return:
{
  "primary":"explainer-video",
  "support":["kinetic-typography","diagram-animation"],
  "coreIdea":"",
  "canvas":"","ink":"","accent":"","muted":"","brandBg":"",
  "energy":"","surface":"dark",
  "motionNotes":"",
  "beats":[
    {"job":"hook","vo":"","durationSec":1.2,"headline":"","visualIntent":"","keyMotion":"","skill":"kinetic-typography"}
  ]
}`, 0.55);

  const top = raw as Record<string, unknown>;
  const nested = raw.look && typeof raw.look === 'object' ? (raw.look as Record<string, unknown>) : {};
  const str = (k: string) => {
    const a = top[k];
    const b = nested[k];
    return typeof a === 'string' && a ? a : typeof b === 'string' ? b : undefined;
  };
  const lookRaw = {
    canvas: str('canvas'),
    ink: str('ink'),
    accent: str('accent'),
    muted: str('muted'),
    brandBg: str('brandBg'),
    energy: str('energy'),
    surface: (str('surface') === 'light' || str('surface') === 'dark') ? str('surface') as 'dark' | 'light' : undefined,
    motionNotes: str('motionNotes'),
  };
  const plan = normalizeSkillPlan({ ...raw, look: lookRaw, contentLang }, aspect, undefined, {
    sourcePrompt: lockAsk,
    forcePrimary: promptForcesStickman(lockAsk) || promptForcesStickman(prompt)
      ? 'stickman-animation'
      : undefined,
    contentLang,
    uiVoMode,
    forceRemotion: opts?.forceRemotion,
  });
  if (plan.engine !== 'manim' && plan.beats.length < 4) {
    throw new Error('skill plan: too few beats');
  }
  return plan;
}
