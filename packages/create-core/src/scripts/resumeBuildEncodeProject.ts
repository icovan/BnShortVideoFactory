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
  renderPreparedDirected,
  type DirectedPrepared,
} from '../make/directedHard.ts';
import { codegenSkillIds, craftSkillIds, type SkillPlan } from '../make/skillPlan.ts';
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
import type { Settings } from '../../../shared/src/index.ts';

const key = process.argv[2] || '';

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

async function main() {
  if (!key) throw new Error('usage: resumeBuildEncodeProject.ts <projectId|dirName>');
  const project = findProject();
  if (!project?.dir) throw new Error(`project not found: ${key}`);
  const dir = join(OUTPUTS_DIR, project.dir);
  const planPath = join(dir, 'skill-plan.json');
  const propsPath = join(dir, 'props.json');
  if (!existsSync(planPath) || !existsSync(propsPath)) {
    throw new Error(`missing plan/props under ${dir}`);
  }

  const plan = readJson<SkillPlan>(planPath);
  const props = readJson<Record<string, unknown>>(propsPath);
  const scenes = (props.scenes || []) as DirectedPrepared['scenes'];
  if (!scenes.length) throw new Error('props.scenes empty');

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
    resume: 'build+encode',
  }, null, 2));

  store.patchProject(project.id, { status: 'running', error: undefined });
  setPipelineStep(project.id, 'plan', 'done', `${plan.primary} · ${plan.support.join('+')}`);
  setPipelineStep(project.id, 'brief', 'done', briefMeta.styleSource || plan.look?.accent || 'brief');
  setPipelineStep(project.id, 'voice', 'done', `resume skip TTS · ${scenes.length} scenes`);
  setPipelineStep(project.id, 'build', 'running', `codegen · ${craftIds.join('+')}`);

  const assetFiles = assetFilesFromProps(props.assets);
  const validateTsx = (src: string) =>
    validateDirectedTsx(src, craftIds, contentLang, plan.aspect, sceneCount, assetFiles);

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

  if (codeIssues.length || !skillGate.ok) {
    tsx = await fixDirectedTsx(settings, {
      source: tsx,
      error: [...codeIssues, ...skillGate.issues].join('; '),
      propsJson: propsStr,
    });
    codeIssues = validateTsx(tsx);
    skillGate = assertSkillsInTsx(codegenIds, tsx, { hardIds: craftIds });
    depthGate = scoreSkillDepth(tsx, craftIds, plan.beats);
  }
  if (!codeIssues.length && skillGate.ok && !depthGate.ok && depthGate.issues.length) {
    tsx = await fixDirectedTsx(settings, {
      source: tsx,
      error: [
        'CRAFT DEPTH repair — implement assigned scene.skill techniques deeply:',
        ...depthGate.issues,
        'Rotate reveal families; honor each beat craftMust; no shared Hud on every beat',
      ].join('; '),
      propsJson: propsStr,
    });
    codeIssues = validateTsx(tsx);
    skillGate = assertSkillsInTsx(codegenIds, tsx, { hardIds: craftIds });
    depthGate = scoreSkillDepth(tsx, craftIds, plan.beats);
  }

  let usedCodegen = codeIssues.length === 0 && skillGate.ok && depthGate.ok;
  if (!usedCodegen) {
    tsx = await fixDirectedTsx(settings, {
      source: tsx,
      error: [
        ...codeIssues,
        ...skillGate.issues,
        ...depthGate.issues,
        'final repair: keep THIS brief; deepen diagram/kinetic/caption; forbid REC/CAM HudShell every beat',
      ].join('; '),
      propsJson: propsStr,
    });
    codeIssues = validateTsx(tsx);
    skillGate = assertSkillsInTsx(codegenIds, tsx, { hardIds: craftIds });
    depthGate = scoreSkillDepth(tsx, craftIds, plan.beats);
    usedCodegen = codeIssues.length === 0 && skillGate.ok && depthGate.ok;
  }

  if (!usedCodegen) {
    const syn = parseTsxSyntaxIssues(tsx);
    const msg = [
      ...codeIssues,
      ...skillGate.issues,
      ...depthGate.issues,
      ...syn,
    ].slice(0, 8).join('; ') || 'codegen failed';
    failPipeline(project.id, `技能技法未落地（禁止出片）：${msg}`);
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
