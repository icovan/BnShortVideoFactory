import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SFX_ASSETS } from './catalog.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
/** apps/server/src/sfx → monorepo root (biunow-video-factory) */
const ROOT = join(HERE, '../../../..');
export const SFX_PUBLIC_DIR = join(ROOT, 'packages/remotion-explainer/public/sfx');

const SOUNDCN = 'https://cdn.jsdelivr.net/gh/kapishdima/soundcn@main/assets';
const IFACE = `${SOUNDCN}/kenney_interface-sounds`;
const IMPACT = `${SOUNDCN}/kenney_impact-sounds`;
const SCIFI = `${SOUNDCN}/kenney_sci-fi-sounds`;

/** local filename → remote URL（开源 CDN，不自创） */
const REMOTE: Record<string, string> = {
  // Remotion / remotion.media
  'whoosh.wav': 'https://remotion.media/whoosh.wav',
  'whip.wav': 'https://remotion.media/whip.wav',
  'page-turn.wav': 'https://remotion.media/page-turn.wav',
  'switch.wav': 'https://remotion.media/switch.wav',
  'mouse-click.wav': 'https://remotion.media/mouse-click.wav',
  'shutter-modern.wav': 'https://remotion.media/shutter-modern.wav',
  'shutter-old.wav': 'https://remotion.media/shutter-old.wav',
  'ding.wav': 'https://remotion.media/ding.wav',
  'vine-boom.wav': 'https://remotion.media/vine-boom.wav',
  'dramatic-boomer.wav': 'https://remotion.media/dramatic-boomer.wav',
  'record-scratch.wav': 'https://remotion.media/record-scratch.wav',
  'snapchat-notification.wav': 'https://remotion.media/snapchat-notification.wav',

  // Kenney UI Audio (Calinou mirror — legacy names)
  'kenney-click-1.wav': 'https://cdn.jsdelivr.net/gh/Calinou/kenney-ui-audio@master/Audio/click1.ogg',
  'kenney-click-2.wav': 'https://cdn.jsdelivr.net/gh/Calinou/kenney-ui-audio@master/Audio/click2.ogg',
  'kenney-click-3.wav': 'https://cdn.jsdelivr.net/gh/Calinou/kenney-ui-audio@master/Audio/click3.ogg',
  'kenney-switch-1.wav': 'https://cdn.jsdelivr.net/gh/Calinou/kenney-ui-audio@master/Audio/switch1.ogg',
  'kenney-switch-2.wav': 'https://cdn.jsdelivr.net/gh/Calinou/kenney-ui-audio@master/Audio/switch2.ogg',
  'kenney-switch-3.wav': 'https://cdn.jsdelivr.net/gh/Calinou/kenney-ui-audio@master/Audio/switch3.ogg',
  'kenney-mouseclick.wav': 'https://cdn.jsdelivr.net/gh/Calinou/kenney-ui-audio@master/Audio/mouseclick1.ogg',
  'kenney-rollover.wav': 'https://cdn.jsdelivr.net/gh/Calinou/kenney-ui-audio@master/Audio/rollover1.ogg',

  // Kenney Interface Sounds (soundcn mirror, CC0)
  'iface-click-001.ogg': `${IFACE}/click_001.ogg`,
  'iface-click-002.ogg': `${IFACE}/click_002.ogg`,
  'iface-click-003.ogg': `${IFACE}/click_003.ogg`,
  'iface-click-004.ogg': `${IFACE}/click_004.ogg`,
  'iface-select-001.ogg': `${IFACE}/select_001.ogg`,
  'iface-select-003.ogg': `${IFACE}/select_003.ogg`,
  'iface-select-005.ogg': `${IFACE}/select_005.ogg`,
  'iface-switch-001.ogg': `${IFACE}/switch_001.ogg`,
  'iface-switch-003.ogg': `${IFACE}/switch_003.ogg`,
  'iface-toggle-001.ogg': `${IFACE}/toggle_001.ogg`,
  'iface-toggle-003.ogg': `${IFACE}/toggle_003.ogg`,
  'iface-tick-001.ogg': `${IFACE}/tick_001.ogg`,
  'iface-tick-002.ogg': `${IFACE}/tick_002.ogg`,
  'iface-tick-004.ogg': `${IFACE}/tick_004.ogg`,
  'iface-drop-001.ogg': `${IFACE}/drop_001.ogg`,
  'iface-drop-003.ogg': `${IFACE}/drop_003.ogg`,
  'iface-bong-001.ogg': `${IFACE}/bong_001.ogg`,
  'iface-pluck-001.ogg': `${IFACE}/pluck_001.ogg`,
  'iface-pluck-002.ogg': `${IFACE}/pluck_002.ogg`,
  'iface-confirm-001.ogg': `${IFACE}/confirmation_001.ogg`,
  'iface-confirm-002.ogg': `${IFACE}/confirmation_002.ogg`,
  'iface-confirm-003.ogg': `${IFACE}/confirmation_003.ogg`,
  'iface-confirm-004.ogg': `${IFACE}/confirmation_004.ogg`,
  'iface-question-001.ogg': `${IFACE}/question_001.ogg`,
  'iface-open-001.ogg': `${IFACE}/open_001.ogg`,
  'iface-open-002.ogg': `${IFACE}/open_002.ogg`,
  'iface-open-003.ogg': `${IFACE}/open_003.ogg`,
  'iface-open-004.ogg': `${IFACE}/open_004.ogg`,
  'iface-maximize-001.ogg': `${IFACE}/maximize_001.ogg`,
  'iface-maximize-002.ogg': `${IFACE}/maximize_002.ogg`,
  'iface-maximize-003.ogg': `${IFACE}/maximize_003.ogg`,
  'iface-minimize-001.ogg': `${IFACE}/minimize_001.ogg`,
  'iface-scroll-001.ogg': `${IFACE}/scroll_001.ogg`,
  'iface-scroll-003.ogg': `${IFACE}/scroll_003.ogg`,
  'iface-close-001.ogg': `${IFACE}/close_001.ogg`,
  'iface-scratch-001.ogg': `${IFACE}/scratch_001.ogg`,
  'iface-scratch-002.ogg': `${IFACE}/scratch_002.ogg`,
  'iface-scratch-003.ogg': `${IFACE}/scratch_003.ogg`,
  'iface-scratch-004.ogg': `${IFACE}/scratch_004.ogg`,
  'iface-glass-001.ogg': `${IFACE}/glass_001.ogg`,
  'iface-glass-003.ogg': `${IFACE}/glass_003.ogg`,

  // Kenney Impact Sounds
  'impact-generic-000.ogg': `${IMPACT}/impactGeneric_light_000.ogg`,
  'impact-generic-001.ogg': `${IMPACT}/impactGeneric_light_001.ogg`,
  'impact-soft-000.ogg': `${IMPACT}/impactSoft_medium_000.ogg`,
  'impact-soft-002.ogg': `${IMPACT}/impactSoft_medium_002.ogg`,
  'impact-punch-000.ogg': `${IMPACT}/impactPunch_medium_000.ogg`,
  'impact-plate-000.ogg': `${IMPACT}/impactPlate_light_000.ogg`,
  'impact-glass-000.ogg': `${IMPACT}/impactGlass_light_000.ogg`,

  // Kenney Sci-Fi (短 hit，不用长引擎循环)
  'scifi-laser-small-000.ogg': `${SCIFI}/laserSmall_000.ogg`,
  'scifi-laser-small-002.ogg': `${SCIFI}/laserSmall_002.ogg`,
  'scifi-laser-retro-000.ogg': `${SCIFI}/laserRetro_000.ogg`,
  'scifi-low-explosion-000.ogg': `${SCIFI}/lowFrequency_explosion_000.ogg`,
};

const ALIASES: Record<string, string> = {
  'click.wav': 'mouse-click.wav',
  'lowboom.wav': 'vine-boom.wav',
};

let ready: Promise<void> | null = null;

async function download(url: string, dest: string) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 20_000);
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) throw new Error(`SFX download ${res.status}: ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200) throw new Error(`SFX too small: ${url}`);
    // 跳过超长素材（>1.5s 近似 > 200KB 的 hit 音效不合适）
    if (buf.length > 350_000) throw new Error(`SFX too long for hit: ${url} (${buf.length})`);
    writeFileSync(dest, buf);
  } finally {
    clearTimeout(timer);
  }
}

function hasClip(path: string, minBytes = 200): boolean {
  return existsSync(path) && statSync(path).size > minBytes;
}

async function mapPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

/** 确保开源音效已落到 public/sfx */
export function ensureSfxAssets(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      mkdirSync(SFX_PUBLIC_DIR, { recursive: true });
      console.log(`[sfx] library dir: ${SFX_PUBLIC_DIR}`);

      const jobs = Object.entries(REMOTE).filter(([file]) => !hasClip(join(SFX_PUBLIC_DIR, file)));
      let fetched = 0;
      await mapPool(jobs, 8, async ([file, url]) => {
        const dest = join(SFX_PUBLIC_DIR, file);
        try {
          await download(url, dest);
          fetched += 1;
        } catch (e) {
          console.warn('[sfx]', e instanceof Error ? e.message : e);
        }
      });
      if (fetched) console.log(`[sfx] fetched ${fetched} new clips`);

      for (const [alias, src] of Object.entries(ALIASES)) {
        const from = join(SFX_PUBLIC_DIR, src);
        const to = join(SFX_PUBLIC_DIR, alias);
        if (existsSync(from) && !existsSync(to)) copyFileSync(from, to);
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
      if (missing === 0) {
        console.log(`[sfx] ready — ${listLocalSfx().length} open-library clips`);
      } else {
        console.warn(`[sfx] ready with ${missing} missing (fallbacks still work)`);
      }
    })();
  }
  return ready;
}

/** 强制重新拉取（开发用） */
export function resetSfxEnsure() {
  ready = null;
}

/** 把角色库文件同步进项目 public/sfx */
export function copySfxIntoProject(projectPublicDir: string, files: string[]) {
  const destDir = join(projectPublicDir, 'sfx');
  mkdirSync(destDir, { recursive: true });
  const uniq = [...new Set(files.map((f) => f.replace(/^sfx\//, '')))];
  for (const name of uniq) {
    const src = join(SFX_PUBLIC_DIR, name);
    if (!existsSync(src)) continue;
    copyFileSync(src, join(destDir, name));
  }
}

export function listLocalSfx(): string[] {
  if (!existsSync(SFX_PUBLIC_DIR)) return [];
  return readdirSync(SFX_PUBLIC_DIR).filter((n) => /\.(wav|mp3|ogg)$/i.test(n));
}
