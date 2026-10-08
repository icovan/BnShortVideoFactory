import { existsSync } from 'node:fs';
import { copyFile, readFile, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const LOCK = new Set(['EBUSY', 'EPERM', 'EACCES']);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isLock(e: unknown) {
  const code = (e as NodeJS.ErrnoException)?.code;
  const msg = e instanceof Error ? e.message : String(e);
  return (code && LOCK.has(code)) || /EBUSY|resource busy or locked/i.test(msg);
}

/** Windows: manim/ffmpeg/Defender 刚写完的 mp4 常被锁，copyFileSync 会直接炸。 */
export async function copyReadyFile(src: string, dest: string) {
  if (!existsSync(src)) throw new Error(`缺少源文件 ${src}`);
  let prev = -1;
  for (let i = 0; i < 20; i++) {
    const size = (await stat(src)).size;
    if (size > 2048 && size === prev) break;
    prev = size;
    await sleep(200);
  }
  let last: unknown;
  for (let i = 0; i < 10; i++) {
    try {
      await copyFile(src, dest);
      if (existsSync(dest) && (await stat(dest)).size > 0) return dest;
    } catch (e) {
      last = e;
      if (!isLock(e)) throw e;
      await sleep(280 * (i + 1));
    }
  }
  try {
    await writeFile(dest, await readFile(src));
    return dest;
  } catch (e) {
    last = e;
  }
  const r = spawnSync('ffmpeg', ['-y', '-i', src, '-c', 'copy', dest], {
    windowsHide: true,
    encoding: 'utf8',
  });
  if (r.status === 0 && existsSync(dest)) return dest;
  throw last instanceof Error ? last : new Error(`无法复制成片 ${src}`);
}

export function isLockError(e: unknown) {
  return isLock(e);
}
