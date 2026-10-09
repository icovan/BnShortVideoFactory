/**
 * 设计参考图 → JobLook（锁皮）
 * 1) ffmpeg 采样主色（始终可用）
 * 2) 若 LLM 支持 vision，再补 energy / motionNotes
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import type { Settings } from '../../../shared/src/index.ts';
import { chatVisionJson } from '../llm.ts';
import { normalizeLook, type JobLook, type LookFamily } from './look.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const DATA_DIR = join(ROOT, 'data');
const CACHE_FILE = join(DATA_DIR, 'style-look-cache.json');
const IMG_RE = /\.(webp|png|jpe?g|gif)$/i;

function dirHasImages(dir: string): boolean {
  if (!existsSync(dir)) return false;
  try {
    return readdirSync(dir).some((f) => IMG_RE.test(f));
  } catch {
    return false;
  }
}

/** 候选目录：env → 开发态 cankao → 安装包 assets → 可写 data */
function styleRefsCandidates(): string[] {
  const out: string[] = [];
  const push = (d?: string | null) => {
    const t = (d || '').trim();
    if (!t || out.includes(t)) return;
    out.push(t);
  };
  push(process.env.STYLE_REFS_DIR);
  push(join(ROOT, '../cankao/style'));
  push(join(ROOT, 'assets/style-refs'));
  push(join(ROOT, 'packages/create-core/assets/style-refs'));
  push(join(DATA_DIR, 'style-refs'));
  return out;
}

/**
 * 主目录：优先「已有参考图」的目录。
 * 旧逻辑会 mkdir 空 data/style-refs 并直接返回，安装包列表永远为空。
 */
export function styleRefsDir(): string {
  for (const d of styleRefsCandidates()) {
    if (dirHasImages(d)) return d;
  }
  const bundled = join(ROOT, 'assets/style-refs');
  try {
    mkdirSync(bundled, { recursive: true });
    return bundled;
  } catch {
    const underData = join(DATA_DIR, 'style-refs');
    mkdirSync(underData, { recursive: true });
    return underData;
  }
}

/** 用户上传参考图的可写目录 */
export function styleRefsUploadDir(): string {
  const underData = join(DATA_DIR, 'style-refs');
  mkdirSync(underData, { recursive: true });
  return underData;
}

export type StyleRefMeta = {
  id: string;
  name: string;
  file: string;
  url: string;
};

export function listStyleRefs(): StyleRefMeta[] {
  const seen = new Set<string>();
  const out: StyleRefMeta[] = [];
  for (const dir of styleRefsCandidates()) {
    if (!existsSync(dir)) continue;
    let files: string[] = [];
    try {
      files = readdirSync(dir).filter((f) => IMG_RE.test(f));
    } catch {
      continue;
    }
    files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    for (const file of files) {
      const id = file.replace(/\.[^.]+$/, '');
      if (seen.has(id) || seen.has(file)) continue;
      seen.add(id);
      seen.add(file);
      out.push({
        id,
        name: id.replace(/[-_]/g, ' '),
        file,
        url: `/style-refs/${encodeURIComponent(file)}`,
      });
    }
  }
  return out;
}

export function resolveStyleRefFile(idOrFile: string): string | null {
  const bare = decodeURIComponent(idOrFile.replace(/^.*[/\\]/, ''));
  for (const dir of styleRefsCandidates()) {
    if (!existsSync(dir)) continue;
    const direct = join(dir, bare);
    if (existsSync(direct)) return direct;
    for (const ext of ['.webp', '.png', '.jpg', '.jpeg', '.gif']) {
      const p = join(dir, `${bare}${ext}`);
      if (existsSync(p)) return p;
      const q = join(dir, bare.replace(/\.[^.]+$/, '') + ext);
      if (existsSync(q)) return q;
    }
  }
  return null;
}

type CacheMap = Record<string, JobLook & { updatedAt?: string }>;

function loadCache(): CacheMap {
  try {
    if (!existsSync(CACHE_FILE)) return {};
    return JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as CacheMap;
  } catch {
    return {};
  }
}

function saveCache(cache: CacheMap) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

function rgbToHex(r: number, g: number, b: number) {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

function luminance(r: number, g: number, b: number) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function sat(r: number, g: number, b: number) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === min) return 0;
  const l = (max + min) / 2;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

/** ffmpeg 缩略采样 → 主色 / 强调色 */
export function paletteLookFromImage(absPath: string, family: LookFamily = 'narrated'): JobLook {
  const r = spawnSync(
    'ffmpeg',
    ['-v', 'error', '-i', absPath, '-vf', 'scale=40:40:flags=bilinear', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'],
    { encoding: 'buffer', maxBuffer: 2_000_000, windowsHide: true },
  );
  if (r.status !== 0 || !r.stdout?.length) {
    return normalizeLook({}, family);
  }
  const buf = r.stdout as Buffer;
  const bins = new Map<string, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i + 2 < buf.length; i += 3) {
    const rr = buf[i];
    const gg = buf[i + 1];
    const bb = buf[i + 2];
    // quantize
    const qr = rr >> 4;
    const qg = gg >> 4;
    const qb = bb >> 4;
    const key = `${qr},${qg},${qb}`;
    const cur = bins.get(key) || { r: 0, g: 0, b: 0, n: 0 };
    cur.r += rr;
    cur.g += gg;
    cur.b += bb;
    cur.n += 1;
    bins.set(key, cur);
  }
  const colors = [...bins.values()]
    .map((c) => ({
      r: c.r / c.n,
      g: c.g / c.n,
      b: c.b / c.n,
      n: c.n,
      lum: luminance(c.r / c.n, c.g / c.n, c.b / c.n),
      sat: sat(c.r / c.n, c.g / c.n, c.b / c.n),
    }))
    .sort((a, b) => b.n - a.n);

  if (!colors.length) return normalizeLook({}, family);

  const canvasC = colors[0];
  const surface: 'dark' | 'light' = canvasC.lum < 0.45 ? 'dark' : 'light';
  const inkC = colors
    .filter((c) => (surface === 'dark' ? c.lum > 0.7 : c.lum < 0.35))
    .sort((a, b) => b.n - a.n)[0]
    || (surface === 'dark'
      ? { r: 245, g: 245, b: 247, n: 1, lum: 0.96, sat: 0 }
      : { r: 20, g: 18, b: 40, n: 1, lum: 0.1, sat: 0.2 });

  const accentC = colors
    .filter((c) => c.sat > 0.18 && Math.abs(c.lum - canvasC.lum) > 0.12)
    .sort((a, b) => b.sat * b.n - a.sat * a.n)[0]
    || colors.find((c) => c !== canvasC)
    || canvasC;

  const mutedC = colors.find((c) => c !== canvasC && c !== accentC && c.sat < 0.35)
    || {
      r: (canvasC.r + inkC.r) / 2,
      g: (canvasC.g + inkC.g) / 2,
      b: (canvasC.b + inkC.b) / 2,
      n: 1,
      lum: 0.5,
      sat: 0.1,
    };

  const canvas = rgbToHex(canvasC.r, canvasC.g, canvasC.b);
  const ink = rgbToHex(inkC.r, inkC.g, inkC.b);
  const accent = rgbToHex(accentC.r, accentC.g, accentC.b);
  const muted = rgbToHex(mutedC.r, mutedC.g, mutedC.b);
  const highlight = accent;
  const brandBg = surface === 'dark'
    ? rgbToHex(canvasC.r * 0.85 + 10, canvasC.g * 0.85 + 10, canvasC.b * 0.85 + 12)
    : rgbToHex(Math.min(255, accentC.r * 0.55 + 40), Math.min(255, accentC.g * 0.55 + 40), Math.min(255, accentC.b * 0.65 + 50));

  return normalizeLook({
    canvas,
    ink,
    accent,
    muted,
    highlight,
    bar: accent,
    brandBg,
    energy: surface === 'dark' ? 'precise' : 'bold',
    surface,
    motionNotes: 'match reference board: same material weight, accent sparingly, large type contrast',
  }, family);
}

function mimeFor(path: string) {
  const e = extname(path).toLowerCase();
  if (e === '.png') return 'image/png';
  if (e === '.jpg' || e === '.jpeg') return 'image/jpeg';
  if (e === '.gif') return 'image/gif';
  return 'image/webp';
}

async function enrichLookWithVision(
  settings: Settings,
  dataUrl: string,
  base: JobLook,
): Promise<JobLook> {
  try {
    const out = await chatVisionJson<{
      canvas?: string;
      ink?: string;
      accent?: string;
      muted?: string;
      highlight?: string;
      brandBg?: string;
      energy?: string;
      surface?: string;
      motionNotes?: string;
    }>(
      settings,
      `You extract a motion-design LOOK LOCK from a style reference still (not a storyboard).
Return JSON only. Hex must be #RRGGBB.
Fields: canvas, ink, accent, muted, highlight, brandBg, energy (one word), surface ("dark"|"light"),
motionNotes (12–20 English words: material + motion grammar to MATCH this frame — density, type weight, accent use).
Do NOT invent unrelated neon purple skins. Stay faithful to the image.`,
      'Extract the look lock for Remotion props from this design reference.',
      dataUrl,
      0.2,
    );
    return normalizeLook({
      canvas: out.canvas || base.canvas,
      ink: out.ink || base.ink,
      accent: out.accent || base.accent,
      muted: out.muted || base.muted,
      highlight: out.highlight || base.highlight,
      brandBg: out.brandBg || base.brandBg,
      bar: out.accent || base.accent,
      energy: out.energy || base.energy,
      surface: out.surface === 'light' || out.surface === 'dark' ? out.surface : base.surface,
      motionNotes: out.motionNotes || base.motionNotes,
    }, base.surface === 'light' ? 'narrated' : 'launch');
  } catch {
    return base;
  }
}

export async function extractLookFromFile(
  absPath: string,
  settings: Settings,
  family: LookFamily = 'narrated',
  opts?: { useVision?: boolean; cacheKey?: string },
): Promise<JobLook> {
  const key = opts?.cacheKey || createHash('sha1').update(readFileSync(absPath)).digest('hex').slice(0, 16);
  const cache = loadCache();
  if (cache[key]?.canvas) {
    return normalizeLook(cache[key], family);
  }

  let look = paletteLookFromImage(absPath, family);
  if (opts?.useVision !== false && settings.llmApiKey) {
    const buf = readFileSync(absPath);
    const dataUrl = `data:${mimeFor(absPath)};base64,${buf.toString('base64')}`;
    look = await enrichLookWithVision(settings, dataUrl, look);
  }
  cache[key] = { ...look, updatedAt: new Date().toISOString() };
  saveCache(cache);
  return look;
}

export async function extractLookFromDataUrl(
  dataUrl: string,
  settings: Settings,
  family: LookFamily = 'narrated',
): Promise<JobLook> {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) throw new Error('invalid style image dataUrl');
  const ext = m[1].includes('png') ? '.png' : m[1].includes('jpeg') || m[1].includes('jpg') ? '.jpg' : m[1].includes('webp') ? '.webp' : '.bin';
  const tmpDir = join(DATA_DIR, 'style-uploads');
  mkdirSync(tmpDir, { recursive: true });
  const hash = createHash('sha1').update(m[2].slice(0, 2000)).digest('hex').slice(0, 12);
  const abs = join(tmpDir, `${hash}${ext}`);
  if (!existsSync(abs)) writeFileSync(abs, Buffer.from(m[2], 'base64'));
  return extractLookFromFile(abs, settings, family, { cacheKey: `up-${hash}` });
}

export async function resolveStyleLook(opts: {
  styleRefId?: string;
  styleRefDataUrl?: string;
  settings: Settings;
  family?: LookFamily;
}): Promise<{ look: JobLook; source: string } | null> {
  const family = opts.family || 'narrated';
  if (opts.styleRefDataUrl?.startsWith('data:image/')) {
    const look = await extractLookFromDataUrl(opts.styleRefDataUrl, opts.settings, family);
    return { look, source: 'upload' };
  }
  if (opts.styleRefId) {
    const file = resolveStyleRefFile(opts.styleRefId);
    if (!file) throw new Error(`找不到设计参考：${opts.styleRefId}`);
    const look = await extractLookFromFile(file, opts.settings, family, {
      cacheKey: `ref-${basename(file)}`,
    });
    return { look, source: basename(file) };
  }
  return null;
}

export function styleLookLockLine(look: JobLook, source: string, opts?: { mono?: boolean }) {
  if (opts?.mono) {
    return `STYLE REF (texture only, from ${source}): canvas=${look.canvas} ink=${look.ink}. Audience asked MONOCHROME / woodcut — NO chroma accent, NO collage color wipes. Material = ink + paper grain / hatch from the ref; palette already reconciled to mono.`;
  }
  return `STYLE REF LOCK (from ${source}): surface=${look.surface} energy=${look.energy} canvas=${look.canvas} ink=${look.ink} accent=${look.accent} muted=${look.muted} highlight=${look.highlight} brandBg=${look.brandBg}. ${look.motionNotes}
Match this reference board's material and accent grammar. Do NOT drift to Linear / PageOn / sandwich defaults.`;
}
