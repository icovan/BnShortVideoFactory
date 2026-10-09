import type { Aspect } from '../../../shared/src/index.ts';

export type CraftKind = 'default' | 'logo' | 'showreel';

export function isPortraitAspect(aspect: Aspect): boolean {
  return aspect === '9:16' || aspect === '3:4';
}

/** 平台 UI 安全区：背景可满幅，字/Logo/控件必须落在区内。 */
export function safeAreaSpec(aspect: Aspect): string {
  if (isPortraitAspect(aspect)) {
    return '9:16/3:4 SAFE AREA: top ≥8%, bottom ≥18% (platform UI), left/right ≥8%. Full-bleed backgrounds OK; type, logo, and chrome MUST stay inside this box.';
  }
  return '16:9/1:1 SAFE AREA: ≥6% pad on all sides. Titles/logos not flush to frame edge. Full-bleed BG OK.';
}

/**
 * 画布/动效地板。竖屏禁止「每行 ≥72 动能砸字」——那是宽屏作品集门禁，会把 9:16 挤爆并顶到抖音按钮区。
 */
export function cinematicMotionFloor(aspect: Aspect, kind: CraftKind = 'default'): string {
  if (kind === 'logo') {
    return `- LOGO STING (mg-logo craft): mark is the ONLY hero. Recipe: geometric tease → accent bounce/path → stroke-assemble → overshoot/glow → settle.
- On-screen type: none, or brand name / one URL line if brief asks. No explainer headlines, no caption bars, no KineticWords slam, no showreel HUD.
- ${safeAreaSpec(aspect)}
- Motion: spring overshoot / path trail / strokeDash; graphic change in first 8 frames. Prefer uploaded SVG/PNG.
- Palette from THIS mark; dark grain OK; never invent a second logo.`;
  }
  if (kind === 'showreel') {
    return `- MG SHOWREEL (mg-showreel craft): 6 technique chapters — squash&stretch, kinetic type, systems&stagger, radial orbit, shatter, end lockup.
- No VO. Short technique labels as chrome OK; optional tiny corner HUD (index/timecode). No explainer sandwich.
- ${safeAreaSpec(aspect)}
- Motion: every chapter full-bleed geometric/kinetic change in first 8 frames; stagger grids; spring; high contrast MG palette from THIS brief.
- Type: ONE hero slam ≥88px on the kinetic chapter (16:9); other chapters may use small chrome only.`;
  }
  if (isPortraitAspect(aspect)) {
    return `- Type: ONE hero slam (1–4 words / ≤8 zh chars) at 8–12% of width (~86–130px at 1080). Body/captions 4.5–6% (~48–65px). Do NOT set every line to 72–140px.
- KineticWords / KineticLines only for short hooks — never slam a full VO sentence.
- Motion: spring translateY + scale; avoid heavy rotateX/perspective that clips on portrait.
- ${safeAreaSpec(aspect)}
- Frame: subject can full-bleed in the middle band; forbid timid centered micro-UI.
- Draw: stroke/count-up when the beat is diagrammatic. Palette from THIS topic (no default Linear/PageOn purple).`;
  }
  return `- Type: hero kinetic type 88–140px (floor ≥72) for ONE slam, not every caption; prefer KineticWords / KineticLines from '../ui' for short hooks only.
- Motion: spring({ damping: ~12 }) slam — translateY 28–48px + scale 1.12→1 (or 0.88→1 overshoot); stagger 0.08–0.15s; interpolate/camera push; no frozen static AbsoluteFill >0.4s.
- Depth: perspective / rotateX|Y / parallax / stacked AbsoluteFills — never a flat single-layer slide.
- ${safeAreaSpec(aspect)}
- Frame: ≥1 full-bleed / edge-to-edge beat; subject or chrome fills ≥55% of frame; forbid timid centered micro-UI.
- Draw: diagrams/charts via strokeDash, progressive reveal, count-up, shape morph — graphic change in the first 8 frames of each Sequence.
- Palette: invent canvas/ink/accent from THIS topic; do NOT default Linear purple-black / PageOn purple-white unless named.`;
}

export function cinematicFloorLine(aspect: Aspect, kind: CraftKind = 'default'): string {
  if (kind === 'logo') {
    return `CRAFT (logo sting): mark hero; geo→accent→assemble→overshoot→settle; no explainer captions. ${safeAreaSpec(aspect)}`;
  }
  if (kind === 'showreel') {
    return `CRAFT (MG showreel): 6 technique chapters; no VO; kinetic/systems/radial/shatter; tiny HUD OK. ${safeAreaSpec(aspect)}`;
  }
  if (isPortraitAspect(aspect)) {
    return `CRAFT (9:16): one short hero slam 8–12% width; body type 4.5–6%; ${safeAreaSpec(aspect)} Spring translateY/scale — not 72px on every line.`;
  }
  return `CRAFT FLOOR: one hero slam ≥72–140px; spring; depth layers; ${safeAreaSpec(aspect)} Palette from THIS brief — forbid tiny centered micro-UI.`;
}

export function craftFloorForOptimize(aspect: Aspect): string {
  if (isPortraitAspect(aspect)) {
    return `CRAFT (portrait): one short hero slam at 8–12% width; captions 4.5–6% width — NEVER 72–140px on every line. ${safeAreaSpec(aspect)} Spring translateY/scale; no heavy 3D tilt.`;
  }
  return `CRAFT (landscape): one hero slam 72–140px; spring; perspective/depth; ${safeAreaSpec(aspect)} Full-bleed subject; stroke/draw when diagrams fit — NEVER tiny centered micro-UI.`;
}
