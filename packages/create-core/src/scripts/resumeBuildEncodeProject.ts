/**
 * Resume directed pipeline after voice (plan+props+VO exist, no ActiveDirected).
 * Usage: npx tsx src/scripts/resumeBuildEncodeProject.ts <projectId|dirName>
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUTPUTS_DIR } from '../paths.ts';
import { failPipeline, setPipelineStep } from '../pipeline.ts';
import { store } from '../store.ts';
import {
  makeDirectedHard,
  renderPreparedDirected,
  type DirectedPrepared,
} from '../make/directedHard.ts';
import { codegenSkillIds, craftSkillIds, type SkillPlan } from '../make/skillPlan.ts';
import { dropUnaskedSceneSkills, mergeBeatSkills } from '../make/beatTechnique.ts';
import {
  fixDirectedTsx,
  generateDirectedTsx,
  parseTsxSyntaxIssues,
  validateDirectedTsx,
} from '../make/remotionCodegen.ts';
import { assertSkillsInTsx } from '../skills/registry.ts';
import { scoreSkillDepth } from '../skills/skillDepth.ts';
import { writeSkillGateReport } from '../skills/hardPipeline.ts';
import { lookLockLine } from '../make/look.ts';
import { contentLangLockLine } from '../make/contentLang.ts';
import { assetFilesFromProps } from '../make/craftFloor.ts';
import { styleLookLockLine } from '../make/styleLook.ts';
import {
  bindNarrationScene,
  composeNarrationDirectedSource,
  narrationLayoutIssues,
  usesNarrationLayouts,
} from '../make/narrationLayout.ts';
import type { Settings } from '../../../shared/src/index.ts';

const key = process.argv[2] || '';
/** --free: skip narration layouts; rebuild with free directed codegen (keep VO). */
const forceFree = process.argv.includes('--free');

function findProject() {
  const list = store.projects();
  return (
    list.find((p) => p.id === key)
    || list.find((p) => p.dir === key)
    || list.find((p) => p.dir?.includes(key))
  );
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/** 分镜已写好、配音还没落地：沿用原目录，从语音接到成片。 */
async function continueFromPlan(
  project: { id: string; dir: string; prompt?: string },
  dir: string,
  planPath: string,
) {
  const plan = readJson<SkillPlan>(planPath);
  const prompt = existsSync(join(dir, 'prompt-factory.md'))
    ? readFileSync(join(dir, 'prompt-factory.md'), 'utf8')
    : (project.prompt || plan.coreIdea || '');
  const source = existsSync(join(dir, 'prompt-original.md'))
    ? readFileSync(join(dir, 'prompt-original.md'), 'utf8')
    : prompt;
  const audience = existsSync(join(dir, 'prompt-audience.md'))
    ? readFileSync(join(dir, 'prompt-audience.md'), 'utf8')
    : '';
  const brief = existsSync(join(dir, 'brief-meta.json'))
    ? readJson<{
      lookLock?: string;
      assumptions?: string[];
      styleSource?: string;
      styleLook?: SkillPlan['look'];
    }>(join(dir, 'brief-meta.json'))
    : {};
  const settings = store.settings() as Settings;
  store.patchProject(project.id, { status: 'running', error: undefined });
  console.log(JSON.stringify({
    id: project.id,
    dir: project.dir,
    resume: 'voice+build+encode',
    beats: plan.beats.length,
    scriptDrive: plan.scriptDrive || 'off',
  }));
  try {
    const done = await makeDirectedHard(prompt, settings, project.id, plan, {
      sourcePrompt: source,
      factoryPrompt: prompt,
      audiencePrompt: audience,
      lookLock: brief.lookLock,
      assumptions: brief.assumptions,
      styleLook: brief.styleLook,
      styleSource: brief.styleSource,
      reuseDir: project.dir,
    });
    console.log(JSON.stringify({
      ok: done.status === 'ready',
      id: done.id,
      status: done.status,
      error: done.error,
      mp4: join(dir, 'final.mp4'),
    }, null, 2));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    failPipeline(project.id, msg);
    throw e;
  }
}

async function main() {
  if (!key) throw new Error('usage: resumeBuildEncodeProject.ts <projectId|dirName>');
  const project = findProject();
  if (!project?.dir) throw new Error(`project not found: ${key}`);
  const dir = join(OUTPUTS_DIR, project.dir);
  const planPath = join(dir, 'skill-plan.json');
  const propsPath = join(dir, 'props.json');
  if (!existsSync(planPath)) throw new Error(`missing plan under ${dir}`);
  if (!existsSync(propsPath)) {
    await continueFromPlan(project, dir, planPath);
    return;
  }

  const rawPlan = readJson<SkillPlan>(planPath);
  const plan = mergeBeatSkills({
    ...rawPlan,
    beats: dropUnaskedSceneSkills(rawPlan.beats, { keep: rawPlan.primary }),
  });
  const props = readJson<Record<string, unknown>>(propsPath);
  const scenes = (props.scenes || []) as DirectedPrepared['scenes'];
  if (!scenes.length) throw new Error('props.scenes empty');
  for (let i = 0; i < plan.beats.length && i < scenes.length; i++) {
    const beat = plan.beats[i];
    scenes[i].skill = beat.skill;
    if (beat.craftMust?.length) scenes[i].craftMust = beat.craftMust;
  }
  const changed = plan.beats.filter((b, i) => b.skill !== rawPlan.beats[i]?.skill);
  if (changed.length || plan.support.join() !== rawPlan.support.join()) {
    writeFileSync(planPath, JSON.stringify(plan, null, 2), 'utf8');
    writeFileSync(propsPath, JSON.stringify(props, null, 2), 'utf8');
    console.log('[resume-build] retargeted unasked scene skills', changed.map((b) => `${b.job}:${b.skill}`));
  }

  const settings = store.settings() as Settings;
  if (!settings?.llmApiKey && !settings?.llmBaseUrl) {
    console.warn('[resume-build] settings look empty — codegen may fail');
  }

  const prompt = existsSync(join(dir, 'prompt-factory.md'))
    ? readFileSync(join(dir, 'prompt-factory.md'), 'utf8')
    : (project.prompt || plan.coreIdea || '');
  const briefMeta = existsSync(join(dir, 'brief-meta.json'))
    ? readJson<{ styleSource?: string; styleLook?: SkillPlan['look'] }>(join(dir, 'brief-meta.json'))
    : {};

  const contentLang = (plan.contentLang || 'zh') as 'zh' | 'en' | 'bilingual';
  const craftIds = craftSkillIds(plan);
  const codegenIds = codegenSkillIds(plan);
  const sceneCount = Math.max(scenes.length, plan.beats?.length || 0, 1);
  const propsStr = JSON.stringify(props, null, 2);
  const publicDir = join(dir, 'public');
  const stillsDir = join(dir, 'stills');
  const finalMp4 = join(dir, 'final.mp4');
  const totalSec = scenes.reduce((a, s) => a + Math.max(0.1, s.durationSec || 0), 0);

  console.log(JSON.stringify({
    id: project.id,
    dir: project.dir,
    status: project.status,
    scenes: scenes.length,
    totalSec: Math.round(totalSec),
    support: plan.support,
    resume: forceFree ? 'free-codegen+encode' : 'build+encode',
    forceFree,
  }, null, 2));

  store.patchProject(project.id, { status: 'running', error: undefined });
  setPipelineStep(project.id, 'plan', 'done', `${plan.primary} · ${plan.support.join('+')}`);
  setPipelineStep(project.id, 'brief', 'done', briefMeta.styleSource || plan.look?.accent || 'brief');
  setPipelineStep(project.id, 'voice', 'done', `resume skip TTS · ${scenes.length} scenes`);
  setPipelineStep(project.id, 'build', 'running', forceFree ? `free codegen · ${craftIds.join('+')}` : `codegen · ${craftIds.join('+')}`);

  const assetFiles = assetFilesFromProps(props.assets);

  if (!forceFree && usesNarrationLayouts(plan)) {
    for (let i = 0; i < scenes.length; i++) {
      const beat = plan.beats[i];
      const bound = bindNarrationScene({
        skill: beat?.skill || scenes[i].skill,
        visualIntent: beat?.visualIntent || scenes[i].visualIntent,
        keyMotion: beat?.keyMotion || scenes[i].keyMotion,
        headline: beat?.headline || scenes[i].headline,
        vo: beat?.vo || scenes[i].vo,
        items: beat?.items || scenes[i].items,
      });
      scenes[i].layout = bound.layout;
      scenes[i].glyphs = bound.glyphs;
      if (!scenes[i].items?.length && bound.items?.length) scenes[i].items = bound.items;
    }
    props.material = plan.look?.motionNotes || '';
    props.scenes = scenes;
    writeFileSync(propsPath, JSON.stringify(props, null, 2), 'utf8');
    const tsx = composeNarrationDirectedSource();
    const layoutIssues = [
      ...narrationLayoutIssues(tsx, scenes),
      ...parseTsxSyntaxIssues(tsx, 'ActiveDirected.tsx'),
    ];
    if (layoutIssues.length) {
      const msg = `旁白版式未接上：${layoutIssues.slice(0, 4).join('; ')}`;
      failPipeline(project.id, msg);
      throw new Error(msg);
    }
    writeFileSync(join(dir, 'ActiveDirected.tsx'), tsx, 'utf8');
    const skillGate = { ok: true, issues: [] as string[] };
    writeSkillGateReport(dir, 'gate-skills.json', skillGate);
    writeSkillGateReport(dir, 'skill-depth.json', {
      ok: true,
      score: scenes.length,
      max: scenes.length,
      issues: [],
      narrationLayout: true,
      layouts: scenes.map((s) => ({ job: s.job, layout: s.layout, glyphs: s.glyphs })),
    });
    setPipelineStep(project.id, 'build', 'done', `旁白版式 · ${scenes.length} 镜 · ${contentLang}`);
    const prep: DirectedPrepared = {
      dir,
      dirName: project.dir,
      plan,
      props,
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
    const done = await renderPreparedDirected(project.id, prep, {
      settings,
      allowLlmRepair: false,
    });
    console.log(JSON.stringify({
      ok: true,
      id: done.id,
      status: done.status,
      mp4: finalMp4,
      error: done.error,
      narrationLayout: true,
    }, null, 2));
    return;
  }

  const validateTsx = (src: string) =>
    validateDirectedTsx(
      src,
      craftIds,
      contentLang,
      plan.aspect,
      sceneCount,
      assetFiles,
      plan.voMode === 'off' ? [] : scenes.map((s) => s.durationSec || 0),
    );

  let tsx = await generateDirectedTsx(settings, {
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
      briefMeta.styleSource
        ? styleLookLockLine(plan.look, briefMeta.styleSource, { mono: false })
        : '',
    ].filter(Boolean).join('\n'),
  });

  let codeIssues = validateTsx(tsx);
  let skillGate = assertSkillsInTsx(codegenIds, tsx, { hardIds: craftIds });
  let depthGate = scoreSkillDepth(tsx, craftIds, plan.beats);
  console.log('[build] first pass', { codeIssues: codeIssues.slice(0, 4), skillOk: skillGate.ok, depthOk: depthGate.ok });

  if (codeIssues.length) {
    tsx = await fixDirectedTsx(settings, {
      source: tsx,
      error: codeIssues.join('; '),
      propsJson: propsStr,
    });
    codeIssues = validateTsx(tsx);
    skillGate = assertSkillsInTsx(codegenIds, tsx, { hardIds: craftIds });
    depthGate = scoreSkillDepth(tsx, craftIds, plan.beats);
  }

  let usedCodegen = codeIssues.length === 0;
  if (!usedCodegen) {
    tsx = await fixDirectedTsx(settings, {
      source: tsx,
      error: [
        ...codeIssues,
        'repair engineering only: keep THIS brief; respect props.canvas/aspect zone',
      ].join('; '),
      propsJson: propsStr,
    });
    codeIssues = validateTsx(tsx);
    skillGate = assertSkillsInTsx(codegenIds, tsx, { hardIds: craftIds });
    depthGate = scoreSkillDepth(tsx, craftIds, plan.beats);
    usedCodegen = codeIssues.length === 0;
  }

  if (!usedCodegen) {
    const syn = parseTsxSyntaxIssues(tsx);
    const msg = [...codeIssues, ...syn].slice(0, 8).join('; ') || 'codegen failed';
    failPipeline(project.id, `ActiveDirected 工程校验未通过：${msg}`);
    throw new Error(msg);
  }

  writeFileSync(join(dir, 'ActiveDirected.tsx'), tsx, 'utf8');
  writeSkillGateReport(dir, 'gate-skills.json', skillGate);
  writeSkillGateReport(dir, 'skill-depth.json', {
    ...depthGate,
    craftIds,
    brandSkills: plan.brandSkills || [],
    beatSkills: plan.beats.map((b) => ({ job: b.job, skill: b.skill, craftMust: b.craftMust })),
  });
  setPipelineStep(
    project.id,
    'build',
    'done',
    `ActiveDirected · depth ${depthGate.score}/${depthGate.max} · ${contentLang}`,
  );
  console.log('[build] ok', { bytes: tsx.length, depth: `${depthGate.score}/${depthGate.max}` });

  const prep: DirectedPrepared = {
    dir,
    dirName: project.dir,
    plan,
    props,
    propsPath,
    publicDir,
    stillsDir,
    finalMp4,
    scenes,
    totalSec,
    tsx,
    usedCodegen: true,
    usedStickmanPoseFloor: false,
    skillGate,
    contentLang,
  };

  const done = await renderPreparedDirected(project.id, prep, {
    settings,
    allowLlmRepair: true,
  });
  console.log(JSON.stringify({
    ok: true,
    id: done.id,
    status: done.status,
    mp4: finalMp4,
    error: done.error,
  }, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
