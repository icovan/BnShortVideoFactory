/**
 * Resume Remotion stills+encode for an existing project that failed at export.
 * Usage: npx tsx src/scripts/resumeEncodeProject.ts <projectId|dirName>
 */
import { copyFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  installActiveComponent,
  remotionQueueDetail,
  restoreActiveFallback,
  withRemotionCodegenLock,
} from '../engines/remotionLock.ts';
import { renderRemotionComposition } from '../engines/remotionBridge.ts';
import { OUTPUTS_DIR, listFiles } from '../paths.ts';
import { failPipeline, finishPipeline, setPipelineStep } from '../pipeline.ts';
import { buildContactSheet } from '../skills/hardPipeline.ts';
import { probeResFor } from '../skills/registry.ts';
import { store } from '../store.ts';

const key = process.argv[2] || '';
const encodeOnly = process.argv.includes('--encode-only');

function findProject() {
  const list = store.projects();
  return (
    list.find((p) => p.id === key)
    || list.find((p) => p.dir === key)
    || list.find((p) => p.dir?.includes(key))
  );
}

async function main() {
  if (!key) throw new Error('usage: resumeEncodeProject.ts <projectId|dirName>');
  const project = findProject();
  if (!project?.dir) throw new Error(`project not found: ${key}`);
  const dir = join(OUTPUTS_DIR, project.dir);
  const tsxPath = join(dir, 'ActiveDirected.tsx');
  const preFloor = join(dir, 'ActiveDirected.pre-floor.tsx');
  // Prefer pre-floor codegen if present (stock floor was only Remotion-version fallback)
  if (existsSync(preFloor)) {
    copyFileSync(preFloor, tsxPath);
    console.log('[resume] restored ActiveDirected.pre-floor.tsx');
  }
  const propsPath = join(dir, 'props.json');
  const publicDir = join(dir, 'public');
  const stillsDir = join(dir, 'stills');
  const finalMp4 = join(dir, 'final.mp4');
  if (!existsSync(tsxPath)) throw new Error(`missing ${tsxPath}`);
  if (!existsSync(propsPath)) throw new Error(`missing ${propsPath}`);

  const props = JSON.parse(readFileSync(propsPath, 'utf8')) as {
    aspect?: '16:9' | '9:16' | '1:1' | '3:4';
    quality?: '1080p' | '720p';
    scenes?: Array<{ durationSec: number }>;
    assets?: Array<{ role?: string; file?: string }>;
  };
  const scenes = props.scenes || [];
  if (!scenes.length) throw new Error('props.scenes empty');
  const tsx = readFileSync(tsxPath, 'utf8');
  const totalSec = scenes.reduce((a, s) => a + Math.max(0.1, s.durationSec || 0), 0);

  console.log(JSON.stringify({
    id: project.id,
    dir: project.dir,
    status: project.status,
    scenes: scenes.length,
    totalSec: Math.round(totalSec),
    tsxBytes: tsx.length,
  }, null, 2));

  store.patchProject(project.id, { status: 'running', error: undefined });
  setPipelineStep(project.id, encodeOnly ? 'encode' : 'stills', 'running', encodeOnly ? 'resume encode' : 'resume stills');

  try {
    await withRemotionCodegenLock(async () => {
      installActiveComponent('directed', tsx);
      await renderRemotionComposition({
        compositionId: 'GeneratedDirected',
        propsPath,
        outMp4: finalMp4,
        publicDir,
        stillsDir,
        scenes,
        probeRes: probeResFor(props.aspect || '16:9', props.quality === '720p' ? '720p' : '1080p'),
        phases: encodeOnly ? ['encode'] : ['stills', 'encode'],
        onPhase: (phase, detail) => {
          console.log(`[${phase}] ${detail || ''}`);
          setPipelineStep(
            project.id,
            phase === 'stills' ? 'stills' : 'encode',
            'running',
            detail,
          );
        },
      });
      buildContactSheet(stillsDir, join(dir, 'contact-sheet.png'));
      const stillFiles = existsSync(stillsDir)
        ? readdirSync(stillsDir).filter((f) => f.endsWith('.png'))
        : [];
      setPipelineStep(project.id, 'stills', 'done', `${stillFiles.length} stills`);
      setPipelineStep(project.id, 'inspect', 'done', 'skills pass');
    }, {
      onWaiting: (info) => {
        const detail = remotionQueueDetail(info);
        if (detail) {
          console.log(`[queue] ${detail}`);
          setPipelineStep(project.id, 'encode', 'running', detail);
        }
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    failPipeline(project.id, msg);
    throw e;
  } finally {
    try { restoreActiveFallback('directed'); } catch { /* ignore */ }
  }

  const done = finishPipeline(project.id, {
    dir: project.dir,
    durationSec: Math.round(totalSec),
    files: listFiles(dir),
    engine: 'explainer-remotion',
    stylePack: 'skill-directed',
  });
  console.log(JSON.stringify({
    ok: true,
    id: done?.id,
    status: done?.status,
    mp4: finalMp4,
  }, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
