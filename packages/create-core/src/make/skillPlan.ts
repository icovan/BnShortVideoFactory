import { chatJson, readSkill, type SkillName } from '../llm.ts';
import type { Aspect, Engine, Settings } from '../../../shared/src/index.ts';
import { lookBrief, normalizeLook, type JobLook, type LookFamily } from './look.ts';
import {
  CHASSIS_SKILLS,
  PRIMARY_SKILLS,
  SKILL_CONTRACTS,
  SUPPORT_SKILLS,
  isSkillName,
} from '../skills/registry.ts';
import { ensureBeatSkillCoverage } from '../skills/skillDepth.ts';
import { resolveCompanions, techniqueCraftIds } from '../skills/skillCompanion.ts';
import {
  isContentLang,
  planLanguageRules,
  resolveVoMode,
  textLangMismatch,
  type ContentLang,
  type VoMode,
} from './contentLang.ts';
import { applyMgFilmRecipe, mgFilmLockPrompt, type MgFilmKind } from './mgFilm.ts';
import {
  applyStickmanPhraseToBeats,
  asksForStickman,
  stickmanMachineLockBlock,
} from './stickmanBrief.ts';
import { promptForcesMix, promptForcesStickman } from './promptIntent.ts';

function skillWhenCatalog(ids: SkillName[]): string {
  return ids
    .map((id) => {
      const when = SKILL_CONTRACTS[id]?.when || id;
      return `- ${id}: ${when}`;
    })
    .join('\n');
}

export type DirectedBeat = {
  job: string;
  vo: string;
  headline: string;
  line?: string;
  visualIntent: string;
  keyMotion: string;
  skill: SkillName;
  /** Codegen MUST lines for this beat's skill (filled in normalize). */
  craftMust?: string[];
  durationSec?: number;
  items?: string[];
  stat?: { label: string; value: number };
};

export type SkillPlan = {
  aspect: Aspect;
  engine: Engine;
  primary: SkillName;
  /** Technique companions (hard craft seats) */
  support: SkillName[];
  /** Brand / delivery seats — never steal technique slots */
  brandSkills: SkillName[];
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

function applyVoMode(beats: DirectedBeat[], voMode: VoMode, muteTitles?: boolean): DirectedBeat[] {
  if (voMode === 'off') {
    return beats.map((b) => ({
      ...b,
      vo: '',
      headline: muteTitles ? '' : b.headline,
      line: muteTitles ? undefined : b.line,
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

/** Codegen / 硬门禁用：primary + technique support（品牌槽不进硬门禁） */
export function craftSkillIds(plan: {
  primary: SkillName;
  support: SkillName[];
}): SkillName[] {
  return techniqueCraftIds(plan.primary, plan.support);
}

/** Codegen 正文：技法 + 品牌槽 + remotion；不再灌无关 soft 大包挤爆 token */
export function codegenSkillIds(plan: {
  primary: SkillName;
  support: SkillName[];
  brandSkills?: SkillName[];
}): SkillName[] {
  if (plan.primary === 'manim') return ['manim'];
  if (plan.primary === 'footage-remix') return ['footage-remix'];
  const brand = plan.brandSkills || [];
  const logoSoft = plan.primary === 'logo-animation'
    ? (['lottie-animation', 'gsap-web'] as SkillName[])
    : [];
  return uniqueSkills([
    plan.primary,
    ...plan.support,
    ...brand,
    'remotion-video',
    ...logoSoft,
  ]);
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

/** prompt 硬锁：路由关键词（否定句不计入） */
export { promptForcesStickman, promptForcesMix };

/** Pad thin LLM plans so directed pipeline never dies on beat count. */
export function ensureMinimumBeats(
  beats: DirectedBeat[],
  primary: SkillName,
  support: SkillName[],
  contentLang: ContentLang,
  min = 5,
): DirectedBeat[] {
  if (beats.length >= min) return beats;
  const out = [...beats];
  const zh = contentLang === 'zh' || contentLang === 'bilingual';
  const fillers: Array<Pick<DirectedBeat, 'job' | 'vo' | 'headline' | 'visualIntent' | 'keyMotion'>> = [
    {
      job: 'hook',
      vo: zh ? '先看这个问题' : 'Start with the problem',
      headline: zh ? '问题' : 'Hook',
      visualIntent: 'full-frame kinetic hook card',
      keyMotion: 'spring slam',
    },
    {
      job: 'how',
      vo: zh ? '关键在于这一步' : 'Here is the key step',
      headline: zh ? '关键' : 'How',
      visualIntent: 'progressive diagram nodes then edges',
      keyMotion: 'stagger reveal',
    },
    {
      job: 'proof',
      vo: zh ? '这样一来就清楚了' : 'That makes it clear',
      headline: zh ? '清楚了' : 'Proof',
      visualIntent: 'kinetic line stagger payoff',
      keyMotion: 'word stagger',
    },
    {
      job: 'payoff',
      vo: zh ? '记住这个结论' : 'Remember this takeaway',
      headline: zh ? '结论' : 'Takeaway',
      visualIntent: 'seal the core idea on screen',
      keyMotion: 'scale settle',
    },
    {
      job: 'end',
      vo: zh ? '就是这样' : 'That is it',
      headline: zh ? '收束' : 'End',
      visualIntent: 'clean end card settle',
      keyMotion: 'fade settle',
    },
  ];
  let i = 0;
  while (out.length < min && i < fillers.length * 2) {
    const f = fillers[i % fillers.length];
    // skip filler jobs already present
    if (out.some((b) => b.job === f.job)) {
      i += 1;
      continue;
    }
    const skill = (support.length && i % 2 === 1)
      ? support[i % support.length]
      : primary;
    out.push({
      job: f.job,
      vo: f.vo,
      headline: f.headline,
      visualIntent: f.visualIntent,
      keyMotion: f.keyMotion,
      skill,
      durationSec: 2.4,
    });
    i += 1;
  }
  // if still short (all jobs collided), append numbered pads
  while (out.length < min) {
    const n = out.length + 1;
    out.push({
      job: `beat-${n}`,
      vo: zh ? `看第${n}点` : `Point ${n}`,
      headline: zh ? `要点${n}` : `Point ${n}`,
      visualIntent: 'full-frame kinetic beat with clear subject',
      keyMotion: 'spring slam',
      skill: primary,
      durationSec: 2.4,
    });
  }
  return out;
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
    /** logo = Logo 片；showreel = 动效展片（均无旁白） */
    filmKind?: MgFilmKind;
  },
): SkillPlan {
  const contentLang: ContentLang = isContentLang(opts?.contentLang)
    ? opts!.contentLang!
    : (isContentLang(raw.contentLang) ? raw.contentLang : 'zh');
  const filmKind = opts?.filmKind;

  let primary = isSkillName(raw.primary) && PRIMARY_SKILLS.includes(raw.primary)
    ? raw.primary
    : (hint && PRIMARY_SKILLS.includes(hint) ? hint : 'explainer-video');
  if (aspect === '9:16' && primary === 'manim') primary = 'short-form-video';
  if (opts?.forceRemotion && primary === 'manim') {
    primary = aspect === '9:16' || aspect === '3:4' ? 'short-form-video' : 'explainer-video';
  }
  if (filmKind === 'logo' || opts?.forcePrimary === 'logo-animation') {
    primary = 'logo-animation';
  }
  if (filmKind === 'showreel') {
    primary = 'launch-video';
  }
  if (promptForcesMix(opts?.sourcePrompt || '') || opts?.forcePrimary === 'footage-remix') {
    primary = 'footage-remix';
  }
  // 火柴人 = 提示词驱动的可混用图层（不像 manim 独占）。不抢 Logo / 展片 / Manim / 混剪主 skill。
  const wantStickmanMix = filmKind !== 'logo'
    && filmKind !== 'showreel'
    && primary !== 'manim'
    && primary !== 'footage-remix'
    && primary !== 'logo-animation'
    && (promptForcesStickman(opts?.sourcePrompt || '')
      || (raw.support || []).includes('stickman-animation')
      || primary === 'stickman-animation');

  const voMode = filmKind === 'logo' || filmKind === 'showreel'
    ? 'off' as VoMode
    : resolveVoMode({
      ask: opts?.sourcePrompt || '',
      uiMode: opts?.uiVoMode ?? opts?.voMode,
      primary,
    });

  const engine: Engine = primary === 'manim'
    ? 'manim'
    : primary === 'footage-remix'
      ? 'footage-remix'
      : 'explainer-remotion';
  const llmSupport = (raw.support || []).filter(isSkillName).filter((s) => SUPPORT_SKILLS.includes(s));
  const companions = resolveCompanions(primary, llmSupport, {
    stickmanMix: wantStickmanMix,
    showreel: filmKind === 'showreel',
  });
  let support = companions.technique;
  const brandSkills = companions.brand;
  if (primary === 'logo-animation' || filmKind === 'logo') {
    support = support.filter((s) => s !== 'stickman-animation');
  }

  const chassis = engine === 'explainer-remotion'
    ? [...CHASSIS_SKILLS, ...(aspect === '9:16' && primary !== 'stickman-animation' ? ['short-form-video' as SkillName] : [])]
    : [];
  const skills = uniqueSkills(
    engine === 'manim'
      ? ['manim']
      : engine === 'footage-remix'
        ? ['footage-remix']
        : [primary, ...support, ...brandSkills, ...chassis],
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
    if (primary === 'logo-animation' && skill === 'stickman-animation') {
      skill = 'logo-animation';
    }
    const beat: DirectedBeat = {
      job: (b.job || `beat-${i}`).toString().slice(0, 24),
      vo: (b.vo || '').toString().trim(),
      headline: (b.headline || '').toString().slice(0, 48),
      line: b.line?.toString().slice(0, 80),
      visualIntent: (b.visualIntent || b.headline || (filmKind === 'logo' ? 'stroke-assemble the mark' : 'full-frame kinetic beat')).toString().slice(0, 160),
      keyMotion: (b.keyMotion || (filmKind === 'logo' ? 'stroke assemble' : 'spring slam')).toString().slice(0, 80),
      skill,
      durationSec: Number(b.durationSec) > 0.4 ? Number(Number(b.durationSec).toFixed(2)) : undefined,
      items: Array.isArray(b.items) ? b.items.map(String).slice(0, 6) : undefined,
      stat: b.stat && typeof b.stat.value === 'number'
        ? { label: String(b.stat.label || 'stat'), value: b.stat.value }
        : undefined,
    };
    // 展片章节标签允许英文 chrome；Logo 片清空标题
    return filmKind === 'showreel' ? beat : scrubBeatLanguage(beat, contentLang);
  }).filter((b) => b.vo.length >= 2 || b.headline.length >= 2 || b.visualIntent.length >= 8);

  beats = applyVoMode(beats, voMode, filmKind === 'logo' || primary === 'logo-animation');

  // 提示词点了火柴人：保证至少有角色镜，但不得整片改挂（可与 diagram/kinetic/explainer 混用）
  if (wantStickmanMix && beats.length) {
    const nStick = beats.filter((b) => b.skill === 'stickman-animation').length;
    if (nStick === 0) {
      beats = beats.map((b, i) => (i % 2 === 0 ? { ...b, skill: 'stickman-animation' as SkillName } : b));
    } else if (nStick === beats.length && primary !== 'stickman-animation') {
      const other: SkillName = support.find((s) => s !== 'stickman-animation') || primary;
      beats = beats.map((b, i) => (i % 2 === 1 ? { ...b, skill: other } : b));
    }
  }

  if (opts?.forceRemotion) {
    const fallback: SkillName = support.includes('diagram-animation')
      ? 'diagram-animation'
      : primary;
    beats = beats.map((b) => (b.skill === 'manim' ? { ...b, skill: fallback } : b));
  }

  // Pad thin LLM plans before craft coverage (avoids "too few beats" hard fail)
  if (engine === 'explainer-remotion') {
    beats = ensureMinimumBeats(beats, primary, support, contentLang, 5);
    beats = ensureBeatSkillCoverage(beats, primary, support);
  }

  let plan: SkillPlan = {
    aspect,
    engine,
    primary,
    support,
    brandSkills,
    skills,
    coreIdea: (raw.coreIdea || '').toString().slice(0, 120),
    look,
    beats,
    hint,
    contentLang,
    voMode,
  };
  if (filmKind === 'logo' || filmKind === 'showreel') {
    plan = applyMgFilmRecipe(plan, filmKind);
  }
  if (wantStickmanMix || plan.skills.includes('stickman-animation')) {
    plan = {
      ...plan,
      beats: applyStickmanPhraseToBeats(plan.beats, {
        sourceAsk: opts?.sourcePrompt,
      }),
    };
  }
  return plan;
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
  opts?: { forceRemotion?: boolean; filmKind?: MgFilmKind },
): Promise<SkillPlan> {
  const seed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const lockAsk = (sourceAsk || prompt).trim();
  const filmKind = opts?.filmKind;
  const voHint = filmKind === 'logo' || filmKind === 'showreel'
    ? 'off' as VoMode
    : resolveVoMode({ ask: lockAsk, uiMode: uiVoMode });
  const manimRule = opts?.forceRemotion
    ? '- Formula / theorem / axes / geometry → explainer-video + diagram-animation (Remotion). NEVER pick manim.'
    : '- Formula / theorem / axes / 3B1B → manim';
  const primaryPool = PRIMARY_SKILLS.filter((s) => !(opts?.forceRemotion && s === 'manim'));
  // 路由只读技能「何时用」+ 正文摘要，不灌 CRAFT FLOOR
  const skillDigest = readSkill(
    filmKind === 'logo'
      ? ['logo-animation', 'brand-motion-guidelines', 'svg-animation', 'remotion-video']
      : filmKind === 'showreel'
        ? ['launch-video', 'kinetic-typography', 'soundtrack', 'brand-motion-guidelines', 'remotion-video']
        : ['explainer-video', 'diagram-animation', 'kinetic-typography', 'short-form-video', 'launch-video'],
    18000,
  );
  const raw = await chatJson<Partial<SkillPlan>>(settings, `You are the SKILL ROUTER for a video factory.
Match the brief to skill REQUIREMENTS (story/technique), then write beats. Do NOT invent skill names.

PICK FEW SKILLS (quality > coverage):
- PRIMARY: exactly one from the list
- SUPPORT: 0–2 leaf techniques ONLY (never 3+)
- Do NOT stack kinetic + diagram + caption + color + motion-art. One primary + at most two supports.
- Chassis (remotion-video / shot-composition / animation-principles) is added in code — never pick as primary/support.

PRIMARY: ${primaryPool.join(' | ')}
SUPPORT: ${SUPPORT_SKILLS.join(' | ')}

=== WHEN TO USE (catalog) ===
PRIMARY:
${skillWhenCatalog(primaryPool)}
SUPPORT:
${skillWhenCatalog(SUPPORT_SKILLS)}

=== SKILL CRAFT (verbatim excerpts — obey story/technique, not factory slogans) ===
${skillDigest}

ROUTING (prompt wins):
${manimRule}
  EXCLUSIVE: manim is the ONLY skill on that job — never mix manim with Remotion skills.
- Stickman / 火柴人 → stickman-animation as MIXABLE support (not exclusive). Keep true primary; do not make every beat stickman; never steal logo-animation.
  LOOK: invent canvas/ink from THIS brief — never force black for stickman.
${asksForStickman(lockAsk) ? `\n${stickmanMachineLockBlock()}\n` : ''}
- Raw footage / 混剪 → footage-remix
- Chat / iMessage script → text-message-animation
- Hand-drawn / whiteboard → whiteboard-animation
- Year-in-review / wrapped → wrapped-video
- Sale / promo price → promo-video
- UI walkthrough → product-demo-video
- Photo slideshow → photo-slideshow
- Paid social ad → ad-creative-video
- Quote / stars → testimonial-video
- Countdown → countdown-video
- Infographic facts → animated-infographic
- Map / route → map-animation
- Logo sting / 标志揭示 → logo-animation (VO empty)
- MG showreel / technique reel → launch-video + ≤2 of kinetic/diagram/color
- Audiogram → audiogram
- YouTube intro/outro → youtube-intro-outro
- Isometric → isometric-animation
- Product hype / no-VO sizzle → launch-video
- Pitch deck motion → presentation-video
- 9:16 retention short → short-form-video
- How-it-works / concept with VO → explainer-video (+ diagram OR kinetic, not both unless needed)

Aspect LOCKED: ${aspect}. Invent look from THIS brief.
SOFT FRAME (optional, not law): full-bleed subject OK; avoid timid centered micro-UI; palette from topic.
${filmKind ? mgFilmLockPrompt(filmKind) : ''}
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
${voHint === 'on' && !filmKind ? '- EVERY beat.vo MUST be a speakable line in contentLang (zh ≈ 12–40 chars; en ≈ 8–22 words). Prefer skill pacing (explainer VO-first) over slogan compression.' : ''}
${voHint === 'auto' ? '- Prefer VO for explainer; prefer vo="" + durationSec for logo / launch / music films.' : ''}
${filmKind === 'logo' ? 'Always 5 logo-motion beats (geo → accent → assemble → overshoot → settle).' : filmKind === 'showreel' ? 'Always 6 showreel chapters.' : 'Always 5–8 beats (dense lesson ≤10).'} Each beat.skill must be primary or one of the ≤2 supports — SHOW that skill's technique, not craft-floor boilerplate.
visualIntent: describe the graphic action from the skill (nodes→edges, word stagger, mark assemble…) — do NOT paste "72px / 6% safe / full-bleed" slogans.
The machine brief may be English — IGNORE that for VO/headline language; follow contentLang=${contentLang} only.
Seed ${seed}. JSON only.`, `Brief:
${prompt}

contentLang (LOCKED): ${contentLang}
voMode (LOCKED): ${voHint}
No template — route from the brief only.

Return:
{
  "primary":"explainer-video",
  "support":["diagram-animation"],
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
  let plan = normalizeSkillPlan({ ...raw, look: lookRaw, contentLang }, aspect, undefined, {
    sourcePrompt: lockAsk,
    forcePrimary: opts?.filmKind === 'logo'
      ? 'logo-animation'
      : opts?.filmKind === 'showreel'
        ? 'launch-video'
        : undefined,
    filmKind: opts?.filmKind,
    contentLang,
    uiVoMode,
    forceRemotion: opts?.forceRemotion,
  });
  // footage-remix is handled by the mix bench (folder required) — do not fail on beat count
  if (plan.engine === 'explainer-remotion' && plan.beats.length < 4) {
    plan = {
      ...plan,
      beats: ensureBeatSkillCoverage(
        ensureMinimumBeats(plan.beats, plan.primary, plan.support, plan.contentLang, 5),
        plan.primary,
        plan.support,
      ),
    };
  }
  if (plan.engine === 'explainer-remotion' && plan.beats.length < 4) {
    throw new Error('skill plan: too few beats');
  }
  return plan;
}
