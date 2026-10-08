/** Shared technique + recipe pools — style locked; LLM director picks recipe + fills props. */

export const NARRATED_TECHNIQUES = [
  'kinetic',
  'blank_deck',
  'product_demo',
  'diagram',
  'chat_edit',
  'chart_slide',
  'stat',
  'cta',
] as const;

export type NarratedTechnique = (typeof NARRATED_TECHNIQUES)[number];

/** Diagram recipes (diagram-animation skill subset) */
export const DIAGRAM_RECIPES = ['flow', 'nodes', 'cascade'] as const;
export type DiagramRecipe = (typeof DIAGRAM_RECIPES)[number];

/** Presentation recipes (presentation-video / chart subset) */
export const PRESENTATION_RECIPES = ['deck_thumbs', 'hero_slide', 'split_chat'] as const;
export type PresentationRecipe = (typeof PRESENTATION_RECIPES)[number];

export const STAGE_TECHNIQUE_POOL: Record<string, NarratedTechnique[]> = {
  problem: ['kinetic', 'blank_deck'],
  brand: ['kinetic', 'chart_slide'],
  solution: ['product_demo'],
  research: ['diagram'],
  how: ['diagram'],
  design: ['chat_edit', 'chart_slide'],
  proof: ['stat'],
  end: ['cta'],
};

export const DEFAULT_STAGE_TECHNIQUE: Record<string, NarratedTechnique> = {
  problem: 'blank_deck',
  brand: 'kinetic',
  solution: 'product_demo',
  research: 'diagram',
  how: 'diagram',
  design: 'chat_edit',
  proof: 'stat',
  end: 'cta',
};

export function cameraFor(technique: NarratedTechnique, variant = 0): { zoomFrom: number; enterFrames: number } {
  const v = Math.min(2, Math.max(0, variant));
  const base: Record<NarratedTechnique, { zoomFrom: number; enterFrames: number }> = {
    kinetic: { zoomFrom: 1.05 + v * 0.015, enterFrames: 5 },
    blank_deck: { zoomFrom: 1.03 + v * 0.01, enterFrames: 4 },
    product_demo: { zoomFrom: 1.04 + v * 0.01, enterFrames: 5 },
    diagram: { zoomFrom: 1.02 + v * 0.008, enterFrames: 4 },
    chat_edit: { zoomFrom: 1.035 + v * 0.012, enterFrames: 5 },
    chart_slide: { zoomFrom: 1.04 + v * 0.015, enterFrames: 5 },
    stat: { zoomFrom: 1.05 + v * 0.01, enterFrames: 4 },
    cta: { zoomFrom: 1.06 + v * 0.012, enterFrames: 3 },
  };
  return base[technique] || { zoomFrom: 1.03, enterFrames: 4 };
}

export function pickDiagramRecipe(seed: string, preferred?: string): DiagramRecipe {
  if (preferred && (DIAGRAM_RECIPES as readonly string[]).includes(preferred)) {
    return preferred as DiagramRecipe;
  }
  const n = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0);
  return DIAGRAM_RECIPES[n % DIAGRAM_RECIPES.length];
}

export function pickPresentationRecipe(technique: NarratedTechnique, seed: string, preferred?: string): PresentationRecipe {
  if (preferred && (PRESENTATION_RECIPES as readonly string[]).includes(preferred)) {
    return preferred as PresentationRecipe;
  }
  if (technique === 'chat_edit') return 'split_chat';
  if (technique === 'chart_slide') return 'hero_slide';
  const n = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0);
  return PRESENTATION_RECIPES[n % PRESENTATION_RECIPES.length];
}

/** Launch shot-composition recipes (launch-video / motion-design subset) */
export const LAUNCH_SHOT_RECIPES = [
  {
    id: 0, label: 'calm-push', zoomFrom: 1.04,
    boardTilt: [-12, -7] as const, boardPitch: [10, 7] as const, boardScale: 1.16,
    cloudCount: 32, hookCam: 1.08, featurePad: 44, statusWidth: 860,
  },
  {
    id: 1, label: 'bold-dive', zoomFrom: 1.09,
    boardTilt: [-18, -10] as const, boardPitch: [16, 9] as const, boardScale: 1.24,
    cloudCount: 44, hookCam: 1.14, featurePad: 36, statusWidth: 920,
  },
  {
    id: 2, label: 'playful-orbit', zoomFrom: 1.06,
    boardTilt: [-10, -5] as const, boardPitch: [8, 5] as const, boardScale: 1.14,
    cloudCount: 52, hookCam: 1.1, featurePad: 40, statusWidth: 880,
  },
  {
    id: 3, label: 'hero-sweep', zoomFrom: 1.11,
    boardTilt: [-20, -12] as const, boardPitch: [14, 8] as const, boardScale: 1.28,
    cloudCount: 40, hookCam: 1.16, featurePad: 32, statusWidth: 940,
  },
  {
    id: 4, label: 'tight-product', zoomFrom: 1.07,
    boardTilt: [-15, -9] as const, boardPitch: [11, 6] as const, boardScale: 1.2,
    cloudCount: 36, hookCam: 1.09, featurePad: 38, statusWidth: 900,
  },
  {
    id: 5, label: 'wide-stage', zoomFrom: 1.05,
    boardTilt: [-8, -4] as const, boardPitch: [6, 4] as const, boardScale: 1.12,
    cloudCount: 48, hookCam: 1.06, featurePad: 48, statusWidth: 820,
  },
] as const;

export type LaunchShotId = 0 | 1 | 2 | 3 | 4 | 5;

export function launchShot(id?: number) {
  const i = Math.min(5, Math.max(0, Number(id) || 0));
  return LAUNCH_SHOT_RECIPES[i] || LAUNCH_SHOT_RECIPES[0];
}

/** Storyboard beat — explainer script-to-screen SceneSpec */
export type SceneSpecBeat = {
  stage: string;
  technique: NarratedTechnique;
  recipeId?: string;
  vo: string;
  visualIntent: string;
  keyMotion: string;
  transition: string;
  caption: string;
};
