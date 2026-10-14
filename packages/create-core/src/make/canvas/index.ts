import type { Aspect } from '../../../../shared/src/index.ts';
import {
  isLandscapeFamily,
  landscapeBands,
  landscapeCanvasLaw,
  type LandscapeAspect,
} from './landscape.ts';
import { isPortraitFamily, portraitCanvasLaw } from './portrait.ts';
import { sharedCraftLaw } from './shared.ts';
import {
  a2eModeCraftLine,
  a2eModeTableLaw,
  inferA2eMode,
  type A2eModeId,
} from './a2eModes.ts';

/**
 * Agent 基础画布（软）：全幅自绘 + ~5–6% 安全区。
 * 不再默认注入 a2e Stage 硬壳 / ContentSlot 带。
 * 完整 a2e 长文仍可由 landscapeCanvasLaw / portraitCanvasLaw 导出作实验参考。
 */
export function canvasLawForAspect(aspect: Aspect): string {
  if (isPortraitFamily(aspect)) {
    return `${agentPortraitCanvasLaw()}\n\n${sharedCraftLaw()}`;
  }
  const landscape = isLandscapeFamily(aspect) ? (aspect as LandscapeAspect) : '16:9';
  return `${agentLandscapeCanvasLaw(landscape)}\n\n${sharedCraftLaw()}`;
}

function agentLandscapeCanvasLaw(aspect: LandscapeAspect): string {
  const b = landscapeBands(aspect);
  return `=== CANVAS (Agent soft — ${aspect}) ===
Composition ${b.frame.w}×${b.frame.h}. Background = props.canvas (full-bleed OK). Ink/accent from props.
SAFE AREA (soft): ~5–6% pad on all sides; titles/logos not flush to frame edge.
Each beat invents a UNIQUE full-frame metaphor from scene.visualIntent — layered depth, one hero.
Captions: optional in-shot or props.captions; prefer short chunks ≤16 Chinese chars; white + dark stroke, no opaque bar (soft style).
Do NOT force a top HUD pill, progress bar, or Stage-owned shell. scene.layoutMode is a soft variety hint only.
FORBIDDEN: cookie-cutter REC/CAM/TC/LAB on every beat; blank / hairline frames.`;
}

function agentPortraitCanvasLaw(): string {
  return `=== CANVAS (Agent soft — 9:16) ===
Composition 1080×1920. Background = props.canvas (full-bleed OK).
SAFE AREA (soft): ~5–6% pad; not a timid center strip. Extra bottom clearance only if platform CTA is in the brief.
UNIQUE full-frame metaphor per beat. Captions optional; ≤16字 chunks soft. No forced HUD / Stage shell.`;
}

export {
  sharedCraftLaw,
  isLandscapeFamily,
  isPortraitFamily,
  landscapeBands,
  landscapeCanvasLaw,
  portraitCanvasLaw,
  a2eModeCraftLine,
  a2eModeTableLaw,
  inferA2eMode,
};
export type { A2eModeId };
