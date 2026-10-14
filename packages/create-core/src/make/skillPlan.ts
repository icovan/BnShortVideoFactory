import { chatJson, readSkill, type SkillName } from '../llm.ts';
import type { Aspect, Engine, Settings } from '../../../shared/src/index.ts';
import { lookBrief, normalizeLook, type JobLook, type LookFamily } from './look.ts';
import {
  CHASSIS_SKILLS,
  PRIMARY_SKILLS,
  SKILL_CONTRACTS,
  SOFT_CRAFT_SKILLS,
  SUPPORT_SKILLS,
  isSkillName,
} from '../skills/registry.ts';
import { attachCraftMust, ensureBeatSkillCoverage } from '../skills/skillDepth.ts';
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
  applyFormModeSkillBudget,
  poolForFormMode,
  resolveBrandSubtype,
} from './formModePools.ts';
import {
  applyStickmanPhraseToBeats,
  asksForStickman,
  stickmanMachineLockBlock,
} from './stickmanBrief.ts';
import { promptForcesManim, promptForcesMix, promptForcesStickman } from './promptIntent.ts';
import {
  diversifyBeatSkills,
  lockTechniquesFromIntent,
  mergeBeatSkills,
  montageBeatCap,
  numberedShotCount,
} from './beatTechnique.ts';
import { applyDirectorToolkit, type MotifLock } from './directorToolkit.ts';

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
  /** a2e narration-storyboard §4 镜头模式 id（横屏硬挂） */
  layoutMode?: string;
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
  /** 旁白驱动：off 或 polish/verbatim（有文稿时）——只锁 VO，不决定画面管线 */
  scriptDrive?: 'off' | 'polish' | 'verbatim';
  /** 旁白驱动软门禁（结构/切句）；不阻断出片，写入 gate-drive.json */
  driveIssues?: string[];
  /** UI 形态：prompt=自由；六类内容 + brand/remix */
  formMode?: string;
  /** brand 子型：logo | showreel */
  brandSubtype?: string;
  /** 导演工具箱：本片主技法（连占打满） */
  mainTechnique?: SkillName;
  /** 连续同页母题锁 */
  motifLock?: MotifLock;
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
  // 软文档只加深 brief，不进 codegen 大包（防 threejs/shader 等把 TSX 写炸）
  const brand = (plan.brandSkills || []).filter((s) => !SOFT_CRAFT_SKILLS.includes(s)).slice(0, 2);
  return uniqueSkills([
    plan.primary,
    ...plan.support,
    ...brand,
    'remotion-video',
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
    formMode?: string;
    brandSubtype?: string;
  },
): SkillPlan {
  const contentLang: ContentLang = isContentLang(opts?.contentLang)
    ? opts!.contentLang!
    : (isContentLang(raw.contentLang) ? raw.contentLang : 'zh');
  const formMode = (opts?.formMode || raw.formMode || 'prompt').trim() || 'prompt';
  const brandSubtype = opts?.brandSubtype || raw.brandSubtype
    || resolveBrandSubtype(formMode, opts?.brandSubtype);
  const poolFilm = poolForFormMode(formMode, brandSubtype)?.filmKind;
  const filmKind = opts?.filmKind || poolFilm;

  // Agent 对齐：primary 认任何合法 skill 名；仅 UI 快捷形态 / 引擎约束才硬改
  let primary: SkillName = isSkillName(raw.primary)
    ? raw.primary
    : (hint && isSkillName(hint) ? hint : 'explainer-video');
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
  const ask = opts?.sourcePrompt || '';
  const stickmanOrdered = promptForcesStickman(ask);
  const manimOrdered = promptForcesManim(ask);
  // stickman / manim 仍需用户创作指令（避免文稿点名误路由）；其余 primary 信模型
  if (primary === 'stickman-animation' && !stickmanOrdered) {
    primary = 'explainer-video';
  }
  if (primary === 'manim' && !manimOrdered) {
    primary = aspect === '9:16' || aspect === '3:4' ? 'short-form-video' : 'explainer-video';
  }
  const wantStickmanMix = filmKind !== 'logo'
    && filmKind !== 'showreel'
    && primary !== 'manim'
    && primary !== 'footage-remix'
    && primary !== 'logo-animation'
    && stickmanOrdered;

  // support：任意合法 skill，不再 SUPPORT_SKILLS 白名单过滤；不强制 companion 补全
  const llmSupport = (raw.support || [])
    .filter(isSkillName)
    .filter((s) => s !== primary)
    .filter((s) => stickmanOrdered || s !== 'stickman-animation');
  const companions = resolveCompanions(primary, llmSupport, {
    stickmanMix: wantStickmanMix,
    showreel: filmKind === 'showreel',
  });
  let support = companions.technique;
  let brandSkills = companions.brand;
  if (primary === 'logo-animation' || filmKind === 'logo') {
    support = support.filter((s) => s !== 'stickman-animation');
  }

  // 面板技法池 + 1 primary + ≤3 leaf；软文档进 brandSkills
  const budgeted = applyFormModeSkillBudget({
    primary,
    support,
    brandSkills,
    formMode,
    brandSubtype,
  });
  if (budgeted.primary !== primary || budgeted.support.length !== support.length) {
    console.info(
      `[skillPlan] formMode budget ${formMode}/${brandSubtype || '-'} → primary=${budgeted.primary} support=${budgeted.support.join(',') || '(none)'}`,
    );
  }
  primary = budgeted.primary;
  support = budgeted.support;
  brandSkills = budgeted.brandSkills;

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

  const chassis = engine === 'explainer-remotion'
    ? [...CHASSIS_SKILLS]
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
  const beatCap = montageBeatCap(opts?.sourcePrompt || '');
  let beats = (raw.beats || []).slice(0, beatCap).map((b, i) => {
    // 镜级 skill：信模型；非法名才回落 primary/support
    let skill: SkillName = isSkillName(b.skill)
      ? b.skill
      : (support[i % Math.max(support.length, 1)] || primary);
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

  if (!wantStickmanMix) {
    beats = beats.map((b) => (b.skill === 'stickman-animation' ? { ...b, skill: primary } : b));
  }
  if (primary !== 'manim') {
    const fallback: SkillName = support.includes('diagram-animation') ? 'diagram-animation' : primary;
    beats = beats.map((b) => (b.skill === 'manim' ? { ...b, skill: fallback } : b));
  }

  // Pad thin LLM plans before craft coverage (avoids "too few beats" hard fail)
  if (engine === 'explainer-remotion') {
    beats = ensureMinimumBeats(beats, primary, support, contentLang, 5);
    // Agent：不再因「分镜文案没点名技法」删掉 support；镜 skill 覆盖只做软补齐
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
    formMode,
    brandSubtype,
  };
  if (filmKind === 'logo' || filmKind === 'showreel') {
    plan = applyMgFilmRecipe(plan, filmKind);
    // 配方之后再套一次预算，防止 showreel 硬塞超 leaf
    const after = applyFormModeSkillBudget({
      primary: plan.primary,
      support: plan.support,
      brandSkills: plan.brandSkills,
      formMode,
      brandSubtype,
    });
    plan = {
      ...plan,
      primary: after.primary,
      support: after.support,
      brandSkills: after.brandSkills,
      skills: uniqueSkills([
        after.primary,
        ...after.support,
        ...after.brandSkills,
        ...(engine === 'explainer-remotion' ? chassis : []),
      ]),
      beats: plan.beats.map((b) => {
        const ok = b.skill === after.primary || after.support.includes(b.skill);
        return ok ? b : { ...b, skill: after.support[0] || after.primary };
      }),
    };
  }
  if (wantStickmanMix || plan.skills.includes('stickman-animation')) {
    plan = {
      ...plan,
      beats: applyStickmanPhraseToBeats(plan.beats, {
        sourceAsk: opts?.sourcePrompt,
      }),
    };
  }
  if (filmKind !== 'logo' && filmKind !== 'showreel' && plan.engine === 'explainer-remotion') {
    plan = mergeBeatSkills(plan, { allowStickman: wantStickmanMix });
    // 导演工具箱：画面优先挂技 + 主技法打满 + 分层召回 + motif
    plan = applyDirectorToolkit(plan, opts?.sourcePrompt || '');
  } else if (
    plan.engine === 'explainer-remotion'
    && (plan.primary === 'logo-animation' || plan.primary === 'launch-video' || filmKind === 'logo')
  ) {
    // logo/showreel 快捷形态也跑主技锁定，避免否定句误挂 map
    const keep =
      plan.primary === 'launch-video' ? plan.primary : ('logo-animation' as const);
    let beats = diversifyBeatSkills(plan.beats, { primary: keep });
    beats = lockTechniquesFromIntent(beats, { keep });
    plan = { ...plan, beats: attachCraftMust(beats) };
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
  opts?: {
    forceRemotion?: boolean;
    filmKind?: MgFilmKind;
    formMode?: string;
    brandSubtype?: string;
  },
): Promise<SkillPlan> {
  const seed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const lockAsk = (sourceAsk || prompt).trim();
  const formMode = (opts?.formMode || 'prompt').trim() || 'prompt';
  const brandSubtype = opts?.brandSubtype || resolveBrandSubtype(formMode, opts?.brandSubtype);
  const modePool = poolForFormMode(formMode, brandSubtype);
  const filmKind = opts?.filmKind || modePool?.filmKind;
  const voHint = filmKind === 'logo' || filmKind === 'showreel'
    ? 'off' as VoMode
    : resolveVoMode({ ask: lockAsk, uiMode: uiVoMode });
  const manimOrdered = !opts?.forceRemotion && promptForcesManim(lockAsk);
  const manimRule = manimOrdered
    ? '- User asked for Manim / 3Blue1Brown. primary = manim. EXCLUSIVE: manim is the ONLY skill — never mix with Remotion skills.'
    : '- Do NOT pick manim. Naming Manim inside narration, source docs, or a feature list is subject matter. Formula / theorem stays explainer-video + diagram-animation.';
  const primaryPool = modePool
    ? modePool.primaries.filter((s) => !(opts?.forceRemotion && s === 'manim'))
    : PRIMARY_SKILLS.filter((s) => !(opts?.forceRemotion && s === 'manim'));
  const supportPool = modePool
    ? uniqueSkills([...modePool.leaves, ...modePool.primaries.filter((s) => s !== modePool.defaultPrimary)])
    : uniqueSkills([...SUPPORT_SKILLS, ...PRIMARY_SKILLS.filter((s) => s !== 'manim' && s !== 'footage-remix')]);
  // Agent：WHEN 目录覆盖全库；digest 扩到 primary+support（预算截断）
  const digestIds: SkillName[] = filmKind === 'logo'
    ? ['logo-animation', 'brand-motion-guidelines', 'svg-animation', 'remotion-video']
    : filmKind === 'showreel'
      ? ['launch-video', 'kinetic-typography', 'diagram-animation', 'logo-animation', 'remotion-video']
      : modePool
        ? uniqueSkills([...modePool.primaries, ...modePool.leaves, ...(modePool.softDocs || [])])
        : uniqueSkills([...primaryPool, ...SUPPORT_SKILLS]);
  const skillDigest = readSkill(digestIds, 36000);
  const shotN = numberedShotCount(lockAsk);
  const reelRule = shotN >= 4
    ? `TECHNIQUE REEL: the brief has ${shotN} numbered shots. Emit one beat per shot, in order, up to ${Math.min(16, shotN)}. Do not merge shots into one layout. Each beat.skill is THAT shot's technique (map-animation, isometric-animation, whiteboard-animation, text-message-animation, chart-animation, kinetic-typography, product-demo-video, countdown-video, logo-animation, promo-video only for a price strike). support may list every technique used (up to 8). Do NOT mark a map, room, chat, or ink shot as promo-video.`
    : 'Always 5–8 beats (dense lesson ≤10). Each beat.skill must be primary or one of the supports — SHOW that skill\'s technique ON a concrete metaphor, not craft-floor boilerplate.';
  const beatCountRule = filmKind === 'logo'
    ? 'Always 5 logo-motion beats (geo → accent → assemble → overshoot → settle).'
    : filmKind === 'showreel'
      ? 'Always 6 showreel chapters.'
      : reelRule;
  const poolRule = modePool
    ? `PANEL POOL (LOCKED): primary MUST be one of [${modePool.primaries.join(', ')}]; support ≤3 from [${modePool.leaves.join(', ')}]. Soft docs are injected in code — do not put them in support.`
    : 'FREE MODE: pick 1 primary + ≤3 real leaf techniques in support. Soft craft docs are not support seats.';
  const raw = await chatJson<Partial<SkillPlan>>(settings, `You are the SKILL ROUTER for a video factory.
Match the brief to skill REQUIREMENTS (story/technique), then write beats. Do NOT invent skill names.

PICK SKILLS LIKE A DIRECTOR'S TOOLKIT (budget: 1 primary + ≤2 main leaves + 0–1 accent):
- PRIMARY: exactly one film-kind (explainer / whiteboard / launch…). Primary is the show genre — NOT rotated onto every beat.
- MAIN TECHNIQUE: pick 1 leaf the WHOLE film is about (e.g. population curve → chart-animation). Put it first in support. Most beats use THIS skill and deepen it.
- SECOND leaf: only if a different picture family is truly needed. Accent (particle/lower-thirds) only when brief asks.
- ON-DEMAND only when brief/intent names them: map, isometric, chat, product-demo, promo, countdown, wrapped, photo-slideshow, audiogram, logo.
- PICTURE MATERIAL WINS: 剪纸/拼贴/paper-cut/collage/插画/木刻/版画 → mainTechnique = generative-illustration (NOT kinetic-typography). Kinetic only when words ARE the subject or brief says 砸字/动能字.
- FORBIDDEN: default kinetic+diagram+whiteboard+infographic stack "for variety". FORBIDDEN: changing skill every beat for spice.
- Per beat: choose skill FROM visualIntent (object+action) first; same main technique MAY occupy consecutive beats.
- ${shotN >= 4 ? 'Technique reel: one beat per numbered shot; support ≤3 leaves.' : 'Prefer 5–8 beats; rotate leaf skills across beats when the picture differs.'}
- Chassis (remotion-video / shot-composition / animation-principles) is added in code — never pick as primary/support.
- Code will NOT auto-fill missing supports. Empty seats stay empty.
${poolRule}

PRIMARY: ${primaryPool.join(' | ')}
SUPPORT: ${supportPool.join(' | ')}

=== WHEN TO USE (catalog) ===
PRIMARY:
${skillWhenCatalog(primaryPool)}
SUPPORT:
${skillWhenCatalog(supportPool)}

=== SKILL CRAFT (verbatim excerpts — obey story/technique, not factory slogans) ===
The WHEN catalog above is the picker. The excerpts below are not the only legal pictures.
${skillDigest}

ROUTING (prompt wins):
${manimRule}
- Stickman ONLY when the user instruction asks to perform with stickman (用火柴人 / 火柴人风格 / stickman). A feature-list or narration mention is NOT an order. Do not add stickman-animation otherwise.
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
- How-it-works / concept with VO → explainer-video, and keep ONE subject (the thing being explained) on every beat. diagram OR kinetic, not a new slammed title each scene.
- A brief that describes a screen, a player, or a cursor → product-demo-video. Every beat is the next action on THAT screen. Do not swap in a title-card explainer.

Aspect LOCKED: ${aspect}. Invent look from THIS brief.
SOFT FRAME: the subject must own the frame. A blank field or a hairline in the middle is a failure. Do not say "accent under 10%" and do not ask for empty margin around a tiny widget.
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
${beatCountRule}
visualIntent (FREE DIRECTED): 24–120 chars naming ONE concrete metaphor — object + action + space (e.g. 合上的书翻开成资料页与答题卡，朱红箭头从左流向右). Forbidden: Illustrate:, 节点和连线占满, words-only, 72px/safe-area slogans. The skill moves that metaphor; it does not erase it.
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
  let plan = normalizeSkillPlan({ ...raw, look: lookRaw, contentLang, formMode, brandSubtype }, aspect, undefined, {
    sourcePrompt: lockAsk,
    forcePrimary: filmKind === 'logo'
      ? 'logo-animation'
      : filmKind === 'showreel'
        ? 'launch-video'
        : undefined,
    filmKind,
    formMode,
    brandSubtype,
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
