import { makeManim } from './manim.ts';
import { makeDirectedHard, prepareDirectedHard, type DirectedPrepared } from './directedHard.ts';
import { planSkills } from './skillPlan.ts';
import { optimizePrompt } from './optimizePrompt.ts';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { resetPipeline, setPipelineStep } from '../pipeline.ts';
import { store } from '../store.ts';
import { OUTPUTS_DIR } from '../paths.ts';
import { resolveStyleLook } from './styleLook.ts';
import { reconcileStyleLook, type LookFamily } from './look.ts';
import { docsBriefBlock, extractDocText, type IncomingUserAsset } from './userAssets.ts';
import { detectContentLang, isContentLang, stripFactoryPackLines, type ContentLang, type VoMode } from './contentLang.ts';
import { runWebSearch } from './webSearch.ts';
import { extractUrlsFromText, runUrlExtract } from './urlExtract.ts';
import {
  applyScriptDriveToPlan,
  assessDriveConsumption,
  assessDriveScript,
  assessDriveVisualVariety,
  joinDocsText,
  planPicturesForLines,
  shotsFromFormattedNarration,
  synthesizeScriptFromAsk,
  type ScriptDriveMode,
} from './scriptDrive.ts';
import { formatToNarrationTxt } from './narrationFormat.ts';
import { diversifyBeatSkills } from './beatTechnique.ts';
import { attachCraftMust } from '../skills/skillDepth.ts';
import { rebuildSkillsList } from './directorToolkit.ts';
import { isSkillName } from '../skills/registry.ts';
import type { SkillName } from '../llm.ts';
import { coalesceVoiceOver, mapVoiceOver, type VoiceOverUi } from './voiceOver.ts';
import type { Aspect, Project, Quality, Settings, StylePack } from '../../../shared/src/index.ts';
import { isRemixFormMode, makeFootageRemix } from './footageRemix.ts';
import {
  applyStickmanPhraseToBeats,
  asksForStickman,
  withStickmanMachineLock,
} from './stickmanBrief.ts';
import { makeExplainer } from './explainer.ts';
import { resolveBrandSubtype } from './formModePools.ts';
import {
  applyStylePresetToPlan,
  getStylePreset,
  stylePresetBriefLock,
} from './stylePresets.ts';

type MakeOpts = {
  autoSfx?: boolean;
  /** 口播三态：关 / 自动 / 驱动（优先于 voMode+scriptDrive） */
  voiceOver?: VoiceOverUi;
  voMode?: VoMode;
  scriptDrive?: ScriptDriveMode;
  styleRefId?: string;
  styleRefDataUrl?: string;
  /** 风格预设 id（技法偏置；与设计参考联动） */
  stylePresetId?: string;
  userAssets?: IncomingUserAsset[];
  /** 云端 prepare：禁止 Manim */
  forceRemotion?: boolean;
  /** 观众语言锁（UI 按原文检测；避免打包英文行污染） */
  contentLang?: ContentLang;
  /** 成片工作流配方 */
  stylePack?: StylePack;
  /** 真实网页检索，结果注入 densify / skill plan */
  webSearch?: boolean;
  /** 出片分辨率 1080p | 720p */
  quality?: Quality;
  /** UI 形态：prompt / short / narrate / tutorial / story / launch / brand / remix */
  formMode?: string;
  /** brand 子型 */
  brandSubtype?: 'logo' | 'showreel' | string;
  /** 混剪：本机素材文件夹 */
  footageFolder?: string;
  /** 混剪：显式视频路径 */
  footagePaths?: string[];
  /** 混剪：品牌/卖点/主题 → 口播策划 */
  remixBrief?: {
    topic?: string;
    brand?: string;
    sellingPoints?: string;
    theme?: string;
  };
};

function earlyExtractDocs(assets?: IncomingUserAsset[]) {
  if (!assets?.length) return [] as { name: string; text: string }[];
  const out: { name: string; text: string }[] = [];
  for (const a of assets) {
    const isDoc = a.kind === 'doc'
      || /\.(pdf|txt|md|csv|json)$/i.test(a.name)
      || a.dataUrl.startsWith('data:text/')
      || a.dataUrl.startsWith('data:application/pdf')
      || a.dataUrl.startsWith('data:application/json');
    if (!isDoc) continue;
    const m = a.dataUrl.match(/^data:([^;,]+)?(;base64)?,([\s\S]+)$/i);
    if (!m) continue;
    const mime = (m[1] || '').toLowerCase();
    const isB64 = Boolean(m[2]);
    const payload = m[3] || '';
    try {
      const buf = isB64
        ? Buffer.from(payload, 'base64')
        : Buffer.from(decodeURIComponent(payload), 'utf8');
      const text = extractDocText(a.name, mime || 'application/octet-stream', buf);
      if (text.trim()) out.push({ name: a.name, text });
    } catch {
      /* skip */
    }
  }
  return out;
}

async function planFromPrompt(
  prompt: string,
  settings: Settings,
  projectId: string,
  aspect: Aspect,
  opts?: MakeOpts,
) {
  resetPipeline(projectId, 'explainer-remotion', 'skill-directed');

  const docTexts = earlyExtractDocs(opts?.userAssets);

  // 提示词含 http(s) 链接 → 自动 URL 抽取（无 LLM），正文进 brief / 旁白驱动
  let urlBlock = '';
  let urlDocs: { name: string; text: string }[] = [];
  const detectedUrls = extractUrlsFromText(prompt);
  if (detectedUrls.length) {
    setPipelineStep(projectId, 'plan', 'running', `读网页 · ${detectedUrls.length} 链`);
    const extracted = await runUrlExtract({
      prompt,
      apiKey: settings.webSearchApiKey,
    });
    urlBlock = extracted.briefBlock;
    urlDocs = extracted.docTexts;
    const proj = store.getProject(projectId);
    if (proj?.dir) {
      const dir = join(OUTPUTS_DIR, proj.dir);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'url-extract.json'),
        JSON.stringify(
          {
            urls: extracted.urls,
            pages: extracted.pages.map((p) => ({
              url: p.url,
              title: p.title,
              provider: p.provider,
              chars: p.text.length,
              error: p.error,
            })),
            at: new Date().toISOString(),
          },
          null,
          2,
        ),
        'utf8',
      );
    }
    const ok = extracted.pages.filter((p) => p.text).length;
    setPipelineStep(
      projectId,
      'plan',
      'running',
      ok ? `读网页 · 成功 ${ok}/${extracted.urls.length}` : `读网页 · 失败 ${extracted.urls.length} 链`,
    );

    // 有链接但抽不到正文、也没有上传文稿 → 中止，避免空壳「品牌感」片
    if (!ok && !docTexts.length) {
      const why = extracted.pages
        .map((p) => p.error || 'empty')
        .filter(Boolean)
        .slice(0, 2)
        .join('; ');
      const antiBot = /anti-bot|challenge/i.test(why);
      throw new Error(
        antiBot
          ? `读网页失败：站点有反爬（${why}）。请把文章正文粘贴进输入框，或上传 txt/md/pdf 附件后再创作。`
          : `读网页失败：未能取得正文（${why || 'too little text'}）。请粘贴正文或上传附件后再创作。`,
      );
    }
  }

  const mergedDocs = [...docTexts, ...urlDocs];
  const brandSub = resolveBrandSubtype(opts?.formMode, opts?.brandSubtype);
  // 标志与类型不再强制 logo/showreel 配方与关口播——案例提示词写约束，操作栏自由
  let voiceOver = coalesceVoiceOver({
    voiceOver: opts?.voiceOver,
    voMode: opts?.voMode,
    scriptDrive: opts?.scriptDrive,
  });
  // 驱动但无文稿：降为自动（从需求策划），避免空跑
  if (voiceOver === 'drive' && !mergedDocs.length) voiceOver = 'auto';
  const mapped = mapVoiceOver(voiceOver);
  const scriptMode = mapped.scriptDrive;
  const uiVoMode = mapped.voMode;

  let webBlock = '';
  if (opts?.webSearch) {
    setPipelineStep(projectId, 'plan', 'running', '网页检索…');
    const web = await runWebSearch({
      prompt,
      apiKey: settings.webSearchApiKey,
    });
    webBlock = web.briefBlock;
    const proj = store.getProject(projectId);
    if (proj?.dir) {
      const dir = join(OUTPUTS_DIR, proj.dir);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'web-search.json'),
        JSON.stringify(
          { query: web.query, provider: web.provider, hits: web.hits, at: new Date().toISOString() },
          null,
          2,
        ),
        'utf8',
      );
    }
    setPipelineStep(
      projectId,
      'plan',
      'running',
      web.hits.length
        ? `网页检索 · ${web.provider} · ${web.hits.length} 条`
        : `网页检索 · ${web.provider} · 无命中`,
    );
  }

  const promptWithDocs = [prompt, urlBlock, webBlock, docsBriefBlock(mergedDocs)]
    .filter(Boolean)
    .join('\n\n');
  if (mergedDocs.length) {
    setPipelineStep(
      projectId,
      'plan',
      'running',
      `docs · ${mergedDocs.length}${scriptMode !== 'off' ? ` · script:${scriptMode}` : ''}${urlDocs.length ? ' · url' : ''}`,
    );
  }

  setPipelineStep(projectId, 'plan', 'running', '静默润色 · 双轨提示词');
  const brief = await optimizePrompt(promptWithDocs, aspect, settings);
  // UI lock wins; else detect from stripped raw ask (packing / docs must not force `en`)
  brief.contentLang =
    opts?.contentLang && isContentLang(opts.contentLang)
      ? opts.contentLang
      : detectContentLang(prompt);
  const preset = getStylePreset(opts?.stylePresetId);
  const presetLock = stylePresetBriefLock(opts?.stylePresetId);
  const machineBrief = withStickmanMachineLock(
    [brief.machinePrompt || brief.prompt, presetLock].filter(Boolean).join('\n\n'),
    prompt,
  );
  // 技法路由 / 导演工具箱也要看见预设（与 machine brief 对齐）
  const sourceAskForPlan = [prompt, presetLock].filter(Boolean).join('\n');
  setPipelineStep(
    projectId,
    'plan',
    'running',
    brief.primaryGuess
      ? `双轨就绪 · ${brief.primaryGuess} · 观众语 ${brief.contentLang}${asksForStickman(prompt) ? ' · stickman' : ''}${preset ? ` · 风格:${preset.labelZh}` : ''}`
      : `双轨就绪 · 观众语 ${brief.contentLang}${asksForStickman(prompt) ? ' · stickman' : ''}${preset ? ` · 风格:${preset.labelZh}` : ''}`,
  );

  const voForPlan = uiVoMode;

  let plan = await planSkills(
    machineBrief,
    aspect,
    settings,
    undefined,
    brief.contentLang,
    voForPlan,
    sourceAskForPlan,
    {
      forceRemotion: opts?.forceRemotion === true,
      formMode: opts?.formMode,
      brandSubtype: brandSub,
    },
  );
  plan.contentLang = brief.contentLang;
  plan.formMode = (opts?.formMode || 'prompt').trim() || 'prompt';
  plan.brandSubtype = brandSub;
  // 硬偏置主技法（防止 LLM 仍把 kinetic 排第一）
  if (preset) {
    plan = applyStylePresetToPlan(plan, preset.id);
    if (preset.preferMono && brief.lookLock && !/mono|木刻|单色|黑白/i.test(brief.lookLock)) {
      brief.lookLock = `${brief.lookLock} · monochrome woodcut ink`.slice(0, 200);
    } else if (preset.briefLock && !brief.lookLock) {
      brief.lookLock = `${preset.labelZh} · ${preset.motionNotes || ''}`.slice(0, 200);
    }
  }

  if (voiceOver === 'drive' && mergedDocs.length) {
    // 唯一契约：先 narration.txt（空行=画面单元，镜数随内容）→ skill 配画。不开 NarrationFilm / 不走 polish 碎切。
    const sourceText = joinDocsText(mergedDocs);
    setPipelineStep(projectId, 'plan', 'running', '口播驱动 · narration.txt 格式化');
    const narrationTxt = await formatToNarrationTxt(settings, sourceText, { userAsk: prompt });
    const packed = shotsFromFormattedNarration(narrationTxt);
    const driveLines = packed.lines;
    const driveMode: ScriptDriveMode = 'verbatim';

    const projDir = store.getProject(projectId)?.dir;
    if (projDir) {
      const outDir = join(OUTPUTS_DIR, projDir);
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, 'narration.txt'), narrationTxt, 'utf8');
    }

    setPipelineStep(
      projectId,
      'plan',
      'running',
      `口播驱动 · ${driveLines.length} 画面单元`,
    );
    const scriptBeats = await planPicturesForLines(settings, {
      lines: driveLines,
      contentLang: brief.contentLang,
      aspect,
      userAsk: prompt,
    });

    const structureIssues = assessDriveScript(driveLines);
    const driveIssues = [...packed.issues, ...structureIssues].slice(0, 32);
    plan = applyScriptDriveToPlan(plan, scriptBeats, driveMode);
    let consumeIssues = [
      ...assessDriveConsumption({ lines: driveLines, beats: plan.beats }),
      ...assessDriveVisualVariety(plan.beats),
    ];
    // 自查：邻镜同技 / skill 垄断 → 再钉轮转（防导演工具箱回潮；不重跑 LLM）
    if (consumeIssues.some((x) => /consecutive same skill|dominates/i.test(x))) {
      const rotated = attachCraftMust(diversifyBeatSkills(plan.beats, { primary: plan.primary }));
      const used: SkillName[] = [];
      for (const b of rotated) {
        if (isSkillName(b.skill) && b.skill !== plan.primary && !used.includes(b.skill)) {
          used.push(b.skill);
        }
      }
      plan = {
        ...plan,
        beats: rotated,
        support: used.slice(0, 3),
        skills: rebuildSkillsList(plan.primary, used.slice(0, 3), plan.brandSkills || [], true),
      };
      consumeIssues = [
        ...assessDriveConsumption({ lines: driveLines, beats: plan.beats }),
        ...assessDriveVisualVariety(plan.beats),
      ];
    }
    const driveAll = [...driveIssues, ...consumeIssues].slice(0, 40);
    plan = { ...plan, driveIssues: driveAll };
    setPipelineStep(
      projectId,
      'plan',
      'running',
      driveAll.length
        ? `口播锁定 · narration.txt · ${plan.beats.length} 镜 · 提示 ${driveAll.length}`
        : `口播锁定 · narration.txt · ${plan.beats.length} 镜`,
    );
  } else if (voiceOver === 'auto') {
    // 自动：需求 → LLM 策划旁白；同样按空行画面单元归并过碎句（无 24 镜硬顶）
    setPipelineStep(projectId, 'plan', 'running', '口播自动 · 策划');
    const synthesized = await synthesizeScriptFromAsk(settings, {
      userAsk: stripFactoryPackLines(prompt) || prompt,
      contentLang: brief.contentLang,
      aspect,
    });
    if (synthesized.length >= 4) {
      const packedAuto = shotsFromFormattedNarration(
        synthesized.map((b) => b.vo).join('\n\n'),
      );
      const autoBeats = packedAuto.lines.length === synthesized.length
        ? synthesized
        : await planPicturesForLines(settings, {
          lines: packedAuto.lines,
          contentLang: brief.contentLang,
          aspect,
          userAsk: prompt,
        });
      plan = applyScriptDriveToPlan(plan, autoBeats, 'polish');
      setPipelineStep(projectId, 'plan', 'running', `口播锁定 · 合成 ${plan.beats.length} 镜`);
    }
  }

  // 旁白驱动后可能冲掉 clip: 前缀 — 火柴人镜再锁回短语
  if (
    asksForStickman(sourceAskForPlan)
    || plan.skills.includes('stickman-animation')
    || plan.mainTechnique === 'stickman-animation'
  ) {
    plan = {
      ...plan,
      beats: applyStickmanPhraseToBeats(plan.beats, { sourceAsk: sourceAskForPlan }),
    };
  }

  // 旁白驱动可能冲掉技法挂载 — 预设再钉一次
  if (preset) {
    plan = applyStylePresetToPlan(plan, preset.id);
  }

  let styleSource: string | undefined;
  if (opts?.styleRefId || opts?.styleRefDataUrl) {
    setPipelineStep(projectId, 'brief', 'running', preset ? '设计参考 → 色板' : '设计参考 → look');
    const family: LookFamily = aspect === '9:16' || aspect === '3:4' ? 'nextword' : 'launch';
    const hit = await resolveStyleLook({
      styleRefId: opts.styleRefId,
      styleRefDataUrl: opts.styleRefDataUrl,
      settings,
      family,
    });
    if (hit) {
      plan.look = reconcileStyleLook(
        plan.look,
        hit.look,
        [prompt, machineBrief, brief.audiencePrompt || '', brief.lookLock || '', presetLock],
        family,
        { paletteOnly: Boolean(preset) },
      );
      styleSource = hit.source;
      setPipelineStep(projectId, 'brief', 'done', `style · ${plan.look.accent}${preset ? ` · ${preset.labelZh}` : ''}`);
    }
  }

  setPipelineStep(
    projectId,
    'plan',
    'done',
    `primary ${plan.primary} · ${plan.contentLang} · vo:${plan.voMode}${plan.scriptDrive ? ` · script:${plan.scriptDrive}` : ''}`,
  );

  return { plan, brief, machineBrief, styleSource };
}

function isHardStylePack(pack?: StylePack): pack is 'launch-showreel' | 'narrated-explainer' | 'next-word-loop' {
  return pack === 'launch-showreel' || pack === 'narrated-explainer' || pack === 'next-word-loop';
}

export async function makeFromPrompt(
  prompt: string,
  settings: Settings,
  projectId: string,
  aspect: Aspect,
  _templateId?: string,
  opts?: MakeOpts,
): Promise<Project> {
  // 混剪：不走 Remotion plan，直接口播驱动素材
  if (isRemixFormMode(opts?.formMode) || opts?.stylePack === 'footage-remix') {
    return makeFootageRemix(prompt, settings, projectId, {
      aspect,
      quality: opts?.quality,
      scriptDrive: opts?.scriptDrive,
      contentLang: opts?.contentLang,
      userAssets: opts?.userAssets,
      footageFolder: opts?.footageFolder,
      footagePaths: opts?.footagePaths,
      remixBrief: opts?.remixBrief,
    });
  }

  // 硬 SKU 工作流：直接走对应管线（种子提示词保质）
  if (isHardStylePack(opts?.stylePack)) {
    const pack = opts.stylePack;
    resetPipeline(projectId, 'explainer-remotion', pack, { engine: 'explainer-remotion', aspect });
    return makeExplainer(prompt, settings, pack, projectId);
  }

  const { plan, brief, machineBrief, styleSource } = await planFromPrompt(
    prompt, settings, projectId, aspect, opts,
  );
  if (plan.engine === 'manim') {
    resetPipeline(projectId, 'manim', undefined, { engine: 'manim' });
    return makeManim(machineBrief, settings, projectId);
  }
  if (plan.engine === 'footage-remix' || plan.primary === 'footage-remix') {
    const hasFootage = !!(opts?.footageFolder || (opts?.footagePaths && opts.footagePaths.length));
    // 故事池可含 footage-remix；无素材夹时不得误闯混剪（面板混剪入口仍独立）
    if (!hasFootage && !isRemixFormMode(opts?.formMode) && opts?.stylePack !== 'footage-remix') {
      plan.primary = 'text-message-animation';
      plan.engine = 'explainer-remotion';
      plan.support = (plan.support || []).filter((s) => s !== 'footage-remix').slice(0, 3);
      plan.skills = [plan.primary, ...plan.support, ...(plan.brandSkills || [])];
      console.info('[fromPrompt] footage-remix without folder → text-message-animation');
    } else {
      return makeFootageRemix(prompt, settings, projectId, {
        aspect,
        quality: opts?.quality,
        scriptDrive: opts?.scriptDrive,
        contentLang: opts?.contentLang,
        userAssets: opts?.userAssets,
        footageFolder: opts?.footageFolder,
        footagePaths: opts?.footagePaths,
        remixBrief: opts?.remixBrief,
      });
    }
  }

  // 自由 / 技能导向
  return makeDirectedHard(machineBrief, settings, projectId, plan, {
    sourcePrompt: prompt,
    factoryPrompt: machineBrief,
    audiencePrompt: brief.audiencePrompt,
    lookLock: brief.lookLock,
    assumptions: brief.assumptions,
    autoSfx: opts?.autoSfx === true,
    styleLook: styleSource ? plan.look : undefined,
    styleSource,
    userAssets: opts?.userAssets,
    quality: opts?.quality === '720p' ? '720p' : '1080p',
    formMode: plan.formMode || opts?.formMode || 'prompt',
  });
}

/** 编排端：只 prepare（技能+TTS+codegen），不 Remotion */
export async function makeFromPromptPrepare(
  prompt: string,
  settings: Settings,
  projectId: string,
  aspect: Aspect,
  _templateId?: string,
  opts?: MakeOpts,
): Promise<DirectedPrepared> {
  const { plan, brief, machineBrief, styleSource } = await planFromPrompt(
    prompt, settings, projectId, aspect, { ...opts, forceRemotion: true },
  );
  if (plan.engine === 'manim') {
    throw new Error('壳模式暂不支持 Manim 云端编排，请改用 Remotion 技能路由');
  }
  if (plan.engine === 'footage-remix' || plan.primary === 'footage-remix') {
    throw new Error('footage-remix 由本机混剪台执行，不走云端 prepare');
  }
  return prepareDirectedHard(machineBrief, settings, projectId, plan, {
    sourcePrompt: prompt,
    factoryPrompt: machineBrief,
    audiencePrompt: brief.audiencePrompt,
    lookLock: brief.lookLock,
    assumptions: brief.assumptions,
    autoSfx: opts?.autoSfx === true,
    styleLook: styleSource ? plan.look : undefined,
    styleSource,
    userAssets: opts?.userAssets,
    quality: opts?.quality === '720p' ? '720p' : '1080p',
    formMode: plan.formMode || opts?.formMode || 'prompt',
  });
}
