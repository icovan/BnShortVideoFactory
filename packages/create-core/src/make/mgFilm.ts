/**
 * Logo 片 / 动效展片 — 成品质量硬配方（对齐 cankao mg-logo / mg-showreel）
 * 提示词定品牌与气质；章节结构与工艺由系统锁死。
 */
import type { SkillName } from '../llm.ts';

export type MgFilmKind = 'logo' | 'showreel';

/** 避免与 skillPlan 循环依赖：只依赖结构 */
type MgBeat = {
  job: string;
  vo: string;
  headline: string;
  line?: string;
  visualIntent: string;
  keyMotion: string;
  skill: SkillName;
  durationSec?: number;
};

type MgPlan = {
  primary: SkillName;
  support: SkillName[];
  brandSkills?: SkillName[];
  skills: SkillName[];
  beats: MgBeat[];
  voMode: 'on' | 'off' | 'auto';
  contentLang: 'zh' | 'en' | 'bilingual';
};

/** Logo sting：几何起势 → 强调色运动 → 组装 → 过冲 → 定版（约 5–8s） */
export const LOGO_BEAT_RECIPE: Array<{
  job: string;
  visualIntent: string;
  keyMotion: string;
  skill: SkillName;
  durationSec: number;
}> = [
  {
    job: 'geo-tease',
    visualIntent: 'Minimal geometric tease: ruler ticks / thin path / concentric guide — not the full mark yet',
    keyMotion: 'stroke draw',
    skill: 'logo-animation',
    durationSec: 1.2,
  },
  {
    job: 'accent-motion',
    visualIntent: 'Brand-accent object (dot/ball) with path trail or bounce hitting a beat — physics-feel, same accent color as mark',
    keyMotion: 'spring bounce path',
    skill: 'logo-animation',
    durationSec: 1.6,
  },
  {
    job: 'mark-assemble',
    visualIntent: 'Wordmark/icon stroke-draw or part-assemble into the final mark; mark is the ONLY hero',
    keyMotion: 'stroke assemble',
    skill: 'logo-animation',
    durationSec: 2.0,
  },
  {
    job: 'overshoot',
    visualIntent: 'Scale/rotation overshoot on the lockup + brief accent glow or particle burst at the brand hotspot',
    keyMotion: 'spring overshoot',
    skill: 'logo-animation',
    durationSec: 1.2,
  },
  {
    job: 'settle',
    visualIntent: 'Settle the mark; optional one short URL/tagline ONLY if brief asks — never explainer captions',
    keyMotion: 'settle lockup',
    skill: 'logo-animation',
    durationSec: 1.4,
  },
];

/** 动效展片：六章技法（约 12–16s），对齐 mg-showreel */
export const SHOWREEL_CHAPTER_RECIPE: Array<{
  job: string;
  headline: string;
  visualIntent: string;
  keyMotion: string;
  skill: SkillName;
  durationSec: number;
}> = [
  {
    job: 'ch-squash',
    headline: 'SQUASH & STRETCH',
    visualIntent: 'Orange ball squash/stretch on a floor line with motion ghosts; weight and impact readable',
    keyMotion: 'squash stretch spring',
    skill: 'kinetic-typography',
    durationSec: 2.2,
  },
  {
    job: 'ch-kinetic',
    headline: 'KINETIC TYPE',
    visualIntent: 'One hero word slammed full-bleed; custom letter geometry (eye/target in a glyph); high contrast',
    keyMotion: 'kinetic slam',
    skill: 'kinetic-typography',
    durationSec: 2.4,
  },
  {
    job: 'ch-systems',
    headline: 'SYSTEMS & STAGGER',
    visualIntent: 'Dense grid of circles/diamonds; center accent; stagger morph size/corner-radius by distance',
    keyMotion: 'stagger grid morph',
    skill: 'diagram-animation',
    durationSec: 2.4,
  },
  {
    job: 'ch-radial',
    headline: 'RADIAL ORBIT',
    visualIntent: 'Concentric dashed arcs + radial spokes; short phrase rides a circular path; rotational motion',
    keyMotion: 'radial rotate',
    skill: 'kinetic-typography',
    durationSec: 2.4,
  },
  {
    job: 'ch-shatter',
    headline: 'SHATTER',
    visualIntent: 'Central burst of particles and geometric shards exploding outward — clean vector, not photo debris',
    keyMotion: 'shatter burst',
    skill: 'kinetic-typography',
    durationSec: 2.2,
  },
  {
    job: 'ch-lockup',
    headline: 'LOCKUP',
    visualIntent: 'End card: bold name/wordmark + thin accent rule + one subtitle line; settle with spring',
    keyMotion: 'settle lockup',
    skill: 'logo-animation',
    durationSec: 2.0,
  },
];

export function mgFilmLockPrompt(kind: MgFilmKind): string {
  if (kind === 'logo') {
    return `LOGO FILM LOCK (mg-logo quality):
- primary MUST be logo-animation. Exactly 5 beats matching: geo-tease → accent-motion → mark-assemble → overshoot → settle.
- EVERY vo="" and headline="". visualIntent = motion on the mark / brand accent only.
- Prefer uploaded SVG/PNG as the mark. Never invent a second logo. No explainer captions, no stickman, no HUD showreel chrome.
- Palette from the mark; dark grain OK if brief is cinematic.`;
  }
  return `SHOWREEL FILM LOCK (mg-showreel quality):
- Music/SFX film, NO voice-over. Exactly 6 chapters: squash → kinetic type → systems&stagger → radial orbit → shatter → end lockup.
- Each beat.headline = short technique label (English OK as chrome). beat.vo always "".
- Optional tiny corner HUD (SHOWREEL / index / label / timecode) — never large explainer captions.
- primary = launch-video; support ≤3: kinetic-typography + diagram-animation + logo-animation (shatter stays kinetic craft).
- Full-bleed geometric / kinetic motion every chapter; invent shapes from THIS brief's brand/theme colors.`;
}

/** 用硬配方覆盖/补齐 beats，保证成品结构 */
export function applyMgFilmRecipe<T extends MgPlan>(plan: T, kind: MgFilmKind): T {
  if (kind === 'logo') {
    const beats: MgBeat[] = LOGO_BEAT_RECIPE.map((r, i) => {
      const prev = plan.beats[i];
      return {
        job: r.job,
        vo: '',
        headline: '',
        line: undefined,
        visualIntent: (prev?.visualIntent && prev.visualIntent.length >= 12
          ? prev.visualIntent
          : r.visualIntent
        ).slice(0, 160),
        keyMotion: r.keyMotion,
        skill: 'logo-animation',
        durationSec: r.durationSec,
      };
    });
    const support = unique([
      'svg-animation',
      ...plan.support.filter((s) => s !== 'stickman-animation' && s !== 'brand-motion-guidelines'),
    ]).slice(0, 2);
    const brandSkills = unique([
      'brand-motion-guidelines',
      'video-delivery-specs',
      ...(plan.brandSkills || []),
    ]);
    return {
      ...plan,
      primary: 'logo-animation',
      support,
      brandSkills,
      skills: unique([
        'logo-animation',
        ...support,
        ...brandSkills,
        ...plan.skills.filter((s) => s !== 'stickman-animation'),
      ]),
      voMode: 'off',
      beats,
    };
  }

  // 硬预算：1 primary + ≤3 leaf（与面板 showreel 池一致；不再塞 color-motion）
  const support = unique([
    'kinetic-typography',
    'diagram-animation',
    'logo-animation',
    ...plan.support.filter((s) =>
      s === 'kinetic-typography' || s === 'diagram-animation' || s === 'logo-animation'
    ),
  ]).slice(0, 3);
  const zhChrome: Record<string, string> = {
    'ch-squash': '弹压拉伸',
    'ch-kinetic': '动能字体',
    'ch-systems': '系统错峰',
    'ch-radial': '径向轨道',
    'ch-shatter': '碎裂爆发',
    'ch-lockup': '终章定版',
  };
  const useZh = plan.contentLang === 'zh';
  const allowed = new Set<SkillName>(['launch-video', ...support]);
  const beats: MgBeat[] = SHOWREEL_CHAPTER_RECIPE.map((r, i) => {
    const prev = plan.beats[i];
    const chrome = useZh ? (zhChrome[r.job] || r.headline) : r.headline;
    const skill = allowed.has(r.skill) ? r.skill : (support[0] || 'kinetic-typography');
    return {
      job: r.job,
      vo: '',
      headline: (prev?.headline && prev.headline.length >= 2 ? prev.headline : chrome).slice(0, 48),
      line: undefined,
      visualIntent: (prev?.visualIntent && prev.visualIntent.length >= 12
        ? prev.visualIntent
        : r.visualIntent
      ).slice(0, 160),
      keyMotion: r.keyMotion,
      skill,
      durationSec: r.durationSec,
    };
  });
  return {
    ...plan,
    primary: 'launch-video',
    support,
    skills: unique(['launch-video', ...support, ...(plan.brandSkills || [])]),
    voMode: 'off',
    beats,
  };
}

function unique(ids: SkillName[]): SkillName[] {
  return [...new Set(ids)];
}

export function logoCodegenHint(): string {
  return `
LOGO STING HARD LOCK (mg-logo + brand-motion-guidelines + remotion-logo-craft):
- Mark is the ONLY hero. Use props.assets logo Img when present; else geometric wordmark from the brief name — never a second invented brand.
- Beat recipe on screen: (1) geometric tease (2) accent bounce/path (3) stroke-draw OR clipPath mask assemble (4) spring overshoot (5) settle hold ≥0.4s.
- EVERY scene.vo empty; do NOT invent explainer headlines. Empty headline → no title card.
- Brand tokens: entrances decelerate (spring settle); brand moment = emphasized spring; no linear fade-only reveals; uniform scale on final lockup.
- Remotion craft: pathLength+strokeDashoffset draw-on, or clipPath wipe, or staggered piece assemble — pick ONE primary technique and commit.
- Clearspace: do not crop the settled mark with particles/wipes.
- FORBIDDEN: stickman, caption bars, KineticWords slamming full sentences, showreel corner HUD, non-uniform squash on final mark, recolour outside palette mid-reveal.
`;
}

export function showreelCodegenHint(): string {
  return `
MG SHOWREEL HARD LOCK (mg-showreel craft):
- Six chapters in Series — one technique SHOW per Sequence (squash, kinetic type, systems stagger, radial orbit, shatter, lockup).
- No Audio narrationFile. Music/SFX only. scene.vo always empty.
- scene.headline = short technique chrome (may render as small corner/bottom label). Optional L-bracket HUD + index + fake timecode — tiny mono type ≤14px.
- Kinetic chapter: ONE hero word ≥88px (16:9) with custom glyph geometry. Systems: real stagger grid, not a flat slide.
- End lockup: bold name + accent rule + one subtitle. Palette from props / brief — high contrast MG, not purple SaaS default.
- FORBIDDEN: explainer sandwich, stickman as hero, long caption paragraphs, empty AbsoluteFill.
`;
}
