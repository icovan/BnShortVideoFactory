import type { Aspect, Engine } from '../../../shared/src/index.ts';
import type { SkillName } from '../llm.ts';

export type SkillRole = 'primary' | 'support' | 'chassis';

export type SkillGate = {
  id: string;
  re: RegExp;
  message: string;
};

export type SkillContract = {
  id: SkillName;
  role: SkillRole;
  engine: Engine | 'either';
  when: string;
  gates: SkillGate[];
};

/** 已 vendor：合同 + 硬门禁（吃透 = 代码能扫到核心技法） */
export const SKILL_CONTRACTS: Record<SkillName, SkillContract> = {
  'remotion-video': {
    id: 'remotion-video',
    role: 'chassis',
    engine: 'explainer-remotion',
    when: 'Any Remotion job. Frame-driven only.',
    gates: [
      { id: 'import', re: /from\s+['"]remotion['"]/, message: 'remotion-video: must import from remotion' },
      { id: 'frame', re: /useCurrentFrame/, message: 'remotion-video: must use useCurrentFrame()' },
      { id: 'no-timers', re: /^(?![\s\S]*setTimeout)(?![\s\S]*setInterval)[\s\S]*$/, message: 'remotion-video: no timers' },
    ],
  },
  'shot-composition': {
    id: 'shot-composition',
    role: 'chassis',
    engine: 'explainer-remotion',
    when: 'Every framed piece. Safe area + hierarchy + camera.',
    gates: [
      { id: 'safe', re: /SAFE|safeArea|safeTop|safeX|useSafe|paddingTop|paddingBottom|1080|1920/, message: 'shot-composition: missing safe-area / canvas sizing' },
    ],
  },
  'explainer-video': {
    id: 'explainer-video',
    role: 'primary',
    engine: 'explainer-remotion',
    when: '30–90s narrated how-it-works / onboarding / concept. VO is the spine.',
    gates: [
      { id: 'series', re: /Series|Sequence/, message: 'explainer-video: must sequence scenes with Series or Sequence' },
      { id: 'audio', re: /Audio|staticFile/, message: 'explainer-video: must play per-beat VO' },
    ],
  },
  'launch-video': {
    id: 'launch-video',
    role: 'primary',
    engine: 'explainer-remotion',
    when: '15–60s hype / drop / sizzle. Sound leads picture. Hook→tease→reveal→montage→end.',
    gates: [
      { id: 'drop', re: /dropSec|reveal/i, message: 'launch-video: reveal must reference dropSec or reveal beat' },
      { id: 'spring', re: /spring\s*\(/, message: 'launch-video: kinetic spring on reveal' },
    ],
  },
  'short-form-video': {
    id: 'short-form-video',
    role: 'primary',
    engine: 'explainer-remotion',
    when: '9:16 retention short. Hook in 3s, pattern interrupt, one idea, often a loop.',
    gates: [
      { id: 'hook', re: /hook|SAFE|9:16|1080/i, message: 'short-form-video: missing vertical hook / safe layout' },
    ],
  },
  'presentation-video': {
    id: 'presentation-video',
    role: 'primary',
    engine: 'explainer-remotion',
    when: 'Narrated rebuilt slides / pitch deck. Staggered builds, not a PPT recording.',
    gates: [
      { id: 'slide', re: /slide|deck|card|bullet/i, message: 'presentation-video: missing rebuilt slide / card UI' },
    ],
  },
  'kinetic-typography': {
    id: 'kinetic-typography',
    role: 'support',
    engine: 'explainer-remotion',
    when: 'Headlines, title cards, word/line slam.',
    gates: [
      { id: 'split', re: /split\(|stagger|translateY|Kinetic/, message: 'kinetic-typography: missing word/line stagger' },
    ],
  },
  'caption-animation': {
    id: 'caption-animation',
    role: 'support',
    engine: 'explainer-remotion',
    when: 'Burned karaoke / active-word captions synced to VO.',
    gates: [
      { id: 'karaoke', re: /caption|karaoke|activeWord|splitCaption|words\.map/i, message: 'caption-animation: missing per-word caption highlight' },
    ],
  },
  'diagram-animation': {
    id: 'diagram-animation',
    role: 'support',
    engine: 'explainer-remotion',
    when: 'How-it-works: nodes then edges then labels.',
    gates: [
      { id: 'nodes', re: /svg|path|strokeDash|nodes?|edges?/i, message: 'diagram-animation: missing progressive nodes/edges' },
    ],
  },
  'chart-animation': {
    id: 'chart-animation',
    role: 'support',
    engine: 'explainer-remotion',
    when: 'Numbers, bars, count-up. Value from frame, not CSS.',
    gates: [
      { id: 'value', re: /interpolate\(|CountUp|pct|toLocaleString|Math\.(round|floor)/, message: 'chart-animation: missing frame-driven numeric reveal' },
    ],
  },
  manim: {
    id: 'manim',
    role: 'primary',
    engine: 'manim',
    when: 'Math / formula / graph / 3B1B-style. Not Remotion.',
    gates: [],
  },
  'footage-remix': {
    id: 'footage-remix',
    role: 'primary',
    engine: 'either',
    when: 'User has raw footage clips + script; batch cut / 混剪 / FFmpeg assemble. Hand off to local mix bench — not Remotion codegen.',
    gates: [],
  },
  'wrapped-video': {
    id: 'wrapped-video',
    role: 'primary',
    engine: 'explainer-remotion',
    when: 'Year-in-review / recap stats cascade. One number per beat, not a dashboard dump.',
    gates: [
      { id: 'stat', re: /stat|toLocaleString|CountUp|wrapped|recap/i, message: 'wrapped-video: missing recap stat cascade' },
    ],
  },
  'whiteboard-animation': {
    id: 'whiteboard-animation',
    role: 'primary',
    engine: 'explainer-remotion',
    when: 'Hand-drawn explainer: stroke reveals, ink on paper, not a stock icon dump.',
    gates: [
      { id: 'stroke', re: /strokeDash|stroke-dashoffset|whiteboard/i, message: 'whiteboard-animation: missing stroke reveal' },
    ],
  },
  'stickman-animation': {
    id: 'stickman-animation',
    role: 'primary',
    engine: 'explainer-remotion',
    when: 'MIXABLE actor layer. Capsule rig + motion PHRASES (sampleClip) over raw pose spam. Staging/props/duo blocking for expression. Rides explainer/short/diagram beats; never exclusive. Not whiteboard ink.',
    gates: [
      {
        id: 'stickman-import',
        re: /from\s+['"]\.\.\/stickman['"]/,
        message: 'stickman-animation: must import shared rig from ../stickman',
      },
      {
        id: 'stickman',
        re: /<Stickman\b/,
        message: 'stickman-animation: missing <Stickman /> component',
      },
      {
        id: 'series',
        re: /Series|Sequence/,
        message: 'stickman-animation: must sequence beats with Series or Sequence',
      },
      {
        id: 'stickman-motion',
        re: /sampleClip(ForIntent)?\s*\(|walkPose\s*\(|lerpPose\s*\(|idleBob\s*\(/,
        message: 'stickman-animation: drive motion with sampleClip / walkPose / lerpPose',
      },
    ],
  },
  'isometric-animation': {
    id: 'isometric-animation',
    role: 'primary',
    engine: 'explainer-remotion',
    when: 'Isometric product / city / stack. Perspective + rotateX, not a flat card.',
    gates: [
      { id: 'iso', re: /isometric|rotateX|perspective/i, message: 'isometric-animation: missing perspective / rotateX' },
    ],
  },
  'text-message-animation': {
    id: 'text-message-animation',
    role: 'primary',
    engine: 'explainer-remotion',
    when: 'Chat script → iMessage/WhatsApp bubbles. Typing then send, not typeset paragraphs.',
    gates: [
      { id: 'bubble', re: /bubble|iMessage|fromMe|chatRow/i, message: 'text-message-animation: missing chat bubbles' },
    ],
  },
  'promo-video': {
    id: 'promo-video',
    role: 'primary',
    engine: 'explainer-remotion',
    when: 'Sale / offer / % off. Price strike then new price, countdown optional.',
    gates: [
      { id: 'offer', re: /promo|strike|%|off\b|price/i, message: 'promo-video: missing offer / price beat' },
    ],
  },
  'product-demo-video': {
    id: 'product-demo-video',
    role: 'primary',
    engine: 'explainer-remotion',
    when: 'UI walkthrough: cursor / device frame / screenshot beats.',
    gates: [
      { id: 'cursor', re: /cursor|pointer|device|screenshot/i, message: 'product-demo-video: missing cursor / device frame' },
    ],
  },
  'photo-slideshow': {
    id: 'photo-slideshow',
    role: 'primary',
    engine: 'explainer-remotion',
    when: 'Still photos with Ken Burns. Scale from frame, not a CSS slideshow.',
    gates: [
      { id: 'burns', re: /ken|burns|scale\(/i, message: 'photo-slideshow: missing Ken Burns scale' },
    ],
  },
  'ad-creative-video': {
    id: 'ad-creative-video',
    role: 'primary',
    engine: 'explainer-remotion',
    when: 'Paid social ad: hook, proof, CTA. One claim.',
    gates: [
      { id: 'cta', re: /cta|headline|CTA/i, message: 'ad-creative-video: missing CTA / headline lockup' },
    ],
  },
  'testimonial-video': {
    id: 'testimonial-video',
    role: 'primary',
    engine: 'explainer-remotion',
    when: 'Quote / stars / reviewer. Social proof, not a wall of text.',
    gates: [
      { id: 'quote', re: /quote|stars|review|testimonial/i, message: 'testimonial-video: missing quote / stars' },
    ],
  },
  'countdown-video': {
    id: 'countdown-video',
    role: 'primary',
    engine: 'explainer-remotion',
    when: 'Drop / launch clock. Frame-driven remaining seconds.',
    gates: [
      { id: 'clock', re: /countdown|Math\.floor|remaining/i, message: 'countdown-video: missing frame-driven remaining count' },
    ],
  },
  'animated-infographic': {
    id: 'animated-infographic',
    role: 'primary',
    engine: 'explainer-remotion',
    when: 'Infographic cascade: one fact at a time, not a poster.',
    gates: [
      { id: 'cascade', re: /infographic|cascade|items\.map/i, message: 'animated-infographic: missing fact cascade' },
    ],
  },
  'map-animation': {
    id: 'map-animation',
    role: 'primary',
    engine: 'explainer-remotion',
    when: 'Place / route / marker. Geo intent on screen.',
    gates: [
      { id: 'map', re: /map|marker|lat|lng|geo/i, message: 'map-animation: missing map / marker' },
    ],
  },
  'logo-animation': {
    id: 'logo-animation',
    role: 'primary',
    engine: 'explainer-remotion',
    when: 'Brand mark sting (mg-logo craft): geo tease → accent motion → assemble → overshoot → settle. Mark is hero, not a corner bug. Not a multi-chapter showreel.',
    gates: [
      { id: 'logo', re: /logo|Img|strokeDash|pathLength|assemble|wordmark|clipPath|clip-path/i, message: 'logo-animation: missing logo sting / mark assemble' },
      { id: 'draw-or-mask', re: /strokeDash|pathLength|clipPath|clip-path|WebkitClipPath/i, message: 'logo-animation: need stroke draw-on or clip/mask reveal (see remotion-logo-craft)' },
      { id: 'spring-settle', re: /spring\s*\(/, message: 'logo-animation: need spring settle / overshoot on assemble' },
    ],
  },
  'brand-motion-guidelines': {
    id: 'brand-motion-guidelines',
    role: 'support',
    engine: 'explainer-remotion',
    when: 'Brand timing/easing tokens + logo do/don\'t. Injected into logo/launch/promo craft — not a film primary.',
    gates: [
      // Soft craft fingerprints when selected; hard gate skipped in assertSkillsInTsx
      { id: 'token-easing', re: /spring\s*\(|Easing\.|config:\s*\{/, message: 'brand-motion-guidelines: missing named easing / spring token feel' },
    ],
  },
  'video-delivery-specs': {
    id: 'video-delivery-specs',
    role: 'chassis',
    engine: 'either',
    when: 'Delivery / verify checklist for encoded film. Injected for brand films; not a visual primary.',
    gates: [],
  },
  audiogram: {
    id: 'audiogram',
    role: 'primary',
    engine: 'explainer-remotion',
    when: 'Podcast / speech waveform bars driven by frame, not a still album art.',
    gates: [
      { id: 'wave', re: /audiogram|waveform|barH/i, message: 'audiogram: missing waveform bars' },
    ],
  },
  'youtube-intro-outro': {
    id: 'youtube-intro-outro',
    role: 'primary',
    engine: 'explainer-remotion',
    when: 'Channel sting: intro or outro lockup.',
    gates: [
      { id: 'sting', re: /intro|outro|subscribe/i, message: 'youtube-intro-outro: missing intro/outro sting' },
    ],
  },
  'lower-thirds': {
    id: 'lower-thirds',
    role: 'support',
    engine: 'explainer-remotion',
    when: 'Name / title plate over picture. Transparent-ready lockup.',
    gates: [
      { id: 'lt', re: /lowerThird|lower-third|namePlate/i, message: 'lower-thirds: missing name plate' },
    ],
  },
  'motion-background': {
    id: 'motion-background',
    role: 'support',
    engine: 'explainer-remotion',
    when: 'Living backdrop. Gradient / loop, not a frozen hex.',
    gates: [
      { id: 'bg', re: /gradient|motionBg|radial-gradient/i, message: 'motion-background: missing living backdrop' },
    ],
  },
  'color-motion': {
    id: 'color-motion',
    role: 'support',
    engine: 'explainer-remotion',
    when: 'Palette lock: canvas/ink/accent used as design system.',
    gates: [],
  },
  'animation-principles': {
    id: 'animation-principles',
    role: 'chassis',
    engine: 'explainer-remotion',
    when: 'Anticipation, overshoot, easing. Spring not linear fade.',
    gates: [
      { id: 'spring', re: /spring\s*\(/, message: 'animation-principles: missing spring / overshoot' },
    ],
  },
  'beat-sync-editing': {
    id: 'beat-sync-editing',
    role: 'support',
    engine: 'explainer-remotion',
    when: 'Cuts land on drop / beat. dropSec must drive picture.',
    gates: [
      { id: 'drop', re: /dropSec|beat/i, message: 'beat-sync-editing: missing dropSec / beat lock' },
    ],
  },
  'motion-art-direction': {
    id: 'motion-art-direction',
    role: 'support',
    engine: 'explainer-remotion',
    when: 'Look lock from brief. Injected into codegen, not a visual primitive.',
    gates: [],
  },
  'creative-brief': {
    id: 'creative-brief',
    role: 'support',
    engine: 'either',
    when: 'Prompt optimizer only. Never a film primary.',
    gates: [],
  },
  'svg-animation': {
    id: 'svg-animation',
    role: 'support',
    engine: 'explainer-remotion',
    when: 'Vector stroke draw-on / path reveal for marks & icons. Remotion: pathLength+strokeDashoffset (see remotion-bridge).',
    gates: [
      { id: 'stroke', re: /strokeDash|pathLength|clipPath|clip-path/i, message: 'svg-animation: missing stroke/clip vector reveal' },
    ],
  },
  'lottie-animation': {
    id: 'lottie-animation',
    role: 'support',
    engine: 'explainer-remotion',
    when: 'Lottie-style trim/opacity reveals rebuilt in Remotion. Not a film primary.',
    gates: [],
  },
  'generative-illustration': {
    id: 'generative-illustration',
    role: 'support',
    engine: 'explainer-remotion',
    when: 'Code-drawn geometric illustration language for explainers / diagrams. Support craft only.',
    gates: [],
  },
  'soundtrack': {
    id: 'soundtrack',
    role: 'support',
    engine: 'explainer-remotion',
    when: 'Music-led films: bed / drop / duck under VO. Launch & showreel craft.',
    gates: [
      { id: 'bed', re: /musicFile|dropSec|Audio|staticFile\s*\(/i, message: 'soundtrack: missing musicFile/dropSec/Audio bed lock' },
    ],
  },
  'gsap-web': {
    id: 'gsap-web',
    role: 'support',
    engine: 'explainer-remotion',
    when: 'Easing/stagger taste only — map to Remotion spring/interpolate. Never import gsap in ActiveDirected.',
    gates: [],
  },
  '60fps-animation': {
    id: '60fps-animation',
    role: 'support',
    engine: 'explainer-remotion',
    when: 'Performance: prefer transform/opacity; avoid layout thrash. Remotion: cheap per-frame style updates.',
    gates: [],
  },
  'accessible-animation': {
    id: 'accessible-animation',
    role: 'support',
    engine: 'explainer-remotion',
    when: 'Reduced-motion / no flash >3Hz. Soft craft for brand films.',
    gates: [],
  },
  'after-effects': {
    id: 'after-effects',
    role: 'support',
    engine: 'either',
    when: 'AE export / Lottie handoff reference. Not a Remotion primary.',
    gates: [],
  },
  'ascii-animation': {
    id: 'ascii-animation',
    role: 'support',
    engine: 'explainer-remotion',
    when: 'ASCII / terminal aesthetic fields. Rare support craft.',
    gates: [],
  },
  'client-revisions': {
    id: 'client-revisions',
    role: 'support',
    engine: 'either',
    when: 'Freelance revision workflow docs. Never a film primary.',
    gates: [],
  },
  'glassmorphism': {
    id: 'glassmorphism',
    role: 'support',
    engine: 'explainer-remotion',
    when: 'Frosted glass panels (backdrop-filter / translucent cards) for product UI beats.',
    gates: [],
  },
  'javascript-animation': {
    id: 'javascript-animation',
    role: 'support',
    engine: 'explainer-remotion',
    when: 'Zero-asset canvas / code-drawn motion language. Map to Remotion shapes, not DOM rAF.',
    gates: [],
  },
  'micro-interaction': {
    id: 'micro-interaction',
    role: 'support',
    engine: 'explainer-remotion',
    when: 'Hover/press/toggle feedback taste for UI demo beats. Frame-driven only.',
    gates: [],
  },
  'motion-pricing': {
    id: 'motion-pricing',
    role: 'support',
    engine: 'either',
    when: 'Freelance pricing docs. Never a film primary.',
    gates: [],
  },
  'page-transition-animation': {
    id: 'page-transition-animation',
    role: 'support',
    engine: 'explainer-remotion',
    when: 'Enter/exit scene transitions — map to Sequence wipes, not Next.js router.',
    gates: [],
  },
  'particle-system': {
    id: 'particle-system',
    role: 'support',
    engine: 'explainer-remotion',
    when: 'Particle accents for launch/logo. Prefer lightweight div/svg particles in Remotion; no Three.js required.',
    gates: [],
  },
  'shader-glsl': {
    id: 'shader-glsl',
    role: 'support',
    engine: 'explainer-remotion',
    when: 'Shader aesthetics as reference. Remotion: approximate with gradients/noise CSS unless WebGL runtime exists.',
    gates: [],
  },
  'threejs-animation': {
    id: 'threejs-animation',
    role: 'support',
    engine: 'explainer-remotion',
    when: '3D motion reference. Soft craft only — do not require three.js in ActiveDirected.',
    gates: [],
  },
};

export const PRIMARY_SKILLS: SkillName[] = [
  'explainer-video',
  'launch-video',
  'short-form-video',
  'presentation-video',
  'manim',
  'footage-remix',
  'wrapped-video',
  'whiteboard-animation',
  'stickman-animation',
  'isometric-animation',
  'text-message-animation',
  'promo-video',
  'product-demo-video',
  'photo-slideshow',
  'ad-creative-video',
  'testimonial-video',
  'countdown-video',
  'animated-infographic',
  'map-animation',
  'logo-animation',
  'audiogram',
  'youtube-intro-outro',
];

export const SUPPORT_SKILLS: SkillName[] = [
  'kinetic-typography',
  'caption-animation',
  'diagram-animation',
  'chart-animation',
  'stickman-animation',
  'lower-thirds',
  'color-motion',
  'beat-sync-editing',
  'motion-art-direction',
  'motion-background',
  'brand-motion-guidelines',
  'svg-animation',
  'lottie-animation',
  'generative-illustration',
  'soundtrack',
  'gsap-web',
  '60fps-animation',
  'accessible-animation',
  'after-effects',
  'ascii-animation',
  'client-revisions',
  'glassmorphism',
  'javascript-animation',
  'micro-interaction',
  'motion-pricing',
  'page-transition-animation',
  'particle-system',
  'shader-glsl',
  'threejs-animation',
];

export const CHASSIS_SKILLS: SkillName[] = [
  'remotion-video',
  'shot-composition',
  'animation-principles',
  'video-delivery-specs',
];

/** Brand films auto-pull these into codegen (not LLM-picked primaries). */
export const BRAND_CRAFT_SKILLS: SkillName[] = [
  'brand-motion-guidelines',
  'video-delivery-specs',
  'accessible-animation',
];

/** Logo sting: vector craft stack (injected; hard gates soft-skipped except via logo primary). */
export const LOGO_CRAFT_SKILLS: SkillName[] = [
  'svg-animation',
  'lottie-animation',
  'gsap-web',
  'particle-system',
  '60fps-animation',
];

/** Music-led films. */
export const LAUNCH_CRAFT_SKILLS: SkillName[] = [
  'soundtrack',
  'gsap-web',
  'particle-system',
  'page-transition-animation',
];

/** Product / UI demo polish. */
export const UI_CRAFT_SKILLS: SkillName[] = [
  'glassmorphism',
  'micro-interaction',
  'accessible-animation',
  '60fps-animation',
];

/**
 * Soft docs / web-origin references — never hard-fail.
 * P0: technique companions (svg/caption/diagram/kinetic/soundtrack/…) are NOT soft.
 */
export const SOFT_CRAFT_SKILLS: SkillName[] = [
  'brand-motion-guidelines',
  'video-delivery-specs',
  'accessible-animation',
  'creative-brief',
  'lottie-animation',
  'gsap-web',
  'generative-illustration',
  'javascript-animation',
  '60fps-animation',
  'after-effects',
  'ascii-animation',
  'client-revisions',
  'glassmorphism',
  'micro-interaction',
  'motion-pricing',
  'page-transition-animation',
  'particle-system',
  'shader-glsl',
  'threejs-animation',
];

export function isSkillName(v: unknown): v is SkillName {
  return typeof v === 'string' && v in SKILL_CONTRACTS;
}

/**
 * 硬门禁只验 craft 技能（primary + ≤2 support）+ remotion-video。
 * shot-composition / animation-principles / 未列入 hardIds 的 skill 不硬卡。
 */
export function assertSkillsInTsx(
  skillIds: SkillName[],
  tsx: string,
  opts?: { hardIds?: SkillName[] },
): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (/fetch\s*\(|setInterval|setTimeout|requestAnimationFrame/.test(tsx)) {
    issues.push('remotion-video: no fetch / timers / rAF');
  }
  if (/export\s*\{\s*(NarratedExplainer|LaunchShowreel|NextWordLoop)\s+as\s+ActiveDirected/.test(tsx)) {
    issues.push('must NOT re-export a locked SKU as ActiveDirected');
  }
  if (!/export\s+(const|function)\s+ActiveDirected/.test(tsx)) {
    issues.push('must export ActiveDirected');
  }

  const hardIds = (opts?.hardIds?.length ? opts.hardIds : skillIds).filter((id) => {
    if (id === 'manim') return false;
    if (id === 'shot-composition' || id === 'animation-principles') return false;
    // Injected craft docs / web-origin skills: deepen via prompt, not hard-fail
    if (SOFT_CRAFT_SKILLS.includes(id)) return false;
    return true;
  });
  if (!hardIds.includes('remotion-video')) hardIds.unshift('remotion-video');

  const stickmanLed = hardIds.includes('stickman-animation');
  for (const id of hardIds) {
    const c = SKILL_CONTRACTS[id];
    if (!c?.gates.length) continue;
    // 火柴人片：support 技法门禁 soft（避免为过关堆 token）
    if (stickmanLed && c.role === 'support' && id !== 'stickman-animation') continue;
    for (const g of c.gates) {
      if (g.id === 'no-timers') continue;
      if (!g.re.test(tsx)) issues.push(g.message);
    }
  }
  return { ok: issues.length === 0, issues };
}

export type RenderQuality = '1080p' | '720p';

export function sizeFor(aspect: Aspect, quality: RenderQuality = '1080p') {
  const q720 = quality === '720p';
  if (aspect === '9:16') return q720 ? { width: 720, height: 1280 } : { width: 1080, height: 1920 };
  if (aspect === '1:1') return q720 ? { width: 720, height: 720 } : { width: 1080, height: 1080 };
  if (aspect === '3:4') return q720 ? { width: 720, height: 960 } : { width: 1080, height: 1440 };
  return q720 ? { width: 1280, height: 720 } : { width: 1920, height: 1080 };
}

export function probeResFor(aspect: Aspect, quality: RenderQuality = '1080p') {
  const { width, height } = sizeFor(aspect, quality);
  return `${width}x${height}`;
}
