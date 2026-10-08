import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { Project } from '../../shared/src/index.ts';
import { OUTPUTS_DIR } from './paths.ts';

function stillPick(stillsDir: string) {
  if (!existsSync(stillsDir)) return '';
  const pngs = readdirSync(stillsDir).filter((f) => f.endsWith('.png') && !f.startsWith('_')).sort();
  if (!pngs.length) return '';
  return pngs[Math.min(Math.floor(pngs.length * 0.35), pngs.length - 1)];
}

/** 优先 poster.jpg → 验帧 stills → 从 final.mp4 抽一帧（每批最多几次，避免列表卡住） */
export function withPoster(p: Project, budget: { left: number }): Project {
  if (!p.dir) return p;
  const root = join(OUTPUTS_DIR, p.dir);
  if (!existsSync(root)) return p;
  const poster = join(root, 'poster.jpg');
  if (existsSync(poster)) return { ...p, posterUrl: `/outputs/${p.dir}/poster.jpg` };
  const still = stillPick(join(root, 'stills'));
  if (still) return { ...p, posterUrl: `/outputs/${p.dir}/stills/${still}` };
  const mp4 = join(root, 'final.mp4');
  if (existsSync(mp4) && budget.left > 0) {
    budget.left -= 1;
    spawnSync(
      'ffmpeg',
      ['-y', '-ss', '1.2', '-i', mp4, '-frames:v', '1', '-q:v', '4', poster],
      { windowsHide: true, timeout: 6000, stdio: 'ignore' },
    );
    if (existsSync(poster)) return { ...p, posterUrl: `/outputs/${p.dir}/poster.jpg` };
  }
  return p;
}

export function decorateProjects(list: Project[]) {
  const budget = { left: 2 };
  return list.map((p) => withPoster(p, budget));
}
