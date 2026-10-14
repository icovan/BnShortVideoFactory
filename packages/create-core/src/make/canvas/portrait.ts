/**
 * 竖版 9:16 — Agent 软画布；完整 a2e 竖版仍占位。
 */
import type { Aspect } from '../../../../shared/src/index.ts';

export function isPortraitFamily(aspect: Aspect): boolean {
  return aspect === '9:16';
}

/** @deprecated Prefer canvasLawForAspect Agent soft pack. Kept as experimental a2e-flavored reference. */
export function portraitCanvasLaw(): string {
  return `=== CANVAS PACK portrait (9:16) — experimental reference (default path is Agent soft) ===
Composition 1080×1920. Background = props.canvas (full-bleed OK).
SAFE ~5–6% pad. Unique full-frame metaphor per beat. Captions optional (≤16字 soft).
No forced ContentSlot / Stage shell / top HUD.`;
}
