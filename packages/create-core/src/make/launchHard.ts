/**
 * launch-video HARD pipeline (VO-aligned):
 * copy+per-beat VO ? TTS ? lock picture to VO ? dropSec=reveal start ? bed ? codegen ? mix
 */
import { writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chatJson } from '../llm.ts';
import { speak } from '../tts.ts';
import { listFiles, newProjectDir } from '../paths.ts';
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
import {
  assertLaunchAudioFirst,
  buildContactSheet,
  concatMp3List,
  mixLaunchAudio,
  padAudioToDuration,
  synthesizeLaunchBed,
  writeSkillGateReport,
} from '../skills/hardPipeline.ts';
import {
  fixLaunchTsx,
  generateLaunchTsx,
  validateLaunchTsx,
} from './remotionCodegen.ts';
import { lookBrief, lookLockLine, normalizeLook } from './look.ts';
import type { Project, Settings } from '../../../shared/src/index.ts';

function wrapCaption(vo: string) {
  const raw = vo.replace(/\s+/g, ' ').trim();
  if (raw.length <= 42) return raw;
  return `${raw.slice(0, 42)}\n${raw.slice(42, 84)}`;
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

type Scene = {
  kind: 'hook' | 'tease' | 'reveal' | 'feature' | 'end';
  durationSec: number;
  line1?: string;
  line2?: string;
  brandName?: string;
  tagline?: string;
  cta?: string;
  cards?: { title: string; subtitle: string }[];
  vo?: string;
  narrationFile?: string;
};

/** Visual floor only when TTS is missing/tiny � never inflate past real speech + tail */
const MIN_SLOT: Record<Scene['kind'], number> = {
  hook: 1.6,
  tease: 1.6,
  reveal: 1.8,
  feature: 1.5,
  end: 2.0,
};

export async function makeLaunchHard(prompt: string, settings: Settings, projectId: string): Promise<Project> {
  const seed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const { dir, dirName } = newProjectDir('launch', prompt);
  const publicDir = join(dir, 'public');
  mkdirSync(publicDir, { recursive: true });

  // 1) Arc copy � EVERY beat gets its own short Chinese VO (no mid-film silence)
  setPipelineStep(projectId, 'plan', 'running', 'launch arc + per-beat VO');
  const pack = await chatJson<{
    brandName: string;
    tagline: string;
    cta: string;
    hookLine1: string;
    hookLine2: string;
    teaseLine: string;
    revealLabel: string;
    features: { title: string; keyword: string; vo: string }[];
    voHook: string;
    voTease: string;
    voReveal: string;
    voEnd: string;
    canvas?: string;
    ink?: string;
    accent?: string;
    highlight?: string;
    muted?: string;
    brandBg?: string;
    energy?: string;
    surface?: 'dark' | 'light';
    motionNotes?: string;
  }>(settings, `You fill a launch-video HARD arc for Remotion.
Arc: hook ? tease ? reveal ? 4 features ? end.
CRITICAL VO RULES:
- EVERY beat has its own ???? VO line (8�18 Chinese chars). No empty VO.
- features[i].vo is ONE short line for THAT feature only � do NOT pack all 4 into one sentence.
- On-screen UI English; VO Chinese.
${lookBrief('launch')}
Seed ${seed}. JSON only.`, `Brief:
${prompt}

Return exactly:
{
  "brandName":"",
  "tagline":"",
  "cta":"brand.app",
  "hookLine1":"",
  "hookLine2":"",
  "teaseLine":"",
  "revealLabel":"",
  "features":[
    {"title":"","keyword":"","vo":""},
    {"title":"","keyword":"","vo":""},
    {"title":"","keyword":"","vo":""},
    {"title":"","keyword":"","vo":""}
  ],
  "voHook":"",
  "voTease":"",
  "voReveal":"",
  "voEnd":"",
  "canvas":"",
  "ink":"",
  "accent":"",
  "highlight":"",
  "muted":"",
  "brandBg":"",
  "energy":"",
  "surface":"dark",
  "motionNotes":""
}`, 0.72);

  const look = normalizeLook(pack, 'launch');
  store.patchProject(projectId, { title: pack.brandName || prompt.slice(0, 28), dir: dirName });

  const feats = (pack.features || []).slice(0, 4);
  while (feats.length < 4) {
    feats.push({ title: `Benefit ${feats.length + 1}`, keyword: 'Ship', vo: `??${feats.length + 1}?????` });
  }
  for (let i = 0; i < feats.length; i++) {
    if (!feats[i].vo?.trim()) feats[i].vo = `${feats[i].keyword || '??'}?????`;
  }

  let scenes: Scene[] = [
    {
      kind: 'hook', durationSec: MIN_SLOT.hook,
      line1: pack.hookLine1, line2: pack.hookLine2,
      vo: (pack.voHook || '????????').trim(),
    },
    {
      kind: 'tease', durationSec: MIN_SLOT.tease,
      line1: pack.teaseLine || pack.hookLine2,
      vo: (pack.voTease || '??????????').trim(),
    },
    {
      kind: 'reveal', durationSec: MIN_SLOT.reveal,
      brandName: pack.brandName, line1: pack.revealLabel || pack.brandName,
      vo: (pack.voReveal || `${pack.brandName || 'Brand'}??????`).trim(),
    },
    ...feats.map((f) => ({
      kind: 'feature' as const,
      durationSec: MIN_SLOT.feature,
      line1: f.keyword,
      line2: f.title,
      cards: [{ title: f.title, subtitle: f.keyword }],
      vo: f.vo.trim(),
    })),
    {
      kind: 'end', durationSec: MIN_SLOT.end,
      brandName: pack.brandName, tagline: pack.tagline, cta: pack.cta,
      vo: (pack.voEnd || `${pack.brandName || 'Brand'}??????`).trim(),
    },
  ];

  writeFileSync(join(dir, 'plan.json'), JSON.stringify({ seed, pack, scenesDraft: scenes }, null, 2), 'utf8');
  setPipelineStep(projectId, 'plan', 'done', `${pack.brandName} � ${scenes.length} VO beats`);
  setPipelineStep(projectId, 'brief', 'done', 'per-beat VO locked');

  // 2) TTS every scene ? picture duration owned by VO (continuous speech)
  setPipelineStep(projectId, 'voice', 'running', 'TTS per-beat (no silent gaps)');
  const captions: { from: number; to: number; text: string }[] = [];
  let t = 0;
  for (let i = 0; i < scenes.length; i++) {
    const line = (scenes[i].vo || '').trim();
    if (!line) throw new Error(`launch VO missing on scene ${i} (${scenes[i].kind})`);
    const narrationFile = `vo-${i}.mp3`;
    const clip = join(publicDir, narrationFile);
    await speak(line, clip, settings);
    const audioDur = probeAudioDuration(clip);
    // Tiny breath only � MIN_SLOT is a floor for visual beats, not dead air after short VO
    const durationSec = Number(Math.max(MIN_SLOT[scenes[i].kind], audioDur + 0.12).toFixed(3));
    scenes[i] = { ...scenes[i], durationSec, narrationFile, vo: line };
    captions.push({
      from: t + 0.04,
      to: t + Math.max(0.7, audioDur),
      text: wrapCaption(line),
    });
    t += durationSec;
    setPipelineStep(projectId, 'voice', 'running', `TTS ${i + 1}/${scenes.length} � ${audioDur.toFixed(1)}s`);
  }

  // 3) dropSec = reveal start AFTER VO durations locked (picture ? music align)
  let dropSec = 0;
  for (const s of scenes) {
    if (s.kind === 'reveal') break;
    dropSec += s.durationSec;
  }
  dropSec = Number(dropSec.toFixed(3));
  const totalSec = Number(scenes.reduce((a, s) => a + s.durationSec, 0).toFixed(3));

  const bedFile = 'launch-bed.mp3';
  const bedAbs = join(publicDir, bedFile);
  const music = synthesizeLaunchBed(bedAbs, Math.max(totalSec + 0.5, dropSec + 4), 120, dropSec);
  writeSkillGateReport(dir, 'music-plan.json', { ...music, dropSec, totalSec, note: 'bed synthesized after VO lock' });

  // 4) Continuous VO track: each clip padded to exact scene length (no mid gaps)
  const padded: string[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const src = join(publicDir, scenes[i].narrationFile!);
    const padOut = join(publicDir, `vo-pad-${i}.mp3`);
    padAudioToDuration(src, padOut, scenes[i].durationSec);
    padded.push(padOut);
  }
  const fullNarr = join(dir, 'narration-vo.mp3');
  concatMp3List(padded, join(dir, 'concat-vo.txt'), fullNarr);
  mixLaunchAudio({ bed: bedAbs, narration: fullNarr, out: join(dir, 'narration.mp3') });
  writeFileSync(join(dir, 'captions.srt'), toSrt(captions), 'utf8');
  writeSkillGateReport(dir, 'vo-timeline.json', {
    dropSec,
    totalSec,
    scenes: scenes.map((s) => ({ kind: s.kind, durationSec: s.durationSec, vo: s.vo, file: s.narrationFile })),
  });
  setPipelineStep(projectId, 'voice', 'done', `${scenes.length} VO continuous · ${totalSec.toFixed(1)}s · drop@${dropSec}s`);

  const props = {
    brandName: pack.brandName || 'Brand',
    tagline: pack.tagline,
    canvas: look.canvas,
    ink: look.ink,
    accent: look.accent,
    highlight: look.highlight,
    look,
    dropSec,
    musicFile: bedFile,
    beats: music.beats,
    scenes,
    captions,
  };
  writeFileSync(join(dir, 'props.json'), JSON.stringify(props, null, 2), 'utf8');
  writeFileSync(join(dir, 'storyboard.json'), JSON.stringify(props, null, 2), 'utf8');
  writeFileSync(
    join(dir, 'script.md'),
    `# ${pack.brandName} Launch (VO-aligned)\n\ndrop@${dropSec}s total=${totalSec}s\n\n${scenes.map((s, i) => `${i + 1}. [${s.kind} ${s.durationSec}s] ${s.vo}`).join('\n')}\n`,
    'utf8',
  );

  const propsStr = JSON.stringify(props, null, 2);
  const stillsDir = join(dir, 'stills');
  const finalMp4 = join(dir, 'final.mp4');
  const propsPath = join(dir, 'props.json');

  setPipelineStep(projectId, 'build', 'running', 'LLM ActiveLaunch.tsx (VO+drop synced)');
  let tsx = await generateLaunchTsx(settings, { prompt, propsJson: propsStr, lookLine: lookLockLine(look) });
  let codeIssues = validateLaunchTsx(tsx);
  if (codeIssues.length) {
    tsx = await fixLaunchTsx(settings, { source: tsx, error: codeIssues.join('; '), propsJson: propsStr });
    codeIssues = validateLaunchTsx(tsx);
  }
  let audioGate = assertLaunchAudioFirst({ ...music, dropSec }, tsx);
  if (!audioGate.ok) {
    tsx = await fixLaunchTsx(settings, {
      source: tsx,
      error: `HARD GATE: ${audioGate.issues.join('; ')}. musicFile + reveal snap at dropSec=${dropSec}. Each scene.narrationFile plays at sequence start � key motion in first 40% while VO speaks.`,
      propsJson: propsStr,
    });
    audioGate = assertLaunchAudioFirst({ ...music, dropSec }, tsx);
  }
  writeFileSync(join(dir, 'ActiveLaunch.tsx'), tsx, 'utf8');
  writeSkillGateReport(dir, 'gate-audio-first.json', audioGate);
  setPipelineStep(projectId, 'build', 'done', audioGate.ok ? 'ActiveLaunch � VO+drop wired' : `soft: ${audioGate.issues[0]}`);

  let usedCodegen = true;
  try {
    await withRemotionCodegenLock(async () => {
      installActiveComponent('launch', tsx);
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await renderRemotionComposition({
            compositionId: 'GeneratedLaunch',
            propsPath,
            outMp4: finalMp4,
            publicDir,
            stillsDir,
            scenes,
            phases: ['stills'],
            onPhase: (phase, detail) => setPipelineStep(projectId, phase === 'stills' ? 'stills' : 'encode', 'running', detail),
          });
          break;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          writeFileSync(join(dir, `codegen-error-${attempt + 1}.txt`), msg, 'utf8');
          if (attempt === 1) throw err;
          tsx = await fixLaunchTsx(settings, { source: tsx, error: msg, propsJson: propsStr });
          writeFileSync(join(dir, 'ActiveLaunch.tsx'), tsx, 'utf8');
          installActiveComponent('launch', tsx);
        }
      }
      setPipelineStep(projectId, 'stills', 'done', 'codegen stills');
      buildContactSheet(stillsDir, join(dir, 'contact-sheet.png'));

      const stillFiles = existsSync(stillsDir) ? readdirSync(stillsDir).filter((f) => f.endsWith('.png')) : [];
      const issues = [...audioGate.issues];
      if (stillFiles.length < 4) issues.push(`too few stills (${stillFiles.length})`);
      if (scenes.some((s) => !s.narrationFile)) issues.push('scene missing narrationFile � VO gap');
      const gate = { ok: issues.length === 0, issues, mode: 'launch-hard-vo', dropSec };
      writeSkillGateReport(dir, 'inspect-1.json', gate);
      setPipelineStep(projectId, 'inspect', 'done', gate.ok ? 'pass � VO continuous + drop' : issues.slice(0, 2).join('; '));

      await renderRemotionComposition({
        compositionId: 'GeneratedLaunch',
        propsPath,
        outMp4: finalMp4,
        publicDir,
        stillsDir,
        scenes,
        phases: ['encode'],
        onPhase: (phase, detail) => setPipelineStep(projectId, 'encode', 'running', detail),
      });
    }, {
      onWaiting: (info) => {
        const detail = remotionQueueDetail(info);
        if (detail) setPipelineStep(projectId, 'encode', 'running', detail);
      },
    });
  } catch (err) {
    usedCodegen = false;
    writeFileSync(join(dir, 'codegen-fallback.txt'), err instanceof Error ? err.message : String(err), 'utf8');
    restoreActiveFallback('launch');
    throw err instanceof Error ? err : new Error(String(err));
  } finally {
    try { restoreActiveFallback('launch'); } catch { /* ignore */ }
  }

  writeSkillGateReport(dir, 'render-mode.json', {
    compositionId: 'GeneratedLaunch',
    usedCodegen,
    hardPipeline: 'launch-video',
    dropSec,
    voBeats: scenes.length,
  });

  return finishPipeline(projectId, {
    title: pack.brandName || prompt.slice(0, 28),
    kind: 'promo',
    engine: 'explainer-remotion',
    stylePack: 'launch-showreel',
    dir: dirName,
    durationSec: Math.round(totalSec),
    files: listFiles(dir),
  })!;
}
