import type { Aspect } from '../../../shared/src/index.ts';

export type CraftKind = 'default' | 'logo' | 'showreel';

/** Kinetic reveal families — rotate per beat so codegen cannot spring+translateY every scene. */
export type RevealFamily = 'mask' | 'blur' | 'clip' | 'slam';

export function isPortraitAspect(aspect: Aspect): boolean {
  return aspect === '9:16' || aspect === '3:4';
}

/**
 * 轻量安全区（贴近旧厂「Safe areas required」）。
 * 竖屏不再强塞底 18%——那会把动能/金句片挤成中间细条；仅提示别贴边。
 */
export function safeAreaSpec(aspect: Aspect): string {
  if (isPortraitAspect(aspect)) {
    return '9:16/3:4 SAFE AREA (soft): ~5–6% pad on all sides; keep type/logo off the extreme edges. Full-bleed BG OK. Extra bottom clearance only if a platform CTA/chrome is in the brief.';
  }
  return '16:9/1:1 SAFE AREA (soft): ~5–6% pad on all sides. Titles/logos not flush to frame edge. Full-bleed BG OK.';
}

/** Detect which reveal families appear in generated TSX (static scan). */
export function detectRevealFamilies(src: string): RevealFamily[] {
  const found: RevealFamily[] = [];
  if (/clipPath|clip-path/i.test(src)) found.push('clip');
  if (/\bblur\s*\(/i.test(src)) found.push('blur');
  if (
    /maskImage|WebkitMask|\bmask\s*:|maskSize|maskPosition|maskRepeat/i.test(src)
    || /RGB|chromatic|channel.?offset|channel.?split/i.test(src)
  ) {
    found.push('mask');
  }
  // slam: scale overshoot and/or spring + translateY drop
  if (
    /scale\s*[`(]/.test(src)
    || /transform:\s*[`'"].*scale/i.test(src)
    || (/translateY\s*[`(]/.test(src) && /spring\s*\(/.test(src))
  ) {
    found.push('slam');
  }
  return found;
}

export function minRevealFamilies(opts: {
  craftKind?: CraftKind;
  sceneCount?: number;
  stickmanLed?: boolean;
}): number {
  if (opts.craftKind === 'logo') return 0;
  const n = opts.sceneCount ?? 4;
  if (n <= 2) return 1;
  // Stickman-led: still need variety on type/diagram beats, but 1 family floor for short pieces
  if (opts.stickmanLed && n <= 4) return 1;
  if (n <= 4) return 2;
  return 3;
}

/** Hard gate issues when the film collapses to one spring recipe. */
export function assertRevealFamilyRotation(
  src: string,
  opts?: { craftKind?: CraftKind; sceneCount?: number; stickmanLed?: boolean },
): string[] {
  const min = minRevealFamilies(opts || {});
  if (min <= 0) return [];
  const found = detectRevealFamilies(src);
  if (found.length >= min) return [];
  return [
    `reveal families: need ≥${min} of mask|blur|clip|slam across beats (found: ${found.join(',') || 'none'}). Rotate per scene — forbid spring+translateY-only film.`,
  ];
}

/**
 * Injected into codegen system prompts for ALL skill paths.
 * sceneCount drives how many distinct families are required.
 */
export function revealFamilyHardRules(sceneCount?: number): string {
  const n = Math.max(1, sceneCount ?? 6);
  const min = n <= 2 ? 1 : n <= 4 ? 2 : 3;
  return `=== REVEAL FAMILY ROTATION (HARD — statically validated) ===
Four reveal families — assign ONE primary family per beat and ROTATE across the film:
1. mask — overflow:hidden wipe, CSS mask-image, or RGB/chromatic channel-split that resolves
2. blur — filter:blur(...) soft↔sharp on type or graphic
3. clip — clipPath / clip-path inset or polygon wipe
4. slam — spring scale overshoot (e.g. 1.18→1.0) and/or translateY drop + scale settle
REQUIRE ≥${min} distinct families in this film (~${n} scenes). Adjacent beats SHOULD use different families.
Skill-specific craft (strokeDash diagrams, count-up, stickman sampleClip, logo path trim) stacks ON TOP — it does not replace rotation.
FORBIDDEN: every beat = the same spring() + translateY recipe.`;
}

/**
 * Soft craft hint — 旧厂级 + 一丢丢，禁止写成硬字号表。
 */
export function cinematicMotionFloor(aspect: Aspect, kind: CraftKind = 'default'): string {
  if (kind === 'logo') {
    return `- LOGO STING: mark is the ONLY hero — geo tease → accent → stroke-assemble → overshoot → settle.
- On-screen type: none, or brand name / one URL if asked. No explainer caption bars.
- ${safeAreaSpec(aspect)}
- Motion: spring / path / strokeDash; prefer uploaded SVG/PNG. Palette from THIS mark.`;
  }
  if (kind === 'showreel') {
    return `- MG SHOWREEL: technique chapters (squash, kinetic, stagger, radial, shatter, lockup). No VO.
- Short chrome labels OK. ${safeAreaSpec(aspect)}
- Motion: full-bleed geometric/kinetic change early in each chapter; rotate reveal families (mask/blur/clip/slam); palette from THIS brief.`;
  }
  if (isPortraitAspect(aspect)) {
    return `- Type (portrait, soft): short hero hooks may be bold and large (roughly ~14–20% of width for 1–3 words — about 150–220px at 1080). Multi-line body/quote readable (~7–10% / ~75–110px). Do NOT make every line a max slam; do NOT shrink the whole film into a timid center strip.
- Kinetic type: prefer short hooks; full VO sentences stay smaller.
- Motion: rotate reveal families (mask / blur / clip / slam) per beat — not spring+translateY on every word.
- ${safeAreaSpec(aspect)}
- Frame: use the vertical canvas — type/graphics can own most of the middle; forbid tiny centered micro-UI.
- Palette from THIS topic (no default Linear/PageOn purple).`;
  }
  return `- Type (landscape, soft): one hero slam can be large (about 72–140px); captions smaller. Prefer KineticWords / KineticLines for short hooks only.
- Motion: rotate reveal families (mask / blur / clip / slam); spring/depth welcome; no frozen empty AbsoluteFill.
- ${safeAreaSpec(aspect)}
- Frame: full-bleed subject OK; forbid timid centered micro-UI.
- Draw: strokeDash / progressive reveal / count-up when diagrammatic.
- Palette from THIS topic (no default Linear/PageOn purple unless named).`;
}

export function cinematicFloorLine(aspect: Aspect, kind: CraftKind = 'default'): string {
  if (kind === 'logo') {
    return `CRAFT (logo sting, soft): mark hero; assemble/overshoot; no explainer captions. ${safeAreaSpec(aspect)}`;
  }
  if (kind === 'showreel') {
    return `CRAFT (MG showreel, soft): technique chapters; rotate reveal families; no VO. ${safeAreaSpec(aspect)}`;
  }
  if (isPortraitAspect(aspect)) {
    return `CRAFT (9:16, soft): bold short heroes OK; body readable; ~5–6% edge pad — not a tiny center strip. Rotate mask/blur/clip/slam per beat.`;
  }
  return `CRAFT (16:9, soft): one hero slam welcome; rotate mask/blur/clip/slam; ${safeAreaSpec(aspect)} forbid tiny centered micro-UI.`;
}

export function craftFloorForOptimize(aspect: Aspect): string {
  if (isPortraitAspect(aspect)) {
    return `CRAFT (portrait, soft): bold short hero type OK; multi-line body readable; ~5–6% edge pad. Rotate reveal families (mask/blur/clip/slam) — do not spring+translateY every beat.`;
  }
  return `CRAFT (landscape, soft): one hero slam welcome; rotate mask/blur/clip/slam; modest safe pad; full-bleed subject OK — not tiny centered micro-UI.`;
}

/**
 * Hard craft-density law for directed explainers — beats cookie-cutter HUD films.
 * Injected into codegen; validated by assertFilmCraftDensity.
 */
export function filmCraftDensityLaw(sceneCount?: number): string {
  const n = Math.max(1, sceneCount ?? 6);
  const minLen = Math.min(48000, Math.max(2000, 900 + n * 220));
  return `=== FILM CRAFT DENSITY (HARD — statically validated) ===
Goal: each beat has a DISTINCT graphic idea — not the same chrome skin with a new title.
1. Anti-HUD spam: do NOT wrap every Sequence in the same REC / CAM / TC / LAB monitor chrome. At most 1–2 beats may use a surveillance frame as a STORY beat; others must change layout (diagram full-bleed, kinetic slam, caption bar, chart, archival card…).
2. Per-beat craft: diagram beats → real SVG nodes/edges/strokeDash; kinetic beats → split/stagger words or lines; caption beats → active-word / karaoke highlight tied to VO.
3. Density: ~${n} scenes need substantial ActiveDirected (≥~${minLen} chars of real components, not one shared HudShell). Prefer ≥3 interpolate() drivers on long films.
4. Adjacent beats MUST change composition (layout / hero graphic / reveal family) — title-only swaps fail.`;
}

/** Static density + anti-chrome-spam gates (成片向). */
export function assertFilmCraftDensity(
  src: string,
  opts: {
    sceneCount?: number;
    skillIds?: string[];
    craftKind?: CraftKind;
  } = {},
): string[] {
  if (opts.craftKind === 'logo' || opts.craftKind === 'showreel') return [];
  const n = Math.max(1, opts.sceneCount ?? 4);
  const skills = opts.skillIds || [];
  const issues: string[] = [];

  const chromeHits = (src.match(/\bREC\b|CAM\s*\d+|TC\s*[\d:]+|LAB\s*-/gi) || []).length;
  const sharedHud =
    n >= 6
    && /const\s+\w*(Hud|Monitor|CamChrome|RecFrame|LabChrome)\w*\s*[:=]/i.test(src)
    && /<\w*(Hud|Monitor|CamChrome|RecFrame|LabChrome)\w*\b/i.test(src)
    && /(scenes\s*\|\||props\.scenes|BEATS)\s*\.map|Series\.Sequence/.test(src);
  if (sharedHud || (n >= 6 && chromeHits >= Math.ceil(n * 1.15))) {
    issues.push(
      'chrome spam: REC/CAM/TC/LAB must not wrap most beats — vary composition (diagram/kinetic/caption layouts)',
    );
  }

  const minLen = Math.min(48000, Math.max(2000, 900 + n * 220));
  if (src.length < minLen) {
    issues.push(
      `craft density: ActiveDirected too thin (${src.length} chars, need ≥${minLen} for ${n} beats) — deepen per-beat graphics`,
    );
  }

  if (skills.includes('diagram-animation')) {
    const svgN = (src.match(/<svg\b|strokeDash|pathLength|\bnodes?\b|\bedges?\b/gi) || []).length;
    const need = Math.min(10, 3 + Math.floor(n / 5));
    if (svgN < need) {
      issues.push(`diagram-animation: need richer SVG/nodes/strokeDash (hits ${svgN}, want ≥${need})`);
    }
  }
  if (skills.includes('kinetic-typography')) {
    if (!/split\(|stagger|Kinetic/i.test(src)) {
      issues.push('kinetic-typography: need word/line split stagger — not only whole-title fade');
    }
  }
  if (skills.includes('caption-animation')) {
    if (!/caption|karaoke|activeWord|words\.map/i.test(src)) {
      issues.push('caption-animation: need per-word / active caption highlight');
    }
  }
  const interp = (src.match(/interpolate\s*\(/g) || []).length;
  if (n >= 8 && interp < 3) {
    issues.push('craft density: need ≥3 interpolate() drivers for long explainers');
  }
  return issues;
}
