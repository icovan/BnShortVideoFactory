import type { Aspect } from '../../../shared/src/index.ts';
import { SKILL_NAMES } from '../llm.ts';
import { extractConstArray } from './surgicalBeats.ts';
import { canvasLawForAspect } from './canvas/index.ts';

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

/** Agent 软画布 — 委托 canvas 包（~5–6% safe + 一镜一隐喻） */
export function contentZoneLaw(aspect: Aspect): string {
  return canvasLawForAspect(aspect);
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
  return `=== REVEAL FAMILY ROTATION (SOFT — skill + brief driven; not a hard gate) ===
Four reveal families — prefer ONE primary family per beat and rotate across the film:
1. mask — overflow:hidden wipe, CSS mask-image, or RGB/chromatic channel-split
2. blur — filter:blur(...) soft↔sharp
3. clip — clipPath / clip-path wipe
4. slam — spring scale overshoot and/or translateY drop + scale settle
Aim for ≥${min} distinct families across ~${n} scenes when it serves the brief.
Skill craft stacks on top. Avoid repeating the same spring()+translateY recipe on every beat.`;
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
  return `- Layered Z: invent a UNIQUE full-frame composition per beat from scene.visualIntent — background material, mid graphic, accent detail. Never a tiny centered card in void.
- Kinetic beats may use large expressive type. Other beats keep a short headline clear of the hero mass.
- Motion: rotate reveal families (mask / blur / clip / slam). Skill craft (stroke, bars, cursor, ink) lands ON the metaphor.
- ${safeAreaSpec(aspect)}
- Frame: the subject owns the frame. A blank field or a hairline chart fails.
- Material comes from the look notes (paper grain, ink, halftone, clay, glow). Palette from THIS topic (no default Linear/PageOn purple unless named).`;
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
  return `CRAFT (16:9, soft): unique full-frame metaphor per beat; layered depth; kinetic type may be large; ${safeAreaSpec(aspect)} the subject must own the frame — a blank or a hairline fails.`;
}

export function craftFloorForOptimize(aspect: Aspect): string {
  if (isPortraitAspect(aspect)) {
    return `CRAFT (portrait, soft): bold short hero type OK; multi-line body readable; ~5–6% edge pad. Rotate reveal families (mask/blur/clip/slam) — do not spring+translateY every beat.`;
  }
    return `CRAFT (landscape, soft): unique full-frame metaphor per beat; layered depth; modest safe pad; the subject must own the frame — not a blank field or a hairline.`;
}

/**
 * Hard craft-density law for directed explainers — beats cookie-cutter HUD films.
 * Injected into codegen; validated by assertFilmCraftDensity.
 */
export function filmCraftDensityLaw(sceneCount?: number): string {
  const n = Math.max(1, sceneCount ?? 6);
  const minLen = Math.min(48000, Math.max(2800, 1200 + n * 280));
  return `=== FREE DIRECTED PICTURE LAW (SOFT — follow skills + brief; not a hard gate) ===
Goal: each beat is a UNIQUE full-frame metaphor from scene.visualIntent.
1. Avoid wrapping every Sequence in the same REC/CAM/TC/LAB chrome.
2. Put skill craft ON the metaphor (ink, bars, cursor, type) — do not erase the brief with a generic A→B→C card.
3. Aim for substantial per-beat components (~${n} scenes, rough floor ~${minLen} chars). Prefer switch(index) or named beat components.
4. Adjacent beats should change composition when the story allows.
5. Prefer one composition per scene; avoid tiny layout registries.
6. If props.assets exist, draw every asset.file with <Img src={staticFile(...)} />.
7. Never put skill id strings on screen.
8. Picture ≠ full VO transcript.
9. Subject should own the frame — avoid near-blank fields.
10. Spoken beats: keep the main reveal moving until ~durationInFrames * 0.8.
11. Layered Z + at least one near-full-bleed accent when it fits the brief.
12. Rotate layout families when useful; avoid the same TitleBlock sandwich on most beats.
13. Numbered steps need distinct nouns from visualIntent — not empty 01–05 shells.
14. Occupancy: hero well should not leave a void half-frame.
15. Metaphor = object + parts + action when the brief calls for it.`;
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

  const minLen = Math.min(48000, Math.max(2800, 1200 + n * 280));
  if (src.length < minLen) {
    issues.push(
      `craft density: ActiveDirected too thin (${src.length} chars, need ≥${minLen} for ${n} beats) — deepen per-beat metaphors`,
    );
  }

  if (skills.includes('diagram-animation')) {
    // Rich vector / reveal craft — do not force the thin nodes/edges cookie cutter.
    const rich = (src.match(/<svg\b|strokeDash|pathLength|clipPath|filter:|maskImage|<path\b|<rect\b/gi) || []).length;
    const need = Math.min(8, 2 + Math.floor(n / 6));
    if (rich < need) {
      issues.push(`diagram-animation: need richer vector/reveal craft (hits ${rich}, want ≥${need}) — draw the beat metaphors, not empty chrome`);
    }
  }
  if (skills.includes('kinetic-typography')) {
    if (!/split\(|stagger|Kinetic/i.test(src)) {
      issues.push('kinetic-typography: need word/line split stagger — not only whole-title fade. Keep the main reveal moving until durationInFrames * 0.8');
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
  issues.push(...assertBeatLayouts(src, n));
  issues.push(...assertNoSkillIdCopy(src));
  issues.push(...assertLayoutVariety(src, n));
  issues.push(...assertLabeledSteps(src));
  return issues;
}

const SKILL_ID_SET = new Set<string>(SKILL_NAMES);

function stripTsComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function componentRegistryLength(src: string, name: string): number | null {
  const arr = extractConstArray(src, name);
  if (!arr) return null;
  const texts = arr.items.map((it) => it.text.trim()).filter(Boolean);
  if (!texts.length) return 0;
  const components = texts.filter((t) => /^[A-Z][A-Za-z0-9_]*$/.test(t)).length;
  if (components < Math.ceil(texts.length * 0.6)) return null;
  return texts.length;
}

/**
 * Catch the 7fmc sandwich: TitleBlock (or equivalent) pinned at left:~96 top:~70 on most beats.
 */
export function assertLayoutVariety(src: string, sceneCount?: number): string[] {
  const n = Math.max(0, sceneCount ?? 0);
  if (n < 6) return [];
  const code = stripTsComments(src);
  const pinned: Array<{ left: number; top: number }> = [];
  for (const m of code.matchAll(/left:\s*(\d+)\s*,\s*top:\s*(\d+)/g)) {
    pinned.push({ left: Number(m[1]), top: Number(m[2]) });
  }
  for (const m of code.matchAll(/top:\s*(\d+)\s*,\s*left:\s*(\d+)/g)) {
    pinned.push({ left: Number(m[2]), top: Number(m[1]) });
  }
  const sameChrome = pinned.filter((p) => p.left >= 72 && p.left <= 130 && p.top >= 48 && p.top <= 96);
  if (sameChrome.length < Math.ceil(n * 0.65)) return [];
  const families = detectLayoutFamilies(code);
  return [
    `layout sandwich: same top-left title chrome on most beats (families: ${families.join(',') || 'none'}) — rotate hook-bleed/split/process/stack/kinetic/lockup`,
  ];
}

export function detectLayoutFamilies(src: string): string[] {
  const found: string[] = [];
  if (/left:\s*0\b|inset:\s*0\b|width:\s*(['"`]?100%|1920)|scale\(\s*1\.[2-9]/i.test(src)) found.push('bleed');
  if (/gridTemplateColumns|width:\s*['"`]?48%|left:\s*(9[0-9]{2}|1[0-4]\d{2})\b/.test(src)
    && /left:\s*([6-9]\d)\b/.test(src)) {
    found.push('split');
  }
  if (/strokeDash|nodes?|edges?|x1=|length:\s*[4-9]/.test(src) && /left:\s*\d+\s*\+/.test(src)) {
    found.push('process');
  }
  if (/flexDirection:\s*['"`]column|top:\s*\d+\s*\+\s*i\s*\*/.test(src)) found.push('stack');
  if (/split\(|Array\.from\(\s*text|words\.map|stagger/i.test(src)) found.push('kinetic');
  if (/署名|下期见|lockup|farewell|goodbye/i.test(src)) found.push('lockup');
  return found;
}

/**
 * Numbered 01–05 cards must carry distinct labels, not a repeated 模块.
 */
export function assertLabeledSteps(src: string): string[] {
  const code = stripTsComments(src);
  const numbered =
    /0\{i\s*\+\s*1\}/.test(code)
    || /0\$\{i\s*\+\s*1\}/.test(code)
    || /`0\$\{\s*i\s*\+\s*1\s*\}`/.test(code);
  if (!numbered) return [];
  const labeled = /labels?\s*\[|items\s*\[|modules?\s*\[|steps\s*\[|names\s*\[|scene\.items/.test(code);
  if (labeled) return [];
  return [
    'empty numbered shells: each 01–N card must show a distinct label from visualIntent/items — not 01–05 + a repeated 模块',
  ];
}

/**
 * Catch BEATS[i % BEATS.length] and any component registry much shorter than the film.
 * Object-literal beat tables and numeric timing arrays are ignored.
 */
export function assertBeatLayouts(src: string, sceneCount?: number): string[] {
  const n = Math.max(0, sceneCount ?? 0);
  if (n < 8) return [];
  const need = Math.ceil(n * 0.85);
  const code = stripTsComments(src);
  const names = new Set<string>();
  for (const m of code.matchAll(/\bconst\s+(BEATS|beats|layouts|SCENES|BeatList)\b/g)) {
    names.add(m[1]);
  }
  for (const m of code.matchAll(/\b([A-Za-z_]\w*)\s*\[\s*[A-Za-z_]\w*\s*%\s*(?:\1\.length|\d+)\s*\]/g)) {
    names.add(m[1]);
  }

  const issues: string[] = [];
  for (const name of names) {
    const len = componentRegistryLength(code, name);
    if (len == null) continue;
    const modulo = new RegExp(`\\b${name}\\s*\\[\\s*[A-Za-z_]\\w*\\s*%`).test(code);
    if (modulo && len < n) {
      issues.push(
        `beat recycle: ${name}[i % length] reuses ${len} layouts across ${n} scenes — write one component per scene`,
      );
      continue;
    }
    if (len < need) {
      issues.push(
        `beat recycle: ${name} has ${len} layouts for ${n} scenes — need ≥${need} distinct beat components`,
      );
    }
  }
  return issues;
}

/** Quoted skill-id lists and JSX text that paints internal skill names on the canvas. */
export function assertNoSkillIdCopy(src: string): string[] {
  const code = stripTsComments(src);
  const issues: string[] = [];
  const arrays = code.match(/\[[^\[\]]{0,1200}\]/g) || [];
  for (const arr of arrays) {
    const ids = [...arr.matchAll(/['"`]([a-z0-9]+(?:-[a-z0-9]+)+)['"`]/g)]
      .map((m) => m[1])
      .filter((id) => SKILL_ID_SET.has(id));
    if (ids.length >= 2) {
      issues.push(
        `skill ids on screen: do not list skill names in the film (${ids.slice(0, 5).join(', ')})`,
      );
      break;
    }
  }
  const jsx = [...code.matchAll(/>([a-z0-9]+(?:-[a-z0-9]+)+)</g)]
    .map((m) => m[1])
    .filter((id) => SKILL_ID_SET.has(id));
  if (jsx.length) {
    issues.push(`skill ids on screen: remove on-canvas skill labels (${[...new Set(jsx)].slice(0, 4).join(', ')})`);
  }
  return issues;
}

export function assetFilesFromProps(assets: unknown): string[] {
  if (!Array.isArray(assets)) return [];
  const out: string[] = [];
  for (const a of assets) {
    if (!a || typeof a !== 'object') continue;
    const file = (a as { file?: unknown }).file;
    if (typeof file === 'string' && file.trim()) out.push(file.replace(/\\/g, '/').trim());
  }
  return out;
}

/** Every uploaded screen file must be referenced beside an <Img>, not merely passed through props. */
export function assertScreenAssetsDrawn(src: string, files: string[]): string[] {
  const missing: string[] = [];
  const hasImg = /<Img\b/.test(src);
  for (const file of files) {
    const base = file.split(/[/\\]/).pop() || file;
    if (!base) continue;
    if (hasImg && (src.includes(file) || src.includes(base))) continue;
    missing.push(base);
  }
  if (!missing.length) return [];
  return [
    `screen assets: draw each upload with <Img src={staticFile('…')}> — missing ${missing.join(', ')}`,
  ];
}
