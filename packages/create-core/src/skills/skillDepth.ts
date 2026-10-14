/**
 * Skill depth layer — maximize craft use beyond "skill name mentioned + one regex hit".
 * Rhythm/SKU templates stay separate; this only deepens selected skills in directed codegen.
 */
import type { SkillName } from '../llm.ts';
import { SKILL_CONTRACTS } from './registry.ts';

/** Actionable MUST lines injected into codegen (short; not full SKILL.md). */
export const CRAFT_MUST: Partial<Record<SkillName, string[]>> = {
  'explainer-video': [
    'VO-led spine: each Sequence length tracks narration; show the spoken idea as graphics',
    'Use Series/Sequence over scenes; never empty AbsoluteFill placeholders',
  ],
  'launch-video': [
    'Hook→tease→reveal on dropSec; kinetic spring on the reveal beat',
    'Sound leads picture when musicFile/dropSec present',
  ],
  'short-form-video': [
    'Hook graphic in first ~3s; one idea; vertical-safe layout',
    'Pattern interrupt between beats (scale/mask/color snap)',
  ],
  'presentation-video': [
    'Rebuilt slide/card UI with staggered builds — not a static poster',
  ],
  'kinetic-typography': [
    'Word/line stagger (split + translateY/spring) on that beat headline',
    'Do not only fade whole title once',
    'Stage 2–4 phases: enter → accent → settle (or exit); mid-beat motion required',
    'Vary reveal family (mask/blur/clip/slam) — not one spring recipe every beat',
  ],
  'diagram-animation': [
    'Progressive disclosure: nodes then edges/paths then labels (svg/path/strokeDash)',
    'Stagger or spring between node reveals',
    'Hold the same diagram space across the beat; grow parts, do not reset the graph each frame',
    'Labels arrive after structure — never a static finished poster at t=0',
  ],
  'caption-animation': [
    'Per-word or active-word caption highlight synced to VO timing',
  ],
  'chart-animation': [
    'Frame-driven count-up / bar grow via interpolate — not a static number',
    'Keep one shared chart geometry; add points/bars over time — do not swap chart types every beat',
    'Axes/baseline stay; data marks enter with overshoot or grow',
    'Payoff: final value or steep segment holds ≥0.5s',
  ],
  'stickman-animation': [
    'Import shared Stickman from ../stickman; drive with sampleClip/walkPose/lerpPose',
    'Staging/props — not floating figure alone',
  ],
  'whiteboard-animation': [
    'Stroke reveal (strokeDash / dashoffset) like ink drawing',
    'Ink accumulates — previous strokes remain while new paths draw',
    'Prefer pathLength/dashoffset over opacity fades for the hero line',
  ],
  'product-demo-video': [
    'Device/screenshot frame + cursor/pointer motion on UI beats',
  ],
  'logo-animation': [
    'Mark assemble path (geo→accent→assemble→overshoot→settle)',
    'Stroke draw-on (pathLength+strokeDashoffset) OR clipPath wipe OR piece assemble — not opacity-only',
    'Final lockup: uniform scale + spring settle; hold settled mark',
  ],
  'brand-motion-guidelines': [
    'Use brand duration/easing intent: spring settle on brand moments, decelerate entrances',
    'Logo do/don\'t: no non-uniform squash, no free spin, no recolour outside palette mid-reveal',
  ],
  'video-delivery-specs': [
    'Frame-driven only; Composition sized to aspect; avoid empty placeholder Sequences',
  ],
  'svg-animation': [
    'Vector reveal via pathLength+strokeDashoffset or clipPath — frame-driven, no GSAP/CSS keyframes',
  ],
  'lottie-animation': [
    'Rebuild trim/opacity reveals with interpolate/spring; do not invent Lottie URLs',
  ],
  'generative-illustration': [
    'Code-drawn layered illustration from the brief material (paper cut / collage / ink / clay) — not stock icon dump',
    'Build with 2–4 overlapping shape layers that slide/offset; keep the same material language across the beat',
    'Typography is secondary caption — the layered picture is the hero, not kinetic word slam',
  ],
  'soundtrack': [
    'Music-led: respect musicFile/dropSec; duck bed under VO when both present',
  ],
  'gsap-web': [
    'Map easing/stagger taste to Remotion spring/interpolate — never import gsap',
  ],
  'glassmorphism': [
    'Frosted translucent panels via backdropFilter — not opaque white cards only',
  ],
  'particle-system': [
    'Lightweight particle accents with frame-driven positions — avoid mandatory three.js',
  ],
  '60fps-animation': [
    'Prefer transform/opacity; avoid layout thrash and heavy full-screen blur stacks',
  ],
  'accessible-animation': [
    'No strobe; do not communicate meaning by motion alone',
  ],
  'page-transition-animation': [
    'Scene enter/exit wipes between Sequences — not a web router transition',
  ],
  'micro-interaction': [
    'UI press/hover feedback on demo beats — short spring, frame-driven',
  ],
  'javascript-animation': [
    'Code-drawn geometric motion language in Remotion primitives',
  ],
  'promo-video': [
    'Price strike → new price / % off lockup',
  ],
  'ad-creative-video': [
    'Hook → proof → CTA lockup (one claim)',
  ],
  'testimonial-video': [
    'Quote + stars/reviewer social-proof lockup',
  ],
  'countdown-video': [
    'Frame-driven remaining seconds',
  ],
  'animated-infographic': [
    'One fact cascade at a time (items.map stagger)',
    'Icons/plates enter in sequence; prior facts stay visible when the story needs accumulation',
    'Callouts pop after the fact mark settles — not all at once',
  ],
  'map-animation': [
    'Map/marker/route graphic intent on screen',
  ],
  'wrapped-video': [
    'One recap stat per beat with numeric reveal',
  ],
  'text-message-animation': [
    'Chat bubbles with typing→send rhythm',
  ],
  'photo-slideshow': [
    'Ken Burns scale from frame on stills',
  ],
  'isometric-animation': [
    'perspective / rotateX isometric stack',
  ],
  audiogram: [
    'Frame-driven waveform bars',
  ],
  'youtube-intro-outro': [
    'Channel sting + kinetic title; short loop-friendly end',
  ],
  'color-motion': [
    'Palette shifts tied to beat accents (not random flash)',
  ],
  'beat-sync-editing': [
    'Cut or accent motion lands on beat / job accents',
  ],
  'lower-thirds': [
    'Name/title lower-third slide-in',
  ],
  'remotion-video': [
    'useCurrentFrame + spring/interpolate; no setTimeout/fetch',
  ],
};

export type BeatSkillRef = {
  job?: string;
  skill: SkillName | string;
  visualIntent?: string;
  keyMotion?: string;
  /** a2e §4 layout mode id */
  layoutMode?: string;
  craftMust?: string[];
};

/** Attach craftMust. A named picture outranks the skill's generic recipe. */
export function attachCraftMust<T extends BeatSkillRef>(beats: T[]): T[] {
  return beats.map((b) => {
    const id = b.skill as SkillName;
    const must = CRAFT_MUST[id] || [];
    const picture = (b.visualIntent || '').trim();
    const named = picture.length >= 8 && !/^illustrate\s*:/i.test(picture);
    if (named) {
      const flow = /节点|连线|流程图|模块/.test(picture);
      const skillLine = id === 'diagram-animation'
        ? (flow ? must.slice(0, 1) : [])
        : must.slice(0, 1);
      return {
        ...b,
        craftMust: [
          'Picture = visualIntent. Draw that full-frame metaphor (object + action + space). The skill only decides how it moves. Do not replace it with a words-only card, a generic A→B→C node graph, or another skill\'s object.',
          ...skillLine,
        ],
      };
    }
    return must.length ? { ...b, craftMust: must } : { ...b, craftMust: b.craftMust };
  });
}

/**
 * Ensure every selected craft skill appears on ≥1 beat.
 * Prefer reassigning duplicate-heavy beats over inventing new ones.
 */
export function ensureBeatSkillCoverage<T extends BeatSkillRef>(
  beats: T[],
  primary: SkillName,
  support: SkillName[],
): T[] {
  if (!beats.length) return beats;
  const need = [primary, ...support].filter(Boolean);
  let next = beats.map((b) => ({ ...b }));

  const counts = () => {
    const m = new Map<string, number>();
    for (const b of next) m.set(String(b.skill), (m.get(String(b.skill)) || 0) + 1);
    return m;
  };

  for (const id of need) {
    const c = counts();
    if ((c.get(id) || 0) > 0) continue;
    let victim = next.length - 1;
    let best = -1;
    c.forEach((n, skill) => {
      if (skill === id) return;
      if (n > best) {
        best = n;
        victim = next.findIndex((b) => b.skill === skill);
      }
    });
    if (victim < 0) victim = next.length - 1;
    next[victim] = { ...next[victim], skill: id };
  }

  const distinct = new Set(next.map((b) => b.skill)).size;
  if (support.length && next.length >= 4 && distinct < 3) {
    const primaryShare = next.filter((b) => b.skill === primary).length / next.length;
    if (primaryShare >= 0.7) {
      next = next.map((b, i) => {
        if (i % 2 === 1) {
          const s = support[Math.floor(i / 2) % support.length];
          return { ...b, skill: s };
        }
        return b;
      });
      if (!next.some((b) => b.skill === primary)) {
        next[0] = { ...next[0], skill: primary };
      }
    }
  }

  return attachCraftMust(next);
}

/** Compact law block for codegen system prompt. */
export function craftDepthBrief(
  skillIds: SkillName[],
  beats: BeatSkillRef[],
): string {
  const craft = skillIds.filter((id) => id !== 'shot-composition' && id !== 'animation-principles');
  const lines: string[] = ['=== CRAFT DEPTH LAW (implement deeply — not name-drop) ==='];
  for (const id of craft) {
    const must = CRAFT_MUST[id] || [];
    const when = SKILL_CONTRACTS[id]?.when || '';
    lines.push(`## ${id}`);
    if (when) lines.push(`when: ${when}`);
    for (const m of must) lines.push(`- MUST: ${m}`);
  }
  lines.push('=== PER-BEAT SKILL (that beat MUST show this technique) ===');
  beats.forEach((b, i) => {
    const must = (b.craftMust || CRAFT_MUST[b.skill as SkillName] || []).slice(0, 2);
    lines.push(
      `beat[${i}] job=${b.job || i} skill=${b.skill}`
        + (b.layoutMode ? ` layoutMode=${b.layoutMode}` : '')
        + (must.length ? ` → ${must.join(' | ')}` : '')
        + (b.visualIntent ? ` | intent: ${b.visualIntent.slice(0, 80)}` : ''),
    );
  });
  lines.push('When a beat intent names a metaphor, that metaphor fills the frame. A MUST line says how it moves. It does not replace the metaphor with a generic node card, a title-only slide, or another skill\'s object.');
  lines.push('If scene.layoutMode is present, treat it as an optional variety hint only — full-frame metaphors from visualIntent still win.');
  return lines.join('\n');
}

export type SkillDepthReport = {
  ok: boolean;
  score: number;
  max: number;
  issues: string[];
  perSkill: Record<string, { hit: boolean; detail: string }>;
};

/** Depth score: contract gates + motion variety + beat-skill fingerprint. */
export function scoreSkillDepth(
  tsx: string,
  skillIds: SkillName[],
  beats: BeatSkillRef[],
): SkillDepthReport {
  const issues: string[] = [];
  const perSkill: SkillDepthReport['perSkill'] = {};
  let score = 0;
  let max = 0;

  const craft = skillIds.filter(
    (id) => id !== 'manim' && id !== 'footage-remix' && id !== 'creative-brief'
      && id !== 'shot-composition' && id !== 'animation-principles',
  );

  for (const id of craft) {
    max += 2;
    const c = SKILL_CONTRACTS[id];
    const gates = (c?.gates || []).filter((g) => g.id !== 'no-timers');
    const gateOk = !gates.length || gates.every((g) => g.re.test(tsx));
    if (gateOk) score += 1;
    else {
      issues.push(...gates.filter((g) => !g.re.test(tsx)).map((g) => g.message));
    }

    const must = CRAFT_MUST[id] || [];
    // Real depth — never treat gateOk alone as "deep" (that made thin HUD films pass)
    const depthOk = gateOk && (
      must.length === 0
      || id === 'remotion-video'
      || (id === 'kinetic-typography' && /split\(|stagger|Kinetic/i.test(tsx))
      || (id === 'diagram-animation'
        && /strokeDash|pathLength|<svg\b|<path\b|clipPath/i.test(tsx)
        && /spring\(|stagger|interpolate\(/.test(tsx))
      || (id === 'caption-animation' && /caption|karaoke|activeWord|words\.map/i.test(tsx))
      || (id === 'chart-animation' && /interpolate\(|CountUp|toLocaleString|Math\.(round|floor)/.test(tsx))
      || (id === 'explainer-video' && /Series|Sequence/.test(tsx) && /Audio|staticFile/.test(tsx))
      || (id === 'stickman-animation' && /sampleClip|walkPose|lerpPose/.test(tsx))
      || (id === 'soundtrack' && /musicFile|dropSec|Audio/.test(tsx))
      || (must.length > 0 && gateOk && id !== 'kinetic-typography' && id !== 'diagram-animation'
        && id !== 'caption-animation')
    );
    if (depthOk) score += 1;
    else if (gateOk) issues.push(`${id}: gate ok but craft looks shallow — deepen technique on assigned beats`);

    perSkill[id] = {
      hit: gateOk,
      detail: gateOk ? (depthOk ? 'deep' : 'shallow') : 'miss',
    };
  }

  // Motion variety (anti spring+translateY-only film)
  max += 2;
  const families = [
    /spring\s*\(/.test(tsx),
    /clipPath|clip-path|inset\(/i.test(tsx),
    /blur\(|filter:|backdropFilter/i.test(tsx),
    /maskImage|WebkitMask|mask\s*:/i.test(tsx),
    /scale\(|rotate\(/i.test(tsx),
  ].filter(Boolean).length;
  if (families >= 2) score += 1;
  else issues.push('motion depth: need ≥2 reveal families (spring/mask/blur/clip/scale)');
  if (families >= 3) score += 1;

  // Anti cookie-cutter monitor chrome + thin films
  max += 2;
  const chromeHits = (tsx.match(/\bREC\b|CAM\s*\d+|TC\s*[\d:]+|LAB\s*-/gi) || []).length;
  const beatN = Math.max(1, beats.length);
  const sharedHud =
    beatN >= 6
    && /const\s+\w*(Hud|Monitor|CamChrome|RecFrame|LabChrome)\w*\s*[:=]/i.test(tsx)
    && /<\w*(Hud|Monitor|CamChrome|RecFrame|LabChrome)\w*\b/i.test(tsx);
  if (beatN < 6 || (!sharedHud && chromeHits < Math.ceil(beatN * 1.15))) score += 1;
  else issues.push('chrome spam: REC/CAM/TC/LAB wrapping too many beats — vary layouts');
  const minLen = Math.min(48000, Math.max(2800, 1200 + beatN * 280));
  if (tsx.length >= minLen) score += 1;
  else issues.push(`craft density: TSX too thin (${tsx.length} < ${minLen}) for ${beatN} beats`);

  // Beat-assigned leaf skills must leave fingerprints in TSX
  const craftSet = new Set<SkillName>(craft);
  const onBeats = [...new Set(beats.map((b) => b.skill as SkillName).filter(Boolean))];
  for (const id of onBeats) {
    if (!craftSet.has(id)) continue;
    if (id === 'remotion-video' || id === 'explainer-video' || id === 'short-form-video' || id === 'launch-video') {
      continue;
    }
    const c = SKILL_CONTRACTS[id];
    if (!c?.gates?.length) continue;
    max += 1;
    const ok = c.gates.filter((g) => g.id !== 'no-timers').some((g) => g.re.test(tsx));
    if (ok) score += 1;
    else issues.push(`beat-skill ${id}: assigned on beats but technique fingerprint missing in TSX`);
  }

  const uniqIssues = [...new Set(issues)].slice(0, 12);
  // Chrome spam / collapsed density never soft-pass — thin HUD films must repair
  const hardBlock = uniqIssues.some((i) =>
    /chrome spam/i.test(i)
    || (beatN >= 6 && /craft density: TSX too thin/i.test(i)),
  );
  const ok = !hardBlock && (max === 0 || score >= Math.ceil(max * 0.65));
  return {
    ok,
    score,
    max,
    issues: uniqIssues,
    perSkill,
  };
}
