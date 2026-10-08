/**
 * 出片 / 改分镜全局队列：默认串行，避免 Remotion / TTS / LLM 抢资源。
 * FACTORY_MAKE_CONCURRENCY 可调并发（≥1）。
 */
import type { Project } from '../../shared/src/index.ts';
import { failPipeline } from './pipeline.ts';
import { store } from './store.ts';

export type QueueJobKind = 'make' | 'remake';

type QueueJob = {
  id: string;
  kind: QueueJobKind;
  run: () => Promise<void>;
};

const concurrency = Math.max(1, Math.min(4, Number(process.env.FACTORY_MAKE_CONCURRENCY || 1) || 1));

const pending: QueueJob[] = [];
const runningIds = new Set<string>();
let active = 0;
let pumping = false;

function refreshQueuedDetails() {
  const waiting = pending.length;
  pending.forEach((job, i) => {
    const cur = store.getProject(job.id);
    if (!cur || cur.status !== 'queued') return;
    const pos = i + 1;
    const pipeline = (cur.pipeline || []).map((s, idx) =>
      idx === 0
        ? {
            ...s,
            status: 'pending' as const,
            detail:
              waiting <= 1
                ? '排队中 · 即将开始'
                : `排队中 · 第 ${pos} 位 · 前面还有 ${pos - 1} 个任务`,
          }
        : s,
    );
    store.patchProject(job.id, { status: 'queued', pipeline, error: undefined });
  });
}

async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    while (active < concurrency && pending.length > 0) {
      const job = pending.shift()!;
      if (!store.getProject(job.id)) continue;
      active += 1;
      runningIds.add(job.id);
      store.patchProject(job.id, { status: 'running', error: undefined });
      refreshQueuedDetails();
      void (async () => {
        try {
          await job.run();
        } catch (e) {
          if (store.getProject(job.id)) {
            failPipeline(job.id, e instanceof Error ? e.message : String(e));
          }
        } finally {
          runningIds.delete(job.id);
          active = Math.max(0, active - 1);
          refreshQueuedDetails();
          void pump();
        }
      })();
    }
  } finally {
    pumping = false;
  }
}

/** 入队；已在跑或已在队则忽略重复 */
export function enqueueJob(job: QueueJob): Project | null {
  const cur = store.getProject(job.id);
  if (!cur) return null;
  if (runningIds.has(job.id) || pending.some((j) => j.id === job.id)) {
    return withQueueMeta(cur);
  }
  pending.push(job);
  const pipeline = (cur.pipeline || []).map((s, idx) =>
    idx === 0
      ? { ...s, status: 'pending' as const, detail: '排队中 · 等待出片位' }
      : { ...s, status: s.status === 'running' ? ('pending' as const) : s.status },
  );
  store.patchProject(job.id, {
    status: 'queued',
    error: undefined,
    pipeline,
  });
  refreshQueuedDetails();
  void pump();
  const fresh = store.getProject(job.id);
  return fresh ? withQueueMeta(fresh) : null;
}

/** 取消排队（尚未开始）。运行中的任务无法硬中断 Remotion。 */
export function cancelQueued(id: string): boolean {
  const i = pending.findIndex((j) => j.id === id);
  if (i < 0) return false;
  pending.splice(i, 1);
  refreshQueuedDetails();
  return true;
}

export function isJobRunning(id: string): boolean {
  return runningIds.has(id);
}

export function isJobQueued(id: string): boolean {
  return pending.some((j) => j.id === id);
}

export type QueueSnapshot = {
  concurrency: number;
  active: number;
  running: string[];
  queued: { id: string; kind: QueueJobKind; position: number }[];
};

export function queueSnapshot(): QueueSnapshot {
  return {
    concurrency,
    active,
    running: [...runningIds],
    queued: pending.map((j, i) => ({ id: j.id, kind: j.kind, position: i + 1 })),
  };
}

export function queuePosition(id: string): number | undefined {
  const i = pending.findIndex((j) => j.id === id);
  if (i >= 0) return i + 1;
  if (runningIds.has(id)) return 0;
  return undefined;
}

/** API 响应附加排队元数据（不落盘） */
export function withQueueMeta<T extends Project>(p: T): T & {
  queuePosition?: number;
  queueWaiting?: number;
} {
  const snap = queueSnapshot();
  const hit = snap.queued.find((q) => q.id === p.id);
  if (hit) {
    return { ...p, queuePosition: hit.position, queueWaiting: snap.queued.length };
  }
  if (snap.running.includes(p.id)) {
    return { ...p, queuePosition: 0, queueWaiting: snap.queued.length };
  }
  return { ...p, queueWaiting: snap.queued.length };
}

/** 进程启动：把上次残留的 queued/running 标失败，避免幽灵任务 */
export function recoverStaleJobs() {
  const list = store.projects();
  for (const p of list) {
    if (p.status === 'queued' || p.status === 'running') {
      failPipeline(p.id, '引擎已重启，任务中断 — 请重新提交');
    }
  }
  pending.length = 0;
  runningIds.clear();
  active = 0;
}
