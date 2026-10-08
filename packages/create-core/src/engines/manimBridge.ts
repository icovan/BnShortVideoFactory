import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { probeMp4 } from '../probe.ts';
import { copyReadyFile } from './copyReadyFile.ts';

function pythonBin() {
  return process.platform === 'win32' ? 'python' : 'python3';
}

function run(bin: string, args: string[], cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd,
      windowsHide: true,
      env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += String(d); });
    child.stderr.on('data', (d) => { stderr += String(d); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

function findFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  const hits: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      if (name === 'partial_movie_files') continue;
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (name.toLowerCase().endsWith(ext)) hits.push(p);
    }
  };
  walk(dir);
  return hits;
}

function findMp4(dir: string): string | null {
  const hits = findFiles(dir, '.mp4')
    .map((path) => ({ path, size: statSync(path).size }))
    .sort((a, b) => b.size - a.size);
  return hits[0]?.path || null;
}

function findLatestPng(dir: string): string | null {
  const hits = findFiles(dir, '.png')
    .map((path) => ({ path, mtime: statSync(path).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return hits[0]?.path || null;
}

/**
 * Skill verify loop：
 * 1) manim -sql（终帧 PNG）
 * 2) manim -sql -n 0,3（中段帧）
 * 3) manim -qh 成片
 * 4) probe-mp4
 */
export async function renderManimScene(opts: {
  scenePy: string;
  sceneClass: string;
  workDir: string;
  outMp4: string;
  stillsDir: string;
  onPhase?: (phase: 'stills' | 'encode', detail?: string) => void;
}) {
  mkdirSync(opts.workDir, { recursive: true });
  mkdirSync(opts.stillsDir, { recursive: true });
  writeFileSync(join(opts.workDir, 'scene.py'), opts.scenePy, 'utf8');

  const py = pythonBin();
  const media = join(opts.workDir, 'media');

  opts.onPhase?.('stills', 'manim -sql end frame');
  const stillEnd = await run(py, ['-m', 'manim', '-sql', 'scene.py', opts.sceneClass], opts.workDir);
  if (stillEnd.code !== 0) {
    throw new Error(`Manim 终帧失败：${(stillEnd.stderr || stillEnd.stdout).slice(-1500)}`);
  }
  const endPng = findLatestPng(media);
  if (endPng) copyFileSync(endPng, join(opts.stillsDir, 'f-end.png'));

  opts.onPhase?.('stills', 'manim -sql mid frames');
  const stillMid = await run(
    py,
    ['-m', 'manim', '-sql', 'scene.py', opts.sceneClass, '-n', '0,3'],
    opts.workDir,
  );
  if (stillMid.code !== 0) {
    throw new Error(`Manim 中段帧失败：${(stillMid.stderr || stillMid.stdout).slice(-1500)}`);
  }
  const midPng = findLatestPng(media);
  if (midPng) copyFileSync(midPng, join(opts.stillsDir, 'f-mid.png'));

  opts.onPhase?.('encode', 'manim -qh');
  const video = await run(py, ['-m', 'manim', '-qh', 'scene.py', opts.sceneClass], opts.workDir);
  if (video.code !== 0) {
    throw new Error(`Manim 出片失败：${(video.stderr || video.stdout).slice(-1500)}`);
  }

  const mp4 = findMp4(media);
  if (!mp4) throw new Error('Manim 未找到输出 mp4');
  await copyReadyFile(mp4, opts.outMp4);

  probeMp4(opts.outMp4, { res: '1920x1080', fps: 60 });
  return opts.outMp4;
}
