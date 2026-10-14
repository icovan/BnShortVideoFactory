/**
 * 音效库 = Agent sfx-kit-lite（opus-sound-layer 精选子集）。
 * 素材：packages/remotion-explainer/public/sfx/{type}/{id}.wav
 * 目录：同目录 catalog.json（types + sounds）
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type SfxRole =
  | 'hit'
  | 'boom'
  | 'riser'
  | 'reverse'
  | 'transition'
  | 'whoosh'
  | 'swish'
  | 'glitch'
  | 'ui'
  | 'click'
  | 'key'
  | 'tick'
  | 'tap'
  | 'pop'
  | 'thump'
  | 'paper'
  | 'chime'
  | 'shimmer'
  | 'zap';

export type SfxIntent = 'enter' | 'accent' | 'settle';

export type SfxAsset = {
  role: SfxRole;
  /** public/sfx 相对路径，如 whoosh/fs-xxx.wav */
  file: string;
  volume: number;
  label: string;
  source: string;
  id?: string;
};

export type SfxCue = {
  role: SfxRole;
  intent: SfxIntent;
  file: string;
  volume: number;
  atSec: number;
};

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../..');
export const SFX_KIT_PUBLIC = join(ROOT, 'packages/remotion-explainer/public/sfx');

/** Mix levels vs VO@1.0 — loud enough to read as hits, still under speech. */
const TYPE_VOLUME: Record<SfxRole, number> = {
  hit: 0.42,
  boom: 0.38,
  riser: 0.28,
  reverse: 0.28,
  transition: 0.4,
  whoosh: 0.44,
  swish: 0.4,
  glitch: 0.34,
  ui: 0.36,
  click: 0.36,
  key: 0.32,
  tick: 0.34,
  tap: 0.38,
  pop: 0.36,
  thump: 0.4,
  paper: 0.38,
  chime: 0.42,
  shimmer: 0.34,
  zap: 0.36,
};

const ALL_ROLES = Object.keys(TYPE_VOLUME) as SfxRole[];

type KitCatalog = {
  types?: Record<string, { defaults?: string[]; about?: string }>;
  sounds?: Array<{
    id: string;
    type: string;
    file: string;
    credit?: string;
    default?: boolean;
    tags?: string[];
  }>;
};

function loadKit(): { assets: Record<SfxRole, SfxAsset[]>; defaults: Record<SfxRole, string[]> } {
  const assets = Object.fromEntries(ALL_ROLES.map((r) => [r, [] as SfxAsset[]])) as Record<
    SfxRole,
    SfxAsset[]
  >;
  const defaults = Object.fromEntries(ALL_ROLES.map((r) => [r, [] as string[]])) as Record<
    SfxRole,
    string[]
  >;
  const catPath = join(SFX_KIT_PUBLIC, 'catalog.json');
  if (!existsSync(catPath)) return { assets, defaults };
  try {
    const cat = JSON.parse(readFileSync(catPath, 'utf8')) as KitCatalog;
    for (const [type, meta] of Object.entries(cat.types || {})) {
      if (!ALL_ROLES.includes(type as SfxRole)) continue;
      defaults[type as SfxRole] = (meta.defaults || []).map((id) =>
        id.includes('.') ? id : `${id}.wav`,
      );
    }
    for (const s of cat.sounds || []) {
      if (!ALL_ROLES.includes(s.type as SfxRole)) continue;
      const role = s.type as SfxRole;
      const file = (s.file || `${s.id}.wav`).replace(/\\/g, '/');
      assets[role].push({
        role,
        file,
        volume: TYPE_VOLUME[role],
        label: s.id.split('/').pop() || s.id,
        source: s.credit || 'sfx-kit-lite',
        id: s.id,
      });
    }
    // defaults 优先排前
    for (const role of ALL_ROLES) {
      const prefer = new Set(
        (defaults[role] || []).map((d) => d.replace(/\.wav$/i, '')),
      );
      assets[role].sort((a, b) => {
        const ap = prefer.has((a.id || a.file).replace(/\.wav$/i, '')) ? 0 : 1;
        const bp = prefer.has((b.id || b.file).replace(/\.wav$/i, '')) ? 0 : 1;
        return ap - bp;
      });
    }
  } catch (e) {
    console.warn('[sfx] catalog.json parse failed', e);
  }
  return { assets, defaults };
}

const KIT = loadKit();
/** 可变：ensureSfxAssets 同步 catalog.json 后可 reloadSfxKit() */
export const SFX_ASSETS: Record<SfxRole, SfxAsset[]> = KIT.assets;

/** 磁盘 catalog/素材更新后重载内存索引（不重启进程） */
export function reloadSfxKit(): { roles: number; clips: number } {
  const next = loadKit();
  for (const role of ALL_ROLES) {
    SFX_ASSETS[role] = next.assets[role];
  }
  return sfxKitStats();
}

/** 技能 → enter 角色（对齐 kit type 语义） */
const SKILL_ENTER: Record<string, SfxRole> = {
  'logo-animation': 'whoosh',
  'youtube-intro-outro': 'transition',
  'launch-video': 'swish',
  'promo-video': 'whoosh',
  'ad-creative-video': 'swish',
  'countdown-video': 'tick',
  'text-message-animation': 'pop',
  'photo-slideshow': 'swish',
  'whiteboard-animation': 'paper',
  'stickman-animation': 'whoosh',
  'kinetic-typography': 'tap',
  'caption-animation': 'tick',
  'product-demo-video': 'ui',
  'testimonial-video': 'ui',
  'wrapped-video': 'whoosh',
  'chart-animation': 'tick',
  'animated-infographic': 'tap',
  'explainer-video': 'whoosh',
  'short-form-video': 'swish',
  'beat-sync-editing': 'hit',
  'diagram-animation': 'swish',
};

const SKILL_ACCENT: Record<string, SfxRole> = {
  'product-demo-video': 'click',
  'countdown-video': 'tick',
  'chart-animation': 'tick',
  'animated-infographic': 'tap',
  'kinetic-typography': 'tap',
  'caption-animation': 'tick',
  'text-message-animation': 'pop',
  'photo-slideshow': 'click',
  'whiteboard-animation': 'paper',
  'stickman-animation': 'pop',
  'explainer-video': 'click',
  'short-form-video': 'pop',
  'launch-video': 'zap',
  'promo-video': 'tap',
  'ad-creative-video': 'hit',
  'beat-sync-editing': 'hit',
  'diagram-animation': 'tick',
};

type Density = 'sparse' | 'normal' | 'dense';

function densityFor(primary: string): Density {
  if (
    ['short-form-video', 'launch-video', 'promo-video', 'ad-creative-video', 'beat-sync-editing', 'countdown-video'].includes(
      primary,
    )
  ) {
    return 'dense';
  }
  // logo 开场也要 enter+accent，勿 sparse 到几乎只 whoosh
  if (['testimonial-video', 'whiteboard-animation'].includes(primary)) {
    return 'sparse';
  }
  // explainer / diagram / logo-animation 默认 normal
  return 'normal';
}

const INTENT_SCALE: Record<SfxIntent, number> = {
  enter: 1,
  accent: 0.88,
  settle: 0.82,
};

/** 目标角色为空时按 intent 回退，禁止所有 intent 都落到同一 whoosh */
const FALLBACK_BY_INTENT: Record<SfxIntent, SfxRole[]> = {
  enter: ['whoosh', 'swish', 'transition', 'hit', 'boom'],
  accent: ['click', 'tap', 'tick', 'pop', 'ui', 'key'],
  settle: ['chime', 'ui', 'shimmer', 'pop', 'paper'],
};

function firstAssetForRole(role: SfxRole): SfxAsset | null {
  const list = SFX_ASSETS[role];
  return list?.length ? list[0] : null;
}

function fallbackAsset(role: SfxRole, intent: SfxIntent = 'enter'): SfxAsset {
  const direct = firstAssetForRole(role);
  if (direct) return direct;
  for (const r of FALLBACK_BY_INTENT[intent] || []) {
    const hit = firstAssetForRole(r);
    if (hit) return hit;
  }
  for (const r of ALL_ROLES) {
    const hit = firstAssetForRole(r);
    if (hit) return hit;
  }
  return {
    role: 'whoosh',
    file: 'whoosh/fs-30240-swoop1-flac-1.wav',
    volume: 0.4,
    label: 'missing',
    source: 'sfx-kit-lite',
  };
}

/** 片级轮换：同文件不连用；intent 回退避免全员 whoosh */
export class SfxPicker {
  private cursor = new Map<SfxRole, number>();
  private recent: string[] = [];

  pick(role: SfxRole, salt = 0, intent: SfxIntent = 'enter'): SfxAsset {
    let list = SFX_ASSETS[role]?.length ? SFX_ASSETS[role] : [];
    let pickRole = role;
    if (!list.length) {
      for (const r of FALLBACK_BY_INTENT[intent] || []) {
        if (SFX_ASSETS[r]?.length) {
          list = SFX_ASSETS[r];
          pickRole = r;
          break;
        }
      }
    }
    if (!list.length) {
      const fb = fallbackAsset(role, intent);
      this.remember(fb.file);
      return fb;
    }
    const start = ((this.cursor.get(pickRole) || 0) + salt) % list.length;
    for (let i = 0; i < list.length; i++) {
      const asset = list[(start + i) % list.length];
      if (!this.recent.includes(asset.file)) {
        this.cursor.set(pickRole, (start + i + 1) % list.length);
        this.remember(asset.file);
        return asset;
      }
    }
    const asset = list[start % list.length];
    this.cursor.set(pickRole, (start + 1) % list.length);
    this.remember(asset.file);
    return asset;
  }

  private remember(file: string) {
    this.recent.push(file);
    if (this.recent.length > 12) this.recent.shift();
  }
}

function enterRole(opts: { skill?: string; job?: string; index: number; primary?: string }): SfxRole {
  const job = (opts.job || '').toLowerCase();
  const skill = opts.skill || '';
  const primary = opts.primary || '';
  if (job.includes('reveal') || job.includes('drop')) return 'hit';
  if (job.includes('hook') || opts.index === 0) {
    if (primary === 'launch-video' || skill === 'launch-video') return 'boom';
    return SKILL_ENTER[skill] || SKILL_ENTER[primary] || 'whoosh';
  }
  if (job.includes('logo')) return 'whoosh';
  return SKILL_ENTER[skill] || SKILL_ENTER[primary] || 'swish';
}

function accentRole(opts: { skill?: string; primary?: string; keyMotion?: string }): SfxRole {
  const motion = (opts.keyMotion || '').toLowerCase();
  if (motion.includes('list') || motion.includes('bullet') || motion.includes('type')) return 'tick';
  if (motion.includes('chart') || motion.includes('bar') || motion.includes('count')) return 'tick';
  if (motion.includes('glitch') || motion.includes('stutter')) return 'glitch';
  if (motion.includes('laser') || motion.includes('zap')) return 'zap';
  if (motion.includes('paper') || motion.includes('page')) return 'paper';
  if (motion.includes('key') || motion.includes('type')) return 'key';
  const skill = opts.skill || '';
  const primary = opts.primary || '';
  return SKILL_ACCENT[skill] || SKILL_ACCENT[primary] || 'click';
}

function settleRole(opts: { job?: string; primary?: string; index: number; total: number }): SfxRole {
  const job = (opts.job || '').toLowerCase();
  if (job.includes('cta') || job.includes('end') || job.includes('settle') || opts.index === opts.total - 1) {
    return 'chime';
  }
  if (opts.primary === 'logo-animation') return 'shimmer';
  return 'ui';
}

function clampAt(sec: number, durationSec: number): number {
  const max = Math.max(0, durationSec - 0.12);
  return Number(Math.min(Math.max(0, sec), max).toFixed(3));
}

function toCue(asset: SfxAsset, intent: SfxIntent, atSec: number): SfxCue {
  const raw = asset.volume * INTENT_SCALE[intent];
  return {
    role: asset.role,
    intent,
    file: `sfx/${asset.file.replace(/^sfx\//, '')}`,
    volume: Number(Math.min(0.55, Math.max(0.22, raw)).toFixed(3)),
    atSec,
  };
}

export function buildSceneSfxTimeline(
  opts: {
    skill?: string;
    job?: string;
    index: number;
    total: number;
    primary?: string;
    durationSec: number;
    items?: string[];
    keyMotion?: string;
  },
  picker: SfxPicker = new SfxPicker(),
): SfxCue[] {
  const dur = Math.max(0.6, opts.durationSec || 1.2);
  const density = densityFor(opts.primary || '');
  const cues: SfxCue[] = [];
  const job = (opts.job || '').toLowerCase();

  cues.push(toCue(picker.pick(enterRole(opts), opts.index, 'enter'), 'enter', clampAt(0.04, dur)));

  const itemCount = opts.items?.filter(Boolean).length || 0;
  let accentCount = 0;
  if (density === 'dense') accentCount = Math.min(3, Math.max(1, itemCount || (dur >= 2.2 ? 2 : 1)));
  else if (density === 'normal') accentCount = itemCount >= 1 ? Math.min(2, Math.max(1, itemCount)) : dur >= 1.8 ? 1 : 0;
  else accentCount = itemCount >= 2 ? Math.min(2, itemCount) : dur >= 2.6 ? 1 : 0;
  // 口播镜至少一记中段 accent，避免「只有入场一击听不见」
  if (dur >= 2.0 && accentCount < 1) accentCount = 1;
  if (job.includes('countdown')) accentCount = Math.min(3, Math.max(accentCount, 2));

  const accentR = accentRole(opts);
  for (let a = 0; a < accentCount; a++) {
    const t = itemCount > 0
      ? 0.28 + ((a + 1) / (accentCount + 1)) * Math.min(dur * 0.72, dur - 0.35)
      : 0.35 + ((a + 1) / (accentCount + 1)) * (dur * 0.55);
    cues.push(toCue(picker.pick(accentR, opts.index * 3 + a, 'accent'), 'accent', clampAt(t, dur)));
  }

  const wantSettle =
    job.includes('cta')
    || job.includes('end')
    || job.includes('settle')
    || opts.index === opts.total - 1
    || (density === 'dense' && dur >= 1.6)
    || (density === 'normal' && dur >= 2.8);

  if (wantSettle && dur >= 1.2) {
    cues.push(toCue(picker.pick(settleRole(opts), opts.index, 'settle'), 'settle', clampAt(dur - 0.32, dur)));
  }

  cues.sort((x, y) => x.atSec - y.atSec);
  const dedup: SfxCue[] = [];
  for (const c of cues) {
    const prev = dedup[dedup.length - 1];
    if (prev && Math.abs(prev.atSec - c.atSec) < 0.12) continue;
    dedup.push(c);
  }
  return dedup;
}

/** @deprecated */
export function buildSceneSfxCue(opts: {
  skill?: string;
  job?: string;
  index: number;
  total: number;
  primary?: string;
  durationSec?: number;
}): SfxCue {
  return buildSceneSfxTimeline({ ...opts, durationSec: opts.durationSec ?? 2.4 })[0];
}

export function resolveSfxAsset(role: SfxRole, sceneIndex = 0): SfxAsset {
  const list = SFX_ASSETS[role] || SFX_ASSETS.whoosh;
  return list[sceneIndex % Math.max(1, list.length)] || fallbackAsset(role);
}

export function sfxKitStats(): { roles: number; clips: number } {
  let clips = 0;
  for (const list of Object.values(SFX_ASSETS)) clips += list.length;
  return { roles: ALL_ROLES.filter((r) => (SFX_ASSETS[r] || []).length > 0).length, clips };
}
