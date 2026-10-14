import { mkdirSync, readdirSync, rmSync, statSync, existsSync, lstatSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProjectFile } from '../../shared/src/index.ts';

/** 创建目录；若遇坏 junction/软链（目标已删）则卸掉后重建 */
function ensureDir(dir: string) {
  try {
    mkdirSync(dir, { recursive: true });
    return;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT' && err.code !== 'EEXIST') throw e;
  }
  try {
    const st = lstatSync(dir);
    if (st.isSymbolicLink() || st.isDirectory()) {
      rmSync(dir, { recursive: true, force: true });
    }
  } catch {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
  mkdirSync(dir, { recursive: true });
}

function resolveProductRoot(): string {
  const envRoot = (process.env.BIUNOW_ROOT || '').trim();
  if (envRoot) return envRoot;
  // packages/create-core/src → 上三级到产品根
  return join(dirname(fileURLToPath(import.meta.url)), '../../..');
}

export const ROOT = resolveProductRoot();
export const OUTPUTS_DIR = (process.env.BIUNOW_OUTPUTS_DIR || '').trim() || join(ROOT, 'outputs');
export const REMOTION_PKG = join(ROOT, 'packages/remotion-explainer');
ensureDir(OUTPUTS_DIR);

export function slug(s: string) {
  // Windows 控制台/部分工具对中文路径不稳，目录名只用 ASCII
  const t = s
    .normalize('NFKD')
    .replace(/[\u4e00-\u9fff]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 24);
  return t || 'topic';
}

export function newProjectDir(engine: string, topic: string) {
  const id = Math.random().toString(36).slice(2, 6);
  const dirName = `${new Date().toISOString().slice(0, 10)}-${engine}-${slug(topic)}-${id}`;
  const dir = join(OUTPUTS_DIR, dirName);
  mkdirSync(dir, { recursive: true });
  return { dir, dirName };
}

export function listFiles(dir: string, root = dir): ProjectFile[] {
  if (!existsSync(dir)) return [];
  const out: ProjectFile[] = [];
  for (const name of readdirSync(dir)) {
    if (name.endsWith('.json') || name.endsWith('.ps1') || name.endsWith('.txt')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'public' || name === 'media' || name === 'stills' || name === 'manim_work') {
        if (name === 'stills') out.push(...listFiles(p, root));
        else if (name === 'public') out.push(...listFiles(p, root));
      }
      continue;
    }
    const ext = name.split('.').pop()?.toLowerCase();
    const kind = ext === 'png' || ext === 'jpg' ? 'image'
      : ext === 'mp4' || ext === 'webm' ? 'video'
      : ext === 'mp3' || ext === 'wav' ? 'audio'
      : ext === 'md' || ext === 'html' || ext === 'srt' || ext === 'vtt' || ext === 'py' ? 'text'
      : 'other';
    out.push({ name, rel: relative(root, p).replace(/\\/g, '/'), kind });
  }
  return out;
}
