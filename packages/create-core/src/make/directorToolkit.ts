/**
 * 导演工具箱（自由模式五刀）：
 * 1) 画面优先 → skill   2) 分层召回（核心抽屉 + 点名才开）
 * 3) 主技法连占打满     4) 深 craft 合同（attachCraftMust）
 * 5) 连续母题 motifLock
 */
import type { SkillName } from '../llm.ts';
import { CHASSIS_SKILLS, SOFT_CRAFT_SKILLS, isSkillName } from '../skills/registry.ts';
import { attachCraftMust } from '../skills/skillDepth.ts';
import {
  inferTechnique,
  isPictureMaterialBrief,
  isTypeLedBrief,
  lockTechniquesFromIntent,
  PICTURE_MAIN_SKILLS,
  sceneSkillNeedsCue,
  techniqueWasAsked,
} from './beatTechnique.ts';

/** 自由模式默认抽屉：讲解片常用叶技法（含可升格的插画主技法） */
export const FREE_CORE_LEAVES: SkillName[] = [
  'kinetic-typography',
  'diagram-animation',
  'chart-animation',
  'whiteboard-animation',
  'animated-infographic',
  'svg-animation',
  'generative-illustration',
  'caption-animation',
  'color-motion',
];

/** 点缀（最多 1）：不占主技法席 */
export const FREE_ACCENT_LEAVES: SkillName[] = [
  'particle-system',
  'lower-thirds',
  'motion-background',
];

/** 按需召回：brief/intent 点名才进 support */
export const FREE_ON_DEMAND_LEAVES: SkillName[] = [
  'map-animation',
  'isometric-animation',
  'text-message-animation',
  'product-demo-video',
  'promo-video',
  'countdown-video',
  'wrapped-video',
  'photo-slideshow',
  'audiogram',
  'logo-animation',
  'stickman-animation',
  'beat-sync-editing',
  'soundtrack',
];

const CHASSIS = new Set<string>(CHASSIS_SKILLS);
const SOFT = new Set<string>(SOFT_CRAFT_SKILLS);

export type MotifLock = {
  continuousPage: boolean;
  motif: string;
};

export type ToolkitBeat = {
  job?: string;
  vo?: string;
  headline?: string;
  visualIntent?: string;
  keyMotion?: string;
  skill: SkillName | string;
  craftMust?: string[];
  durationSec?: number;
};

export type ToolkitPlanSlice = {
  primary: SkillName;
  support: SkillName[];
  brandSkills: SkillName[];
  skills: SkillName[];
  coreIdea: string;
  beats: ToolkitBeat[];
  formMode?: string;
  mainTechnique?: SkillName;
  motifLock?: MotifLock;
};

function cueText(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/** brief 是否点名该 on-demand 技法 */
export function onDemandCued(skill: SkillName, text: string): boolean {
  if (!text.trim()) return false;
  if (FREE_CORE_LEAVES.includes(skill)) return true;
  if (FREE_ACCENT_LEAVES.includes(skill)) {
    return techniqueWasAsked(skill, text) || inferTechnique(text) === skill;
  }
  return techniqueWasAsked(skill, text) || inferTechnique(text) === skill;
}

/** 从画面意图推断叶技法（优先 visualIntent） */
export function skillFromIntent(beat: ToolkitBeat): SkillName | null {
  const t = cueText(beat.visualIntent, beat.keyMotion, beat.headline, beat.vo);
  return inferTechnique(t);
}

export function detectMotifLock(sourcePrompt: string, coreIdea: string): MotifLock | undefined {
  const t = `${sourcePrompt}\n${coreIdea}`;
  const continuous = /同一页|同一画面|连续母题|不要换场景|整页演化|one\s*page|same\s*page|continuous\s*motif|single\s*canvas|不要切镜/i.test(t);
  if (!continuous) return undefined;
  const motif = (coreIdea || sourcePrompt).replace(/\s+/g, ' ').trim().slice(0, 80);
  return { continuousPage: true, motif: motif || 'shared continuous canvas' };
}

/**
 * 自由模式：support 收成「主技法 1–2 + 点缀 0–1」。
 * on-demand 仅当 brief 点名；软文档进 brand。
 */
export function sharpenFreeSupport(
  primary: SkillName,
  support: SkillName[],
  brandSkills: SkillName[],
  sourcePrompt: string,
): { support: SkillName[]; brandSkills: SkillName[]; mainTechnique?: SkillName } {
  const ask = sourcePrompt || '';
  const soft: SkillName[] = [];
  const core: SkillName[] = [];
  const accent: SkillName[] = [];
  const demand: SkillName[] = [];

  const guessed = inferTechnique(ask);
  const pictureLed = isPictureMaterialBrief(ask) || PICTURE_MAIN_SKILLS.includes(guessed as SkillName);

  for (const id of support) {
    if (!isSkillName(id) || id === primary || CHASSIS.has(id)) continue;
    // 插画/材质主技法：即使挂在 SOFT，brief 点名也升格进 core，禁止埋进 brand
    if (PICTURE_MAIN_SKILLS.includes(id) && (guessed === id || pictureLed || inferTechnique(ask) === id)) {
      core.push(id);
      continue;
    }
    if (SOFT.has(id) && !FREE_ACCENT_LEAVES.includes(id) && !PICTURE_MAIN_SKILLS.includes(id)) {
      soft.push(id);
      continue;
    }
    if (FREE_ACCENT_LEAVES.includes(id)) {
      // 点缀：材质片默认可带纸屑粒子；其它需点名
      if (
        inferTechnique(ask) === id
        || /粒子|纸屑|纸星|particle|lower.?third|字幕条|运动背景|motion\s*background/i.test(ask)
        || (pictureLed && id === 'particle-system')
      ) {
        accent.push(id);
      } else {
        soft.push(id);
      }
      continue;
    }
    if (FREE_ON_DEMAND_LEAVES.includes(id)) {
      if (onDemandCued(id, ask)) demand.push(id);
      continue;
    }
    if (FREE_CORE_LEAVES.includes(id)) {
      // 材质片：禁止把 kinetic 当 core 种子（除非 brief 明示字即主体）
      if (id === 'kinetic-typography' && pictureLed && !isTypeLedBrief(ask)) continue;
      core.push(id);
      continue;
    }
    // 其它合法 leaf：brief 有暗示才留
    if (onDemandCued(id, ask) || inferTechnique(ask) === id) demand.push(id);
  }

  // 主技法：brief 推断优先，再 on-demand，再 core（避免 LLM 把 kinetic 排第一抢走曲线/剪纸片）
  const mains: SkillName[] = [];
  const pushMain = (id: SkillName) => {
    if (id === primary || CHASSIS.has(id)) return;
    if (id === 'kinetic-typography' && pictureLed && !isTypeLedBrief(ask)) return;
    if (!mains.includes(id) && mains.length < 2) mains.push(id);
  };
  if (guessed) pushMain(guessed);
  if (pictureLed) pushMain('generative-illustration');
  if (/曲线|折线|柱|增长|人口|统计|billion|chart|graph/i.test(ask)) {
    pushMain('chart-animation');
  }
  for (const id of [...demand, ...core]) pushMain(id);
  // 无 leaf 时：数据 → 材质插画 → technique-primary → 讲解默认 diagram（不再默认 kinetic）
  if (!mains.length && /曲线|折线|柱|增长|人口|统计|billion|chart|graph/i.test(ask)) {
    pushMain('chart-animation');
  }
  if (!mains.length && pictureLed) pushMain('generative-illustration');

  const accents = accent.filter((id) => !mains.includes(id)).slice(0, 1);
  const nextSupport = [...mains, ...accents].slice(0, 3);
  const techniquePrimary = primary === 'whiteboard-animation'
    || primary === 'animated-infographic'
    || primary === 'logo-animation'
    || primary === 'map-animation'
    || primary === 'isometric-animation'
    || primary === 'text-message-animation'
    || primary === 'product-demo-video'
    || primary === 'promo-video'
    || primary === 'countdown-video'
    || primary === 'wrapped-video'
    || primary === 'photo-slideshow'
    || primary === 'audiogram'
    || primary === 'stickman-animation';
  const fallbackMain: SkillName = techniquePrimary
    ? primary
    : (isTypeLedBrief(ask) ? 'kinetic-typography' : 'diagram-animation');
  return {
    support: nextSupport.length ? nextSupport : (fallbackMain !== primary ? [fallbackMain] : []),
    brandSkills: [...new Set([...brandSkills, ...soft])].filter((s) => s !== primary),
    mainTechnique: mains[0] || fallbackMain,
  };
}

/** 画面优先挂 skill；主技法可连占；禁止为多样性乱换 */
export function assignSkillsByIntent<T extends ToolkitBeat>(
  beats: T[],
  opts: {
    primary: SkillName;
    support: SkillName[];
    mainTechnique?: SkillName;
  },
): T[] {
  if (!beats.length) return beats;
  const allowed = new Set<string>([
    opts.primary,
    ...opts.support,
    ...(opts.mainTechnique ? [opts.mainTechnique] : []),
  ]);
  const main = opts.mainTechnique
    || opts.support.find((s) => FREE_CORE_LEAVES.includes(s) || FREE_ON_DEMAND_LEAVES.includes(s))
    || opts.support[0]
    || opts.primary;

  return beats.map((b, i) => {
    const inferred = skillFromIntent(b);
    const cue = cueText(b.visualIntent, b.keyMotion, b.headline, b.vo);
    let skill: SkillName = isSkillName(b.skill) ? (b.skill as SkillName) : main;

    if (inferred && allowed.has(inferred)) {
      skill = inferred;
    } else if (
      inferred
      && techniqueWasAsked(inferred, cue)
      && (FREE_ON_DEMAND_LEAVES.includes(inferred) || FREE_CORE_LEAVES.includes(inferred))
    ) {
      // 画面正向点名的 SCENE/核心技：即使尚未进 support 也尊重（勿被 main=map 冲掉）
      skill = inferred;
    } else if (inferred && (FREE_CORE_LEAVES.includes(inferred) || opts.support.includes(inferred))) {
      // 意图命中核心抽屉但未进 support：仍尊重画面（稍后 budget 可能已含）
      if (opts.support.includes(inferred) || inferred === main) skill = inferred;
      else skill = main;
    } else if (!allowed.has(skill) || CHASSIS.has(skill) || skill === opts.primary && opts.support.length) {
      // chassis/primary 挂在镜上浪费席位 → 主技法
      // 已挂且画面点名的 SCENE 技保留
      if (!(sceneSkillNeedsCue(skill) && techniqueWasAsked(skill, cue))) {
        skill = main;
      }
    }

    // 连续母题友好：偶数邻镜若意图弱，保持与上一镜相同主技法
    // （在 ensureMainTechniqueDepth 再加固）
    void i;
    return { ...b, skill };
  });
}

/**
 * 主技法至少出现 1 镜（路由准即可）；不再「打满一半镜」。
 * 点缀若存在则保证 1 镜。
 */
export function ensureMainTechniqueDepth<T extends ToolkitBeat>(
  beats: T[],
  mainTechnique: SkillName,
  accent?: SkillName,
): T[] {
  if (!beats.length || !mainTechnique) return beats;
  const next = beats.map((b) => ({ ...b }));
  if (!next.some((b) => b.skill === mainTechnique)) {
    next[Math.floor(next.length / 2)] = {
      ...next[Math.floor(next.length / 2)],
      skill: mainTechnique,
    };
  }
  if (accent && !next.some((b) => b.skill === accent) && next.length >= 2) {
    const victim = next.length - 1;
    if (next[victim].skill !== mainTechnique || next.filter((b) => b.skill === mainTechnique).length > 1) {
      next[victim] = { ...next[victim], skill: accent };
    }
  }
  return next;
}

/** 画面优先挂技 + 主技法至少露面；邻镜换技交给 diversifyBeatSkills */
export function ensureDirectorCoverage<T extends ToolkitBeat>(
  beats: T[],
  primary: SkillName,
  support: SkillName[],
  mainTechnique?: SkillName,
): T[] {
  const main = mainTechnique || support[0] || primary;
  const accent = support.find((s) => FREE_ACCENT_LEAVES.includes(s) && s !== main);
  let next = assignSkillsByIntent(beats, { primary, support, mainTechnique: main });
  next = ensureMainTechniqueDepth(next, main, accent);
  return attachCraftMust(next);
}

export function rebuildSkillsList(
  primary: SkillName,
  support: SkillName[],
  brandSkills: SkillName[],
  engineRemotion: boolean,
): SkillName[] {
  const chassis = engineRemotion ? [...CHASSIS_SKILLS] : [];
  const out: SkillName[] = [];
  for (const id of [primary, ...support, ...brandSkills, ...chassis]) {
    if (isSkillName(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * 对 explainer 自由/解说等非 logo·showreel 片应用导演工具箱。
 * logo/showreel/remix 原样返回。
 */
export function applyDirectorToolkit<T extends ToolkitPlanSlice>(
  plan: T,
  sourcePrompt: string,
): T {
  const mode = (plan.formMode || 'prompt').trim();
  // 仅混剪跳过自由导演工具箱；解说/教程/故事/宣发/标志与类型与自由同路
  if (mode === 'remix') {
    return {
      ...plan,
      beats: attachCraftMust(plan.beats) as T['beats'],
    };
  }

  const sharpened = sharpenFreeSupport(
    plan.primary,
    plan.support,
    plan.brandSkills || [],
    sourcePrompt,
  );
  const main = sharpened.mainTechnique || sharpened.support[0] || plan.primary;
  const motifLock = detectMotifLock(sourcePrompt, plan.coreIdea)
    || plan.motifLock;

  let beats = ensureDirectorCoverage(
    plan.beats,
    plan.primary,
    sharpened.support,
    main,
  ) as T['beats'];

  // logo/launch：未正向点名的 SCENE 技压回 primary（防「不要做写实地图」误灌 map）
  if (plan.primary === 'logo-animation' || plan.primary === 'launch-video') {
    beats = lockTechniquesFromIntent(beats, { keep: plan.primary }) as T['beats'];
  }

  // 连续页：keyMotion 补「同页演化」提示（不改 visualIntent 主体）
  if (motifLock?.continuousPage) {
    beats = beats.map((b, i) => {
      const km = (b.keyMotion || '').trim();
      if (/同页|连续|shared|motif/i.test(km)) return b;
      const prefix = i === 0 ? 'same-page establish → ' : 'same-page evolve → ';
      return {
        ...b,
        keyMotion: `${prefix}${km || 'enter → accent → settle'}`.slice(0, 100),
      };
    }) as T['beats'];
  }

  return {
    ...plan,
    support: sharpened.support,
    brandSkills: sharpened.brandSkills,
    mainTechnique: main,
    motifLock,
    skills: rebuildSkillsList(
      plan.primary,
      sharpened.support,
      sharpened.brandSkills,
      true,
    ),
    beats,
  };
}

/** codegen / props 用的短法条 */
export function motifLockLaw(lock?: MotifLock): string {
  if (!lock?.continuousPage) return '';
  return `=== MOTIF LOCK (continuous page) ===
Shared canvas/motif across ALL scenes: "${lock.motif}".
Do NOT hard-cut to a new location or blank slate each Sequence.
Evolve the SAME page: add/move/scale/remove layers; keep background + hero subject continuity.
Still use one Series.Sequence per scene for editability.`;
}
