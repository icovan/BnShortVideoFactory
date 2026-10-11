import { createRequire } from 'node:module';
import { chatJson, chatText, readSkill, readSkillPack, type SkillName } from '../llm.ts';
import { craftDepthBrief, type BeatSkillRef } from '../skills/skillDepth.ts';
import type { Aspect, Settings } from '../../../shared/src/index.ts';
import {
  collectBeatKinds,
  extractConstArray,
  jsonToTsObjectLiteral,
  spliceConstArrayItems,
  surgicalDriftTooHigh,
  syncBeatsCopyFromScenes,
} from './surgicalBeats.ts';
import {
  assertFilmCraftDensity,
  assertRevealFamilyRotation,
  cinematicFloorLine,
  cinematicMotionFloor,
  filmCraftDensityLaw,
  revealFamilyHardRules,
  type CraftKind,
} from './craftFloor.ts';
import { logoCodegenHint, showreelCodegenHint } from './mgFilm.ts';

const requireTs = createRequire(import.meta.url);

/** esbuild/TS 语法门禁：软接受风格问题可以，语法错误绝不能放行 */
export function parseTsxSyntaxIssues(src: string, fileName = 'Active.tsx'): string[] {
  try {
    // typescript 为 create-core 的本地依赖（devDependency，安装后可用）
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ts = requireTs('typescript') as typeof import('typescript');
    const result = ts.transpileModule(src, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        esModuleInterop: true,
        skipLibCheck: true,
        noLib: true,
      },
      reportDiagnostics: true,
      fileName,
    });
    const diags = (result.diagnostics || []).filter(
      (d) => d.category === ts.DiagnosticCategory.Error,
    );
    return diags.slice(0, 6).map((d) => {
      const msg = ts.flattenDiagnosticMessageText(d.messageText, ' ');
      let loc = '';
      if (d.file && typeof d.start === 'number') {
        const { line } = d.file.getLineAndCharacterOfPosition(d.start);
        loc = `L${line + 1}: `;
      }
      return `syntax ${loc}${msg}`;
    });
  } catch (e) {
    return [`syntax check failed: ${e instanceof Error ? e.message : String(e)}`];
  }
}

export function extractTsx(text: string): string {
  const m = text.match(/```(?:tsx|typescript|ts|jsx)?\s*([\s\S]*?)```/i);
  return (m ? m[1] : text).trim();
}

function parseSceneCountFromProps(propsJson: string): number {
  try {
    const j = JSON.parse(propsJson) as { scenes?: unknown[] };
    if (Array.isArray(j.scenes) && j.scenes.length) return j.scenes.length;
  } catch {
    /* fall through */
  }
  const n = (propsJson.match(/"durationSec"\s*:/g) || []).length;
  return n > 0 ? n : 4;
}

function parseBeatSkillsFromProps(propsJson: string): BeatSkillRef[] {
  try {
    const j = JSON.parse(propsJson) as {
      scenes?: Array<{
        job?: string;
        skill?: string;
        visualIntent?: string;
        keyMotion?: string;
        craftMust?: string[];
      }>;
    };
    if (!Array.isArray(j.scenes)) return [];
    return j.scenes
      .filter((s) => s?.skill)
      .map((s) => ({
        job: s.job,
        skill: s.skill as SkillName,
        visualIntent: s.visualIntent,
        keyMotion: s.keyMotion,
        craftMust: s.craftMust,
      }));
  } catch {
    return [];
  }
}

export function validateNarratedTsx(src: string, sceneCount?: number): string[] {
  const issues: string[] = [];
  if (!/export\s+(const|function)\s+ActiveNarrated/.test(src)) {
    issues.push('must export ActiveNarrated');
  }
  if (!/from\s+['"]remotion['"]/.test(src)) issues.push('must import from remotion');
  if (!/NarratedProps/.test(src)) issues.push('must use NarratedProps');
  if (/from\s+['"]\.\.\/NarratedExplainer['"]/.test(src)) {
    issues.push('must NOT re-export stock NarratedExplainer — invent new scenes');
  }
  if (/fetch\s*\(/.test(src) || /setInterval|setTimeout|requestAnimationFrame/.test(src)) {
    issues.push('no fetch / timers — frame-driven only');
  }
  if (src.length < 800) issues.push('source too short — likely incomplete');
  // Boldness gates (PageOn energy) — reject timid slide decks
  if (!/spring\s*\(/.test(src)) issues.push('must use spring() for kinetic motion');
  if (!/fontSize:\s*(?:7[2-9]|[89]\d|1\d{2}|2\d{2})/.test(src)) {
    issues.push('hero type must hit ≥72px somewhere (PageOn-scale kinetic)');
  }
  if (!/(rotate|scale)\s*[`(]/.test(src) && !/transform:.*(?:rotate|scale)/.test(src)) {
    issues.push('must use scale/rotate transforms for depth (tilted UI / slam)');
  }
  issues.push(...assertRevealFamilyRotation(src, { sceneCount }));
  return issues;
}

export function validateLaunchTsx(src: string, sceneCount?: number): string[] {
  const issues: string[] = [];
  if (!/export\s+(const|function)\s+ActiveLaunch/.test(src)) {
    issues.push('must export ActiveLaunch');
  }
  if (!/from\s+['"]remotion['"]/.test(src)) issues.push('must import from remotion');
  if (!/LaunchProps/.test(src)) issues.push('must use LaunchProps');
  if (/from\s+['"]\.\.\/LaunchShowreel['"]/.test(src)) {
    issues.push('must NOT re-export stock LaunchShowreel — invent new scenes');
  }
  if (!/musicFile|dropSec/.test(src)) {
    issues.push('must reference props.musicFile and props.dropSec (sound leads picture)');
  }
  if (/fetch\s*\(/.test(src) || /setInterval|setTimeout|requestAnimationFrame/.test(src)) {
    issues.push('no fetch / timers — frame-driven only');
  }
  if (src.length < 800) issues.push('source too short — likely incomplete');
  if (!/spring\s*\(/.test(src)) issues.push('must use spring() for kinetic motion');
  if (!/fontSize:\s*(?:7[2-9]|[89]\d|1\d{2}|2\d{2})/.test(src)) {
    issues.push('hero type must hit ≥72px somewhere (portfolio-scale kinetic)');
  }
  if (!/(rotate|scale)\s*[`(]/.test(src) && !/transform:.*(?:rotate|scale)/.test(src)) {
    issues.push('must use scale/rotate transforms for depth (tilted UI / slam)');
  }
  issues.push(...assertRevealFamilyRotation(src, { sceneCount }));
  return issues;
}

/** @deprecated Use cinematicMotionFloor(aspect). Kept as 16:9 default for legacy SKU codegen. */
export const CINEMATIC_MOTION_FLOOR = cinematicMotionFloor('16:9');

/** @deprecated Use cinematicFloorLine(aspect). */
export const CINEMATIC_FLOOR_LINE = cinematicFloorLine('16:9');

export { cinematicFloorLine, cinematicMotionFloor };

const NARRATED_SKELETON = `import React from 'react';
import {
  AbsoluteFill, Audio, Series, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import type { NarratedProps, NarratedScene } from '../narratedSchema';
// Optional helpers (prefer inventing your own layouts):
// import { KineticWords, KineticLines, SlideCard, ChatPane, CountUp, CaptionChip } from '../ui';

const { fontFamily: FONT } = loadFont('normal', {
  weights: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});

export const ActiveNarrated: React.FC<NarratedProps> = (props) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: props.canvas, fontFamily: FONT }}>
      <Series>
        {props.scenes.map((scene, i) => {
          const dur = Math.max(1, Math.round(scene.durationSec * fps));
          return (
            <Series.Sequence key={i} durationInFrames={dur}>
              {scene.narrationFile ? <Audio src={staticFile(scene.narrationFile)} /> : null}
              {/* TODO: render UNIQUE visuals for scene.stage / scene.visualIntent */}
              <AbsoluteFill />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
`;

const LAUNCH_SKELETON = `import React from 'react';
import {
  AbsoluteFill, Audio, Series, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import type { LaunchProps } from '../launchSchema';

const { fontFamily: FONT } = loadFont('normal', {
  weights: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});

export const ActiveLaunch: React.FC<LaunchProps> = (props) => {
  const { fps } = useVideoConfig();
  const dropSec = props.dropSec ?? 9;
  return (
    <AbsoluteFill style={{ background: props.canvas, fontFamily: FONT }}>
      {props.musicFile ? <Audio src={staticFile(props.musicFile)} /> : null}
      <Series>
        {props.scenes.map((scene, i) => {
          const dur = Math.max(1, Math.round(scene.durationSec * fps));
          return (
            <Series.Sequence key={i} durationInFrames={dur}>
              {scene.narrationFile ? <Audio src={staticFile(scene.narrationFile)} /> : null}
              {/* hook | tease | reveal@dropSec | feature | end — UNIQUE UI */}
              <AbsoluteFill />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
`;

export async function generateNarratedTsx(
  settings: Settings,
  opts: { prompt: string; propsJson: string; storyboardJson: string; lookLine?: string },
): Promise<string> {
  // Full skill packs — hard pipeline budget (no soft-flavor truncation to 14k)
  const skill = readSkill([
    'explainer-video',
    'remotion-video',
    'kinetic-typography',
    'diagram-animation',
    'presentation-video',
  ], 48000);
  const sceneCount = parseSceneCountFromProps(opts.propsJson);

  const raw = await chatText(
    settings,
    `You are a Remotion AUTHOR under a HARD skill pipeline (code-enforced later).
Skills are LAW — implement their techniques, not decorate.

=== SKILLS (verbatim) ===
${skill}

=== HARD RULES (will be statically validated) ===
1. Export: export const ActiveNarrated: React.FC<NarratedProps>
2. Import from 'remotion' + '../narratedSchema'. Font: @remotion/google-fonts/Inter. Optional '../ui'.
3. FORBIDDEN: re-export NarratedExplainer; empty AbsoluteFill placeholders; timid micro-motion.
4. Series over props.scenes; durationInFrames = round(durationSec * fps); Audio via staticFile(narrationFile).
5. REALIZE every scene.visualIntent + keyMotion with on-screen copy that matches the spoken line language (do not translate away from props).
6. Technique cores REQUIRED in code:
   - diagram/research: progressive disclosure nodes → edges → labels (SVG path strokeDash / stagger springs)
   - kinetic/problem|brand: word or line stagger — rotate reveal families (mask/blur/clip/slam), not one spring recipe
   - stat/proof: numeric count-up driven by interpolate/spring
   - chat_edit/design: chat bubble + slide update
7. Style lock from THIS job's props.canvas / ink / accent / brandBg — one grammar, prompt-owned skin.
8. No fetch/timers/setState animation.

${revealFamilyHardRules(sceneCount)}

=== MOTION LANGUAGE (quality floor, NOT official PageOn skin) ===
${opts.lookLine || 'Use props.canvas/ink/accent. Invent material from the brief.'}
${CINEMATIC_MOTION_FLOOR}
- At least ONE full-bleed accent beat using props.accent (not a hardcoded indigo).
- HOLD kinetic settles for VO when narrationFile is present.

Skeleton:
\`\`\`tsx
${NARRATED_SKELETON}
\`\`\``,
    `User brief:
${opts.prompt}

Storyboard (MUST realize visualIntent):
${opts.storyboardJson.slice(0, 14000)}

Locked props (timing + VO + styleLock):
${opts.propsJson.slice(0, 16000)}

Return complete ActiveNarrated.tsx.`,
    0.75,
  );

  let src = extractTsx(raw);
  // Ensure export name
  if (!/ActiveNarrated/.test(src) && /export\s+const\s+\w+/.test(src)) {
    src = src.replace(/export\s+const\s+\w+/, 'export const ActiveNarrated');
  }
  return src;
}

export async function fixNarratedTsx(
  settings: Settings,
  opts: { source: string; error: string; propsJson: string },
): Promise<string> {
  const raw = await chatText(
    settings,
    `You fix Remotion TSX for GeneratedNarrated. Keep export const ActiveNarrated.
Obey remotion frame-driven rules. Output complete TSX only.`,
    `Error:
${opts.error.slice(0, 2500)}

Current source:
\`\`\`tsx
${opts.source.slice(0, 16000)}
\`\`\`

Props reminder (durations/VO):
${opts.propsJson.slice(0, 4000)}`,
    0.4,
  );
  return extractTsx(raw);
}

export async function generateLaunchTsx(
  settings: Settings,
  opts: { prompt: string; propsJson: string; lookLine?: string },
): Promise<string> {
  const skill = readSkill([
    'launch-video',
    'remotion-video',
    'shot-composition',
    'kinetic-typography',
  ], 42000);
  const sceneCount = parseSceneCountFromProps(opts.propsJson);

  const raw = await chatText(
    settings,
    `You are a Remotion AUTHOR under HARD launch-video pipeline.
SOUND LEADS PICTURE. Reveal MUST snap on props.dropSec.

=== SKILLS ===
${skill}

=== HARD RULES (validated in gates) ===
1. Export: export const ActiveLaunch: React.FC<LaunchProps> from '../launchSchema'
2. Props include dropSec, musicFile, beats[], scenes[] — EACH scene has narrationFile (continuous VO in props language).
3. Root play music: <Audio src={staticFile(props.musicFile!)} /> PLUS per-scene <Audio src={staticFile(scene.narrationFile)} /> at Series.Sequence start.
4. VO SYNC: key visual change lands in the first ~40% of each scene while that scene's VO speaks — do not leave long silent holds with static frames.
5. Arc: hook → tease → reveal → feature×N → end. Reveal brand mark hits FULL at props.dropSec (scale overshoot then settle).
6. Feature montage: one benefit + one keyword per shot, hard cuts, kinetic pop — rotate reveal families across features.
7. End card logo+CTA hold ≥2s. FORBIDDEN: re-export LaunchShowreel; ignore dropSec; mute feature scenes.

${revealFamilyHardRules(sceneCount)}

=== MOTION LANGUAGE (quality floor, NOT official Linear skin) ===
${opts.lookLine || 'Use props.canvas/ink/accent. Invent chrome from the brief.'}
${CINEMATIC_MOTION_FLOOR}
- Hook/tease: dense floating chips with depth, slow camera push.
- Reveal: mark SNAP on dropSec with 1.18→1.0 overshoot.
- Product chrome oversized and tilted — not tiny centered icons.
- Forbidden: copying Linear ENG-2481 / #5E6AD2 unless the brief is Linear.

Skeleton:
\`\`\`tsx
${LAUNCH_SKELETON}
\`\`\``,
    `User brief:
${opts.prompt}

Locked props (dropSec/musicFile/beats/scenes — obey):
${opts.propsJson.slice(0, 18000)}

Return complete ActiveLaunch.tsx.`,
    0.72,
  );

  let src = extractTsx(raw);
  if (!/ActiveLaunch/.test(src) && /export\s+const\s+\w+/.test(src)) {
    src = src.replace(/export\s+const\s+\w+/, 'export const ActiveLaunch');
  }
  return src;
}

export async function fixLaunchTsx(
  settings: Settings,
  opts: { source: string; error: string; propsJson: string },
): Promise<string> {
  const raw = await chatText(
    settings,
    `Fix Remotion TSX for GeneratedLaunch. Keep export const ActiveLaunch. Complete file only.`,
    `Error:
${opts.error.slice(0, 2500)}

Source:
\`\`\`tsx
${opts.source.slice(0, 16000)}
\`\`\`

Props:
${opts.propsJson.slice(0, 4000)}`,
    0.4,
  );
  return extractTsx(raw);
}

export function validateNextWordTsx(src: string, sceneCount?: number): string[] {
  const issues: string[] = [];
  if (!/export\s+(const|function)\s+ActiveNextWord/.test(src)) issues.push('must export ActiveNextWord');
  if (!/from\s+['"]remotion['"]/.test(src)) issues.push('must import from remotion');
  if (!/NextWordProps/.test(src)) issues.push('must use NextWordProps');
  if (/from\s+['"]\.\.\/NextWordLoop['"]/.test(src)) {
    issues.push('must NOT re-export stock NextWordLoop — invent layouts from props.scenes');
  }
  if (/fetch\s*\(/.test(src) || /setInterval|setTimeout|requestAnimationFrame/.test(src)) {
    issues.push('no fetch / timers — frame-driven only');
  }
  if (src.length < 900) issues.push('source too short');
  if (!/spring\s*\(/.test(src)) issues.push('must use spring()');
  if (!/READ/.test(src) || !/ODDS/.test(src) || !/SPIN/.test(src) || !/ADD/.test(src)) {
    issues.push('must render persistent 1 READ / 2 ODDS / 3 SPIN / 4 ADD chrome');
  }
  if (!/durationSec/.test(src) || !/useCurrentFrame/.test(src)) {
    issues.push('pills must be driven off composition frame + scene durations (never remount inside Series)');
  }
  issues.push(...assertRevealFamilyRotation(src, { sceneCount }));
  return issues;
}

const NEXTWORD_SKELETON = `import React from 'react';
import {
  AbsoluteFill, Audio, Series, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import type { NextWordProps } from '../nextWordSchema';

const { fontFamily: FONT } = loadFont('normal', {
  weights: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});

export const ActiveNextWord: React.FC<NextWordProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: props.canvas, fontFamily: FONT }}>
      {/* overlay 1 READ 2 ODDS 3 SPIN 4 ADD — hide hook+type, then NEVER unmount */}
      <Series>
        {props.scenes.map((scene, i) => {
          const dur = Math.max(1, Math.round(scene.durationSec * fps));
          return (
            <Series.Sequence key={i} durationInFrames={dur}>
              {scene.narrationFile ? <Audio src={staticFile(scene.narrationFile)} /> : null}
              <AbsoluteFill />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
`;

export async function generateNextWordTsx(
  settings: Settings,
  opts: { prompt: string; propsJson: string; lookLine?: string },
): Promise<string> {
  const skill = readSkill([
    'short-form-video',
    'caption-animation',
    'chart-animation',
    'kinetic-typography',
    'diagram-animation',
    'remotion-video',
  ], 42000);
  const sceneCount = parseSceneCountFromProps(opts.propsJson);

  const raw = await chatText(
    settings,
    `You are a Remotion AUTHOR for a 9:16 (1080×1920) LLM next-word explainer.
Follow skills. Invent UNIQUE layouts from props — do NOT re-export NextWordLoop.

=== SKILLS ===
${skill}

=== HARD RULES ===
1. Export: export const ActiveNextWord: React.FC<NextWordProps> from '../nextWordSchema'
2. 1080×1920. Safe: top 120, bottom 300, left 90, right 120.
3. STEP BAR is a ROOT overlay (sibling of Series). Labels 1 READ / 2 ODDS / 3 SPIN / 4 ADD.
   Hide only on hook+type. After READ, NEVER unmount — only active color changes.
   Drive from useCurrentFrame() + cumulative scene.durationSec.
4. Series over props.scenes; Audio via staticFile(scene.narrationFile) only when set — skip Audio if missing.
5. Invent layouts from THIS job's props (question, writingText, tokens, candidates, winner).
6. Kinetic stagger headlines. Odds: bars grow + count-up. Spin: unequal wheel + labels. Add: compact writing + wheel, winner accent. Loop: nodes then edges.
7. FORBIDDEN: re-export NextWordLoop; remounting pills per scene; giant empty WRITING box; landscape layout.
8. No fetch/timers/setState.

${revealFamilyHardRules(sceneCount)}

=== LOOK + LAYOUT ===
${opts.lookLine || 'Use props.canvas/ink/accent. Invent from the brief — not a sandwich SKU.'}
- Hook: 3-line hero, last phrase in props.accent; YOU = small right pill; WRITING = short rounded bar.
- Type: typewriter in that compact box.
- READ: scanning token chips.
- ODDS: context + dashed ? + bars in the middle of the 9:16 frame.
- SPIN: large unequal wheel, biggest slice = winner, fat pointer.
- ADD: compact phrase with winner in accent AND wheel with winner slice painted.
- Grammar (READ→ODDS→SPIN→ADD) is locked. Demo topic, copy, and palette come from THIS job's props.

Skeleton:
\`\`\`tsx
${NEXTWORD_SKELETON}
\`\`\``,
    `User brief:
${opts.prompt}

Locked props:
${opts.propsJson.slice(0, 18000)}

Return complete ActiveNextWord.tsx.`,
    0.72,
  );

  let src = extractTsx(raw);
  if (!/ActiveNextWord/.test(src) && /export\s+const\s+\w+/.test(src)) {
    src = src.replace(/export\s+const\s+\w+/, 'export const ActiveNextWord');
  }
  return src;
}

export async function fixNextWordTsx(
  settings: Settings,
  opts: { source: string; error: string; propsJson: string },
): Promise<string> {
  const raw = await chatText(
    settings,
    `Fix Remotion TSX for GeneratedNextWord. Keep export const ActiveNextWord. 1080×1920. Step pills persistent overlay outside Series. Complete file only.`,
    `Error:
${opts.error.slice(0, 2500)}

Source:
\`\`\`tsx
${opts.source.slice(0, 16000)}
\`\`\`

Props:
${opts.propsJson.slice(0, 4000)}`,
    0.4,
  );
  return extractTsx(raw);
}

const DIRECTED_SKELETON = `import React from 'react';
import {
  AbsoluteFill, Audio, Sequence, Series, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import type { DirectedProps } from '../directedSchema';

const { fontFamily: FONT } = loadFont('normal', {
  weights: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});

export const ActiveDirected: React.FC<DirectedProps> = (props) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: props.canvas, fontFamily: FONT }}>
      {props.musicFile ? <Audio src={staticFile(props.musicFile)} volume={0.35} /> : null}
      <Series>
        {props.scenes.map((scene, i) => {
          const dur = Math.max(1, Math.round(scene.durationSec * fps));
          const cues = props.autoSfx === false
            ? []
            : (scene.sfxCues?.length
              ? scene.sfxCues
              : scene.sfxFile
                ? [{ file: scene.sfxFile, volume: scene.sfxVolume ?? 0.2, atSec: 0 }]
                : []);
          return (
            <Series.Sequence key={i} durationInFrames={dur}>
              {scene.narrationFile ? <Audio src={staticFile(scene.narrationFile)} /> : null}
              {cues.map((cue, j) => (
                <Sequence key={j} from={Math.max(0, Math.round((cue.atSec || 0) * fps))} layout="none">
                  <Audio src={staticFile(cue.file)} volume={cue.volume ?? 0.18} />
                </Sequence>
              ))}
              <AbsoluteFill />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
`;

function stickmanDirectedHint(contentLang: 'zh' | 'en' | 'bilingual' = 'zh'): string {
  const titleRule = contentLang === 'bilingual'
    ? '· When titles are needed: <BilingualTitle zh="…" en="…" y={…} /> — invent copy from THIS brief (never default to MOTIVATION/DISCIPLINE).'
    : contentLang === 'en'
      ? '· When titles are needed: English CaptionPill / KineticLine only (NO BilingualTitle, NO Chinese).'
      : '· When titles are needed: Simplified Chinese CaptionPill / KineticLine (NO default BilingualTitle).';
  return `
STICKMAN HARD LOCK (when stickman-animation is in the plan):
- MUST: import {
    Stickman, POSES, lerpPose, idleBob, walkPose, sampleClip, sampleClipForIntent, clipsForIntent,
    resolveStickInk,
    // staging props when needed: Platform, PropBlock, SignBoard, PhoneSlab, typeScale, CaptionPill…
  } from '../stickman';
- MUST: render <Stickman x={…} y={…} pose={…} ink={…} face={…} /> on every stickman-animation character beat.
- PHRASES > POSES: drive character motion with sampleClip(clipId, tLocal, { frame, fps }) or sampleClipForIntent(scene.visualIntent||scene.vo, tLocal, { frame, fps }).
  If scene.visualIntent starts with "clip:<id> —", MUST use that id in sampleClip(<id>, tLocal, { frame, fps }).
  tLocal = (frame - sequenceStart) / durationInFrames clamped 0..1. Apply sample.dx/dy onto base x/y; honor sample.face.
  Clip catalog: enter-present | explain-board | compare-sides | hesitate | agree-cheer | phone-talk | desk-work | give-take | push-heavy | pull-in | carry-across | greet-wave | think-loop | duo-debate-a | duo-debate-b.
  Intent map (examples): explain/teach→explain-board; compare/vs→compare-sides; doubt→hesitate; win→agree-cheer; phone→phone-talk; desk→desk-work; give→give-take; push/pull/carry→matching clip; 两人/辩论→duo-debate-a + duo-debate-b.
- Raw POSES.* / walkPose / wavePose only as fallback inside a clip — never invent thin SVG stick figures; never pose={undefined}.
- STAGING: rich expression = phrases + blocking + props, not a bigger pose list.
  · Dual cast: two Stickman with opposite face; duo-debate-a (left) + duo-debate-b (right); leave center for diagram/kinetic.
  · Props: SignBoard / PropBlock near hands for board/box; PhoneSlab on phone-talk; Platform or Ground under feet.
  · Mix: other plan skills (diagram/kinetic/caption) must still SHOW — stickman is an actor layer, not every beat.
- STRUCTURE: AbsoluteFill → <Series> → <Series.Sequence> per scene. Nested <Sequence layout="none"> only for timed Audio/SFX.
- LOOK: background = props.canvas; ink = props.ink || resolveStickInk(props.canvas). Capsule RIG only; glow=0.
  ${titleRule}
  · Titles optional; prefer typeScale(width).title. Do NOT force motivation ladders / ProgressTicks.
- Gap poses available if a clip needs them: push | pull | carry | handoff | desk (still prefer sampleClip).
- FORBIDDEN: local Stickman / LimbChain / RIG reimplementation; ignoring props.canvas/ink; dumping idle POSES.stand for every beat.
- Obey props.contentLang for all on-screen strings (already locked in lookLine).
`;
}

function craftKindFromSkills(skillIds: string[]): CraftKind {
  const showreel = skillIds.includes('launch-video')
    && skillIds.includes('kinetic-typography')
    && skillIds.includes('diagram-animation')
    && skillIds.includes('logo-animation');
  if (showreel) return 'showreel';
  if (skillIds.includes('logo-animation') && !skillIds.includes('stickman-animation')) return 'logo';
  return 'default';
}

export function validateDirectedTsx(
  src: string,
  skillIds?: string[],
  contentLang: 'zh' | 'en' | 'bilingual' = 'zh',
  aspect: Aspect = '16:9',
  sceneCount?: number,
): string[] {
  const issues: string[] = [];
  const stickmanOn = skillIds?.includes('stickman-animation') === true;
  const craft = craftKindFromSkills(skillIds || []);
  const logoOn = craft === 'logo';
  const showreelOn = craft === 'showreel';
  if (!/export\s+(const|function)\s+ActiveDirected/.test(src)) issues.push('must export ActiveDirected');
  if (!/from\s+['"]remotion['"]/.test(src)) issues.push('must import from remotion');
  if (!/DirectedProps/.test(src)) issues.push('must use DirectedProps');
  if (/from\s+['"]\.\.\/(NarratedExplainer|LaunchShowreel|NextWordLoop)['"]/.test(src)) {
    issues.push('must NOT re-export a locked SKU');
  }
  if (src.length < 800) issues.push('source too short');
  if (!/spring\s*\(/.test(src)) issues.push('must use spring()');
  if (logoOn) {
    if (!/(strokeDash|stroke-dash|pathLength|scale|assemble|Img\b)/i.test(src)) {
      issues.push('logo: must stroke-draw / scale-assemble the mark (or Img asset)');
    }
    if (/<Stickman\b/.test(src)) issues.push('logo: stickman forbidden on logo sting');
  }
  if (showreelOn) {
    if (!/Series\.Sequence/.test(src)) issues.push('showreel: must use Series.Sequence chapters');
    if ((src.match(/Series\.Sequence/g) || []).length < 4) {
      issues.push('showreel: need ≥4 technique chapters on screen');
    }
  }
  // CRAFT 地板改为 soft：不再因 72px / 层数 / 3D 硬失败（避免模型堆 token 过关）
  if (!logoOn) {
    if (/<AbsoluteFill\s*\/>\s*<\/Series\.Sequence>/.test(src)
      || /Series\.Sequence[^>]*>\s*<AbsoluteFill\s*\/>\s*<\/Series\.Sequence>/.test(src)) {
      issues.push('empty AbsoluteFill placeholder sequences forbidden');
    }
  }
  void aspect;
  if (stickmanOn) {
    if (!/from\s+['"]\.\.\/stickman['"]/.test(src)) {
      issues.push('stickman: must import from ../stickman');
    }
    if (!/<Stickman\b/.test(src)) {
      issues.push('stickman: must render <Stickman />');
    }
    if (/const\s+Stickman\s*[:=]|function\s+Stickman\b/.test(src)) {
      issues.push('stickman: do not redefine Stickman locally — import from ../stickman');
    }
    if (!/<Series[\s>]/.test(src) || !/Series\.Sequence/.test(src)) {
      issues.push('stickman: wrap scenes in <Series> + <Series.Sequence>');
    }
    // Prefer phrase clips; still accept legacy walkPose/POSES drivers
    if (!/sampleClip(ForIntent)?\s*\(/.test(src)
      && !/walkPose\s*\(|idleBob\s*\(|wavePose\s*\(|lerpPose\s*\(/.test(src)) {
      issues.push('stickman: drive motion with sampleClip / sampleClipForIntent (or walkPose/lerpPose)');
    }
    void contentLang;
  }
  // 按镜轮换揭示族：全 skill 硬卡，禁止 spring+translateY 复读
  issues.push(...assertRevealFamilyRotation(src, {
    craftKind: craft,
    sceneCount,
    stickmanLed: stickmanOn,
  }));
  // 成片密度：禁每镜同一套 REC/CAM HUD，技法要够厚
  if (!logoOn && !showreelOn) {
    issues.push(...assertFilmCraftDensity(src, {
      sceneCount,
      skillIds: skillIds || [],
      craftKind: craft,
    }));
  }
  // 语法错误优先：esbuild 会在 still 阶段炸，必须在 soft-accept 前拦住
  issues.push(...parseTsxSyntaxIssues(src, 'ActiveDirected.tsx'));
  return issues;
}

function parseAspectFromProps(propsJson: string): Aspect {
  const m = propsJson.match(/"aspect"\s*:\s*"(16:9|9:16|1:1|3:4)"/);
  return (m?.[1] as Aspect) || '16:9';
}

export async function generateDirectedTsx(
  settings: Settings,
  opts: {
    prompt: string;
    propsJson: string;
    skillIds: string[];
    lookLine?: string;
    contentLang?: 'zh' | 'en' | 'bilingual';
    aspect?: Aspect;
    /** Beat-level skill refs for CRAFT DEPTH LAW */
    beats?: BeatSkillRef[];
    /** P1: pack-aware skill load */
    primary?: SkillName;
    technique?: SkillName[];
    brandSkills?: SkillName[];
  },
): Promise<string> {
  const primary = (opts.primary || opts.skillIds[0] || 'explainer-video') as SkillName;
  const technique = (opts.technique?.length
    ? opts.technique
    : opts.skillIds.filter((id) => id !== primary && id !== 'remotion-video')) as SkillName[];
  const brandSkills = (opts.brandSkills || []) as SkillName[];
  // P1: chunked full-skill pack — primary prioritized, never one-pot truncate
  const skill = readSkillPack({
    primary,
    technique,
    brand: brandSkills,
    extra: opts.skillIds.includes('lottie-animation') || opts.skillIds.includes('gsap-web')
      ? (['lottie-animation', 'gsap-web'] as SkillName[]).filter((id) => opts.skillIds.includes(id))
      : [],
    budget: 42000,
  });
  const stickmanOn = opts.skillIds.includes('stickman-animation');
  const contentLang = opts.contentLang || 'zh';
  const aspect = opts.aspect || parseAspectFromProps(opts.propsJson);
  const craftKind = craftKindFromSkills(opts.skillIds);
  const floorHint = cinematicMotionFloor(aspect, craftKind);
  const sceneCount = parseSceneCountFromProps(opts.propsJson);
  const depthLaw = craftDepthBrief(
    [primary, ...technique] as SkillName[],
    opts.beats?.length
      ? opts.beats
      : parseBeatSkillsFromProps(opts.propsJson),
  );
  const raw = await chatText(
    settings,
    `You are a Remotion AUTHOR. Implement the SELECTED skills deeply — story + technique from SKILL text below.
Export: export const ActiveDirected: React.FC<DirectedProps> from '../directedSchema'
Canvas from props.aspect. Series over props.scenes; Audio via staticFile(scene.narrationFile) only when set. Optional props.musicFile + props.dropSec.
When props.autoSfx is on, play scene.sfxCues as timed hits (only files listed in props).
If props.assets exist, use <Img src={staticFile(asset.file)} />. Never invent URLs.
Use scene.headline / scene.vo / scene.line EXACTLY — do not translate. Empty headline → no invented title card.
Fill each Sequence with real motion/graphics — no empty AbsoluteFill placeholders.
Focus on the skills listed below (primary + technique supports, often 3 craft seats). Do NOT sprinkle fake markers for unselected skills.
Each scene.skill + scene.craftMust is LAW for THAT beat — implement that technique in that Sequence.
${stickmanOn ? stickmanDirectedHint(contentLang) : ''}
${craftKind === 'logo' ? logoCodegenHint() : ''}
${craftKind === 'showreel' ? showreelCodegenHint() : ''}
${opts.lookLine || ''}
${stickmanOn ? '\nSTICKMAN MIX: actor layer only; keep other selected skills visible on their beats.\n' : ''}

=== SELECTED SKILLS (LAW — implement their craft, not factory slogans) ===
${skill}

${depthLaw}

${craftKind === 'logo' ? '' : revealFamilyHardRules(sceneCount)}

${craftKind === 'logo' || craftKind === 'showreel' ? '' : filmCraftDensityLaw(sceneCount)}

=== SOFT HINT (optional quality, NOT a pass/fail checklist) ===
${floorHint}
Prefer skill pacing and progressive disclosure over repeating "72px / safe area / full-bleed" in every beat.
FORBIDDEN: re-export stock SKUs; fetch/timers; empty placeholders; default Linear/PageOn purple skins unless brief asks.
FORBIDDEN: spring()+translateY as the only reveal for every beat — rotate mask/blur/clip/slam.
FORBIDDEN: one HudShell (REC/CAM/TC/LAB) reused on every beat with only the title changed.

Skeleton:
\`\`\`tsx
${DIRECTED_SKELETON}
\`\`\``,
    `User brief:
${opts.prompt}

Locked props:
${opts.propsJson.slice(0, 18000)}

Return complete ActiveDirected.tsx.`,
    0.7,
  );
  let src = extractTsx(raw);
  if (!/ActiveDirected/.test(src) && /export\s+const\s+\w+/.test(src)) {
    src = src.replace(/export\s+const\s+\w+/, 'export const ActiveDirected');
  }
  return src;
}

export async function fixDirectedTsx(
  settings: Settings,
  opts: { source: string; error: string; propsJson: string },
): Promise<string> {
  const sceneCount = parseSceneCountFromProps(opts.propsJson);
  const raw = await chatText(
    settings,
    `Fix Remotion TSX for GeneratedDirected. Keep export const ActiveDirected. Frame-driven. Complete file only.
Preserve the brief's staging / props / look (props.canvas, props.ink) — do NOT replace the film with a generic pose demo.
If error mentions hero type / scale / rotate / timid: on 16:9 enlarge ONE slam to ≥72–140px with spring scale/rotate depth; on 9:16 keep captions smaller and modest edge pad — do NOT put 72px on every line or keep tiny centered cards. If logo/motion: animate the mark, do not add explainer titles.
If error mentions reveal families: ROTATE mask / blur / clip / slam across beats — add real clipPath, filter:blur, mask/RGB wipe, or scale-overshoot slam. Do NOT only retune spring+translateY.
If error mentions chrome spam / craft density: DELETE per-beat REC/CAM/TC/LAB shells; give each Sequence a distinct layout (full-bleed diagram, kinetic slam, caption bar, chart). Deepen SVG/strokeDash/split/interpolate — do not shrink the file.
${revealFamilyHardRules(sceneCount)}
${filmCraftDensityLaw(sceneCount)}
If stickman / Series / pose errors:
- import { Stickman, sampleClip, sampleClipForIntent, POSES, lerpPose, idleBob, walkPose, resolveStickInk, ensurePose } from '../stickman' — never redefine Stickman locally.
- Prefer sampleClip(clipId, tLocal, { frame, fps }) / sampleClipForIntent(intent, tLocal, { frame, fps }); apply dx/dy/face onto Stickman.
- Structure MUST be AbsoluteFill → <Series> → <Series.Sequence> per scene. Series.Sequence ONLY inside Series. Use nested <Sequence layout="none"> only for timed Audio.
- Every <Stickman pose={…} /> must get a real StickPose (clip sample / POSES.* / lerpPose / ensurePose(…)). Never undefined pose.
- Background = props.canvas; body ink = props.ink || resolveStickInk(props.canvas).`,
    `Error:
${opts.error.slice(0, 2500)}

Source:
\`\`\`tsx
${opts.source.slice(0, 16000)}
\`\`\`

Props:
${opts.propsJson.slice(0, 4000)}`,
    0.35,
  );
  return extractTsx(raw);
}

/**
 * 分镜二次创作（外科手术）：
 * 1) 有 `const BEATS = [...]` → 只让模型改选中项并拼回原文件（推荐，不会整片重写）
 * 2) 文案模式 → 只同步 BEATS 文本 / 或原样返回（props 已在管线更新）
 * 3) 无 BEATS 的旧片 → 全文件外科编辑 + 漂移检测；漂移过大则拒绝整片结果
 */
export async function remakeSelectedDirectedTsx(
  settings: Settings,
  opts: {
    source: string;
    propsJson: string;
    skillIds: string[];
    contentLang?: 'zh' | 'en' | 'bilingual';
    lookLine?: string;
    note: string;
    beatIndexes: number[];
    selectedScenesJson: string;
    mode?: 'both' | 'visual' | 'copy';
    scenes?: { headline?: string; vo?: string; line?: string }[];
  },
): Promise<string> {
  const contentLang = opts.contentLang || 'zh';
  const indexes = opts.beatIndexes;
  const mode = opts.mode || 'both';
  const prior = opts.source || '';

  if (!prior || prior.length < 400) {
    return generateDirectedTsx(settings, {
      prompt: `Remake beats [${indexes.join(', ')}]: ${opts.note}`,
      propsJson: opts.propsJson,
      skillIds: opts.skillIds,
      contentLang,
      lookLine: opts.lookLine,
    });
  }

  const beatsArr = extractConstArray(prior, 'BEATS');

  // ——— 文案向：不重画，只改选中镜文案数据 ———
  if (mode === 'copy') {
    if (beatsArr && opts.scenes?.length) {
      return syncBeatsCopyFromScenes(prior, opts.scenes, indexes) || prior;
    }
    return prior;
  }

  // ——— 有 BEATS 表：只补丁选中 index（真正的分镜级二次创作）———
  if (beatsArr && beatsArr.items.length > 0) {
    const kinds = collectBeatKinds(prior);
    const selected = indexes
      .filter((i) => i >= 0 && i < beatsArr.items.length)
      .map((i) => ({ index: i, current: beatsArr.items[i].text }));
    if (!selected.length) return prior;

    const patched = await chatJson<{
      beats?: { index?: number; beat?: Record<string, unknown> }[];
    }>(
      settings,
      `You revise ONLY selected storyboard BEATS entries for an existing Remotion film.
Return JSON only: { "beats": [ { "index": number, "beat": { ...fields } } ] }.
HARD RULES:
- Only include indexes: [${indexes.join(', ')}].
- Each "beat" must be a plain object (kind/tag/sub/chips/items/…).
- Prefer kinds already used in this film: ${kinds.slice(0, 40).join(', ') || '(any existing)'}.
- Do NOT invent a new film structure. Do NOT return TSX.
- Obey contentLang=${contentLang}. User note is LAW for these beats only.
- Keep fields you do not need to change.`,
      `User note:
${opts.note}

Selected scene props:
${opts.selectedScenesJson.slice(0, 8000)}

Current BEATS entries (TypeScript object literals — revise these):
${selected.map((s) => `--- index ${s.index} ---\n${s.current}`).join('\n\n')}
${opts.lookLine ? `\n${opts.lookLine}` : ''}`,
      0.35,
    );

    const map = new Map<number, string>();
    for (const row of patched?.beats || []) {
      const idx = Number(row?.index);
      if (!Number.isInteger(idx) || !indexes.includes(idx)) continue;
      if (!row.beat || typeof row.beat !== 'object') continue;
      if (kinds.length && typeof row.beat.kind === 'string' && !kinds.includes(row.beat.kind)) {
        // 未知 kind → 保留原 kind，避免 SceneView switch 落空
        const prev = beatsArr.items[idx]?.text || '';
        const km = prev.match(/\bkind\s*:\s*['"]([^'"]+)['"]/);
        if (km) row.beat.kind = km[1];
      }
      map.set(idx, jsonToTsObjectLiteral(row.beat));
    }
    if (!map.size) {
      throw new Error('分镜补丁为空：模型未返回可应用的 BEATS 改动，请把修改写得更具体后重试');
    }
    const merged = spliceConstArrayItems(prior, 'BEATS', map);
    if (!merged) throw new Error('无法把分镜补丁写回 ActiveDirected（BEATS 解析失败）');
    return merged;
  }

  // ——— 无 BEATS：全文件外科编辑，但拒绝「整片重写」结果 ———
  const raw = await chatText(
    settings,
    `You surgically edit an EXISTING Remotion ActiveDirected.tsx.
Return the COMPLETE file only. export const ActiveDirected.

SURGICAL HARD LOCK (fatal if broken):
1. CHANGE ONLY scene indexes [${indexes.join(', ')}] (0-based).
2. Every OTHER scene must stay character-equivalent (same helpers, layout, motion).
3. Do NOT replace the design system. Do NOT rewrite unselected beats "for quality".
4. Keep Series/Sequence/Audio wiring. Canvas uses props.canvas.
5. User note applies ONLY to selected beats. contentLang=${contentLang}.
${opts.lookLine || ''}
${opts.skillIds.includes('stickman-animation') ? stickmanDirectedHint(contentLang) : ''}`,
    `User note (selected beats only):
${opts.note}

Selected scene props:
${opts.selectedScenesJson.slice(0, 6000)}

Existing ActiveDirected.tsx (EDIT — do not invent a new film). If the file is long, preserve ALL unselected logic verbatim:
\`\`\`tsx
${prior.length > 28000 ? `${prior.slice(0, 14000)}\n\n/* … middle omitted for size — DO NOT delete middle; keep structure … */\n\n${prior.slice(-14000)}` : prior}
\`\`\`

Props (context only):
${opts.propsJson.slice(0, 8000)}`,
    0.2,
  );
  let src = extractTsx(raw);
  if (!/ActiveDirected/.test(src) && /export\s+const\s+\w+/.test(src)) {
    src = src.replace(/export\s+const\s+\w+/, 'export const ActiveDirected');
  }

  const sceneCount = Math.max(indexes.length + 1, (opts.scenes?.length || 0), 1);
  const selectedRatio = indexes.length / sceneCount;
  if (surgicalDriftTooHigh(prior, src, selectedRatio)) {
    throw new Error(
      '模型把未选中的分镜也整片重写了。请缩小修改范围或写得更具体后重试（系统已拦截整片重做）。',
    );
  }
  return src;
}
