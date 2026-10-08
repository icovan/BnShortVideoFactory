/**
 * 工位分镜：从 outputs/{dir}/props.json + stills 组装可 seek 的 beat 列表。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUTPUTS_DIR } from '../paths.ts';
import { normalizeVersionLabels } from './projectVersions.ts';
import type {
  Aspect,
  Project,
  ProjectVersion,
  StoryboardBeat,
  StoryboardPayload,
} from '../../../shared/src/index.ts';

type RawScene = {
  job?: string;
  durationSec?: number;
  vo?: string;
  headline?: string;
  line?: string;
  visualIntent?: string;
  keyMotion?: string;
  skill?: string;
};

type RawProps = {
  aspect?: Aspect;
  contentLang?: string;
  scenes?: RawScene[];
};

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

/** Map stills/f-*-frame*.png to scene index when possible; else nearest by order. */
function stillThumbs(dir: string, sceneCount: number): (string | undefined)[] {
  const stillsDir = join(dir, 'stills');
  const out: (string | undefined)[] = Array.from({ length: sceneCount });
  if (!existsSync(stillsDir) || sceneCount <= 0) return out;
  const files = readdirSync(stillsDir)
    .filter((f) => /^f-\d+-frame\d+\.png$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!files.length) return out;

  // Prefer explicit f-{i}- when i < sceneCount
  for (const f of files) {
    const m = f.match(/^f-(\d+)-frame/i);
    if (!m) continue;
    const i = Number(m[1]);
    if (i >= 0 && i < sceneCount && !out[i]) out[i] = f;
  }
  // Fill gaps by order
  let cursor = 0;
  for (let i = 0; i < sceneCount; i++) {
    if (out[i]) continue;
    while (cursor < files.length) {
      const f = files[cursor++];
      const m = f.match(/^f-(\d+)-frame/i);
      const idx = m ? Number(m[1]) : -1;
      if (idx >= 0 && idx < sceneCount && out[idx]) continue;
      out[i] = f;
      break;
    }
  }
  return out;
}

export function projectOutputDir(project: Project): string | null {
  if (!project.dir) return null;
  const dir = join(OUTPUTS_DIR, project.dir);
  return existsSync(dir) ? dir : null;
}

export function loadStoryboard(project: Project): StoryboardPayload | null {
  const dir = projectOutputDir(project);
  if (!dir || !project.dir) return null;

  const props = readJson<RawProps>(join(dir, 'props.json'))
    || readJson<RawProps>(join(dir, 'storyboard.json'));
  const scenes = props?.scenes || [];
  const thumbs = stillThumbs(dir, scenes.length);

  let t = 0;
  const beats: StoryboardBeat[] = scenes.map((s, index) => {
    const durationSec = Math.max(0.2, Number(s.durationSec) || 1.2);
    const startSec = Number(t.toFixed(3));
    const endSec = Number((t + durationSec).toFixed(3));
    t += durationSec;
    const thumbFile = thumbs[index];
    return {
      index,
      job: (s.job || `beat-${index}`).toString(),
      headline: (s.headline || s.line || s.job || `分镜 ${index + 1}`).toString().slice(0, 80),
      line: s.line?.toString(),
      vo: s.vo?.toString(),
      visualIntent: s.visualIntent?.toString(),
      keyMotion: s.keyMotion?.toString(),
      skill: s.skill?.toString(),
      durationSec,
      startSec,
      endSec,
      thumbUrl: thumbFile ? `/outputs/${project.dir}/stills/${thumbFile}` : undefined,
    };
  });

  const hasVideo = existsSync(join(dir, 'final.mp4'));
  const lang = props?.contentLang === 'en' ? 'en' : 'zh';
  const versions: ProjectVersion[] = normalizeVersionLabels(
    (Array.isArray(project.versions) ? project.versions : [])
      .filter((v) => !/^回退前/.test(v.label || '')),
    lang,
  );

  return {
    projectId: project.id,
    dir: project.dir,
    aspect: props?.aspect || project.aspect,
    durationSec: Number(t.toFixed(3)) || project.durationSec || 0,
    videoUrl: hasVideo
      ? `/outputs/${project.dir}/final.mp4?v=${Date.now()}`
      : undefined,
    currentVersionId: project.currentVersionId || 'current',
    versions,
    beats,
    files: project.files || [],
  };
}
