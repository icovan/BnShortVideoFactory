/**
 * 成片后再创作：改所选分镜 → TTS（如需）→ 整片 codegen/encode → 存「改过版本 n」。
 * 版本：初始版本 / 改过版本1…n（outputs/{dir}/_versions/{id}/）
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';
import { speak } from '../tts.ts';
import { listFiles, OUTPUTS_DIR } from '../paths.ts';
import { renderRemotionComposition } from '../engines/remotionBridge.ts';
import {
  installActiveComponent,
  remotionQueueDetail,
  restoreActiveFallback,
  withRemotionCodegenLock,
} from '../engines/remotionLock.ts';
import { probeAudioDuration } from '../probe.ts';
import {
  failPipeline,
  finishPipeline,
  remakePipeline,
  setPipelineStep,
} from '../pipeline.ts';
import { store } from '../store.ts';
import { assertSkillsInTsx, isSkillName, probeResFor } from '../skills/registry.ts';
import { lookLockLine, type JobLook } from './look.ts';
import { contentLangLockLine } from './contentLang.ts';
import {
  fixDirectedTsx,
  remakeSelectedDirectedTsx,
  repairUnsafeGoogleFonts,
  validateDirectedTsx,
} from './remotionCodegen.ts';
import { extractConstArray } from './surgicalBeats.ts';
import { assetFilesFromProps } from './craftFloor.ts';
import { chatJson } from '../llm.ts';
import { projectOutputDir } from './storyboard.ts';
import { VO_TAIL_SEC, buildContactSheet, writeSkillGateReport } from '../skills/hardPipeline.ts';
import {
  isInitialVersion,
  labelInitial,
  labelRemake,
  nextRemakeIndex,
  restoreSnapshotToDir,
  snapshotProjectVersion,
} from './projectVersions.ts';
import type {
  Project,
  ProjectVersion,
  RemakeMode,
  Settings,
} from '../../../shared/src/index.ts';
import type { SkillPlan } from './skillPlan.ts';

type PropsScene = {
  job: string;
  durationSec: number;
  vo?: string;
  headline?: string;
  line?: string;
  visualIntent?: string;
  keyMotion?: string;
  skill?: string;
  items?: string[];
  stat?: { label: string; value: number };
  narrationFile?: string;
  sfxCues?: unknown[];
  sfxFile?: string;
  sfxVolume?: number;
  sfxRole?: string;
};

type DirectedPropsFile = {
  aspect: '9:16' | '16:9' | '1:1' | '3:4';
  quality?: '1080p' | '720p';
  canvas: string;
  ink: string;
  accent: string;
  muted: string;
  brandBg?: string;
  primary: string;
  skills: string[];
  coreIdea?: string;
  contentLang?: 'zh' | 'en' | 'bilingual';
  dropSec?: number;
  musicFile?: string;
  autoSfx?: boolean;
  assets?: unknown[];
  scenes: PropsScene[];
  captions?: { from: number; to: number; text: string }[];
};

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

type PatchedBeat = {
  index: number;
  headline?: string;
  line?: string;
  vo?: string;
  visualIntent?: string;
  keyMotion?: string;
};

async function llmPatchBeats(
  settings: Settings,
  opts: {
    note: string;
    mode: RemakeMode;
    scenes: PropsScene[];
    indexes: number[];
    contentLang: string;
  },
): Promise<PatchedBeat[]> {
  const selected = opts.indexes.map((index) => {
    const s = opts.scenes[index];
    return {
      index,
      job: s.job,
      headline: s.headline || '',
      line: s.line || '',
      vo: s.vo || '',
      visualIntent: s.visualIntent || '',
      keyMotion: s.keyMotion || '',
    };
  });
  const modeRule = opts.mode === 'visual'
    ? 'ONLY change visualIntent and keyMotion (and headline if needed for on-screen). Keep vo/line meaning.'
    : opts.mode === 'copy'
      ? 'ONLY change vo, headline, line. Keep visualIntent/keyMotion unless copy forces a tiny label tweak.'
      : 'Change BOTH picture staging (visualIntent/keyMotion) AND copy/VO (vo/headline/line) as needed.';

  const raw = await chatJson<{ beats?: PatchedBeat[] }>(
    settings,
    `You revise selected storyboard beats for a finished film. Return JSON only.
${modeRule}
Keep each beat's job/skill role. Language for on-screen/VO must stay ${opts.contentLang}.
User note is LAW for the selected beats. Do not invent unrelated genres.
Return: { "beats": [ { "index": number, "headline"?: string, "line"?: string, "vo"?: string, "visualIntent"?: string, "keyMotion"?: string } ] }`,
    `User note:
${opts.note}

Selected beats:
${JSON.stringify(selected, null, 2)}`,
    0.45,
  );
  const beats = Array.isArray(raw?.beats) ? raw.beats : [];
  return beats.filter((b) => typeof b?.index === 'number' && opts.indexes.includes(b.index));
}

function rebuildCaptions(scenes: PropsScene[]): { from: number; to: number; text: string }[] {
  const captions: { from: number; to: number; text: string }[] = [];
  let t = 0;
  for (const s of scenes) {
    const dur = Math.max(0.2, Number(s.durationSec) || 1.2);
    const vo = (s.vo || '').trim();
    if (vo) {
      captions.push({
        from: Number((t + 0.05).toFixed(3)),
        to: Number((t + Math.min(dur - 0.05, Math.max(0.8, dur * 0.85))).toFixed(3)),
        text: vo.slice(0, 48),
      });
    }
    t += dur;
  }
  return captions;
}

export async function remakeBeats(
  projectId: string,
  settings: Settings,
  opts: {
    beatIndexes: number[];
    note: string;
    mode?: RemakeMode;
  },
): Promise<Project> {
  const project = store.getProject(projectId);
  if (!project) throw new Error('项目不存在');
  // API route already gates on ready → sets running before calling us; do NOT reject running here.
  if (project.status === 'queued') {
    throw new Error('当前任务还在排队，请稍后再改');
  }
  if (project.status === 'error') {
    // Allow remake retry after a failed remake / prior error when output dir still exists.
  } else if (project.status !== 'ready' && project.status !== 'running') {
    throw new Error('成片就绪后才能改分镜');
  }
  const dir = projectOutputDir(project);
  if (!dir || !project.dir) throw new Error('找不到成片目录');

  const propsPath = join(dir, 'props.json');
  const props = readJson<DirectedPropsFile>(propsPath);
  if (!props?.scenes?.length) throw new Error('没有分镜数据（props.json）');

  const indexes = [...new Set(opts.beatIndexes)]
    .filter((i) => Number.isInteger(i) && i >= 0 && i < props.scenes.length)
    .sort((a, b) => a - b);
  if (!indexes.length) throw new Error('请至少选择一个分镜');
  const note = (opts.note || '').trim();
  if (!note) throw new Error('请写明要怎么改');
  const mode: RemakeMode = opts.mode === 'visual' || opts.mode === 'copy' ? opts.mode : 'both';

  const totalBefore = props.scenes.reduce((a, s) => a + (Number(s.durationSec) || 0), 0);
  const lang = (props.contentLang === 'en' ? 'en' : 'zh') as 'zh' | 'en';
  // 尚无「初始版本」时，先把当前成片存为初始版本（二次创作前的底稿）
  let versions: ProjectVersion[] = [...(project.versions || []).filter((v) => !/^回退前/.test(v.label || ''))];
  if (!versions.some(isInitialVersion) && existsSync(join(dir, 'final.mp4'))) {
    const initial = await snapshotProjectVersion(dir, {
      label: labelInitial(lang),
      kind: 'initial',
      note: '首次成片',
      durationSec: Number(totalBefore.toFixed(2)),
    });
    versions = [initial, ...versions.filter((v) => v.id !== initial.id)].slice(-20);
  }

  store.patchProject(projectId, {
    status: 'running',
    error: undefined,
    versions,
    currentVersionId: 'current',
    pipeline: remakePipeline(),
  });

  try {
    setPipelineStep(projectId, 'plan', 'running', `改 ${indexes.length} 镜`);
    const contentLang = props.contentLang || 'zh';
    const patched = await llmPatchBeats(settings, {
      note,
      mode,
      scenes: props.scenes,
      indexes,
      contentLang,
    });
    const byIndex = new Map(patched.map((b) => [b.index, b]));

    for (const i of indexes) {
      const p = byIndex.get(i);
      if (!p) continue;
      const scene = props.scenes[i];
      if (mode !== 'copy') {
        if (p.visualIntent) scene.visualIntent = String(p.visualIntent).slice(0, 220);
        if (p.keyMotion) scene.keyMotion = String(p.keyMotion).slice(0, 120);
      }
      if (mode !== 'visual') {
        if (p.headline != null) scene.headline = String(p.headline).slice(0, 64);
        if (p.line != null) scene.line = String(p.line).slice(0, 80);
        if (p.vo != null) scene.vo = String(p.vo).slice(0, 240);
      }
    }
    setPipelineStep(projectId, 'plan', 'done', `已改 ${indexes.length} 镜 · ${mode}`);

    // 视觉向二次创作：若用户在改色/气质，刷新全局色板（否则 TSX 仍绑死旧 props.canvas）
    if (mode !== 'copy' && /色|清新|配色|色板|亮|暗|暖|冷|color|palette|pastel|bright|dark|soft|fresh|mood|tone/i.test(note)) {
      setPipelineStep(projectId, 'brief', 'running', '刷新色板');
      try {
        const nextLook = await chatJson<{
          canvas?: string;
          ink?: string;
          accent?: string;
          muted?: string;
        }>(
          settings,
          `You refresh a film color palette from a user remake note. Return JSON only with hex fields: canvas, ink, accent, muted.
Keep strong contrast (ink vs canvas). For 小清新/pastel/fresh: light canvas, soft accent. For darker moods: deep canvas.`,
          `Current palette: canvas=${props.canvas} ink=${props.ink} accent=${props.accent} muted=${props.muted}
User note: ${note}
Selected beat intents: ${indexes.map((i) => props.scenes[i]?.visualIntent || '').join(' | ').slice(0, 600)}`,
          0.4,
        );
        const hexOk = (v: unknown) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
        if (hexOk(nextLook.canvas)) props.canvas = nextLook.canvas!;
        if (hexOk(nextLook.ink)) props.ink = nextLook.ink!;
        if (hexOk(nextLook.accent)) props.accent = nextLook.accent!;
        if (hexOk(nextLook.muted)) props.muted = nextLook.muted!;
        props.brandBg = props.canvas;
      } catch {
        /* keep palette */
      }
    }
    setPipelineStep(projectId, 'brief', 'done', `${props.canvas} / ${props.ink}`);

    // Sync skill-plan beats when present
    const planPath = join(dir, 'skill-plan.json');
    const plan = readJson<SkillPlan>(planPath);
    if (plan?.beats?.length) {
      for (const i of indexes) {
        if (!plan.beats[i]) continue;
        const s = props.scenes[i];
        plan.beats[i] = {
          ...plan.beats[i],
          vo: s.vo || plan.beats[i].vo,
          headline: s.headline || plan.beats[i].headline,
          line: s.line || plan.beats[i].line,
          visualIntent: s.visualIntent || plan.beats[i].visualIntent,
          keyMotion: s.keyMotion || plan.beats[i].keyMotion,
        };
      }
      writeFileSync(planPath, JSON.stringify(plan, null, 2), 'utf8');
    }

    const publicDir = join(dir, 'public');
    mkdirSync(publicDir, { recursive: true });
    setPipelineStep(projectId, 'voice', 'running', '更新旁白');
    let voChanged = 0;
    for (const i of indexes) {
      const scene = props.scenes[i];
      const vo = (scene.vo || '').trim();
      if (mode === 'visual' && scene.narrationFile && existsSync(join(publicDir, scene.narrationFile))) {
        continue;
      }
      if (vo) {
        const narrationFile = scene.narrationFile || `vo-${i}.mp3`;
        scene.narrationFile = narrationFile;
        const clip = join(publicDir, narrationFile);
        await speak(vo, clip, settings, { contentLang });
        const audioDur = probeAudioDuration(clip);
        scene.durationSec = Number(Math.max(scene.durationSec || 1.2, audioDur + VO_TAIL_SEC).toFixed(3));
        voChanged += 1;
      } else {
        // 无旁白：不灌空静音；清掉 narrationFile，镜长保留
        scene.narrationFile = undefined;
        if (!scene.durationSec || scene.durationSec < 0.6) {
          scene.durationSec = 1.2;
        }
      }
    }
    props.captions = rebuildCaptions(props.scenes);
    writeFileSync(propsPath, JSON.stringify(props, null, 2), 'utf8');
    writeFileSync(join(dir, 'storyboard.json'), JSON.stringify(props, null, 2), 'utf8');
    setPipelineStep(projectId, 'voice', 'done', voChanged ? `重配 ${voChanged} 镜旁白` : '旁白未改');

    let surface: JobLook['surface'] = 'dark';
    try {
      const h = props.canvas.replace('#', '');
      if (h.length === 6) {
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        surface = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55 ? 'light' : 'dark';
      }
    } catch { /* keep dark */ }
    const look: JobLook = {
      canvas: props.canvas,
      ink: props.ink,
      accent: props.accent,
      muted: props.muted,
      highlight: props.accent,
      bar: props.accent,
      brandBg: props.brandBg || props.canvas,
      energy: 'remake',
      surface,
      motionNotes: note.slice(0, 120),
    };

    const propsStr = JSON.stringify(props, null, 2);
    const selectedScenesJson = JSON.stringify(
      indexes.map((i) => ({ index: i, ...props.scenes[i] })),
      null,
      2,
    );
    // Prefer previous film source so unselected beats stay put (surgical remake).
    let priorTsx = existsSync(join(dir, 'ActiveDirected.tsx'))
      ? readFileSync(join(dir, 'ActiveDirected.tsx'), 'utf8')
      : '';
    if (!priorTsx) {
      const seed = versions.find(isInitialVersion) || versions[0];
      if (seed?.rel && existsSync(join(dir, seed.rel, 'ActiveDirected.tsx'))) {
        priorTsx = readFileSync(join(dir, seed.rel, 'ActiveDirected.tsx'), 'utf8');
      }
    }

    const beatsTable = Boolean(extractConstArray(priorTsx, 'BEATS'));
    setPipelineStep(
      projectId,
      'build',
      'running',
      mode === 'copy'
        ? `只改文案 ${indexes.length} 镜`
        : beatsTable
          ? `只补丁 ${indexes.length} 镜 BEATS`
          : `只重画 ${indexes.length} 镜`,
    );
    const allSkillIds = props.skills.filter(isSkillName);
    // 再创作：硬门禁只盯 primary/support 角色，避开 chassis 堆叠
    const hardIds = allSkillIds.filter((id) => {
      if (id === 'remotion-video' || id === 'shot-composition' || id === 'animation-principles') return false;
      if (id === 'short-form-video' && allSkillIds.some((s) => s !== 'short-form-video' && s !== 'remotion-video')) {
        return false;
      }
      return true;
    }).slice(0, 3);
    const skillIds: typeof allSkillIds = hardIds.length
      ? (hardIds.includes('remotion-video' as typeof hardIds[number])
        ? hardIds
        : [...hardIds, 'remotion-video']).filter(isSkillName)
      : allSkillIds;
    let tsx = await remakeSelectedDirectedTsx(settings, {
      source: priorTsx,
      propsJson: propsStr,
      skillIds,
      contentLang,
      lookLine: [lookLockLine(look), contentLangLockLine(contentLang)].join('\n'),
      note,
      beatIndexes: indexes,
      selectedScenesJson,
      mode,
      scenes: props.scenes,
    });
    const sceneCount = Math.max(props.scenes?.length || 0, 1);
    const assetFiles = assetFilesFromProps(props.assets);
    let codeIssues = validateDirectedTsx(tsx, skillIds, contentLang, undefined, sceneCount, assetFiles);
    let skillGate = assertSkillsInTsx(skillIds, tsx, { hardIds });
    if (codeIssues.length || !skillGate.ok) {
      // BEATS 补丁路径禁止再走「整文件 fix」（否则又会整片重写）
      if (beatsTable || mode === 'copy') {
        const syntax = codeIssues.filter((i) => i.startsWith('syntax'));
        if (syntax.length) {
          throw new Error(`分镜改动语法未通过：${syntax.slice(0, 2).join('; ')}`);
        }
        // 非语法的 skill/风格门禁：分镜补丁下软放行，保住未选中镜
        codeIssues = [];
        skillGate = { ok: true, issues: [] };
      } else {
        tsx = await fixDirectedTsx(settings, {
          source: tsx,
          error: [
            ...codeIssues,
            ...skillGate.issues,
            `SURGICAL: only beats [${indexes.join(', ')}] may change; restore unselected sequences from prior film if you drifted.`,
          ].join('; '),
          propsJson: propsStr,
        });
        codeIssues = validateDirectedTsx(tsx, skillIds, contentLang, undefined, sceneCount, assetFiles);
        skillGate = assertSkillsInTsx(skillIds, tsx, { hardIds });
      }
    }
    // Soft-accept stickman contract（语法错误不可软放行）
    if ((codeIssues.length || !skillGate.ok)
      && skillIds.includes('stickman-animation')
      && /from\s+['"]\.\.\/stickman['"]/.test(tsx)
      && /<Stickman\b/.test(tsx)
      && /(Series|Sequence)/.test(tsx)
      && !codeIssues.some((i) => i.startsWith('syntax'))) {
      codeIssues = [];
      skillGate = { ok: true, issues: [] };
    }
    if (codeIssues.length || !skillGate.ok) {
      throw new Error(`画面生成未通过：${[...codeIssues, ...skillGate.issues].slice(0, 3).join('; ')}`);
    }

    // 视觉改动却几乎原样返回 → 视为失败，避免「任务成功但成片未变」
    if (mode !== 'copy' && priorTsx && tsx.replace(/\s+/g, '') === priorTsx.replace(/\s+/g, '')) {
      throw new Error('画面代码未产生有效改动，请把修改写得更具体后重试（例如：换成浅色小清新背景、强调色改为薄荷绿）');
    }

    tsx = repairUnsafeGoogleFonts(tsx);
    writeFileSync(join(dir, 'ActiveDirected.tsx'), tsx, 'utf8');
    writeSkillGateReport(dir, 'gate-skills.json', skillGate);
    setPipelineStep(projectId, 'build', 'done', 'ActiveDirected');

    const stillsDir = join(dir, 'stills');
    const finalMp4 = join(dir, 'final.mp4');
    const finalBefore = existsSync(finalMp4) ? statSync(finalMp4) : null;
    await withRemotionCodegenLock(async () => {
      installActiveComponent('directed', tsx);
      try {
        const maxAttempts = 3;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            await renderRemotionComposition({
              compositionId: 'GeneratedDirected',
              propsPath,
              outMp4: finalMp4,
              publicDir,
              stillsDir,
              scenes: props.scenes.map((s) => ({ durationSec: s.durationSec })),
              probeRes: probeResFor(props.aspect, props.quality === '720p' ? '720p' : '1080p'),
              phases: ['stills'],
              onPhase: (phase, detail) => setPipelineStep(projectId, phase === 'stills' ? 'stills' : 'encode', 'running', detail),
            });
            break;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            writeFileSync(join(dir, `remake-error-${attempt + 1}.txt`), msg, 'utf8');
            if (attempt >= maxAttempts - 1) throw err;
            tsx = repairUnsafeGoogleFonts(await fixDirectedTsx(settings, {
              source: tsx,
              error: `${msg}\nFIX: Series→Series.Sequence; keep props.canvas/ink. SURGICAL: only beats [${indexes.join(', ')}] may change — do not restyle other sequences.`,
              propsJson: propsStr,
            }));
            writeFileSync(join(dir, 'ActiveDirected.tsx'), tsx, 'utf8');
            installActiveComponent('directed', tsx);
          }
        }
        buildContactSheet(stillsDir, join(dir, 'contact-sheet.png'));
        const stillFiles = existsSync(stillsDir) ? readdirSync(stillsDir).filter((f) => f.endsWith('.png')) : [];
        setPipelineStep(projectId, 'stills', 'done', `${stillFiles.length} stills`);
        setPipelineStep(projectId, 'inspect', 'done', 'skills pass');
        await renderRemotionComposition({
          compositionId: 'GeneratedDirected',
          propsPath,
          outMp4: finalMp4,
          publicDir,
          stillsDir,
          scenes: props.scenes.map((s) => ({ durationSec: s.durationSec })),
          probeRes: probeResFor(props.aspect, props.quality === '720p' ? '720p' : '1080p'),
          phases: ['encode'],
          onPhase: (_phase, detail) => setPipelineStep(projectId, 'encode', 'running', detail),
        });
      } finally {
        try { restoreActiveFallback('directed'); } catch { /* ignore */ }
      }
    }, {
      onWaiting: (info) => {
        const detail = remotionQueueDetail(info);
        if (detail) setPipelineStep(projectId, 'encode', 'running', detail);
      },
    });

    const finalAfter = existsSync(finalMp4) ? statSync(finalMp4) : null;
    if (
      !finalAfter
      || (finalBefore
        && finalAfter.size === finalBefore.size
        && Math.abs(finalAfter.mtimeMs - finalBefore.mtimeMs) < 5)
    ) {
      throw new Error('导出完成但成片文件未更新（可能仍被占用）。请关闭预览后重试。');
    }

    const durationSec = Number(props.scenes.reduce((a, s) => a + (Number(s.durationSec) || 0), 0).toFixed(3));
    // 成功后再存「改过版本 n」（内容=本次新成片，不是重做前底稿）
    const live = store.getProject(projectId);
    let nextVersions = [...(live?.versions || versions)].filter((v) => !/^回退前/.test(v.label || ''));
    if (!nextVersions.some(isInitialVersion)) {
      // 兜底：极少数路径未在开头落初始版本
      const initial = await snapshotProjectVersion(dir, {
        label: labelInitial(lang),
        kind: 'initial',
        note: '首次成片',
        durationSec: Number(totalBefore.toFixed(2)),
      });
      nextVersions = [initial, ...nextVersions];
    }
    const remakeN = nextRemakeIndex(nextVersions);
    const remade = await snapshotProjectVersion(dir, {
      label: labelRemake(remakeN, lang),
      kind: 'remake',
      remakeIndex: remakeN,
      note: note.slice(0, 120),
      beatIndexes: indexes,
      durationSec,
    });
    nextVersions = [...nextVersions.filter((v) => v.id !== remade.id), remade].slice(-20);

    writeFileSync(
      join(dir, 'remake-log.json'),
      JSON.stringify({
        at: new Date().toISOString(),
        note,
        mode,
        beatIndexes: indexes,
        remakeVersionId: remade.id,
        remakeIndex: remakeN,
        surgical: true,
        finalBytes: finalAfter.size,
        finalMtime: finalAfter.mtime.toISOString(),
        canvas: props.canvas,
        accent: props.accent,
      }, null, 2),
      'utf8',
    );

    return finishPipeline(projectId, {
      durationSec,
      dir: project.dir,
      engine: project.engine || 'explainer-remotion',
      stylePack: project.stylePack || 'skill-directed',
      aspect: props.aspect,
      files: listFiles(dir),
      versions: nextVersions,
      currentVersionId: remade.id,
      posterUrl: undefined,
    })!;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 失败标 error 后返回项目，避免未捕获异常打崩 create-core 子进程（壳表现为闪退）
    const failed = failPipeline(projectId, msg);
    return failed || store.getProject(projectId) || project;
  }
}

export async function restoreProjectVersion(projectId: string, versionId: string): Promise<Project> {
  const project = store.getProject(projectId);
  if (!project?.dir) throw new Error('项目不存在');
  if (project.status === 'running' || project.status === 'queued') {
    throw new Error('出片中不能回退版本');
  }
  if (project.currentVersionId === versionId) {
    return project;
  }
  const dir = join(OUTPUTS_DIR, project.dir);
  const version = (project.versions || []).find((v) => v.id === versionId);
  if (!version) throw new Error('版本不存在');

  await restoreSnapshotToDir(dir, version.rel);

  const props = readJson<DirectedPropsFile>(join(dir, 'props.json'));
  const durationSec = props?.scenes?.reduce((a, s) => a + (Number(s.durationSec) || 0), 0) || project.durationSec;
  const versions = (project.versions || []).filter((v) => !/^回退前/.test(v.label || ''));

  return store.patchProject(projectId, {
    versions,
    currentVersionId: versionId,
    durationSec: Number(durationSec.toFixed(3)),
    files: listFiles(dir),
    status: 'ready',
    error: undefined,
    posterUrl: undefined,
  })!;
}
