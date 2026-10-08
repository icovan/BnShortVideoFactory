import { existsSync, mkdirSync, openSync, closeSync, unlinkSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REMOTION_PKG } from '../paths.ts';

const LOCK = join(REMOTION_PKG, '.codegen.lock');
/** Drop lock only if holder stopped heartbeating (crash). Long encodes keep refreshing. */
const STALE_MS = 18 * 60 * 1000;
const HEARTBEAT_MS = 25_000;
const FILE_POLL_MS = 800;

export type RemotionLockWaitInfo = { position: number; waitedMs: number };

export type RemotionLockOptions = {
  onWaiting?: (info: RemotionLockWaitInfo) => void;
};

/** Pipeline detail while waiting for the global render slot; null = uncontended, skip UI flash. */
export function remotionQueueDetail(info: RemotionLockWaitInfo): string | null {
  if (info.position <= 0 && info.waitedMs < 500) return null;
  return info.position > 0
    ? `排队中 · 前面还有 ${info.position} 个任务`
    : '排队中 · 等待渲染位';
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function writeLockPayload() {
  writeFileSync(LOCK, `${Date.now()}:${process.pid}`, 'utf8');
}

function tryClearStaleLock() {
  if (!existsSync(LOCK)) return;
  try {
    const raw = readFileSync(LOCK, 'utf8');
    const ts = Number(String(raw).split(':')[0] || 0);
    if (ts && Date.now() - ts > STALE_MS) unlinkSync(LOCK);
  } catch { /* ignore */ }
}

/** Acquire exclusive file lock; waits indefinitely (stale locks are cleared). */
async function acquireFileLock(onTick?: (waitedMs: number) => void): Promise<() => void> {
  mkdirSync(REMOTION_PKG, { recursive: true });
  const started = Date.now();
  for (;;) {
    try {
      const fd = openSync(LOCK, 'wx');
      writeFileSync(fd, `${Date.now()}:${process.pid}`, 'utf8');
      closeSync(fd);
      const beat = setInterval(() => {
        try { writeLockPayload(); } catch { /* ignore */ }
      }, HEARTBEAT_MS);
      beat.unref?.();
      return () => {
        clearInterval(beat);
        try { unlinkSync(LOCK); } catch { /* ignore */ }
      };
    } catch {
      tryClearStaleLock();
      onTick?.(Date.now() - started);
      await sleep(FILE_POLL_MS);
    }
  }
}

type QueueEntry = {
  id: number;
  enqueuedAt: number;
  onWaiting?: (info: RemotionLockWaitInfo) => void;
  start: () => void;
};

const queue: QueueEntry[] = [];
let nextId = 1;
let running = false;

function notifyQueue() {
  for (let i = 0; i < queue.length; i++) {
    const e = queue[i];
    e.onWaiting?.({
      position: i + (running ? 1 : 0),
      waitedMs: Date.now() - e.enqueuedAt,
    });
  }
}

function pump() {
  if (running || queue.length === 0) return;
  const next = queue.shift()!;
  running = true;
  next.start();
}

/**
 * Exclusive lock so concurrent jobs don't overwrite Active*.tsx mid-render.
 * Process-local FIFO + file lock (cross-process) with heartbeat — waits, does not timeout-fail.
 */
export async function withRemotionCodegenLock<T>(
  fn: () => Promise<T>,
  opts?: RemotionLockOptions,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const entry: QueueEntry = {
      id: nextId++,
      enqueuedAt: Date.now(),
      onWaiting: opts?.onWaiting,
      start: () => {
        void (async () => {
          try {
            const releaseFile = await acquireFileLock((waitedMs) => {
              opts?.onWaiting?.({ position: 0, waitedMs });
            });
            try {
              resolve(await fn());
            } finally {
              releaseFile();
            }
          } catch (e) {
            reject(e);
          } finally {
            running = false;
            notifyQueue();
            pump();
          }
        })();
      },
    };

    queue.push(entry);
    // Immediate position: index in queue + 1 if someone is already rendering
    opts?.onWaiting?.({
      position: queue.length - 1 + (running ? 1 : 0),
      waitedMs: 0,
    });
    notifyQueue();
    pump();
  });
}

export function installActiveComponent(kind: 'narrated' | 'launch' | 'nextword' | 'directed', tsxSource: string) {
  const name = kind === 'narrated'
    ? 'ActiveNarrated.tsx'
    : kind === 'launch'
      ? 'ActiveLaunch.tsx'
      : kind === 'directed'
        ? 'ActiveDirected.tsx'
        : 'ActiveNextWord.tsx';
  const dir = join(REMOTION_PKG, 'src', 'generated');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), tsxSource, 'utf8');
}

export function restoreActiveFallback(kind: 'narrated' | 'launch' | 'nextword' | 'directed') {
  if (kind === 'narrated') {
    installActiveComponent(
      'narrated',
      `export { NarratedExplainer as ActiveNarrated } from '../NarratedExplainer';\n`,
    );
  } else if (kind === 'launch') {
    installActiveComponent(
      'launch',
      `export { LaunchShowreel as ActiveLaunch } from '../LaunchShowreel';\n`,
    );
  } else if (kind === 'directed') {
    installActiveComponent(
      'directed',
      `export { DirectedFilm as ActiveDirected } from '../DirectedFilm';\n`,
    );
  } else {
    installActiveComponent(
      'nextword',
      `export { NextWordLoop as ActiveNextWord } from '../NextWordLoop';\n`,
    );
  }
}
