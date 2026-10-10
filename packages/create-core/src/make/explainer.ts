import { writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { speak } from '../tts.ts';
import { listFiles, newProjectDir } from '../paths.ts';
import { renderRemotionComposition, type RemotionCompositionId } from '../engines/remotionBridge.ts';
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
  beatFor,
  inspectNarratedProps,
  planNarratedExplainer,
  resolveCamera,
  resolveTechnique,
  validateStoryboard,
  verifyTechniqueRender,
} from './narratedPlan.ts';
import {
  fixNarratedTsx,
  generateNarratedTsx,
  validateNarratedTsx,
} from './remotionCodegen.ts';
import { makeLaunchHard } from './launchHard.ts';
import { makeNextWordHard } from './nextWordHard.ts';
import {
  VO_TAIL_SEC,
  assertExplainerRuntimeBudget,
  assertTechniqueInTsx,
  buildContactSheet,
  estimateVoSec,
  writeSkillGateReport,
} from '../skills/hardPipeline.ts';
import { lookLockLine, normalizeLook } from './look.ts';
import type { Project, Settings, StylePack } from '../../../shared/src/index.ts';

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

async function makeLaunch(prompt: string, settings: Settings, projectId: string): Promise<Project> {
  // Hard launch-video pipeline (music-first). Legacy fill path removed.
  return makeLaunchHard(prompt, settings, projectId);
}

async function makeNarrated(prompt: string, settings: Settings, projectId: string): Promise<Project> {
  const STAGE_ORDER = ['problem', 'brand', 'solution', 'research', 'design', 'proof', 'end'] as const;
  type Stage = typeof STAGE_ORDER[number];

  setPipelineStep(projectId, 'plan', 'running', 'Agent: SceneSpec director loop');
  const plan = await planNarratedExplainer(prompt, settings);
  const boardCheck = validateStoryboard(plan);
  setPipelineStep(
    projectId,
    'plan',
    'done',
    `${plan.brandName} · ${plan.diagramRecipe}/${plan.presentationRecipe} · ${boardCheck.ok ? 'SceneSpec ok' : boardCheck.issues[0]}`,
  );

  setPipelineStep(projectId, 'brief', 'running', 'mapping plan → style-pack props');

  const defaults: Record<Stage, {
    title: string; accentWord?: string; subtitle?: string; promptText?: string; step?: number;
    cards?: { title: string; subtitle?: string; kind?: 'web' | 'pdf' | 'note' }[];
    slideTitle?: string; slideAccent?: string; proofLabel?: string; vo: string;
  }> = {
    problem: {
      title: '想法很多，片子还空着。',
      accentWord: '是不是很熟悉？',
      vo: '明天有个大会议……空白页正盯着你。是不是很熟悉？',
    },
    brand: {
      title: '给你一个主题。',
      accentWord: '一句话搭好整套片子。',
      subtitle: '从想法到成品演示',
      vo: '这就是 PageOn。它把你的想法变成成品片子。',
    },
    solution: {
      title: '输入一个主题',
      subtitle: '……或直接粘贴文档',
      promptText: plan.demoTopic || '为换电网络创业写一份路演',
      step: 1,
      vo: '第一步：输入主题，或贴进文档。',
    },
    research: {
      title: '检索、撰写，搭出大纲',
      step: 2,
      vo: '第二步：它检索资料、写好文案，并搭出带图和图表的幻灯片。',
      cards: plan.demoSources?.length
        ? plan.demoSources
        : [
          { title: '市场信号', subtitle: '网页来源', kind: 'web' },
          { title: '用户访谈纪要', subtitle: '网页来源', kind: 'web' },
          { title: 'brief.pdf', subtitle: '你的文档', kind: 'pdf' },
        ],
    },
    design: {
      title: '设计幻灯片',
      step: 3,
      slideTitle: plan.demoSlideTitle || '市场在变',
      slideAccent: plan.demoSlideAccent || '关键一击',
      vo: '第三步：想改样式？直接聊天就行，标题和图表马上跟上。',
    },
    proof: {
      title: '来自',
      accentWord: '120+',
      proofLabel: '来自 120+ 个国家的创作者',
      vo: '已有来自一百二十多个国家的创作者这样做片子。',
    },
    end: {
      title: 'PageOn',
      vo: 'PageOn 点 A I。用在你的下一套片子上试试。',
    },
  };

  type BuiltScene = {
    stage: Stage;
    technique?: string;
    recipeId?: string;
    visualIntent?: string;
    keyMotion?: string;
    transition?: string;
    vo: string;
    title: string;
    accentWord?: string;
    subtitle?: string;
    promptText?: string;
    step?: number;
    cards?: { title: string; subtitle?: string; kind?: 'web' | 'pdf' | 'note' }[];
    slideTitle?: string;
    slideAccent?: string;
    slideBullets?: string[];
    thumbs?: { title: string; sub?: string; tone?: string; kind?: 'cover' | 'bullets' | 'chart' | 'customers'; bullets?: string[] }[];
    outlineLines?: string[];
    chatUser?: string;
    chatReply?: string;
    proofLabel?: string;
    brandName?: string;
    cta?: string;
    variant?: number;
    zoomFrom?: number;
    enterFrames?: number;
    durationSec: number;
    narrationFile?: string;
  };

  const vo = plan.voByStage || ({} as typeof plan.voByStage);
  const on = plan.onScreen || ({} as typeof plan.onScreen);
  const variant = Math.min(2, Math.max(0, Number(plan.variant) || 0));
  const tones = ['#3F6B4B', '#5B4CDB', '#2F6B5A', '#E8A45A'];
  const kinds = ['cover', 'bullets', 'chart', 'customers'] as const;
  const bullets = (plan.demoBullets || []).filter(Boolean);
  const outlineLines = plan.outlineLines?.length
    ? plan.outlineLines.slice(0, 5)
    : (bullets.length ? bullets : ['问题与机会', '方案一句话', '证明点', '下一步']).slice(0, 4);
  const chatUser = plan.chatUser || '把标题加粗，再加一张图表';
  const chatReply = plan.chatReply || '好了，版式已更新。';
  const demoThumbs = (() => {
    const cover = (plan.demoSlideTitle || plan.demoTopic || '新品路演').slice(0, 22);
    const b0 = (bullets[0] || '关键洞察').slice(0, 24);
    const b1 = (bullets[1] || '增长信号').slice(0, 24);
    const b2 = (bullets[2] || '谁在买单').slice(0, 24);
    return [
      { title: cover, sub: (plan.demoSlideAccent || '封面').slice(0, 20), tone: tones[0], kind: kinds[0] as 'cover' },
      { title: b0, sub: '要点', tone: tones[1], kind: kinds[1] as 'bullets', bullets: bullets.slice(0, 3) },
      { title: b1, sub: '数据', tone: tones[2], kind: kinds[2] as 'chart' },
      { title: b2, sub: '人群', tone: tones[3], kind: kinds[3] as 'customers' },
    ];
  })();

  let scenes: BuiltScene[] = STAGE_ORDER.map((stage) => {
    const def = defaults[stage];
    const beat = beatFor(stage, plan);
    const stageVo = (beat?.vo || vo[stage] || def.vo).trim();
    const technique = resolveTechnique(stage, plan);
    const cam = resolveCamera(stage, plan);
    let recipeId = beat?.recipeId;
    if (stage === 'research') recipeId = plan.diagramRecipe;
    else if (stage === 'design') {
      // chat_edit always split; chart_slide always hero
      recipeId = technique === 'chat_edit' ? 'split_chat' : 'hero_slide';
    } else if (stage === 'brand') {
      recipeId = technique === 'chart_slide' ? 'hero_slide' : 'deck_thumbs';
    } else recipeId = recipeId || technique;
    const base = {
      technique,
      recipeId,
      visualIntent: beat?.visualIntent,
      keyMotion: beat?.keyMotion,
      transition: beat?.transition,
      variant,
      zoomFrom: cam.zoomFrom,
      enterFrames: cam.enterFrames,
      durationSec: 3 as number,
    };

    if (stage === 'problem') {
      return {
        stage, vo: stageVo, title: on.problemHook || def.title,
        accentWord: on.problemSticker || def.accentWord,
        thumbs: demoThumbs, ...base,
      };
    }
    if (stage === 'brand') {
      return {
        stage, vo: stageVo, title: def.title,
        accentWord: on.brandLine || '一句话搭好整套片子。',
        subtitle: def.subtitle,
        brandName: plan.brandName,
        thumbs: demoThumbs,
        slideTitle: plan.demoSlideTitle,
        slideAccent: plan.demoSlideAccent,
        slideBullets: bullets.slice(0, 3),
        ...base,
      };
    }
    if (stage === 'solution') {
      return {
        stage, vo: stageVo, title: def.title, subtitle: def.subtitle,
        promptText: on.promptText || plan.demoTopic || def.promptText,
        cards: plan.demoSources?.length ? plan.demoSources : def.cards,
        step: 1, ...base,
      };
    }
    if (stage === 'research') {
      return {
        stage, vo: stageVo,
        title: on.researchTitle || def.title,
        step: 2,
        cards: plan.demoSources?.length ? plan.demoSources : def.cards,
        outlineLines,
        ...base,
      };
    }
    if (stage === 'design') {
      return {
        stage, vo: stageVo,
        title: on.designTitle || def.title,
        step: 3,
        slideTitle: plan.demoSlideTitle || def.slideTitle,
        slideAccent: plan.demoSlideAccent || def.slideAccent,
        slideBullets: bullets.length ? bullets.slice(0, 3) : undefined,
        chatUser, chatReply,
        ...base,
      };
    }
    if (stage === 'proof') {
      return {
        stage, vo: stageVo,
        title: def.title,
        accentWord: plan.proofStat || def.accentWord,
        proofLabel: plan.proofLabel || def.proofLabel,
        ...base,
      };
    }
    const ctaStr = typeof plan.cta === 'string' ? plan.cta : 'pageon.ai';
    return {
      stage, vo: stageVo, title: plan.brandName || def.title,
      brandName: plan.brandName,
      cta: ctaStr,
      subtitle: on.endTagline || plan.tagline || '用在你的下一套片子上。',
      accentWord: on.endTagline || plan.tagline,
      ...base,
    };
  });

  setPipelineStep(
    projectId,
    'brief',
    'running',
    `${scenes.map((s) => `${s.technique}/${s.recipeId}`).join('→')}`,
  );

  const { dir, dirName } = newProjectDir('narrated', plan.brandName || prompt);
  const publicDir = join(dir, 'public');
  mkdirSync(publicDir, { recursive: true });
  store.patchProject(projectId, { title: plan.brandName || prompt.slice(0, 28), dir: dirName });

  writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan, null, 2), 'utf8');
  writeFileSync(
    join(dir, 'script.md'),
    `# ${plan.brandName}\n\n${plan.notes || ''}\n\nvariant=${variant}\ndemo=${plan.demoTopic || ''}\ndiagram=${plan.diagramRecipe}\npresentation=${plan.presentationRecipe}\ntechniques=${scenes.map((s) => `${s.technique}/${s.recipeId}`).join('→')}\n\n${scenes.map((s, i) => `${i + 1}. [${s.stage}/${s.technique}/${s.recipeId}] ${s.vo}\n   intent: ${s.visualIntent || '-'}\n   motion: ${s.keyMotion || '-'}`).join('\n')}\n`,
    'utf8',
  );
  setPipelineStep(projectId, 'brief', 'done', `${plan.brandName} · ${String(plan.demoTopic || 'brief').slice(0, 24)}`);

  async function synthesizeVo(label: string) {
    setPipelineStep(projectId, 'voice', 'running', label);
    let t = 0;
    const captions2: { from: number; to: number; text: string }[] = [];
    const concatList: string[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const line = scenes[i].vo;
      let audioDur = 0;
      let narrationFile: string | undefined;
      if (line) {
        narrationFile = `vo-${i}.mp3`;
        const clip = join(publicDir, narrationFile);
        await speak(line, clip, settings);
        audioDur = probeAudioDuration(clip);
        concatList.push(clip);
        setPipelineStep(projectId, 'voice', 'running', `TTS ${i + 1}/${scenes.length} · ${audioDur.toFixed(1)}s`);
      }
      // VO-first: picture = probed TTS + tiny tail. Never pad up to estimateVoSec
      // (char-budget estimate is slower than real TTS → long silence between lines).
      const durationSec = Number(
        (audioDur > 0
          ? audioDur + VO_TAIL_SEC
          : Math.max(1.8, line ? estimateVoSec(line) : 1.8)
        ).toFixed(3),
      );
      scenes[i] = { ...scenes[i], durationSec, narrationFile };
      captions2.push({
        from: t + 0.06,
        to: t + Math.max(0.9, audioDur > 0 ? audioDur : durationSec - 0.25),
        text: wrapCaption(line || scenes[i].title),
      });
      t += durationSec;
    }

    if (concatList.length) {
      const listFile = join(dir, 'concat.txt');
      writeFileSync(listFile, concatList.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'), 'utf8');
      const fullNarr = join(dir, 'narration.mp3');
      const r = spawnSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', fullNarr], {
        windowsHide: true,
      });
      if (r.status !== 0 && concatList[0]) copyFileSync(concatList[0], fullNarr);
    }

    writeFileSync(join(dir, 'captions.srt'), toSrt(captions2), 'utf8');
    const audioSum = scenes.reduce(
      (a, s) => a + (s.narrationFile ? probeAudioDuration(join(publicDir, s.narrationFile)) : 0),
      0,
    );
    setPipelineStep(projectId, 'voice', 'done', `aligned · VO ${audioSum.toFixed(1)}s / picture ${t.toFixed(1)}s`);
    return captions2;
  }

  let captions2 = await synthesizeVo('per-scene TTS (VO-first)');

  // explainer-video: runtime budget gate (how-share + VO pacing)
  const budget = assertExplainerRuntimeBudget(scenes);
  writeSkillGateReport(dir, 'gate-vo-budget.json', budget);
  if (!budget.ok) {
    setPipelineStep(projectId, 'voice', 'done', `budget notes: ${budget.issues[0]}`);
  }

  setPipelineStep(projectId, 'brief', 'running', 'look from prompt');
  const look = plan.look || normalizeLook(plan, 'narrated');
  const styleLock = {
    canvas: look.canvas,
    ink: look.ink,
    accent: look.accent,
    muted: look.muted,
    brandBg: look.brandBg,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    typeScale: { hero: 96, title: 52, body: 28 },
    energy: look.energy,
    surface: look.surface,
    motionNotes: look.motionNotes,
  };
  writeSkillGateReport(dir, 'style-lock.json', styleLock);
  setPipelineStep(projectId, 'brief', 'done', `look · ${look.surface} ${look.accent}`);

  const buildProps = () => ({
    brandName: plan.brandName || prompt.slice(0, 12) || 'Brand',
    canvas: styleLock.canvas,
    ink: styleLock.ink,
    accent: styleLock.accent,
    muted: styleLock.muted,
    brandBg: styleLock.brandBg,
    styleLock,
    scenes,
    captions: captions2,
  });

  let props = buildProps();
  writeFileSync(join(dir, 'storyboard.json'), JSON.stringify(props, null, 2), 'utf8');
  writeFileSync(join(dir, 'props.json'), JSON.stringify(props, null, 2), 'utf8');
  writeFileSync(join(dir, 'storyboard-beats.json'), JSON.stringify(plan.storyboard || [], null, 2), 'utf8');

  const stillsDir = join(dir, 'stills');
  const finalMp4 = join(dir, 'final.mp4');
  const propsPath = join(dir, 'props.json');
  let propsStr = JSON.stringify(props, null, 2);

  // === HARD build: codegen + technique static gate (must pass before encode) ===
  setPipelineStep(projectId, 'build', 'running', 'LLM ActiveNarrated.tsx');
  let tsx = await generateNarratedTsx(settings, {
    prompt,
    propsJson: propsStr,
    storyboardJson: JSON.stringify(plan.storyboard || [], null, 2),
    lookLine: lookLockLine(look),
  });
  let issues = validateNarratedTsx(tsx);
  let techGate = assertTechniqueInTsx(tsx, scenes);
  if (issues.length || !techGate.ok) {
    setPipelineStep(projectId, 'build', 'running', `technique gate: ${(techGate.issues[0] || issues[0])}`);
    tsx = await fixNarratedTsx(settings, {
      source: tsx,
      error: [...issues, ...techGate.issues].join('; '),
      propsJson: propsStr,
    });
    issues = validateNarratedTsx(tsx);
    techGate = assertTechniqueInTsx(tsx, scenes);
  }
  writeFileSync(join(dir, 'ActiveNarrated.tsx'), tsx, 'utf8');
  writeSkillGateReport(dir, 'gate-technique.json', techGate);
  if (!techGate.ok) {
    // one more forced fix — hard pipeline refuses silent soft pass
    tsx = await fixNarratedTsx(settings, {
      source: tsx,
      error: `HARD TECHNIQUE GATE FAILED: ${techGate.issues.join('; ')}. Implement missing skill cores in TSX.`,
      propsJson: propsStr,
    });
    techGate = assertTechniqueInTsx(tsx, scenes);
    writeFileSync(join(dir, 'ActiveNarrated.tsx'), tsx, 'utf8');
    writeSkillGateReport(dir, 'gate-technique.json', techGate);
  }
  setPipelineStep(projectId, 'build', 'done', techGate.ok ? 'ActiveNarrated · techniques ok' : `techniques soft: ${techGate.issues[0]}`);

  let compositionId: RemotionCompositionId = 'GeneratedNarrated';
  let usedCodegen = true;

  try {
    if (!techGate.ok) {
      throw new Error(`explainer hard technique gate: ${techGate.issues.join('; ')}`);
    }
    await withRemotionCodegenLock(async () => {
      installActiveComponent('narrated', tsx);
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await renderRemotionComposition({
            compositionId: 'GeneratedNarrated',
            propsPath,
            outMp4: finalMp4,
            publicDir,
            stillsDir,
            scenes,
            phases: ['stills'],
            onPhase: (phase, detail) => setPipelineStep(projectId, phase, 'running', detail),
          });
          setPipelineStep(projectId, 'stills', 'done', `codegen stills · attempt ${attempt + 1}`);
          break;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          writeFileSync(join(dir, `codegen-error-${attempt + 1}.txt`), msg, 'utf8');
          if (attempt === 1) throw err;
          setPipelineStep(projectId, 'build', 'running', 'fixing ActiveNarrated.tsx');
          tsx = await fixNarratedTsx(settings, { source: tsx, error: msg, propsJson: propsStr });
          techGate = assertTechniqueInTsx(tsx, scenes);
          writeFileSync(join(dir, 'ActiveNarrated.tsx'), tsx, 'utf8');
          installActiveComponent('narrated', tsx);
        }
      }

      buildContactSheet(stillsDir, join(dir, 'contact-sheet.png'));
      setPipelineStep(projectId, 'inspect', 'running', 'edit/polish skill gates');
      const stillFiles = existsSync(stillsDir)
        ? readdirSync(stillsDir).filter((f) => f.endsWith('.png')).map((f) => join(stillsDir, f))
        : [];
      const report = inspectNarratedProps(props, stillFiles);
      const verify = verifyTechniqueRender(props, stillFiles);
      const budget2 = assertExplainerRuntimeBudget(scenes);
      const merged = {
        ok: report.ok && verify.ok && techGate.ok && budget2.ok && stillFiles.length >= 4,
        issues: [...report.issues, ...verify.issues, ...techGate.issues, ...budget2.issues],
        mode: 'explainer-hard',
        howShare: budget2.howShare,
        storyboard: plan.storyboard,
      };
      writeSkillGateReport(dir, 'inspect-1.json', merged);
      setPipelineStep(
        projectId,
        'inspect',
        'done',
        merged.ok ? 'pass · hard explainer gates' : merged.issues.slice(0, 2).join('; '),
      );

      await renderRemotionComposition({
        compositionId: 'GeneratedNarrated',
        propsPath,
        outMp4: finalMp4,
        publicDir,
        stillsDir,
        scenes,
        phases: ['encode'],
        onPhase: (phase, detail) => setPipelineStep(projectId, phase, 'running', detail),
      });
    }, {
      onWaiting: (info) => {
        const detail = remotionQueueDetail(info);
        if (detail) setPipelineStep(projectId, 'encode', 'running', detail);
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    writeFileSync(join(dir, 'codegen-fallback.txt'), msg, 'utf8');
    // Hard pipeline: do NOT silently ship stock template as "skill success"
    usedCodegen = false;
    compositionId = 'NarratedExplainer';
    restoreActiveFallback('narrated');
    setPipelineStep(projectId, 'inspect', 'done', `HARD FAIL → emergency stock: ${msg.slice(0, 80)}`);
    await renderRemotionComposition({
      compositionId: 'NarratedExplainer',
      propsPath,
      outMp4: finalMp4,
      publicDir,
      stillsDir,
      scenes,
      phases: ['stills', 'encode'],
      onPhase: (phase, detail) => setPipelineStep(projectId, phase, 'running', detail),
    });
  } finally {
    try { restoreActiveFallback('narrated'); } catch { /* ignore */ }
  }

  writeSkillGateReport(dir, 'render-mode.json', {
    compositionId,
    usedCodegen,
    hardPipeline: 'explainer-video',
    techniqueGate: techGate,
    voBudget: budget,
  });

  const done = finishPipeline(projectId, {
    title: plan.brandName || prompt.slice(0, 28),
    kind: 'explainer',
    engine: 'explainer-remotion',
    stylePack: 'narrated-explainer',
    dir: dirName,
    durationSec: Math.round(scenes.reduce((a, s) => a + s.durationSec, 0)),
    files: listFiles(dir),
  });
  return done!;
}

export async function makeExplainer(
  prompt: string,
  settings: Settings,
  stylePack: StylePack = 'narrated-explainer',
  projectId: string,
): Promise<Project> {
  if (stylePack === 'launch-showreel') return makeLaunch(prompt, settings, projectId);
  if (stylePack === 'next-word-loop') return makeNextWordHard(prompt, settings, projectId);
  return makeNarrated(prompt, settings, projectId);
}
