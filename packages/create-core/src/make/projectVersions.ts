/**
 * 成片版本：初始版本 → 改过版本1…n
 * 快照目录：outputs/{dir}/_versions/{id}/
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type { ProjectVersion } from '../../../shared/src/index.ts';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function copyIfExists(src: string, dest: string) {
  if (!existsSync(src)) return;
  copyFileSync(src, dest);
}

async function copyIfExistsRetry(src: string, dest: string, tries = 10) {
  if (!existsSync(src)) return;
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      copyFileSync(src, dest);
      return;
    } catch (e) {
      last = e;
      await sleep(150 + i * 120);
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

export function isInitialVersion(v: ProjectVersion) {
  if (v.kind === 'initial') return true;
  return /^(初始版本|Initial)\b/i.test(v.label || '');
}

export function remakeIndexOf(v: ProjectVersion): number {
  if (typeof v.remakeIndex === 'number' && v.remakeIndex > 0) return v.remakeIndex;
  const m = String(v.label || '').match(/改过版本\s*(\d+)/i)
    || String(v.label || '').match(/Edit\s*#?\s*(\d+)/i)
    || String(v.label || '').match(/remake\s*#?\s*(\d+)/i);
  return m ? Number(m[1]) || 0 : 0;
}

export function nextRemakeIndex(versions: ProjectVersion[]): number {
  let max = 0;
  for (const v of versions) {
    const n = remakeIndexOf(v);
    if (n > max) max = n;
  }
  return max + 1;
}

export function labelInitial(lang: 'zh' | 'en' = 'zh') {
  return lang === 'en' ? 'Initial' : '初始版本';
}

export function labelRemake(n: number, lang: 'zh' | 'en' = 'zh') {
  return lang === 'en' ? `Edit ${n}` : `改过版本${n}`;
}

/** 展示用：按时间排序并规范标签（不改磁盘，仅返回新数组） */
export function normalizeVersionLabels(
  versions: ProjectVersion[],
  lang: 'zh' | 'en' = 'zh',
): ProjectVersion[] {
  const cleaned = [...versions].filter((v) => !/^回退前/.test(v.label || ''));
  const proper = cleaned.filter(
    (v) =>
      v.kind === 'initial'
      || v.kind === 'remake'
      || /^(初始版本|Initial)\b/i.test(v.label || '')
      || /^改过版本\s*\d+/i.test(v.label || '')
      || /^Edit\s+\d+/i.test(v.label || ''),
  );
  // 旧「重做前归档」多份内容往往相同：只保留最早一份当初始版本
  const legacy = cleaned
    .filter((v) => !proper.includes(v))
    .sort((a, b) => Date.parse(a.createdAt || '') - Date.parse(b.createdAt || ''));
  const merged = proper.length
    ? proper
    : legacy.length
      ? [legacy[0]]
      : [];
  const sorted = merged.sort((a, b) => Date.parse(a.createdAt || '') - Date.parse(b.createdAt || ''));
  if (!sorted.length) return [];
  return sorted.map((v, i) => {
    if (i === 0) {
      return {
        ...v,
        kind: 'initial' as const,
        remakeIndex: undefined,
        label: labelInitial(lang),
      };
    }
    const n = remakeIndexOf(v) || i;
    return {
      ...v,
      kind: 'remake' as const,
      remakeIndex: n,
      label: labelRemake(n, lang),
    };
  });
}

export async function snapshotProjectVersion(
  dir: string,
  meta: {
    id?: string;
    label: string;
    note?: string;
    beatIndexes?: number[];
    durationSec?: number;
    kind?: 'initial' | 'remake';
    remakeIndex?: number;
  },
): Promise<ProjectVersion> {
  const versionId = meta.id || `v${Date.now().toString(36)}`;
  const rel = `_versions/${versionId}`;
  const dest = join(dir, rel);
  mkdirSync(dest, { recursive: true });
  mkdirSync(join(dest, 'public'), { recursive: true });
  await copyIfExistsRetry(join(dir, 'final.mp4'), join(dest, 'final.mp4'));
  copyIfExists(join(dir, 'props.json'), join(dest, 'props.json'));
  copyIfExists(join(dir, 'storyboard.json'), join(dest, 'storyboard.json'));
  copyIfExists(join(dir, 'skill-plan.json'), join(dest, 'skill-plan.json'));
  copyIfExists(join(dir, 'ActiveDirected.tsx'), join(dest, 'ActiveDirected.tsx'));
  copyIfExists(join(dir, 'contact-sheet.png'), join(dest, 'contact-sheet.png'));
  const stillsSrc = join(dir, 'stills');
  if (existsSync(stillsSrc)) {
    mkdirSync(join(dest, 'stills'), { recursive: true });
    for (const f of readdirSync(stillsSrc).filter((x) => x.endsWith('.png')).slice(0, 16)) {
      copyIfExists(join(stillsSrc, f), join(dest, 'stills', f));
    }
  }
  const version: ProjectVersion = {
    id: versionId,
    rel,
    label: meta.label,
    createdAt: new Date().toISOString(),
    note: meta.note,
    beatIndexes: meta.beatIndexes,
    durationSec: meta.durationSec,
    kind: meta.kind,
    remakeIndex: meta.remakeIndex,
  };
  writeFileSync(join(dest, 'version.json'), JSON.stringify(version, null, 2), 'utf8');
  return version;
}

/** 把版本快照恢复到工作区（final.mp4 带重试） */
export async function restoreSnapshotToDir(dir: string, versionRel: string) {
  const src = join(dir, versionRel);
  if (!existsSync(src)) throw new Error('版本文件丢失');
  await copyIfExistsRetry(join(src, 'final.mp4'), join(dir, 'final.mp4'));
  copyIfExists(join(src, 'props.json'), join(dir, 'props.json'));
  copyIfExists(join(src, 'storyboard.json'), join(dir, 'storyboard.json'));
  copyIfExists(join(src, 'skill-plan.json'), join(dir, 'skill-plan.json'));
  copyIfExists(join(src, 'ActiveDirected.tsx'), join(dir, 'ActiveDirected.tsx'));
  copyIfExists(join(src, 'contact-sheet.png'), join(dir, 'contact-sheet.png'));
  const stillsSrc = join(src, 'stills');
  const stillsDest = join(dir, 'stills');
  if (existsSync(stillsSrc)) {
    mkdirSync(stillsDest, { recursive: true });
    for (const f of readdirSync(stillsSrc).filter((x) => x.endsWith('.png'))) {
      copyIfExists(join(stillsSrc, f), join(stillsDest, f));
    }
  }
  // 触碰 final.mp4 mtime，方便前端缓存失效判断
  const mp4 = join(dir, 'final.mp4');
  if (existsSync(mp4)) {
    try {
      const tmp = `${mp4}.touch`;
      copyFileSync(mp4, tmp);
      try {
        unlinkSync(mp4);
      } catch {
        /* ignore */
      }
      renameSync(tmp, mp4);
    } catch {
      /* ignore */
    }
    void statSync(mp4);
  }
}
