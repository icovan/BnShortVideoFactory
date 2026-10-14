/**
 * 音效落盘：Agent sfx-kit-lite → packages/remotion-explainer/public/sfx
 * 不再从 Kenney CDN 拉取。
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  cpSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SFX_ASSETS, SFX_KIT_PUBLIC, reloadSfxKit, sfxKitStats } from './catalog.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../..');

/** 权威源：环境变量 > Agent/f2v 旁路 vendored 库 > 本仓 public/sfx */
export function resolveSfxKitSource(): string {
  const env = (process.env.BIUNOW_SFX_KIT || process.env.SFX_KIT_LITE || '').trim();
  if (env && existsSync(join(env, 'catalog.json'))) return env;
  const candidates = [
    join(ROOT, '../dsh-file-to-video-skills/assets/sfx-kit-lite'),
    join(ROOT, '../BnFactory/dsh-file-to-video-skills/assets/sfx-kit-lite'),
    join(ROOT, '../BnFactory/file2video-main/packages/remotion-explainer/public/sfx'),
    join(ROOT, '../file2video-main/packages/remotion-explainer/public/sfx'),
  ];
  for (const p of candidates) {
    if (existsSync(join(p, 'catalog.json'))) return p;
  }
  return SFX_KIT_PUBLIC;
}

export const SFX_PUBLIC_DIR = SFX_KIT_PUBLIC;

function hasClip(path: string, minBytes = 200): boolean {
  return existsSync(path) && statSync(path).size > minBytes;
}

let ready: Promise<void> | null = null;

/** 确保 sfx-kit-lite 已在 public/sfx（可从 Agent 目录同步） */
export function ensureSfxAssets(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      mkdirSync(SFX_PUBLIC_DIR, { recursive: true });
      const src = resolveSfxKitSource();
      console.log(`[sfx] kit source: ${src}`);
      console.log(`[sfx] library dir: ${SFX_PUBLIC_DIR}`);

      const srcCat = join(src, 'catalog.json');
      const dstCat = join(SFX_PUBLIC_DIR, 'catalog.json');
      const needSync =
        src !== SFX_PUBLIC_DIR
        && existsSync(srcCat)
        && (!existsSync(dstCat) || !hasClip(join(SFX_PUBLIC_DIR, 'whoosh'), 1));

      // 源与目标不同 → 整库同步（覆盖缺文件 / 缺 catalog）
      if (src !== SFX_PUBLIC_DIR && existsSync(srcCat)) {
        try {
          cpSync(src, SFX_PUBLIC_DIR, { recursive: true, force: needSync || !existsSync(dstCat) });
          console.log('[sfx] synced sfx-kit-lite → public/sfx');
        } catch (e) {
          console.warn('[sfx] sync failed', e instanceof Error ? e.message : e);
        }
      }

      // catalog 在模块加载时可能为空（旧 Kenney 扁平库）；同步后再读一次
      let st = reloadSfxKit();
      if (st.clips === 0) {
        console.error('[sfx] catalog empty after sync — forcing sibling kit copy');
        for (const cand of [
          join(ROOT, '../BnFactory/dsh-file-to-video-skills/assets/sfx-kit-lite'),
          join(ROOT, '../BnFactory/file2video-main/packages/remotion-explainer/public/sfx'),
          join(ROOT, '../dsh-file-to-video-skills/assets/sfx-kit-lite'),
        ]) {
          if (!existsSync(join(cand, 'catalog.json'))) continue;
          try {
            cpSync(cand, SFX_PUBLIC_DIR, { recursive: true, force: true });
            console.log(`[sfx] force-synced from ${cand}`);
            st = reloadSfxKit();
            if (st.clips > 0) break;
          } catch (e) {
            console.warn('[sfx] force sync failed', e instanceof Error ? e.message : e);
          }
        }
      }
      let missing = 0;
      for (const list of Object.values(SFX_ASSETS)) {
        for (const a of list) {
          if (!hasClip(join(SFX_PUBLIC_DIR, a.file))) {
            console.warn(`[sfx] missing ${a.file}`);
            missing += 1;
          }
        }
      }
      if (st.clips === 0) {
        console.error('[sfx] catalog still empty — public/sfx 缺少 catalog.json 或 wav 未就位');
      } else if (missing === 0) {
        console.log(`[sfx] ready — sfx-kit-lite · ${st.roles} types · ${st.clips} clips`);
      } else {
        console.warn(`[sfx] ready with ${missing} missing of ${st.clips} catalogued`);
      }
    })();
  }
  return ready;
}

export function resetSfxEnsure() {
  ready = null;
}

/** 把选用的音效同步进项目 public/sfx（保留 type/ 子目录） */
export function copySfxIntoProject(projectPublicDir: string, files: string[]) {
  const destDir = join(projectPublicDir, 'sfx');
  mkdirSync(destDir, { recursive: true });
  const uniq = [...new Set(files.map((f) => f.replace(/^sfx\//, '').replace(/\\/g, '/')))];
  for (const name of uniq) {
    const src = join(SFX_PUBLIC_DIR, name);
    if (!existsSync(src)) continue;
    const dest = join(destDir, name);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
  }
  // 附带 CREDITS（有则拷）
  for (const meta of ['CREDITS.md', 'catalog.json']) {
    const from = join(SFX_PUBLIC_DIR, meta);
    if (existsSync(from)) {
      copyFileSync(from, join(destDir, meta));
    }
  }
}

export function listLocalSfx(): string[] {
  if (!existsSync(SFX_PUBLIC_DIR)) return [];
  const out: string[] = [];
  const walk = (dir: string, prefix = '') => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      const rel = prefix ? `${prefix}/${n}` : n;
      if (statSync(p).isDirectory()) walk(p, rel);
      else if (/\.(wav|mp3|ogg)$/i.test(n)) out.push(rel.replace(/\\/g, '/'));
    }
  };
  walk(SFX_PUBLIC_DIR);
  return out;
}
