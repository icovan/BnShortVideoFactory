/**
 * prompt → skill plan → VO lock → codegen ActiveDirected → GeneratedDirected
 */
import { writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { speak } from '../tts.ts';
import { listFiles, newProjectDir, OUTPUTS_DIR } from '../paths.ts';
import { renderRemotionComposition } from '../engines/remotionBridge.ts';
import {
  installActiveComponent,
  remotionQueueDetail,
  restoreActiveFallback,
  withRemotionCodegenLock,
} from '../engines/remotionLock.ts';
import { probeAudioDuration } from '../probe.ts';
import { finishPipeline, setPipelineStep } from '../pipeline.ts';
import { store } from '../store.ts';
import { labelInitial, snapshotProjectVersion } from './projectVersions.ts';
import {
  VO_TAIL_SEC,
  buildContactSheet,
  concatMp3List,
  mixLaunchAudio,
  padAudioToDuration,
  synthesizeLaunchBed,
  writeSkillGateReport,
} from '../skills/hardPipeline.ts';
import { assertSkillsInTsx, probeResFor } from '../skills/registry.ts';
import { scoreSkillDepth } from '../skills/skillDepth.ts';
import {
  beatsForStillVerify,
  stillIssuesNeedCodeRepair,
  verifyStillSkillBeats,
  type StillSkillReport,
} from '../skills/skillStillVerify.ts';
import { emptyStillIssues } from './stillOccupancy.ts';
import {
  lookLockLine,
  promptForcesMono,
  reconcileStyleLook,
  type JobLook,
} from './look.ts';
import { contentLangLockLine } from './contentLang.ts';
import { captionFragmentIssues, splitCaptionBlocks } from './captionBlocks.ts';
import {
  DRIVE_BEAT_MAX_SOFT_SEC,
  assessDriveConsumption,
  driveSceneDurationSec,
} from './scriptDrive.ts';
import { codegenSkillIds, craftSkillIds, type SkillPlan } from './skillPlan.ts';
import {
  assertSafeGoogleFonts,
  fixDirectedTsx,
  generateDirectedTsx,
  parseTsxSyntaxIssues,
  sealDirectedSource,
  validateDirectedTsx,
} from './remotionCodegen.ts';

/** Seal before any disk write / soft-accept — fonts、位移、VO 路径、spring fps。 */
function sealDirectedTsx(src: string): string {
  return sealDirectedSource(src);
}
import type { Project, Settings } from '../../../shared/src/index.ts';
import {
  buildSceneSfxTimeline,
  reloadSfxKit,
  sfxKitStats,
  SfxPicker,
  type SfxCue,
} from '../sfx/catalog.ts';
import {
  copySfxIntoProject,
  ensureSfxAssets,
  resetSfxEnsure,
  SFX_PUBLIC_DIR,
} from '../sfx/ensureAssets.ts';
import { styleLookLockLine } from './styleLook.ts';
import {
  assetsLockLine,
  materializeUserAssets,
  type IncomingUserAsset,
  type ScreenAsset,
} from './userAssets.ts';
import {
  bindNarrationScene,
  composeNarrationDirectedSource,
  narrationLayoutIssues,
  usesNarrationLayouts,
} from './narrationLayout.ts';

/** @deprecated 禁止再回退 DirectedFilm stock（会出空镜）；保留常量仅防误引用 */
const STOCK = `export { DirectedFilm as ActiveDirected } from '../DirectedFilm';\n`;
void STOCK;

/** 结构完整的叙事 TSX：宁可 soft-accept，也禁止用 DirectedFilm stock 冲掉 brief */
function directedNarrativeContractOk(src: string): boolean {
  return (
    /export\s+(const|function)\s+ActiveDirected/.test(src)
    && /from\s+['"]remotion['"]/.test(src)
    && /DirectedProps/.test(src)
    && /<Series[\s>]/.test(src)
    && /Series\.Sequence/.test(src)
    && src.length >= 800
    && !/from\s+['"]\.\.\/DirectedFilm['"]/.test(src)
    && !/export\s*\{\s*DirectedFilm\s+as\s+ActiveDirected/.test(src)
  );
}

/**
 * Pose-aware stickman floor (NOT the old motivation/contrast shell).
 * Reads visualIntent / keyMotion / headline / line / job → named poses + variants.
 * Used only when LLM codegen fails gates or render — still must honor the beat sheet.
 */
const STICKMAN_STOCK = `import React from 'react';
import {
  AbsoluteFill, Audio, Sequence, Series, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import type { DirectedProps } from '../directedSchema';
import {
  Stickman, POSES, idleBob, lerpPose, walkPose, runPose, jumpPose, jumpHipY,
  wavePose, climbPose, pushupPose, poseByName, footPlantOffset,
  CaptionPill, typeScale, resolveStickInk,
} from '../stickman';

const hayOf = (scene: DirectedProps['scenes'][number]) =>
  [scene.visualIntent, scene.keyMotion, scene.headline, scene.line, scene.job]
    .filter(Boolean).join(' ').toLowerCase();

const has = (hay: string, re: RegExp) => re.test(hay);

function resolveMotion(
  hay: string,
  frame: number,
  fps: number,
  durationInFrames: number,
  mid: number,
  groundY: number,
) {
  const t = frame / Math.max(1, durationInFrames - 1);
  const phase = (frame / fps) * 0.85;
  const face: 1 | -1 = has(hay, /face\\s*[:=]?\\s*-1|掉头|转身|turn\\s*back|reverse/) && t > 0.55 ? -1 : 1;
  const hip0 = groundY - footPlantOffset();

  // Multi-pose chains in one beat (shrug→present→cheer→bow, struggle→fall→rise…)
  const chain: string[] = [];
  const push = (re: RegExp, name: string) => { if (has(hay, re) && !chain.includes(name)) chain.push(name); };
  push(/shrug|耸肩/, 'shrug');
  push(/present|展示/, 'present');
  push(/cheer|欢呼/, 'cheer');
  push(/bow|鞠躬/, 'bow');
  push(/struggle|挣扎/, 'struggle');
  push(/fall|跌倒|摔/, 'fall');
  push(/think|思考/, 'think');
  push(/phone|电话/, 'phone');
  push(/wave|挥手/, 'wave');
  push(/point|指向/, 'point');
  if (chain.length >= 2 && !has(hay, /run|walk|jump|冲刺|行走|跳/)) {
    const i = Math.min(chain.length - 1, Math.floor(t * chain.length));
    const a = poseByName(chain[i]);
    const b = poseByName(chain[Math.min(chain.length - 1, i + 1)]);
    const local = (t * chain.length) % 1;
    return { pose: idleBob(lerpPose(a, b, local), frame, fps), x: mid, y: hip0, face: 1 as const, variant: 'default' as const };
  }
  if (has(hay, /run|冲刺|快跑/)) {
    const x = interpolate(frame, [0, durationInFrames], face === 1 ? [mid - 220, mid + 220] : [mid + 220, mid - 220], { extrapolateRight: 'clamp' });
    return { pose: runPose(phase * 1.2), x, y: hip0, face, variant: 'default' as const };
  }
  if (has(hay, /walk|行走|走过/)) {
    const x = interpolate(frame, [0, durationInFrames], [mid - 200, mid + 180], { extrapolateRight: 'clamp' });
    return { pose: walkPose(phase), x, y: hip0, face: 1 as const, variant: 'default' as const };
  }
  if (has(hay, /jump|跳|crouch|蹲|land|落/)) {
    const pose = jumpPose(t);
    return { pose, x: mid, y: jumpHipY(hip0, t, 110), face: 1 as const, variant: 'compact' as const };
  }
  if (has(hay, /wave|挥手/)) return { pose: wavePose(frame, fps), x: mid, y: hip0, face: 1 as const, variant: 'default' as const };
  if (has(hay, /climb|爬|ladder/)) return { pose: climbPose(phase), x: mid, y: hip0 - t * 40, face: 1 as const, variant: 'tall' as const };
  if (has(hay, /pushup|俯卧撑/)) return { pose: pushupPose((Math.sin(frame / 8) + 1) / 2), x: mid, y: hip0, face: 1 as const, variant: 'default' as const };
  if (has(hay, /fall|跌倒|摔/)) return { pose: idleBob(lerpPose(POSES.struggle, POSES.fall, Math.min(1, t * 1.4)), frame, fps), x: mid, y: hip0, face: 1 as const, variant: 'default' as const };
  if (has(hay, /struggle|挣扎/)) return { pose: idleBob(POSES.struggle, frame, fps), x: mid, y: hip0, face: 1 as const, variant: 'default' as const };
  if (has(hay, /cheer|欢呼/)) return { pose: idleBob(lerpPose(POSES.stand, POSES.cheer, spring({ frame, fps, config: { damping: 14, stiffness: 140 } })), frame, fps), x: mid, y: hip0, face: 1 as const, variant: 'default' as const };
  if (has(hay, /bow|鞠躬/)) return { pose: idleBob(POSES.bow, frame, fps), x: mid, y: hip0, face: 1 as const, variant: 'default' as const };
  if (has(hay, /shrug|耸肩/)) return { pose: idleBob(POSES.shrug, frame, fps), x: mid, y: hip0, face: 1 as const, variant: 'default' as const };
  if (has(hay, /present|展示/)) return { pose: idleBob(POSES.present, frame, fps), x: mid, y: hip0, face: 1 as const, variant: 'default' as const };
  if (has(hay, /think|思考/)) return { pose: idleBob(POSES.think, frame, fps), x: mid, y: hip0, face: 1 as const, variant: 'tall' as const };
  if (has(hay, /phone|电话/)) return { pose: idleBob(POSES.phone, frame, fps), x: mid, y: hip0, face: 1 as const, variant: 'tall' as const };
  if (has(hay, /point|指向/)) return { pose: idleBob(POSES.point, frame, fps), x: mid, y: hip0, face: 1 as const, variant: 'compact' as const };
  if (has(hay, /sit|坐/)) return { pose: idleBob(POSES.sit, frame, fps), x: mid, y: hip0, face: 1 as const, variant: 'default' as const };
  if (has(hay, /\\bidle\\b|呼吸|站立|default|stand|hook|cta|endcard/)) {
    return { pose: idleBob(POSES.idle, frame, fps), x: mid, y: hip0, face: 1 as const, variant: 'default' as const };
  }
  const named = hay.match(/\\b(wave|think|phone|shrug|present|cheer|bow|point|crouch|kneel|kick|lie|fall|struggle|climb|sit)\\b/);
  if (named) return { pose: idleBob(poseByName(named[1]), frame, fps), x: mid, y: hip0, face: 1 as const, variant: 'default' as const };
  return { pose: idleBob(POSES.stand, frame, fps), x: mid, y: hip0, face: 1 as const, variant: 'default' as const };
}

const Beat: React.FC<{ scene: DirectedProps['scenes'][number]; props: DirectedProps; index: number }> = ({ scene, props }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const ts = typeScale(width);
  const hay = hayOf(scene);
  const groundY = Math.round(height * 0.72);
  const mid = width / 2;
  const dual = has(hay, /tall|compact|两|two-shot|双人|两人|\\+ /);
  const m = resolveMotion(hay, frame, fps, durationInFrames, mid, groundY);
  const u = frame / Math.max(1, durationInFrames - 1);
  const title = scene.headline || scene.job || ' ';
  const lang = props.contentLang || 'zh';
  const enSub = lang === 'bilingual' && scene.line && /[A-Za-z]/.test(scene.line) ? scene.line : undefined;
  const scale = width < 1200 ? 1.25 : 1.1;
  const canvas = props.canvas || '#000000';
  const bodyInk = props.ink || resolveStickInk(canvas);
  const leftPose = has(hay, /think|phone/)
    ? idleBob(u < 0.5 ? POSES.think : POSES.phone, frame, fps)
    : m.pose;
  const rightPose = has(hay, /wave|point/)
    ? (u < 0.5 ? wavePose(frame, fps) : idleBob(POSES.point, frame, fps))
    : idleBob(POSES.wave, frame, fps);
  // Pose floor: honor job look; thin ground line — never motivation Platform / ProgressTicks kit
  return (
    <AbsoluteFill style={{ backgroundColor: canvas, paddingTop: Math.round(height * 0.06) }}>
      <div style={{ position: 'absolute', left: width * 0.08, right: width * 0.08, top: Math.round(height * 0.08), textAlign: 'center', color: bodyInk, fontSize: ts.title, fontWeight: 700, lineHeight: 1.15 }}>
        {title}
        {enSub ? <div style={{ marginTop: 8, fontSize: ts.title * 0.42, letterSpacing: '0.12em', opacity: 0.75, fontWeight: 500 }}>{String(enSub).toUpperCase()}</div> : null}
      </div>
      <div style={{ position: 'absolute', left: width * 0.12, width: width * 0.76, top: groundY, height: 2, background: bodyInk, opacity: 0.9 }} />
      {dual ? (
        <>
          <Stickman x={mid - 140} y={m.y} pose={leftPose} scale={scale} variant="tall" face={1} ink={bodyInk} accent="#FF6B2C" />
          <Stickman x={mid + 140} y={m.y} pose={rightPose} scale={scale * 0.92} variant="compact" face={-1} ink={bodyInk} accent="#3ECFCF" />
        </>
      ) : (
        <Stickman x={m.x} y={m.y} pose={m.pose} scale={scale} face={m.face} variant={m.variant} ink={bodyInk} />
      )}
      {scene.line && lang !== 'bilingual' ? <CaptionPill text={scene.line} /> : null}
    </AbsoluteFill>
  );
};

export const ActiveDirected: React.FC<DirectedProps> = (props) => {
  const { fps } = useVideoConfig();
  const canvas = props.canvas || '#000000';
  return (
    <AbsoluteFill style={{ backgroundColor: canvas }}>
      {props.musicFile ? <Audio src={staticFile(props.musicFile)} volume={0.22} /> : null}
      <Series>
        {props.scenes.map((scene, i) => {
          const dur = Math.max(1, Math.round(scene.durationSec * fps));
          const cues = props.autoSfx === false
            ? []
            : (scene.sfxCues?.length
              ? scene.sfxCues
              : scene.sfxFile
                ? [{ file: scene.sfxFile, volume: scene.sfxVolume ?? 0.4, atSec: 0 }]
                : []);
          return (
            <Series.Sequence key={i} durationInFrames={dur}>
              {scene.narrationFile ? <Audio src={staticFile(scene.narrationFile)} /> : null}
              {cues.map((cue, j) => (
                <Sequence key={j} from={Math.max(0, Math.round((cue.atSec || 0) * fps))} durationInFrames={Math.max(6, Math.round(fps * 0.9))} layout="none">
                  <Audio src={staticFile(cue.file)} volume={cue.volume ?? 0.4} />
                </Sequence>
              ))}
              <Beat scene={scene} props={props} index={i} />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
`;

/** @deprecated 仅 SRT 兜底；片内字幕用 splitCaptionBlocks */
function wrapCaption(vo: string) {
  const blocks = splitCaptionBlocks(vo);
  if (!blocks.length) return '';
  if (blocks.length === 1) return blocks[0];
  return `${blocks[0]}\n${blocks[1]}`;
}

function toSrt(cues: { from: number; to: number; text: string }[]) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.round((sec - Math.floor(sec)) * 1000);
    return `${pad(h)}:${pad(m)}:${pad(s)},${String(ms).padStart(3, '0')}`;
  };
  return cues.map((c, i) => `${i + 1}\n${fmt(c.from)} --> ${fmt(c.to)}\n${c.text.split('\n').slice(0, 2).join('\n')}\n`).join('\n');
}

export type DirectedPrepareMeta = {
  sourcePrompt?: string;
  factoryPrompt?: string;
  audiencePrompt?: string;
  lookLock?: string;
  assumptions?: string[];
  autoSfx?: boolean;
  styleLook?: JobLook;
  styleSource?: string;
  userAssets?: IncomingUserAsset[];
  quality?: '1080p' | '720p';
  /** UI 形态：写入 plan，决定是否可走旁白版式 */
  formMode?: string;
  /** 已有输出目录名（outputs 下）。配音中断后续跑时不另开文件夹。 */
  reuseDir?: string;
};

/** prepare 阶段产物：可打包下发到 PC 壳只做 Remotion 渲染 */
export type DirectedPrepared = {
  dir: string;
  dirName: string;
  plan: SkillPlan;
  props: Record<string, unknown>;
  propsPath: string;
  publicDir: string;
  stillsDir: string;
  finalMp4: string;
  scenes: Array<{
    job: string;
    durationSec: number;
    vo: string;
    headline: string;
    line?: string;
    visualIntent: string;
    keyMotion: string;
    skill: string;
    layoutMode?: string;
    craftMust?: string[];
    layout?: string;
    glyphs?: string[];
    items?: string[];
    stat?: { label: string; value: number };
    narrationFile?: string;
    sfxCues?: SfxCue[];
    sfxFile?: string;
    sfxVolume?: number;
    sfxRole?: string;
  }>;
  totalSec: number;
  tsx: string;
  usedCodegen: boolean;
  usedStickmanPoseFloor: boolean;
  skillGate: { ok: boolean; issues: string[] };
  contentLang: string;
};

export async function makeDirectedHard(
  prompt: string,
  settings: Settings,
  projectId: string,
  plan: SkillPlan,
  meta?: DirectedPrepareMeta,
): Promise<Project> {
  const prep = await prepareDirectedHard(prompt, settings, projectId, plan, meta);
  return renderPreparedDirected(projectId, prep, { settings, allowLlmRepair: true });
}

/** Skill/TTS/codegen（可在编排服务端跑）；不启动 Remotion */
export async function prepareDirectedHard(
  prompt: string,
  settings: Settings,
  projectId: string,
  plan: SkillPlan,
  meta?: DirectedPrepareMeta,
): Promise<DirectedPrepared> {
  const autoSfx = meta?.autoSfx === true;
  if (meta?.formMode) plan.formMode = meta.formMode.trim() || plan.formMode;
  if (!plan.formMode) plan.formMode = 'prompt';
  if (meta?.styleLook || meta?.styleSource) {
    const family =
      plan.aspect === '9:16' || plan.aspect === '3:4' ? 'nextword' as const : 'launch' as const;
    plan.look = reconcileStyleLook(
      plan.look,
      meta.styleLook,
      [
        meta.sourcePrompt || '',
        meta.factoryPrompt || prompt,
        meta.audiencePrompt || '',
        meta.lookLock || '',
      ],
      family,
    );
  }
  const contentLang = plan.contentLang || 'zh';
  const monoLook = promptForcesMono(
    [meta?.sourcePrompt, meta?.factoryPrompt, meta?.audiencePrompt, prompt].filter(Boolean).join('\n'),
  );
  const reuseName = meta?.reuseDir?.trim();
  const { dir, dirName } = reuseName
    ? { dir: join(OUTPUTS_DIR, reuseName), dirName: reuseName }
    : newProjectDir('directed', prompt);
  if (reuseName && !existsSync(dir)) throw new Error(`续跑目录不存在：${dir}`);
  const publicDir = join(dir, 'public');
  mkdirSync(publicDir, { recursive: true });
  if (autoSfx) {
    await ensureSfxAssets();
    let st = reloadSfxKit();
    if (st.clips === 0) {
      console.error('[sfx] kit empty before timeline — retry ensureSfxAssets');
      resetSfxEnsure();
      await ensureSfxAssets();
      st = reloadSfxKit();
    }
    console.info(`[sfx] timeline kit · ${sfxKitStats().roles} types · ${sfxKitStats().clips} clips`);
  }

  const materialized = materializeUserAssets(publicDir, meta?.userAssets);
  const screenAssets: ScreenAsset[] = materialized.screen;
  let userMusic = materialized.musicFile;
  store.patchProject(projectId, { title: plan.coreIdea.slice(0, 28) || prompt.slice(0, 28), dir: dirName });
  writeFileSync(join(dir, 'skill-plan.json'), JSON.stringify(plan, null, 2), 'utf8');
  writeFileSync(join(dir, 'prompt-original.md'), meta?.sourcePrompt || prompt, 'utf8');
  writeFileSync(join(dir, 'prompt-factory.md'), meta?.factoryPrompt || prompt, 'utf8');
  if (meta?.audiencePrompt?.trim()) {
    writeFileSync(join(dir, 'prompt-audience.md'), meta.audiencePrompt.trim(), 'utf8');
  }
  if (plan.scriptDrive && plan.scriptDrive !== 'off') {
    writeFileSync(
      join(dir, 'script-vo.md'),
      [
        `# Script drive (${plan.scriptDrive})`,
        '',
        ...plan.beats.map((b, i) => `${i + 1}. ${b.vo}`),
        '',
      ].join('\n'),
      'utf8',
    );
  }
  if (meta?.lookLock || meta?.assumptions?.length || meta?.styleSource) {
    writeFileSync(
      join(dir, 'brief-meta.json'),
      JSON.stringify({
        lookLock: meta.lookLock,
        assumptions: meta.assumptions || [],
        styleSource: meta.styleSource,
        styleLook: meta.styleLook || plan.look,
        contentLang: plan.contentLang,
        voMode: plan.voMode,
        dualTrack: true,
      }, null, 2),
      'utf8',
    );
  }
  setPipelineStep(projectId, 'plan', 'done', `${plan.primary} · ${plan.support.join('+') || 'no-support'}`);
  setPipelineStep(
    projectId,
    'brief',
    'done',
    meta?.styleSource
      ? `style:${meta.styleSource} · ${plan.look.accent}`
      : `${plan.look.surface} ${plan.look.accent}`,
  );

  setPipelineStep(
    projectId,
    'voice',
    'running',
    plan.voMode === 'off' ? '无旁白 · 跳过 TTS/空音频' : 'TTS per beat',
  );
  const captions: { from: number; to: number; text: string }[] = [];
  const concatList: string[] = [];
  let t = 0;
  const scenes: {
    job: string;
    durationSec: number;
    vo: string;
    headline: string;
    line?: string;
    visualIntent: string;
    keyMotion: string;
    skill: string;
    layoutMode?: string;
    craftMust?: string[];
    layout?: string;
    glyphs?: string[];
    items?: string[];
    stat?: { label: string; value: number };
    narrationFile?: string;
    /** 多挂点时间轴（enter / accent / settle） */
    sfxCues?: SfxCue[];
    /** 兼容旧单挂点：取时间轴第一枪 */
    sfxFile?: string;
    sfxVolume?: number;
    sfxRole?: string;
  }[] = [];
  const sfxPicker = new SfxPicker();
  let sfxHitCount = 0;
  let voClipCount = 0;
  const voOff = plan.voMode === 'off';
  const driveOn = plan.scriptDrive === 'verbatim' || plan.scriptDrive === 'polish';
  const driveDurIssues: string[] = [];
  const allCaptionBlocks: string[] = [];
  // 有用户画面素材时强制自由 codegen（旁白版式不吃 props.assets）
  const narrationOn = usesNarrationLayouts(plan) && screenAssets.length === 0;
  for (let i = 0; i < plan.beats.length; i++) {
    const beat = plan.beats[i];
    const voText = (beat.vo || '').trim();
    // 无旁白：不灌空静音 mp3，镜长用 beat.durationSec（与自动音效关闭同理跳过）
    let narrationFile: string | undefined;
    let audioDur = Math.max(0.6, beat.durationSec || 1.2);
    if (voText) {
      narrationFile = `vo-${i}.mp3`;
      const clip = join(publicDir, narrationFile);
      await speak(voText, clip, settings, { contentLang });
      audioDur = existsSync(clip) ? probeAudioDuration(clip) : audioDur;
      concatList.push(clip);
      voClipCount += 1;
      setPipelineStep(projectId, 'voice', 'running', `TTS ${voClipCount}/${plan.beats.length}`);
    }
    const timed = driveSceneDurationSec({
      scriptDrive: plan.scriptDrive,
      audioDur,
      beatDurationSec: beat.durationSec,
      hasVo: Boolean(voText),
      voTailSec: VO_TAIL_SEC,
    });
    const durationSec = timed.durationSec;
    if (timed.softLong) {
      driveDurIssues.push(
        `beat ${i}: VO ${audioDur.toFixed(1)}s > soft max ${DRIVE_BEAT_MAX_SOFT_SEC}s`,
      );
    }
    const rawCues = autoSfx
      ? buildSceneSfxTimeline({
        skill: beat.skill,
        job: beat.job,
        index: i,
        total: plan.beats.length,
        primary: plan.primary,
        durationSec,
        items: beat.items,
        keyMotion: beat.keyMotion,
      }, sfxPicker)
      : [];
    const cues = rawCues.filter((c) => existsSync(join(SFX_PUBLIC_DIR, c.file.replace(/^sfx\//, ''))));
    sfxHitCount += cues.length;
    const head = cues[0];
    const narrationBind = narrationOn ? bindNarrationScene(beat) : null;
    const sceneItems = beat.items?.length
      ? beat.items
      : (narrationBind?.items?.length ? narrationBind.items : beat.items);
    scenes.push({
      job: beat.job,
      durationSec,
      vo: beat.vo,
      headline: beat.headline,
      line: beat.line,
      visualIntent: beat.visualIntent,
      keyMotion: beat.keyMotion,
      skill: beat.skill,
      craftMust: beat.craftMust,
      ...(narrationBind
        ? { layout: narrationBind.layout, glyphs: narrationBind.glyphs }
        : {}),
      items: sceneItems,
      stat: beat.stat,
      ...(narrationFile ? { narrationFile } : {}),
      ...(cues.length
        ? {
          sfxCues: cues,
          sfxFile: head.file,
          sfxVolume: head.volume,
          sfxRole: head.role,
        }
        : {}),
    });
    if (voText) {
      const blocks = splitCaptionBlocks(voText);
      allCaptionBlocks.push(...blocks);
      const spanSec = Math.max(0.8, audioDur);
      // 按块显示权重分配时间，避免等时切片把短英文碎块拉得过长
      const weights = blocks.map((b) => Math.max(1, [...b.replace(/\s/g, '')].length));
      const weightSum = weights.reduce((a, w) => a + w, 0) || 1;
      let acc = 0;
      blocks.forEach((text, bi) => {
        const from = t + 0.05 + (acc / weightSum) * spanSec;
        acc += weights[bi];
        const to = bi === blocks.length - 1
          ? t + spanSec
          : Math.min(t + spanSec, t + 0.05 + (acc / weightSum) * spanSec);
        captions.push({ from, to, text });
      });
    }
    t += durationSec;
  }

  let dropSec: number | undefined;
  let musicFile: string | undefined;
  if (userMusic) {
    musicFile = userMusic;
  }
  // launch-video 仅在有旁白或用户上传配乐时才合成/混 bed；无旁白展片只用 SFX，避免空白 bed.mp3
  if (plan.primary === 'launch-video' && !userMusic && !voOff && concatList.length) {
    dropSec = Number(scenes.slice(0, 2).reduce((a, s) => a + s.durationSec, 0).toFixed(2));
    const bedAbs = join(publicDir, 'bed.mp3');
    synthesizeLaunchBed(bedAbs, t, 120, dropSec);
    musicFile = 'bed.mp3';
    const padded: string[] = [];
    for (let i = 0; i < scenes.length; i++) {
      const nf = scenes[i].narrationFile;
      if (!nf) continue;
      const src = join(publicDir, nf);
      if (!existsSync(src)) continue;
      const padOut = join(publicDir, `vo-pad-${i}.mp3`);
      padAudioToDuration(src, padOut, scenes[i].durationSec);
      padded.push(padOut);
    }
    if (padded.length) {
      const fullNarr = join(dir, 'narration-vo.mp3');
      concatMp3List(padded, join(dir, 'concat-vo.txt'), fullNarr);
      mixLaunchAudio({ bed: bedAbs, narration: fullNarr, out: join(dir, 'narration.mp3') });
    }
  } else if (concatList.length) {
    const listFile = join(dir, 'concat.txt');
    writeFileSync(listFile, concatList.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'), 'utf8');
    const fullNarr = join(dir, 'narration.mp3');
    const r = spawnSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', fullNarr], { windowsHide: true });
    if (r.status !== 0 && concatList[0]) copyFileSync(concatList[0], fullNarr);
  }

  writeFileSync(join(dir, 'captions.srt'), toSrt(captions), 'utf8');
  const totalSec = Number(scenes.reduce((a, s) => a + s.durationSec, 0).toFixed(3));
  const voLabel = voClipCount === 0 ? 'no-VO' : `${voClipCount} VO`;
  if (voOff || voClipCount === 0) {
    setPipelineStep(projectId, 'voice', 'running', '跳过空旁白 · 镜长按分镜');
  }
  if (autoSfx) {
    const files = scenes.flatMap((s) => (s.sfxCues || []).map((c) => c.file).concat(s.sfxFile ? [s.sfxFile] : []));
    copySfxIntoProject(publicDir, files.filter(Boolean));
    setPipelineStep(projectId, 'voice', 'done', `${voLabel} · ${contentLang} · SFX ${sfxHitCount} · ${totalSec.toFixed(1)}s`);
  } else {
    setPipelineStep(projectId, 'voice', 'done', `${voLabel} · ${contentLang} · ${totalSec.toFixed(1)}s`);
  }

  const quality = meta?.quality === '720p' ? '720p' as const : '1080p' as const;
  const props = {
    aspect: plan.aspect,
    quality,
    canvas: plan.look.canvas,
    ink: plan.look.ink,
    accent: plan.look.accent,
    muted: plan.look.muted,
    brandBg: plan.look.brandBg,
    ...(narrationOn ? { material: plan.look.motionNotes || '' } : {}),
    primary: plan.primary,
    skills: plan.skills,
    coreIdea: plan.coreIdea,
    contentLang,
    dropSec,
    musicFile,
    autoSfx,
    /** Agent 全幅默认；a2e Stage 壳仅实验 opt-in */
    a2eCanvas: false,
    a2eHud: false,
    ...(plan.mainTechnique ? { mainTechnique: plan.mainTechnique } : {}),
    ...(plan.motifLock?.continuousPage ? { motifLock: plan.motifLock } : {}),
    assets: screenAssets.length ? screenAssets : undefined,
    scenes,
    captions,
  };
  writeFileSync(join(dir, 'props.json'), JSON.stringify(props, null, 2), 'utf8');
  writeFileSync(join(dir, 'storyboard.json'), JSON.stringify(props, null, 2), 'utf8');
  writeFileSync(
    join(dir, 'content-lang.json'),
    JSON.stringify({
      contentLang,
      voMode: plan.voMode,
      scriptDrive: plan.scriptDrive || 'off',
      voBeats: plan.beats.length,
    }, null, 2),
    'utf8',
  );

  // 旁白驱动软门禁：结构 / 镜长 / skill 消耗 / 字幕；不阻断出片，不影响无旁白
  if (driveOn) {
    const consumeIssues = assessDriveConsumption({
      beats: scenes.map((s) => ({
        skill: s.skill,
        durationSec: s.durationSec,
        vo: s.vo,
      })),
    });
    const issues = [
      ...(plan.driveIssues || []),
      ...driveDurIssues,
      ...consumeIssues,
      ...captionFragmentIssues(allCaptionBlocks),
    ].slice(0, 48);
    const skillSet = new Set(scenes.map((s) => s.skill).filter(Boolean));
    writeSkillGateReport(dir, 'gate-drive.json', {
      ok: issues.filter((x) => /consecutive same skill|dominates|overlong|thin one-liner/i.test(x)).length === 0,
      scriptDrive: plan.scriptDrive,
      voBeats: plan.beats.length,
      shotCount: scenes.length,
      skillVariety: skillSet.size,
      skills: [...skillSet],
      issues,
    });
  }

  const propsPath = join(dir, 'props.json');
  const stillsDir = join(dir, 'stills');
  const finalMp4 = join(dir, 'final.mp4');
  const propsStr = JSON.stringify(props, null, 2);

  if (narrationOn) {
    const tsx = composeNarrationDirectedSource();
    const layoutIssues = [
      ...narrationLayoutIssues(tsx, scenes),
      ...parseTsxSyntaxIssues(tsx, 'ActiveDirected.tsx'),
    ];
    if (layoutIssues.length) {
      throw new Error(`旁白版式未接上：${layoutIssues.slice(0, 4).join('; ')}`);
    }
    const skillGate = { ok: true, issues: [] as string[] };
    writeFileSync(join(dir, 'ActiveDirected.tsx'), tsx, 'utf8');
    writeSkillGateReport(dir, 'gate-skills.json', skillGate);
    writeSkillGateReport(dir, 'skill-depth.json', {
      ok: true,
      score: scenes.length,
      max: scenes.length,
      issues: [],
      narrationLayout: true,
      layouts: scenes.map((s) => ({ job: s.job, layout: s.layout, glyphs: s.glyphs })),
    });
    setPipelineStep(projectId, 'build', 'done', `旁白版式 · ${scenes.length} 镜 · ${contentLang}`);
    return {
      dir,
      dirName,
      plan,
      props: props as Record<string, unknown>,
      propsPath,
      publicDir,
      stillsDir,
      finalMp4,
      scenes,
      totalSec,
      tsx,
      usedCodegen: false,
      usedStickmanPoseFloor: false,
      skillGate,
      contentLang,
    };
  }

  const craftIds = craftSkillIds(plan);
  const codegenIds = codegenSkillIds(plan);
  const sceneCount = Math.max(props.scenes?.length || 0, plan.beats?.length || 0, 1);
  const assetFiles = screenAssets.map((a) => a.file).filter((f) => Boolean(f));
  const validateTsx = (src: string) =>
    validateDirectedTsx(src, craftIds, contentLang, plan.aspect, sceneCount, assetFiles, plan.voMode === 'off' ? [] : scenes.map((s) => s.durationSec));
  setPipelineStep(projectId, 'build', 'running', `codegen · ${craftIds.join('+')} · ${contentLang}`);
  let tsx = sealDirectedTsx(await generateDirectedTsx(settings, {
    prompt,
    propsJson: propsStr,
    skillIds: codegenIds,
    primary: plan.primary,
    technique: plan.support,
    brandSkills: plan.brandSkills || [],
    aspect: plan.aspect,
    contentLang,
    beats: plan.beats,
    lookLine: [
      lookLockLine(plan.look),
      contentLangLockLine(contentLang),
      meta?.styleSource
        ? styleLookLockLine(plan.look, meta.styleSource, { mono: monoLook })
        : '',
      assetsLockLine(screenAssets, musicFile),
      monoLook
        ? 'MONO HARD LOCK: black ink on paper only — no red/purple/neon accent fills, no collage color wipes.'
        : '',
    ].filter(Boolean).join('\n'),
  }));
  // 导演松绑：硬失败仅工程底线（可编译 / export / remotion 接线）；skill 指纹与深度只记录警告
  let codeIssues = validateTsx(tsx);
  let skillGate = assertSkillsInTsx(codegenIds, tsx, { hardIds: craftIds });
  let depthGate = scoreSkillDepth(tsx, craftIds, plan.beats);
  if (codeIssues.length) {
    tsx = sealDirectedTsx(await fixDirectedTsx(settings, {
      source: tsx,
      error: codeIssues.join('; '),
      propsJson: propsStr,
    }));
    codeIssues = validateTsx(tsx);
    skillGate = assertSkillsInTsx(codegenIds, tsx, { hardIds: craftIds });
    depthGate = scoreSkillDepth(tsx, craftIds, plan.beats);
  }
  const stickmanJob = craftIds.includes('stickman-animation') || plan.primary === 'stickman-animation';
  const stickmanContractOk = (src: string) =>
    /from\s+['"]\.\.\/stickman['"]/.test(src)
    && /<Stickman\b/.test(src)
    && /(Series|Sequence)/.test(src)
    && !/const\s+Stickman\s*[:=]|function\s+Stickman\b/.test(src);

  let usedCodegen = codeIssues.length === 0;
  let usedStickmanPoseFloor = false;
  let softAccepted = false;
  if (!usedCodegen) {
    if (stickmanJob) {
      tsx = sealDirectedTsx(await fixDirectedTsx(settings, {
        source: tsx,
        error: [...codeIssues, 'stickman: keep brief staging; use props.canvas/ink; optional titles only'].join('; '),
        propsJson: propsStr,
      }));
      codeIssues = validateTsx(tsx);
      skillGate = assertSkillsInTsx(codegenIds, tsx, { hardIds: craftIds });
      usedCodegen = codeIssues.length === 0;
      if (!usedCodegen && stickmanContractOk(tsx) && parseTsxSyntaxIssues(tsx).length === 0) {
        usedCodegen = true;
        softAccepted = true;
      } else if (!usedCodegen) {
        const syn = parseTsxSyntaxIssues(tsx);
        if (syn.length && stickmanContractOk(tsx)) {
          tsx = sealDirectedTsx(await fixDirectedTsx(settings, {
            source: tsx,
            error: `${syn.join('; ')}; FIX SYNTAX ONLY — keep stickman Series/poses`,
            propsJson: propsStr,
          }));
          codeIssues = validateTsx(tsx);
          if (stickmanContractOk(tsx) && parseTsxSyntaxIssues(tsx).length === 0) {
            usedCodegen = true;
            softAccepted = true;
          }
        }
        if (!usedCodegen) {
          tsx = STICKMAN_STOCK;
          usedStickmanPoseFloor = true;
          codeIssues = validateTsx(tsx);
          skillGate = assertSkillsInTsx(codegenIds, tsx, { hardIds: craftIds });
          usedCodegen = codeIssues.length === 0;
        }
      }
    } else {
      tsx = sealDirectedTsx(await fixDirectedTsx(settings, {
        source: tsx,
        error: [
          ...codeIssues,
          'repair engineering only: keep THIS brief; respect props.canvas/aspect zone; do NOT re-export DirectedFilm',
        ].join('; '),
        propsJson: propsStr,
      }));
      codeIssues = validateTsx(tsx);
      skillGate = assertSkillsInTsx(codegenIds, tsx, { hardIds: craftIds });
      depthGate = scoreSkillDepth(tsx, craftIds, plan.beats);
      usedCodegen = codeIssues.length === 0;
      if (!usedCodegen) {
        tsx = sealDirectedTsx(tsx);
        const syn = parseTsxSyntaxIssues(tsx);
        const fontHard = assertSafeGoogleFonts(tsx);
        writeFileSync(join(dir, 'ActiveDirected.tsx'), tsx, 'utf8');
        writeFileSync(join(dir, 'ActiveDirected.syntax-fail.tsx'), tsx, 'utf8');
        if (syn.length) {
          throw new Error(`ActiveDirected 语法错误：${syn.slice(0, 3).join('; ')}`);
        }
        if (fontHard.length) {
          throw new Error(`ActiveDirected 字体不安全：${fontHard.slice(0, 3).join('; ')}`);
        }
        // 一镜一组件缺失 / Math.min 钳位：禁止 soft-accept（否则后半段固定版式）
        const beatHard = codeIssues.filter((x) => /beat (recycle|clamp|coverage)/i.test(x));
        if (beatHard.length) {
          throw new Error(`ActiveDirected 分镜组件不足：${beatHard.slice(0, 3).join('; ')}`);
        }
        // 禁止用 DirectedFilm stock 假成功（空镜主因）；语法过关 + 叙事合约过关才 soft-accept
        if (directedNarrativeContractOk(tsx)) {
          usedCodegen = true;
          softAccepted = true;
        } else {
          throw new Error(
            `ActiveDirected 工程校验未通过：${codeIssues.slice(0, 4).join('; ') || 'validate failed'}`,
          );
        }
      }
    }
  }
  // skill / depth：只落盘报告，不再禁止出片
  tsx = sealDirectedTsx(tsx);
  depthGate = scoreSkillDepth(tsx, craftIds, plan.beats);
  writeFileSync(join(dir, 'ActiveDirected.tsx'), tsx, 'utf8');
  writeSkillGateReport(dir, 'gate-skills.json', skillGate);
  writeSkillGateReport(dir, 'skill-depth.json', {
    ...depthGate,
    craftIds,
    brandSkills: plan.brandSkills || [],
    beatSkills: plan.beats.map((b) => ({ job: b.job, skill: b.skill, craftMust: b.craftMust })),
  });
  setPipelineStep(
    projectId,
    'build',
    'done',
    usedStickmanPoseFloor
      ? `stickman-pose-floor · ${contentLang} · vo:${plan.voMode}`
      : softAccepted
        ? `ActiveDirected · soft-accept · depth ${depthGate.score}/${depthGate.max} · ${contentLang}`
        : usedCodegen
          ? `ActiveDirected · depth ${depthGate.score}/${depthGate.max} · ${contentLang}`
          : `stock · ${codeIssues[0] || skillGate.issues[0] || 'fallback'}`,
  );

  return {
    dir,
    dirName,
    plan,
    props: props as Record<string, unknown>,
    propsPath,
    publicDir,
    stillsDir,
    finalMp4,
    scenes,
    totalSec,
    tsx,
    usedCodegen,
    usedStickmanPoseFloor,
    skillGate,
    contentLang,
  };
}

function withEmptyFrames(
  report: StillSkillReport,
  stillsDir: string,
  opts?: { narration?: boolean },
): StillSkillReport {
  const extra = emptyStillIssues(stillsDir, opts);
  if (!extra.length) return report;
  return {
    ...report,
    ok: false,
    hardIssues: [...report.hardIssues, ...extra],
    issues: [...report.issues, ...extra],
  };
}

/** 本机 Remotion 渲染（PC 壳）；不再读技能包 / 不再调 LLM */
export async function renderPreparedDirected(
  projectId: string,
  prep: DirectedPrepared,
  opts?: { settings?: Settings; allowLlmRepair?: boolean },
): Promise<Project> {
  const {
    dir, dirName, plan, propsPath, publicDir, stillsDir, finalMp4, scenes,
    totalSec, skillGate, contentLang,
  } = prep;
  let { tsx, usedCodegen, usedStickmanPoseFloor } = prep;
  const stickmanJob = plan.skills.includes('stickman-animation') || plan.primary === 'stickman-animation';
  const narrationFilm = /narration-layout/.test(tsx);
  const quality = prep.props.quality === '720p' ? '720p' as const : '1080p' as const;
  const propsStr = JSON.stringify(prep.props, null, 2);
  const settings = opts?.settings;
  const allowLlmRepair = opts?.allowLlmRepair === true && Boolean(settings);

  try {
    await withRemotionCodegenLock(async () => {
      installActiveComponent('directed', tsx);
      const maxRenderAttempts = stickmanJob && allowLlmRepair ? 4 : 2;
      let rendered = false;
      for (let attempt = 0; attempt < maxRenderAttempts; attempt++) {
        try {
          await renderRemotionComposition({
            compositionId: 'GeneratedDirected',
            propsPath,
            outMp4: finalMp4,
            publicDir,
            stillsDir,
            scenes,
            probeRes: probeResFor(plan.aspect, quality),
            phases: ['stills'],
            onPhase: (phase, detail) => setPipelineStep(projectId, phase === 'stills' ? 'stills' : 'encode', 'running', detail),
          });
          rendered = true;
          break;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          writeFileSync(join(dir, `codegen-error-${attempt + 1}.txt`), msg, 'utf8');
          const canRepair = allowLlmRepair && usedCodegen && !usedStickmanPoseFloor && attempt < maxRenderAttempts - 1;
          if (canRepair && settings) {
            const repairHint = [
              msg,
              stickmanJob
                ? 'FIX: AbsoluteFill→Series→Series.Sequence per scene; Stickman pose must be POSES.*/lerpPose/idleBob/ensurePose (never undefined); keep props.canvas/ink and brief staging — do NOT swap to a generic pose demo.'
                : '',
            ].filter(Boolean).join('\n');
            tsx = sealDirectedTsx(await fixDirectedTsx(settings, { source: tsx, error: repairHint, propsJson: propsStr }));
            writeFileSync(join(dir, 'ActiveDirected.tsx'), tsx, 'utf8');
            writeFileSync(join(dir, `ActiveDirected.repair-${attempt + 1}.tsx`), tsx, 'utf8');
            installActiveComponent('directed', tsx);
            continue;
          }
          usedCodegen = false;
          if (!stickmanJob) {
            // 禁止回退 DirectedFilm stock（空镜主因：只有标题/字幕、中间无隐喻）
            throw err instanceof Error ? err : new Error(msg);
          }
          writeFileSync(join(dir, 'ActiveDirected.pre-floor.tsx'), tsx, 'utf8');
          tsx = STICKMAN_STOCK;
          usedStickmanPoseFloor = true;
          writeFileSync(join(dir, 'ActiveDirected.tsx'), tsx, 'utf8');
          installActiveComponent('directed', tsx);
          await renderRemotionComposition({
            compositionId: 'GeneratedDirected',
            propsPath,
            outMp4: finalMp4,
            publicDir,
            stillsDir,
            scenes,
            probeRes: probeResFor(plan.aspect, quality),
            phases: ['stills'],
            onPhase: (phase, detail) => setPipelineStep(projectId, phase === 'stills' ? 'stills' : 'encode', 'running', detail),
          });
          rendered = true;
          break;
        }
      }
      if (!rendered) throw new Error('remotion stills failed after repairs');
      buildContactSheet(stillsDir, join(dir, 'contact-sheet.png'));

      // P2: map stills with render scene durations (not plan 2.5s defaults)
      const craftIds = craftSkillIds(plan);
      const softStill = stickmanJob || usedStickmanPoseFloor;
      const stillBeats = beatsForStillVerify(plan.beats, scenes);
      let stillReport = withEmptyFrames(verifyStillSkillBeats({
        stillsDir,
        tsx,
        beats: stillBeats,
        craftIds,
        soft: softStill,
      }), stillsDir, { narration: narrationFilm });
      // Only fingerprint misses need LLM repair — coverage/sampling cannot be fixed by rewriting TSX
      if (
        !stillReport.ok
        && stillIssuesNeedCodeRepair(stillReport)
        && allowLlmRepair
        && settings
        && usedCodegen
        && !usedStickmanPoseFloor
        && !narrationFilm
      ) {
        setPipelineStep(projectId, 'inspect', 'running', 'still skill repair');
        try {
          tsx = sealDirectedTsx(await fixDirectedTsx(settings, {
            source: tsx,
            error: [
              'STILL SKILL GATE — implement assigned beat skills so fingerprints appear in ActiveDirected:',
              ...stillReport.hardIssues,
              'Keep THIS brief narrative; rotate reveal families; do NOT re-export DirectedFilm',
            ].join('; '),
            propsJson: propsStr,
          }));
          writeFileSync(join(dir, 'ActiveDirected.tsx'), tsx, 'utf8');
          writeFileSync(join(dir, 'ActiveDirected.still-repair.tsx'), tsx, 'utf8');
          installActiveComponent('directed', tsx);
          await renderRemotionComposition({
            compositionId: 'GeneratedDirected',
            propsPath,
            outMp4: finalMp4,
            publicDir,
            stillsDir,
            scenes,
            probeRes: probeResFor(plan.aspect, quality),
            phases: ['stills'],
            onPhase: (phase, detail) => setPipelineStep(projectId, phase === 'stills' ? 'stills' : 'encode', 'running', detail),
          });
          buildContactSheet(stillsDir, join(dir, 'contact-sheet.png'));
          stillReport = withEmptyFrames(verifyStillSkillBeats({
            stillsDir,
            tsx,
            beats: stillBeats,
            craftIds,
            soft: softStill,
          }), stillsDir, { narration: narrationFilm });
        } catch (repairErr) {
          // 402 / 欠费等：验收修补可跳过，默认继续 encode（空镜硬门禁仍拦）
          const msg = repairErr instanceof Error ? repairErr.message : String(repairErr);
          const billing = /402|insufficient balance|欠费|余额不足|quota|billing/i.test(msg);
          setPipelineStep(
            projectId,
            'inspect',
            'running',
            billing
              ? `still repair skipped (billing) · continue encode`
              : `still repair skipped · ${msg.slice(0, 80)}`,
          );
          if (!billing) {
            // 非账单类仍允许继续出片，但记入 soft issues
            stillReport = {
              ...stillReport,
              issues: [...(stillReport.issues || []), `still repair skipped: ${msg.slice(0, 160)}`].slice(0, 24),
            };
          } else {
            stillReport = {
              ...stillReport,
              issues: [...(stillReport.issues || []), 'still repair skipped: insufficient balance'].slice(0, 24),
            };
          }
        }
      }
      writeSkillGateReport(dir, 'inspect-stills-skill.json', stillReport);
      // 空镜硬拦（含 title/caption 中空）；技能指纹未命中只警告
      const emptyFrameHard = stillReport.hardIssues.filter((i) => /empty|blank|occupancy|no still/i.test(i));
      if (emptyFrameHard.length && !softStill) {
        throw new Error(`抽帧空镜（禁止出片）：${emptyFrameHard.slice(0, 5).join('; ')}`);
      }

      const stillFiles = existsSync(stillsDir) ? readdirSync(stillsDir).filter((f) => f.endsWith('.png')) : [];
      writeSkillGateReport(dir, 'inspect-1.json', {
        ok: stillFiles.length >= 3 && (softStill || stillReport.ok),
        issues: [
          ...(stillFiles.length >= 3 ? [] : [`too few stills (${stillFiles.length})`]),
          ...stillReport.issues,
        ],
        skills: plan.skills,
        usedCodegen,
        usedStickmanPoseFloor,
        stillSkillOk: stillReport.ok,
        mappedBeats: stillReport.mapped?.length ?? 0,
      });
      setPipelineStep(projectId, 'stills', 'done', `${stillFiles.length} stills`);
      setPipelineStep(
        projectId,
        'inspect',
        'done',
        usedStickmanPoseFloor
          ? 'pose-floor'
          : stillReport.ok
            ? (skillGate.ok ? 'skills+stills pass' : skillGate.issues[0])
            : stillReport.issues[0],
      );
      await renderRemotionComposition({
        compositionId: 'GeneratedDirected',
        propsPath,
        outMp4: finalMp4,
        publicDir,
        stillsDir,
        scenes,
        probeRes: probeResFor(plan.aspect, quality),
        phases: ['encode'],
        onPhase: (_phase, detail) => setPipelineStep(projectId, 'encode', 'running', detail),
      });
    }, {
      onWaiting: (info) => {
        const detail = remotionQueueDetail(info);
        if (detail) setPipelineStep(projectId, 'encode', 'running', detail);
      },
    });
  } finally {
    try { restoreActiveFallback('directed'); } catch { /* ignore */ }
  }

  writeSkillGateReport(dir, 'render-mode.json', {
    compositionId: 'GeneratedDirected',
    usedCodegen,
    usedStickmanPoseFloor,
    primary: plan.primary,
    skills: plan.skills,
    aspect: plan.aspect,
    quality,
    shellRender: !allowLlmRepair,
  });

  const lang = plan.contentLang === 'en' ? 'en' : 'zh';
  let versions = store.getProject(projectId)?.versions || [];
  if (existsSync(join(dir, 'final.mp4')) && !versions.some((v) => v.kind === 'initial' || /^(初始版本|Initial)\b/i.test(v.label || ''))) {
    try {
      const initial = await snapshotProjectVersion(dir, {
        label: labelInitial(lang),
        kind: 'initial',
        note: '首次成片',
        durationSec: Math.round(totalSec),
      });
      versions = [initial];
    } catch {
      /* 初始快照失败不阻断成片 */
    }
  }

  return finishPipeline(projectId, {
    title: plan.coreIdea.slice(0, 28) || String(prep.props.coreIdea || '').slice(0, 28) || '作品',
    kind: plan.primary === 'launch-video' ? 'promo' : 'explainer',
    engine: 'explainer-remotion',
    stylePack: 'skill-directed',
    dir: dirName,
    durationSec: Math.round(totalSec),
    quality,
    files: listFiles(dir),
    versions,
    currentVersionId: versions[0]?.id || 'current',
  })!;
}
