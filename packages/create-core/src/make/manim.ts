import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chatText, readSkill } from '../llm.ts';
import { listFiles, newProjectDir } from '../paths.ts';
import { renderManimScene } from '../engines/manimBridge.ts';
import { copyReadyFile, isLockError } from '../engines/copyReadyFile.ts';
import { probeMp4 } from '../probe.ts';
import { finishPipeline, setPipelineStep } from '../pipeline.ts';
import { store } from '../store.ts';
import type { Project, Settings } from '../../../shared/src/index.ts';

function extractPython(text: string) {
  const m = text.match(/```(?:python)?\s*([\s\S]*?)```/i);
  return (m ? m[1] : text).trim();
}

function detectClass(py: string) {
  const m = py.match(/class\s+(\w+)\s*\(\s*(?:ThreeD)?Scene\s*\)/);
  return m?.[1] || 'MainScene';
}

export async function makeManim(prompt: string, settings: Settings, projectId: string): Promise<Project> {
  const skill = readSkill('manim');
  setPipelineStep(projectId, 'scene', 'running', 'LLM writing scene.py');

  const raw = await chatText(settings, `You are a faithful executor of the Manim skill below. Follow the skill and all reference rules (MathTex, Axes/ValueTracker, 3D/Camera, verify loop). Do not invent a different pipeline.
Output ONE complete runnable Python file (markdown fence optional).

${skill}

Hard requirements:
- from manim import *
- Exactly one Scene (or ThreeDScene / MovingCameraScene) subclass; all animation in construct(self)
- MathTex / Tex always raw strings r"..."; Chinese labels may use Text
- Layout with next_to / arrange / VGroup — no hand-guessed stacked coordinates
- Key beats: Write / Create / TransformMatchingTex / Indicate / LaggedStart; intentional run_time and rate_func=smooth
- End with self.wait(); duration about 12–25 seconds
- No external assets, no wall-clock randomness
- Class name: English PascalCase
- If on-screen text is needed for a Chinese audience, use Chinese Text(...); keep code comments English.`, `User brief (may be Chinese or English):
${prompt}`);

  let scenePy = extractPython(raw);
  if (!scenePy.includes('from manim import') && !scenePy.includes('import manim')) {
    throw new Error('Model did not return a valid Manim script.');
  }
  let sceneClass = detectClass(scenePy);
  setPipelineStep(projectId, 'scene', 'done', sceneClass);

  const { dir, dirName } = newProjectDir('manim', prompt);
  store.patchProject(projectId, { title: prompt.slice(0, 28) || '数理动画', dir: dirName });
  writeFileSync(join(dir, 'scene.py'), scenePy, 'utf8');
  writeFileSync(join(dir, 'prompt.md'), `# ${prompt}\n\nclass: ${sceneClass}\n`, 'utf8');

  const finalMp4 = join(dir, 'final.mp4');
  const stillsDir = join(dir, 'stills');

  setPipelineStep(projectId, 'stills', 'running', 'manim -sql');
  try {
    await renderManimScene({
      scenePy,
      sceneClass,
      workDir: join(dir, 'manim_work'),
      outMp4: finalMp4,
      stillsDir,
      onPhase: (phase, detail) => setPipelineStep(projectId, phase, 'running', detail),
    });
  } catch (firstErr) {
    const errMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
    if (isLockError(firstErr)) {
      setPipelineStep(projectId, 'encode', 'running', '成片文件解锁后复制');
      const src = errMsg.match(/copyfile '([^']+)'/)?.[1];
      if (src) await copyReadyFile(src, finalMp4);
      else throw firstErr;
    } else {
    setPipelineStep(projectId, 'scene', 'running', 'fixing scene.py');
    const fixed = await chatText(settings, `You are a Manim skill fixer. Edit scene.py based on the error while still obeying the skill.
Output complete Python only (fence optional). Keep a single Scene subclass.`, `User brief:
${prompt}

Original script:
\`\`\`python
${scenePy}
\`\`\`

Error:
${errMsg.slice(0, 2500)}`);
    scenePy = extractPython(fixed);
    sceneClass = detectClass(scenePy);
    writeFileSync(join(dir, 'scene.py'), scenePy, 'utf8');
    writeFileSync(join(dir, 'fix-attempt.md'), errMsg.slice(0, 4000), 'utf8');
    setPipelineStep(projectId, 'stills', 'running', 'retry manim');
    await renderManimScene({
      scenePy,
      sceneClass,
      workDir: join(dir, 'manim_work'),
      outMp4: finalMp4,
      stillsDir,
      onPhase: (phase, detail) => setPipelineStep(projectId, phase, 'running', detail),
    });
    }
  }

  setPipelineStep(projectId, 'encode', 'done', 'probe ok');
  const spec = probeMp4(finalMp4);

  const done = finishPipeline(projectId, {
    title: prompt.slice(0, 28) || '数理动画',
    kind: 'explainer',
    engine: 'manim',
    dir: dirName,
    durationSec: Math.round(spec.duration),
    files: listFiles(dir),
  });
  return done!;
}
