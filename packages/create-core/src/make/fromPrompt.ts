import { makeManim } from './manim.ts';
import { makeDirectedHard, prepareDirectedHard, type DirectedPrepared } from './directedHard.ts';
import { planSkills } from './skillPlan.ts';
import { optimizePrompt } from './optimizePrompt.ts';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { finishPipeline, resetPipeline, setPipelineStep } from '../pipeline.ts';
import { store } from '../store.ts';
import { OUTPUTS_DIR } from '../paths.ts';
import { resolveStyleLook } from './styleLook.ts';
import { reconcileStyleLook, type LookFamily } from './look.ts';
import { docsBriefBlock, extractDocText, type IncomingUserAsset } from './userAssets.ts';
import { detectContentLang, isContentLang, type ContentLang, type VoMode } from './contentLang.ts';
import { runWebSearch } from './webSearch.ts';
import { extractUrlsFromText, runUrlExtract } from './urlExtract.ts';
import {
  applyScriptDriveToPlan,
  joinDocsText,
  polishScriptForFilm,
  resolveScriptDrive,
  splitVerbatimScript,
  type ScriptDriveMode,
} from './scriptDrive.ts';
import type { Aspect, Project, Quality, Settings } from '../../../shared/src/index.ts';

type MakeOpts = {
  autoSfx?: boolean;
  voMode?: VoMode;
  scriptDrive?: ScriptDriveMode;
  styleRefId?: string;
  styleRefDataUrl?: string;
  userAssets?: IncomingUserAsset[];
  /** 云端 prepare：禁止 Manim */
  forceRemotion?: boolean;
  /** 观众语言锁（UI 按原文检测；避免打包英文行污染） */
  contentLang?: ContentLang;
  /** 仅 skill-directed | footage-remix（硬 SKU 模板已移除） */
  stylePack?: 'skill-directed' | 'footage-remix';
  /** 真实网页检索，结果注入 densify / skill plan */
  webSearch?: boolean;
  /** 出片分辨率 1080p | 720p */
  quality?: Quality;
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
  const scriptMode = resolveScriptDrive({
    uiMode: opts?.scriptDrive,
    hasDocs: mergedDocs.length > 0,
  });

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
  const machineBrief = brief.machinePrompt || brief.prompt;
  setPipelineStep(
    projectId,
    'plan',
    'running',
    brief.primaryGuess
      ? `双轨就绪 · ${brief.primaryGuess} · 观众语 ${brief.contentLang}`
      : `双轨就绪 · 观众语 ${brief.contentLang}`,
  );

  const voForPlan = scriptMode !== 'off' ? 'on' as VoMode : opts?.voMode;

  let plan = await planSkills(
    machineBrief,
    aspect,
    settings,
    undefined,
    brief.contentLang,
    voForPlan,
    prompt,
    { forceRemotion: opts?.forceRemotion === true },
  );
  plan.contentLang = brief.contentLang;

  if (scriptMode !== 'off' && mergedDocs.length) {
    setPipelineStep(projectId, 'plan', 'running', `旁白驱动 · ${scriptMode}`);
    const sourceText = joinDocsText(mergedDocs);
    let scriptBeats;
    if (scriptMode === 'verbatim') {
      scriptBeats = splitVerbatimScript(sourceText).slice(0, 40).map((vo, i) => ({
        job: `beat-${i}`,
        vo,
        headline: vo.slice(0, 16),
        visualIntent: `Illustrate: ${vo.slice(0, 80)}`,
        keyMotion: 'spring reveal',
      }));
    } else {
      scriptBeats = await polishScriptForFilm(settings, {
        sourceText,
        contentLang: brief.contentLang,
        aspect,
        userAsk: prompt,
      });
    }
    plan = applyScriptDriveToPlan(plan, scriptBeats, scriptMode);
    setPipelineStep(projectId, 'plan', 'running', `旁白锁定 · ${plan.beats.length} 句`);
  }

  let styleSource: string | undefined;
  if (opts?.styleRefId || opts?.styleRefDataUrl) {
    setPipelineStep(projectId, 'brief', 'running', '设计参考 → look');
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
        [prompt, machineBrief, brief.audiencePrompt || '', brief.lookLock || ''],
        family,
      );
      styleSource = hit.source;
      setPipelineStep(projectId, 'brief', 'done', `style · ${plan.look.accent}`);
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

export async function makeFromPrompt(
  prompt: string,
  settings: Settings,
  projectId: string,
  aspect: Aspect,
  _templateId?: string,
  opts?: MakeOpts,
): Promise<Project> {
  const { plan, brief, machineBrief, styleSource } = await planFromPrompt(
    prompt, settings, projectId, aspect, opts,
  );
  if (plan.engine === 'manim') {
    resetPipeline(projectId, 'manim', undefined, { engine: 'manim' });
    return makeManim(machineBrief, settings, projectId);
  }
  if (plan.engine === 'footage-remix' || plan.primary === 'footage-remix' || opts?.stylePack === 'footage-remix') {
    resetPipeline(projectId, 'explainer-remotion', 'footage-remix', {
      engine: 'footage-remix',
      stylePack: 'footage-remix',
      title: (plan.coreIdea || prompt).slice(0, 28) || '混剪任务',
    });
    setPipelineStep(projectId, 'plan', 'done', 'footage-remix · 交给混剪台');
    setPipelineStep(projectId, 'brief', 'done', '请在混剪技能页完成素材与配音');
    return finishPipeline(projectId, {
      engine: 'footage-remix',
      stylePack: 'footage-remix',
      durationSec: 0,
    }) || store.getProject(projectId)!;
  }

  // 仅自由模式 skill-directed（四模板硬管线已移除）
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
  });
}
