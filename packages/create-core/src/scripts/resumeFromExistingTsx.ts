/**
 * 已有合法 ActiveDirected.tsx + props 时，跳过 codegen 直接 stills→encode。
 * Usage: npx tsx src/scripts/resumeFromExistingTsx.ts <projectId|dirName>
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUTPUTS_DIR } from '../paths.ts';
import { failPipeline, setPipelineStep } from '../pipeline.ts';
import { store } from '../store.ts';
import {
  renderPreparedDirected,
  type DirectedPrepared,
} from '../make/directedHard.ts';
import { craftSkillIds, type SkillPlan } from '../make/skillPlan.ts';
import {
  parseTsxSyntaxIssues,
  sealDirectedSource,
  validateDirectedTsx,
} from '../make/remotionCodegen.ts';
import { assertSkillsInTsx } from '../skills/registry.ts';
import { scoreSkillDepth } from '../skills/skillDepth.ts';
import { writeSkillGateReport } from '../skills/hardPipeline.ts';
import { assetFilesFromProps } from '../make/craftFloor.ts';
import type { Settings } from '../../../shared/src/index.ts';

const key = process.argv[2] || '';

function seal(src: string) {
  return sealDirectedSource(src);
}

async function main() {
  if (!key) throw new Error('usage: resumeFromExistingTsx.ts <projectId|dirName>');
  const project = store.projects().find((p) => p.id === key || p.dir === key || p.dir?.includes(key));
  if (!project?.dir) throw new Error(`project not found: ${key}`);
  const dir = join(OUTPUTS_DIR, project.dir);
  const plan = JSON.parse(readFileSync(join(dir, 'skill-plan.json'), 'utf8')) as SkillPlan;
  const props = JSON.parse(readFileSync(join(dir, 'props.json'), 'utf8')) as Record<string, unknown>;
  const scenes = (props.scenes || []) as DirectedPrepared['scenes'];
  const tsxPath = join(dir, 'ActiveDirected.tsx');
  if (!existsSync(tsxPath)) throw new Error(`missing ${tsxPath}`);
  let tsx = seal(readFileSync(tsxPath, 'utf8'));
  const craftIds = craftSkillIds(plan);
  const contentLang = (plan.contentLang || 'zh') as 'zh' | 'en' | 'bilingual';
  const issues = [
    ...parseTsxSyntaxIssues(tsx, 'ActiveDirected.tsx'),
    ...validateDirectedTsx(
      tsx,
      craftIds,
      contentLang,
      plan.aspect,
      scenes.length,
      assetFilesFromProps(props.assets),
      plan.voMode === 'off' ? [] : scenes.map((s) => s.durationSec || 0),
    ),
  ];
  // validate 可能含软问题；语法硬错误才挡
  const hard = issues.filter((x) => /^syntax\b/i.test(x));
  if (hard.length) {
    failPipeline(project.id, `ActiveDirected 语法错误：${hard.slice(0, 4).join('; ')}`);
    throw new Error(hard.join('; '));
  }
  const { writeFileSync } = await import('node:fs');
  writeFileSync(tsxPath, tsx, 'utf8');
  const skillGate = assertSkillsInTsx(craftIds, tsx, { hardIds: craftIds });
  const depthGate = scoreSkillDepth(tsx, craftIds, plan.beats);
  writeSkillGateReport(dir, 'gate-skills.json', skillGate);
  writeSkillGateReport(dir, 'skill-depth.json', { ...depthGate, craftIds });

  store.patchProject(project.id, { status: 'running', error: undefined });
  setPipelineStep(project.id, 'build', 'done', `resume tsx · depth ${depthGate.score}/${depthGate.max}`);
  const totalSec = scenes.reduce((a, s) => a + Math.max(0.1, s.durationSec || 0), 0);
  const prep: DirectedPrepared = {
    dir,
    dirName: project.dir,
    plan,
    props,
    propsPath: join(dir, 'props.json'),
    publicDir: join(dir, 'public'),
    stillsDir: join(dir, 'stills'),
    finalMp4: join(dir, 'final.mp4'),
    scenes,
    totalSec,
    tsx,
    usedCodegen: true,
    usedStickmanPoseFloor: false,
    skillGate,
    contentLang,
  };
  const settings = store.settings() as Settings;
  const done = await renderPreparedDirected(project.id, prep, {
    settings,
    allowLlmRepair: true,
  });
  console.log(JSON.stringify({
    ok: done.status === 'ready',
    id: done.id,
    status: done.status,
    error: done.error,
    mp4: prep.finalMp4,
  }, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
