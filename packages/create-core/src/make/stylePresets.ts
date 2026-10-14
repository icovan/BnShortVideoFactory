/**
 * 成片「风格」预设 — 气质/材质走向，不是片型或叶技法清单。
 * 底层映射到 skills；设计参考只锁色板，二者可叠。
 */
import type { SkillName } from '../llm.ts';
import { isSkillName } from '../skills/registry.ts';
import { attachCraftMust } from '../skills/skillDepth.ts';
import {
  ensureDirectorCoverage,
  rebuildSkillsList,
} from './directorToolkit.ts';
import type { JobLook } from './look.ts';
import type { SkillPlan } from './skillPlan.ts'; // type-only — avoid runtime cycle

export type StylePreset = {
  id: string;
  labelZh: string;
  labelEn: string;
  /** 主技法 — 真实 skill id */
  mainTechnique: SkillName;
  /** 可选点缀 leaf */
  accent?: SkillName;
  /** 软工艺（进 brandSkills，不抢主技法席） */
  softCraft?: SkillName[];
  /** 写入 machine brief */
  briefLock: string;
  energy?: string;
  motionNotes?: string;
  preferMono?: boolean;
};

/** 8 个常见成片风格（从 skills 提炼） */
export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'paper-cut',
    labelZh: '剪纸拼贴',
    labelEn: 'Paper-cut collage',
    mainTechnique: 'generative-illustration',
    accent: 'particle-system',
    briefLock:
      'STYLE PRESET: 剪纸拼贴 / paper-cut collage. mainTechnique=generative-illustration. Layered cut paper, offset sheets, silhouette peels — NOT flat icon cards or kinetic-type-only.',
    energy: 'tactile',
    motionNotes:
      'layered paper peel + parallax cut edges; confetti flecks sparingly; matte paper grain',
  },
  {
    id: 'picture-book',
    labelZh: '儿童绘本',
    labelEn: 'Picture book',
    mainTechnique: 'generative-illustration',
    briefLock:
      'STYLE PRESET: 儿童绘本 / children picture book. mainTechnique=generative-illustration. Soft storybook illustration, rounded shapes, gentle page-turn reveals — NOT corporate diagram cards.',
    energy: 'warm',
    motionNotes:
      'soft storybook pans; gentle scale-in characters; watercolor-like flat shapes; cozy type',
  },
  {
    id: 'woodcut',
    labelZh: '木刻版画',
    labelEn: 'Woodcut',
    mainTechnique: 'generative-illustration',
    briefLock:
      'STYLE PRESET: 木刻版画 / woodcut. mainTechnique=generative-illustration. Monochrome carved ink on paper, crosshatch + stipple — NO chroma accent fills.',
    energy: 'hushed',
    motionNotes:
      'monochrome ink woodcut; crosshatch + stipple only; paper grain; no chroma accent',
    preferMono: true,
  },
  {
    id: 'textbook-50s',
    labelZh: '50年代教科书',
    labelEn: '1950s science textbook',
    mainTechnique: 'generative-illustration',
    accent: 'diagram-animation',
    briefLock:
      'STYLE PRESET: 20世纪50年代科学教科书 / 1950s science textbook. mainTechnique=generative-illustration. Vintage textbook plates, labeled figures, halftone diagrams — NOT neon SaaS UI.',
    energy: 'scholarly',
    motionNotes:
      'vintage plate reveals; labeled callouts; halftone / ink print grain; restrained accent',
  },
  {
    id: 'glass-ui',
    labelZh: '玻璃拟态',
    labelEn: 'Glass UI',
    mainTechnique: 'product-demo-video',
    softCraft: ['glassmorphism', 'micro-interaction'],
    briefLock:
      'STYLE PRESET: 玻璃拟态 / glass UI product. mainTechnique=product-demo-video. Frosted glass panels, soft blur, device/UI chrome, micro-interactions — NOT paper-cut or woodcut.',
    energy: 'precise',
    motionNotes:
      'frosted glass panels; backdrop blur; soft specular edges; UI chrome settle; micro-interaction taps',
  },
  {
    id: 'kinetic-type',
    labelZh: '动能大字',
    labelEn: 'Kinetic type',
    mainTechnique: 'kinetic-typography',
    briefLock:
      'STYLE PRESET: 动能大字 / kinetic typography. mainTechnique=kinetic-typography. Words ARE the subject — word slam, stagger, overshoot. Prefer type-led beats over diagrams.',
    energy: 'punchy',
    motionNotes: 'word slam overshoot; line stagger; full-bleed type as hero',
  },
  {
    id: 'whiteboard',
    labelZh: '白板手绘',
    labelEn: 'Whiteboard',
    mainTechnique: 'whiteboard-animation',
    accent: 'diagram-animation',
    briefLock:
      'STYLE PRESET: 白板手绘 / whiteboard. mainTechnique=whiteboard-animation. Stroke-draw ink on cream board; hand-crafted process reveals.',
    energy: 'clear',
    motionNotes: 'strokeDash ink draw; cream board; stepwise hand-drawn process',
  },
  {
    id: 'stickman',
    labelZh: '火柴人',
    labelEn: 'Stickman',
    mainTechnique: 'stickman-animation',
    accent: 'diagram-animation',
    briefLock:
      'STYLE PRESET: 火柴人 / stickman. mainTechnique=stickman-animation. Capsule stick figures with clip phrases; mix diagram beats when explaining structure.',
    energy: 'playful',
    motionNotes: 'stickman clip phrases; clear staging; ink on paper/canvas',
  },
];

const BY_ID = new Map(STYLE_PRESETS.map((p) => [p.id, p]));

export function getStylePreset(id?: string | null): StylePreset | null {
  const key = (id || '').trim();
  if (!key) return null;
  return BY_ID.get(key) || null;
}

export function listStylePresets(): Array<{
  id: string;
  labelZh: string;
  labelEn: string;
  mainTechnique: string;
  accent?: string;
}> {
  return STYLE_PRESETS.map((p) => ({
    id: p.id,
    labelZh: p.labelZh,
    labelEn: p.labelEn,
    mainTechnique: p.mainTechnique,
    accent: p.accent,
  }));
}

/** 拼进 machine brief / sourceAsk，让技法路由与 LLM 看见 */
export function stylePresetBriefLock(id?: string | null): string {
  return getStylePreset(id)?.briefLock || '';
}

/** 无参考图时把预设材质语气并进 look */
export function mergePresetIntoLook(look: JobLook, id?: string | null): JobLook {
  const p = getStylePreset(id);
  if (!p) return look;
  return {
    ...look,
    energy: (p.energy || look.energy).slice(0, 24),
    motionNotes: (p.motionNotes || look.motionNotes).slice(0, 160),
  };
}

/**
 * 硬偏置主技法：support 首位 + 至少一镜挂上。
 * logo/showreel/brand/remix 跳过（自有池）。
 */
export function applyStylePresetToPlan(plan: SkillPlan, id?: string | null): SkillPlan {
  const p = getStylePreset(id);
  if (!p) return plan;
  const mode = (plan.formMode || 'prompt').trim();
  if (mode === 'remix') return plan;
  if (!isSkillName(p.mainTechnique)) return plan;

  const main = p.mainTechnique;
  const accent = p.accent && isSkillName(p.accent) ? p.accent : undefined;
  const rest = plan.support.filter((s) => s !== main && s !== accent);
  const support = [main, ...(accent ? [accent] : []), ...rest].slice(0, 3);
  const soft = (p.softCraft || []).filter(isSkillName);
  const brandSkills = [...new Set([...(plan.brandSkills || []), ...soft])]
    .filter((s) => s !== plan.primary && !support.includes(s));

  let beats = ensureDirectorCoverage(
    plan.beats,
    plan.primary,
    support,
    main,
  );
  if (main === 'stickman-animation') {
    beats = attachCraftMust(beats);
  }

  return {
    ...plan,
    support,
    brandSkills,
    mainTechnique: main,
    look: mergePresetIntoLook(plan.look, p.id),
    skills: rebuildSkillsList(
      plan.primary,
      support,
      brandSkills,
      plan.engine === 'explainer-remotion',
    ),
    beats,
  };
}
