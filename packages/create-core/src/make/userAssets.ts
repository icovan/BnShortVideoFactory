/**
 * 用户上传素材：上屏图 / 配乐 / 文稿
 * 全部以 data URL 进 make，落盘到项目 public/，再进 props。
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

export type ScreenAssetRole = 'logo' | 'product' | 'shot' | 'image';

export type IncomingUserAsset = {
  name: string;
  dataUrl: string;
  /** image | music | doc — 缺省按 mime 推断 */
  kind?: 'image' | 'music' | 'doc';
  role?: ScreenAssetRole;
};

export type ScreenAsset = {
  role: ScreenAssetRole;
  name: string;
  /** 相对 public，如 assets/logo-xxx.png */
  file: string;
};

export type MaterializedAssets = {
  screen: ScreenAsset[];
  musicFile?: string;
  docTexts: { name: string; text: string }[];
};

const MAX_IMAGE = 2_500_000;
const MAX_AUDIO = 10_000_000;
const MAX_DOC = 2_000_000;

function parseDataUrl(dataUrl: string): { mime: string; buf: Buffer } | null {
  const m = dataUrl.match(/^data:([^;,]+)?(;base64)?,([\s\S]+)$/i);
  if (!m) return null;
  const mime = (m[1] || 'application/octet-stream').toLowerCase();
  const b64 = !!m[2];
  try {
    const buf = b64 ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
    return { mime, buf };
  } catch {
    return null;
  }
}

function guessKind(mime: string, name: string, kind?: IncomingUserAsset['kind']): IncomingUserAsset['kind'] {
  if (kind) return kind;
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'music';
  const ext = extname(name).toLowerCase();
  if (['.mp3', '.wav', '.m4a', '.ogg', '.aac', '.flac'].includes(ext)) return 'music';
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext)) return 'image';
  return 'doc';
}

function extFor(mime: string, name: string, kind: IncomingUserAsset['kind']): string {
  const fromName = extname(name).toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  if (kind === 'music') {
    if (mime.includes('wav')) return '.wav';
    if (mime.includes('mpeg') || mime.includes('mp3')) return '.mp3';
    if (mime.includes('mp4') || mime.includes('m4a')) return '.m4a';
    return '.mp3';
  }
  if (kind === 'image') {
    if (mime.includes('png')) return '.png';
    if (mime.includes('webp')) return '.webp';
    if (mime.includes('gif')) return '.gif';
    if (mime.includes('svg')) return '.svg';
    return '.jpg';
  }
  if (mime.includes('pdf')) return '.pdf';
  if (mime.includes('markdown')) return '.md';
  return '.txt';
}

function inferRole(name: string, index: number, explicit?: ScreenAssetRole): ScreenAssetRole {
  if (explicit) return explicit;
  const n = name.toLowerCase();
  if (/logo|brand|mark|icon/.test(n)) return 'logo';
  if (/product|shot|ui|screen|mock|device|app/.test(n)) return 'product';
  if (index === 0) return 'logo';
  if (index === 1) return 'product';
  return 'shot';
}

function safeSlug(name: string) {
  return name
    .replace(/\.[^.]+$/, '')
    .normalize('NFKD')
    .replace(/[^\w\-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) || 'asset';
}

/** 从 PDF buffer 粗提文本（无第三方依赖；复杂 PDF 可能不全） */
export function extractPdfText(buf: Buffer): string {
  // 优先 pdftotext（poppler）
  try {
    const tmp = join(process.env.TEMP || '/tmp', `factory-pdf-${Date.now()}.pdf`);
    writeFileSync(tmp, buf);
    const r = spawnSync('pdftotext', ['-enc', 'UTF-8', '-q', tmp, '-'], {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 4_000_000,
    });
    if (r.status === 0 && r.stdout?.trim()) return r.stdout.trim().slice(0, 12_000);
  } catch {
    /* fall through */
  }
  const raw = buf.toString('latin1');
  const chunks: string[] = [];
  const re = /\((?:\\.|[^\\)]){2,180}\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    let s = m[0].slice(1, -1);
    s = s
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\t/g, ' ')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\');
    if (/[A-Za-z\u4e00-\u9fff]{2,}/.test(s)) chunks.push(s);
    if (chunks.join(' ').length > 12_000) break;
  }
  return chunks.join(' ').replace(/\s+/g, ' ').trim().slice(0, 12_000);
}

export function extractDocText(name: string, mime: string, buf: Buffer): string {
  const ext = extname(name).toLowerCase();
  if (mime.includes('pdf') || ext === '.pdf') return extractPdfText(buf);
  const text = buf.toString('utf8');
  // 去掉明显二进制
  if (/[\x00-\x08\x0e-\x1f]/.test(text.slice(0, 200)) && !text.includes('\n')) {
    return '';
  }
  return text.replace(/\u0000/g, '').trim().slice(0, 12_000);
}

export function materializeUserAssets(
  publicDir: string,
  incoming: IncomingUserAsset[] | undefined,
): MaterializedAssets {
  const out: MaterializedAssets = { screen: [], docTexts: [] };
  if (!incoming?.length) return out;

  const assetDir = join(publicDir, 'assets');
  mkdirSync(assetDir, { recursive: true });

  let imageIdx = 0;
  for (const item of incoming.slice(0, 10)) {
    const parsed = parseDataUrl(item.dataUrl);
    if (!parsed) continue;
    const kind = guessKind(parsed.mime, item.name, item.kind);
    const max = kind === 'music' ? MAX_AUDIO : kind === 'image' ? MAX_IMAGE : MAX_DOC;
    if (parsed.buf.length < 32 || parsed.buf.length > max) continue;

    const ext = extFor(parsed.mime, item.name, kind);
    const hash = createHash('sha1').update(parsed.buf).digest('hex').slice(0, 8);
    const base = `${safeSlug(item.name)}-${hash}${ext}`;

    if (kind === 'image') {
      if (out.screen.length >= 6) continue;
      const file = `assets/${base}`;
      const abs = join(publicDir, file);
      if (!existsSync(abs)) writeFileSync(abs, parsed.buf);
      out.screen.push({
        role: inferRole(item.name, imageIdx, item.role),
        name: item.name,
        file,
      });
      imageIdx += 1;
      continue;
    }

    if (kind === 'music') {
      if (out.musicFile) continue; // 只用第一首
      const file = `bed-user${ext === '.wav' ? '.wav' : '.mp3'}`;
      writeFileSync(join(publicDir, file), parsed.buf);
      out.musicFile = file;
      continue;
    }

    // doc
    const text = extractDocText(item.name, parsed.mime, parsed.buf);
    if (text) out.docTexts.push({ name: item.name, text });
  }

  return out;
}

/** 把文稿拼进 brief（截断，避免撑爆 plan） */
export function docsBriefBlock(docs: { name: string; text: string }[]): string {
  if (!docs.length) return '';
  const parts = docs.map((d) => {
    const body = d.text.slice(0, 3500);
    return `--- USER DOC: ${d.name} ---\n${body}`;
  });
  return [
    'User-provided source documents (use for facts, structure, and on-screen copy; do not invent conflicting claims):',
    ...parts,
  ].join('\n\n').slice(0, 8000);
}

export function assetsLockLine(screen: ScreenAsset[], musicFile?: string): string {
  const bits: string[] = [];
  if (screen.length) {
    bits.push(
      `USER SCREEN ASSETS (must appear via staticFile): ${screen.map((a) => `${a.role}=${a.file}`).join(', ')}. `
      + 'Use logo on logo/end/brand beats; product/shot inside device frames or Ken Burns plates. Do not invent other image URLs.',
    );
  }
  if (musicFile) {
    bits.push(`USER MUSIC BED: props.musicFile=${musicFile} (play under VO at low volume ~0.22).`);
  }
  return bits.join('\n');
}
