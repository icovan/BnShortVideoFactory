/**
 * next-word-loop HARD pipeline (same as Launch/Narrated):
 * LLM copy → TTS lock → LLM ActiveNextWord.tsx → GeneratedNextWord, stock NextWordLoop fallback
 */
import { writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
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
import { VO_TAIL_SEC, buildContactSheet, writeSkillGateReport } from '../skills/hardPipeline.ts';
import {
  fixNextWordTsx,
  generateNextWordTsx,
  validateNextWordTsx,
} from './remotionCodegen.ts';
import { lookBrief, lookLockLine, normalizeLook } from './look.ts';
import type { Project, Settings } from '../../../shared/src/index.ts';

type SceneKind = 'hook' | 'type' | 'read' | 'odds' | 'spin' | 'add' | 'loop';

type Scene = {
  kind: SceneKind;
  durationSec: number;
  headline?: string;
  line?: string;
  vo?: string;
  narrationFile?: string;
  promptBubble?: string;
  tokens?: string[];
  writingText?: string;
  candidates?: { word: string; pct: number }[];
  winner?: string;
};

const MIN_SLOT: Record<SceneKind, number> = {
  hook: 2.2,
  type: 2.0,
  read: 2.4,
  odds: 2.4,
  spin: 2.6,
  add: 2.2,
  loop: 2.4,
};

const STOCK_ACTIVE = `export { NextWordLoop as ActiveNextWord } from '../NextWordLoop';\n`;

function wrapCaption(vo: string) {
  const raw = vo.replace(/\s+/g, ' ').trim();
  if (raw.length <= 16) return raw;
  const punct = [...raw.matchAll(/[，。！？、；]/g)].map((m) => m.index ?? -1).filter((i) => i >= 8 && i < raw.length - 2);
  const cut = punct[0];
  if (cut != null) return `${raw.slice(0, cut + 1)}\n${raw.slice(cut + 1)}`;
  const mid = Math.ceil(raw.length / 2);
  return `${raw.slice(0, mid)}\n${raw.slice(mid)}`;
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

function normalizeCandidates(raw: { word: string; pct: number }[] | undefined, fallback: { word: string; pct: number }[]) {
  const list = (raw || []).slice(0, 6).filter((c) => c.word?.trim());
  if (list.length < 2) return fallback;
  const sum = list.reduce((a, c) => a + c.pct, 0) || 1;
  return list.map((c) => ({ word: c.word.trim(), pct: Math.round((c.pct / sum) * 100) }));
}

export async function makeNextWordHard(prompt: string, settings: Settings, projectId: string): Promise<Project> {
  const seed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const { dir, dirName } = newProjectDir('next-word', prompt);
  const publicDir = join(dir, 'public');
  mkdirSync(publicDir, { recursive: true });

  setPipelineStep(projectId, 'plan', 'running', 'next-word arc + VO');
  const pack = await chatJson<{
    demoQuestion: string;
    partialWriting: string;
    writingWithWinner: string;
    tokens: string[];
    oddsCandidates: { word: string; pct: number }[];
    spinWinner: string;
    headlineHook: string;
    headlineRead: string;
    headlineOdds: string;
    headlineSpin: string;
    headlineAdd: string;
    headlineLoop: string;
    lineRead: string;
    lineSpin: string;
    lineLoop: string;
    voHook: string;
    voType: string;
    voRead: string;
    voOdds: string;
    voSpin: string;
    voAdd: string;
    voLoop: string;
    canvas?: string;
    ink?: string;
    accent?: string;
    muted?: string;
    bar?: string;
    highlight?: string;
    brandBg?: string;
    energy?: string;
    surface?: 'dark' | 'light';
    motionNotes?: string;
  }>(settings, `You fill a vertical 9:16 explainer about how an LLM picks the next token (READ→ODDS→SPIN→ADD).
Invent English on-screen copy from the brief — do NOT always use peanut-butter if the brief is another topic.
CRITICAL:
- demoQuestion: short YOU bubble (≤ 6 English words), like "Name a classic sandwich".
- partialWriting / writingWithWinner: SHORT display phrases (3–6 words). Not a paragraph.
- oddsCandidates: 5–6 items, one dominant slice 50–70%, others shrinking; pct sum ~100; spinWinner = largest.
- tokens: question + partial answer words.
- Headlines English; vo* 简体中文 10–22 chars.
${lookBrief('nextword')}
Seed ${seed}. JSON only.`, `Brief:
${prompt || 'Explain how ChatGPT picks the next word using a sandwich example.'}

Return exactly:
{
  "demoQuestion":"Name a classic sandwich",
  "partialWriting":"Peanut butter and",
  "writingWithWinner":"Peanut butter and jelly",
  "tokens":["Name","a","classic","sandwich","Peanut","butter","and"],
  "oddsCandidates":[{"word":"jelly","pct":62},{"word":"jam","pct":17},{"word":"bread","pct":8},{"word":"banana","pct":5},{"word":"honey","pct":5},{"word":"other","pct":3}],
  "spinWinner":"jelly",
  "headlineHook":"How does ChatGPT actually pick the next word?",
  "headlineRead":"First, it reads everything so far",
  "headlineOdds":"Every possible next word gets odds",
  "headlineSpin":"Then it spins. Bigger slice, better chance.",
  "headlineAdd":"It adds the winner... then does it all again.",
  "headlineLoop":"Every word goes round this loop",
  "lineRead":"your question + everything written so far",
  "lineSpin":"Usually a big slice wins. Not always: that's why answers can vary.",
  "lineLoop":"READ → ODDS → SPIN → ADD → …",
  "voHook":"","voType":"","voRead":"","voOdds":"","voSpin":"","voAdd":"","voLoop":""
}`, 0.7);

  store.patchProject(projectId, { title: '下一词回路', dir: dirName });

  const look = normalizeLook(pack, 'nextword');
  const odds = normalizeCandidates(pack.oddsCandidates, [
    { word: 'jelly', pct: 62 }, { word: 'jam', pct: 17 }, { word: 'bread', pct: 8 },
    { word: 'banana', pct: 5 }, { word: 'honey', pct: 5 }, { word: 'other', pct: 3 },
  ]);
  const winner = (pack.spinWinner || odds[0]?.word || 'jelly').trim();
  const partial = pack.partialWriting || 'Peanut butter and';
  const withWin = pack.writingWithWinner || `${partial} ${winner}`.trim();

  let scenes: Scene[] = [
    {
      kind: 'hook',
      durationSec: MIN_SLOT.hook,
      headline: pack.headlineHook || 'How does ChatGPT actually pick the next word?',
      promptBubble: pack.demoQuestion || 'Name a classic sandwich',
      writingText: '',
      vo: (pack.voHook || '大模型是怎么选出下一个词的？').trim(),
    },
    {
      kind: 'type',
      durationSec: MIN_SLOT.type,
      writingText: partial,
      vo: (pack.voType || '它像打字一样，逐词写出回答。').trim(),
    },
    {
      kind: 'read',
      durationSec: MIN_SLOT.read,
      headline: pack.headlineRead || 'First, it reads everything so far',
      tokens: pack.tokens?.length ? pack.tokens : defaultNextWordTokens(),
      line: pack.lineRead || 'your question + everything written so far',
      vo: (pack.voRead || '第一步 READ：读入问题和已写出的每个词。').trim(),
    },
    {
      kind: 'odds',
      durationSec: MIN_SLOT.odds,
      headline: pack.headlineOdds || 'Every possible next word gets odds',
      writingText: partial,
      candidates: odds,
      vo: (pack.voOdds || '第二步 ODDS：给每个候选词算概率。').trim(),
    },
    {
      kind: 'spin',
      durationSec: MIN_SLOT.spin,
      headline: pack.headlineSpin || 'Then it spins. Bigger slice, better chance.',
      line: pack.lineSpin || "Usually a big slice wins. Not always: that's why answers can vary.",
      candidates: odds,
      winner,
      vo: (pack.voSpin || '第三步 SPIN：按概率转轮，抽中一个词。').trim(),
    },
    {
      kind: 'add',
      durationSec: MIN_SLOT.add,
      headline: pack.headlineAdd || 'It adds the winner... then does it all again.',
      writingText: withWin,
      winner,
      candidates: odds,
      vo: (pack.voAdd || '第四步 ADD：把词写进回答，然后回到 READ。').trim(),
    },
    {
      kind: 'loop',
      durationSec: MIN_SLOT.loop,
      headline: pack.headlineLoop || 'Every word goes round this loop',
      line: pack.lineLoop || 'READ → ODDS → SPIN → ADD → …',
      vo: (pack.voLoop || '每个词都走同一套回路，直到整段话说完。').trim(),
    },
  ];

  writeFileSync(join(dir, 'plan.json'), JSON.stringify({ seed, pack, scenesDraft: scenes }, null, 2), 'utf8');
  setPipelineStep(projectId, 'plan', 'done', `7 beats · ${winner}`);
  setPipelineStep(projectId, 'brief', 'done', 'next-word-loop props arc');

  setPipelineStep(projectId, 'voice', 'running', 'TTS per scene');
  const captions: { from: number; to: number; text: string }[] = [];
  const concatList: string[] = [];
  let t = 0;
  for (let i = 0; i < scenes.length; i++) {
    const line = (scenes[i].vo || '').trim();
    if (!line) throw new Error(`next-word VO missing on scene ${i} (${scenes[i].kind})`);
    const narrationFile = `vo-${i}.mp3`;
    const clip = join(publicDir, narrationFile);
    await speak(line, clip, settings);
    const audioDur = probeAudioDuration(clip);
    concatList.push(clip);
    const durationSec = Number(Math.max(MIN_SLOT[scenes[i].kind], audioDur + VO_TAIL_SEC).toFixed(3));
    scenes[i] = { ...scenes[i], durationSec, narrationFile, vo: line };
    captions.push({ from: t + 0.05, to: t + Math.max(0.8, audioDur), text: wrapCaption(line) });
    t += durationSec;
    setPipelineStep(projectId, 'voice', 'running', `TTS ${i + 1}/${scenes.length} · ${audioDur.toFixed(1)}s`);
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

  writeFileSync(join(dir, 'captions.srt'), toSrt(captions), 'utf8');
  const totalSec = Number(scenes.reduce((a, s) => a + s.durationSec, 0).toFixed(3));
  setPipelineStep(projectId, 'voice', 'done', `${scenes.length} VO · ${totalSec.toFixed(1)}s`);

  const props = {
    canvas: look.canvas,
    ink: look.ink,
    accent: look.accent,
    muted: look.muted,
    bar: look.bar,
    look,
    scenes,
    captions,
  };
  writeFileSync(join(dir, 'props.json'), JSON.stringify(props, null, 2), 'utf8');
  writeFileSync(join(dir, 'storyboard.json'), JSON.stringify(props, null, 2), 'utf8');
  writeFileSync(
    join(dir, 'script.md'),
    `# 下一词回路\n\n${scenes.map((s, i) => `${i + 1}. [${s.kind} ${s.durationSec}s] ${s.vo}`).join('\n')}\n`,
    'utf8',
  );

  const propsPath = join(dir, 'props.json');
  const stillsDir = join(dir, 'stills');
  const finalMp4 = join(dir, 'final.mp4');

  setPipelineStep(projectId, 'build', 'running', 'LLM ActiveNextWord.tsx');
  const propsStr = JSON.stringify(props, null, 2);
  let tsx = await generateNextWordTsx(settings, { prompt, propsJson: propsStr, lookLine: lookLockLine(look) });
  let codeIssues = validateNextWordTsx(tsx);
  if (codeIssues.length) {
    tsx = await fixNextWordTsx(settings, { source: tsx, error: codeIssues.join('; '), propsJson: propsStr });
    codeIssues = validateNextWordTsx(tsx);
  }
  const useCodegen = codeIssues.length === 0;
  if (!useCodegen) {
    tsx = STOCK_ACTIVE;
    writeFileSync(join(dir, 'codegen-soft.txt'), codeIssues.join('\n'), 'utf8');
  }
  writeFileSync(join(dir, 'ActiveNextWord.tsx'), tsx, 'utf8');
  setPipelineStep(projectId, 'build', 'done', useCodegen ? 'ActiveNextWord codegen' : `stock fallback · ${codeIssues[0]}`);

  const compositionId: 'GeneratedNextWord' | 'NextWordLoop' = useCodegen ? 'GeneratedNextWord' : 'NextWordLoop';
  let usedCodegen = useCodegen;
  try {
    await withRemotionCodegenLock(async () => {
      installActiveComponent('nextword', tsx);
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await renderRemotionComposition({
            compositionId,
            propsPath,
            outMp4: finalMp4,
            publicDir,
            stillsDir,
            scenes,
            probeRes: '1080x1920',
            phases: ['stills'],
            onPhase: (phase, detail) => setPipelineStep(projectId, phase === 'stills' ? 'stills' : 'encode', 'running', detail),
          });
          break;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          writeFileSync(join(dir, `codegen-error-${attempt + 1}.txt`), msg, 'utf8');
          if (attempt === 0 && useCodegen) {
            tsx = await fixNextWordTsx(settings, { source: tsx, error: msg, propsJson: propsStr });
            writeFileSync(join(dir, 'ActiveNextWord.tsx'), tsx, 'utf8');
            installActiveComponent('nextword', tsx);
            continue;
          }
          usedCodegen = false;
          tsx = STOCK_ACTIVE;
          writeFileSync(join(dir, 'ActiveNextWord.tsx'), tsx, 'utf8');
          installActiveComponent('nextword', tsx);
          await renderRemotionComposition({
            compositionId: 'NextWordLoop',
            propsPath,
            outMp4: finalMp4,
            publicDir,
            stillsDir,
            scenes,
            probeRes: '1080x1920',
            phases: ['stills'],
            onPhase: (phase, detail) => setPipelineStep(projectId, phase === 'stills' ? 'stills' : 'encode', 'running', detail),
          });
          break;
        }
      }
      buildContactSheet(stillsDir, join(dir, 'contact-sheet.png'));
      const stillFiles = existsSync(stillsDir) ? readdirSync(stillsDir).filter((f) => f.endsWith('.png')) : [];
      const gate = {
        ok: stillFiles.length >= 4,
        issues: stillFiles.length >= 4 ? [] : [`too few stills (${stillFiles.length})`],
        mode: usedCodegen ? 'next-word-codegen' : 'next-word-stock',
      };
      writeSkillGateReport(dir, 'inspect-1.json', gate);
      setPipelineStep(projectId, 'stills', 'done', `${stillFiles.length} stills`);
      setPipelineStep(projectId, 'inspect', 'done', gate.ok ? `pass · ${gate.mode}` : gate.issues[0]);

      await renderRemotionComposition({
        compositionId: usedCodegen ? 'GeneratedNextWord' : 'NextWordLoop',
        propsPath,
        outMp4: finalMp4,
        publicDir,
        stillsDir,
        scenes,
        probeRes: '1080x1920',
        phases: ['encode'],
        onPhase: (phase, detail) => setPipelineStep(projectId, 'encode', 'running', detail),
      });
    }, {
      onWaiting: (info) => {
        const detail = remotionQueueDetail(info);
        if (detail) setPipelineStep(projectId, 'encode', 'running', detail);
      },
    });
  } finally {
    try { restoreActiveFallback('nextword'); } catch { /* ignore */ }
  }

  writeSkillGateReport(dir, 'render-mode.json', {
    compositionId: usedCodegen ? 'GeneratedNextWord' : 'NextWordLoop',
    usedCodegen,
    hardPipeline: 'next-word-loop',
    voBeats: scenes.length,
  });

  return finishPipeline(projectId, {
    title: '下一词回路',
    kind: 'explainer',
    engine: 'explainer-remotion',
    stylePack: 'next-word-loop',
    dir: dirName,
    durationSec: Math.round(totalSec),
    files: listFiles(dir),
  })!;
}

function defaultNextWordTokens() {
  return ['Name', 'a', 'classic', 'sandwich', 'Peanut', 'butter', 'and'];
}
