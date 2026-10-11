/**
 * Hard companion packs for skill-directed films (no hard-SKU template required).
 * Technique slots ≠ brand slots — brand never steals diagram/kinetic seats.
 * Explainer-class films get 3 technique seats so caption cannot evict kinetic.
 */
import type { SkillName } from '../llm.ts';
import { SUPPORT_SKILLS, isSkillName } from './registry.ts';

export type CompanionPack = {
  /** Hard craft companions — enter craftSkillIds + hard gates */
  technique: SkillName[];
  /** Brand / delivery / a11y — codegen inject, separate from technique cap */
  brand: SkillName[];
};

/** Official-style same-film combinations (成品向). */
export const HARD_COMPANIONS: Partial<Record<SkillName, CompanionPack>> = {
  'explainer-video': {
    // Kinetic + diagram are the visual spine; caption rides VO — all three hard
    technique: ['diagram-animation', 'kinetic-typography', 'caption-animation'],
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
    technique: ['kinetic-typography', 'caption-animation', 'diagram-animation'],
    brand: [],
  },
  'presentation-video': {
    technique: ['kinetic-typography', 'diagram-animation', 'caption-animation'],
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
  'countdown-video': {
    technique: ['kinetic-typography'],
    brand: [],
  },
  audiogram: {
    technique: ['caption-animation', 'kinetic-typography'],
    brand: [],
  },
  'isometric-animation': {
    technique: ['diagram-animation', 'kinetic-typography'],
    brand: [],
  },
};

const TECH_CAP_DEFAULT = 2;

/** Rich VO / chapter films — caption must not steal kinetic/diagram seats. */
const TECH_CAP_BY_PRIMARY: Partial<Record<SkillName, number>> = {
  'explainer-video': 3,
  'presentation-video': 3,
  'short-form-video': 3,
  'animated-infographic': 3,
};

function techCap(primary: SkillName, opts?: { showreel?: boolean }): number {
  if (opts?.showreel) return 3;
  return TECH_CAP_BY_PRIMARY[primary] ?? TECH_CAP_DEFAULT;
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

/**
 * Merge LLM support with hard companions.
 * Technique seats filled by HARD pack first, then LLM extras if room.
 * Brand seats never count against technique cap.
 */
export function resolveCompanions(
  primary: SkillName,
  llmSupport: SkillName[],
  opts?: { stickmanMix?: boolean; showreel?: boolean },
): { technique: SkillName[]; brand: SkillName[] } {
  const cap = techCap(primary, opts);
  const pack = HARD_COMPANIONS[primary] || { technique: [], brand: [] };
  let technique = uniq(
    pack.technique.filter((s) => SUPPORT_SKILLS.includes(s) || isSkillName(s)),
  ).slice(0, cap);

  const llmTech = llmSupport.filter(
    (s) =>
      isSkillName(s)
      && SUPPORT_SKILLS.includes(s)
      && s !== 'brand-motion-guidelines'
      && s !== 'video-delivery-specs'
      && s !== 'client-revisions'
      && s !== 'motion-pricing'
      && s !== 'after-effects',
  );

  for (const s of llmTech) {
    if (technique.length >= cap) break;
    if (!technique.includes(s)) technique.push(s);
  }

  if (opts?.showreel) {
    technique = uniq(['kinetic-typography', 'diagram-animation', 'color-motion', ...technique]).slice(0, 3);
  }

  if (opts?.stickmanMix && primary !== 'stickman-animation') {
    // stickman takes one technique seat but keep at least one leaf craft
    const leaf = technique.filter((s) => s !== 'stickman-animation');
    technique = uniq(['stickman-animation', ...leaf]).slice(0, Math.max(cap, opts.showreel ? 3 : cap));
  }

  const brand = uniq([
    ...pack.brand,
    ...llmSupport.filter((s) => s === 'brand-motion-guidelines' || s === 'accessible-animation'),
  ]);

  return { technique, brand };
}

/** Craft ids for hard gates: primary + technique only */
export function techniqueCraftIds(primary: SkillName, technique: SkillName[]): SkillName[] {
  return uniq([primary, ...technique]);
}
