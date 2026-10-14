/**
 * Companion resolution — Agent 对齐：只信 LLM 的 support，不再用 HARD_COMPANIONS 硬补。
 * HARD_COMPANIONS 仅作文档/参考表保留，runtime 不强制灌入。
 */
import type { SkillName } from '../llm.ts';
import { isSkillName } from './registry.ts';

export type CompanionPack = {
  technique: SkillName[];
  brand: SkillName[];
};

/** 参考组合（成品向）；不再自动写入 plan */
export const HARD_COMPANIONS: Partial<Record<SkillName, CompanionPack>> = {
  'explainer-video': {
    technique: ['kinetic-typography', 'diagram-animation'],
    brand: [],
  },
  'launch-video': {
    technique: ['kinetic-typography', 'soundtrack'],
    brand: ['brand-motion-guidelines'],
  },
  'logo-animation': {
    technique: ['svg-animation'],
    brand: ['brand-motion-guidelines', 'video-delivery-specs'],
  },
  'short-form-video': {
    technique: ['kinetic-typography', 'diagram-animation'],
    brand: [],
  },
  'presentation-video': {
    technique: ['kinetic-typography', 'diagram-animation', 'chart-animation'],
    brand: [],
  },
  'promo-video': {
    technique: ['kinetic-typography'],
    brand: ['brand-motion-guidelines'],
  },
  'ad-creative-video': {
    technique: ['kinetic-typography'],
    brand: ['brand-motion-guidelines'],
  },
  'product-demo-video': {
    technique: ['kinetic-typography'],
    brand: ['brand-motion-guidelines', 'glassmorphism'],
  },
  'youtube-intro-outro': {
    technique: ['kinetic-typography'],
    brand: ['brand-motion-guidelines'],
  },
  'wrapped-video': {
    technique: ['chart-animation', 'kinetic-typography'],
    brand: [],
  },
  'animated-infographic': {
    technique: ['chart-animation', 'diagram-animation', 'kinetic-typography'],
    brand: [],
  },
  'map-animation': {
    technique: ['diagram-animation', 'kinetic-typography'],
    brand: [],
  },
  'whiteboard-animation': {
    technique: ['diagram-animation', 'caption-animation'],
    brand: [],
  },
  'text-message-animation': {
    technique: ['kinetic-typography'],
    brand: [],
  },
  'photo-slideshow': {
    technique: ['caption-animation', 'kinetic-typography'],
    brand: [],
  },
  'testimonial-video': {
    technique: ['lower-thirds', 'caption-animation'],
    brand: [],
  },
};

/** Agent：1–4 support；展片最多 3 */
function techCap(_primary: SkillName, opts?: { showreel?: boolean }): number {
  if (opts?.showreel) return 3;
  return 4;
}

function uniq(ids: SkillName[]): SkillName[] {
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

const BRAND_IDS = new Set<SkillName>([
  'brand-motion-guidelines',
  'accessible-animation',
  'video-delivery-specs',
  'client-revisions',
  'motion-pricing',
]);

/**
 * 只保留 LLM 选出的 support（最多 4）。
 * 不再用 HARD_COMPANIONS 填空座位。
 */
export function resolveCompanions(
  primary: SkillName,
  llmSupport: SkillName[],
  opts?: { stickmanMix?: boolean; showreel?: boolean },
): { technique: SkillName[]; brand: SkillName[] } {
  const cap = techCap(primary, opts);
  const llm = llmSupport.filter((s) => isSkillName(s) && s !== primary);

  let technique = uniq(
    llm.filter((s) => !BRAND_IDS.has(s) && s !== 'after-effects'),
  ).slice(0, cap);

  const brand = uniq(llm.filter((s) => BRAND_IDS.has(s) || s === 'accessible-animation'));

  if (opts?.stickmanMix && primary !== 'stickman-animation') {
    technique = uniq(['stickman-animation', ...technique.filter((s) => s !== 'stickman-animation')]).slice(
      0,
      Math.max(cap, 1),
    );
  }

  if (opts?.showreel && !technique.length) {
    // 展片快捷形态：模型空 support 时给最低可映种子（≤3 leaf）
    technique = ['kinetic-typography', 'diagram-animation', 'logo-animation'].slice(0, 3);
  }

  return { technique, brand };
}

export function techniqueCraftIds(primary: SkillName, technique: SkillName[]): SkillName[] {
  return uniq([primary, ...technique]);
}
