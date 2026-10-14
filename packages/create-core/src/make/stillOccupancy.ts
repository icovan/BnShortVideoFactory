/**
 * 静帧主体：近乎全黑、只有一根细线、或一小点，都算没画完。
 * 用 ffmpeg 缩成小图数像素，避免再引入图像库。
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { listStillPngs } from '../skills/skillStillVerify.ts';

const W = 96;
const H = 54;

export type OccupancyStats = {
  inkRatio: number;
  bboxWRatio: number;
  bboxHRatio: number;
  /** Mid-band ink (skips title/caption chrome). */
  innerInkRatio?: number;
  leftInk?: number;
  midInk?: number;
  rightInk?: number;
};

export function occupancyIssues(stats: OccupancyStats): string[] {
  if (stats.inkRatio < 0.004) {
    return ['empty frame: subject is missing (near-blank still) — draw it full-frame'];
  }
  if (stats.bboxHRatio < 0.055 && stats.bboxWRatio > 0.25 && stats.inkRatio < 0.02) {
    return ['empty frame: subject is only a thin line — draw it full-frame'];
  }
  if (stats.bboxWRatio < 0.16 && stats.bboxHRatio < 0.12) {
    return ['empty frame: subject is a speck — it must own the frame'];
  }
  return [];
}

/** Narration layouts must own the frame — a center icon on black fails. */
export function narrationOccupancyIssues(stats: OccupancyStats): string[] {
  const base = occupancyIssues(stats);
  if (base.length) return base;
  if (stats.bboxWRatio < 0.55 || stats.bboxHRatio < 0.42) {
    return ['empty frame: narration subject must cover ~55% width and ~42% height'];
  }
  if (stats.inkRatio < 0.035) {
    return ['empty frame: narration subject is too sparse — fill the hero well'];
  }
  return [];
}

/**
 * Free directed: title+caption on a void, or a left column with an empty right half, fail.
 * Centered heroes (mid-band mass) still pass.
 *
 * 勿误杀「标志+字标 / 封面+文案」等合法左右构图：
 * 彩色块 vs 白字像素密度差很大时，旧规则会把有字的一侧判成 void。
 */
export function directedOccupancyIssues(stats: OccupancyStats): string[] {
  const base = occupancyIssues(stats);
  if (base.length) return base;
  const innerInk = stats.innerInkRatio ?? stats.inkRatio;
  if (innerInk < 0.028) {
    return ['empty frame: hero well is only title/caption — fill the mid-frame with the metaphor'];
  }
  const left = stats.leftInk ?? 0;
  const mid = stats.midInk ?? 0;
  const right = stats.rightInk ?? 0;
  const side = left + right;
  if (side < 8) return [];
  const heavy = Math.max(left, right);
  const light = Math.min(left, right);
  const centerLed = mid >= heavy * 0.85 && mid >= 18;
  if (centerLed) return [];
  // 两侧都有够用的墨量 → 合法 lockup / 分栏
  if (light >= 10 && heavy >= 16) return [];
  // 封面/图标在一侧 + 字标落在中带（右/左三分之一可能为 0）→ 合法 brand lockup
  if (heavy >= 18 && mid >= Math.max(14, heavy * 0.4)) return [];
  // 主体 bbox 横向铺开且总墨够 → 通过
  if ((stats.bboxWRatio ?? 0) >= 0.5 && stats.inkRatio >= 0.02 && mid + light >= 12) return [];
  // 真·半边空：一侧很重，对侧几乎空，且中带也撑不起构图
  if (heavy >= 28 && light < 8 && mid < heavy * 0.4) {
    return ['empty frame: one side of the hero well is void — occupy both thirds or center a full-bleed object'];
  }
  return [];
}
export function statsFromRgb(buf: Buffer, width = W, height = H): OccupancyStats | null {
  const need = width * height * 3;
  if (buf.length < need) return null;
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  let br = 0;
  let bg = 0;
  let bb = 0;
  for (const [x, y] of corners) {
    const i = (y * width + x) * 3;
    br += buf[i];
    bg += buf[i + 1];
    bb += buf[i + 2];
  }
  br /= 4;
  bg /= 4;
  bb /= 4;
  let ink = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const d = Math.abs(buf[i] - br) + Math.abs(buf[i + 1] - bg) + Math.abs(buf[i + 2] - bb);
      if (d < 42) continue;
      ink += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  const pixels = width * height;
  const y0 = Math.floor(height * 0.18);
  const y1 = Math.ceil(height * 0.82);
  const xL = Math.floor(width * 0.34);
  const xR = Math.ceil(width * 0.66);
  let inner = 0;
  let leftInk = 0;
  let midInk = 0;
  let rightInk = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const d = Math.abs(buf[i] - br) + Math.abs(buf[i + 1] - bg) + Math.abs(buf[i + 2] - bb);
      if (d < 42) continue;
      inner += 1;
      if (x < xL) leftInk += 1;
      else if (x >= xR) rightInk += 1;
      else midInk += 1;
    }
  }
  const innerPixels = Math.max(1, (y1 - y0) * width);
  if (ink === 0) {
    return {
      inkRatio: 0,
      bboxWRatio: 0,
      bboxHRatio: 0,
      innerInkRatio: 0,
      leftInk: 0,
      midInk: 0,
      rightInk: 0,
    };
  }
  return {
    inkRatio: ink / pixels,
    bboxWRatio: (maxX - minX + 1) / width,
    bboxHRatio: (maxY - minY + 1) / height,
    innerInkRatio: inner / innerPixels,
    leftInk,
    midInk,
    rightInk,
  };
}

function sampleStill(file: string): OccupancyStats | null {
  const r = spawnSync(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-frames:v', '1', '-vf', `scale=${W}:${H}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'],
    { windowsHide: true, maxBuffer: W * H * 3 + 1024 },
  );
  if (r.status !== 0 || !r.stdout || !Buffer.isBuffer(r.stdout)) return null;
  return statsFromRgb(r.stdout);
}

/**
 * 末尾一张纯黑多半是收尾静帧，不单独拦截。
 * 其余近空、细线、小点都退回重画。
 */
export function emptyStillIssues(stillsDir: string, opts?: { narration?: boolean }): string[] {
  const check = opts?.narration ? narrationOccupancyIssues : directedOccupancyIssues;
  const files = listStillPngs(stillsDir);
  const rows: { file: string; issues: string[] }[] = [];
  for (const name of files) {
    const stats = sampleStill(join(stillsDir, name));
    if (!stats) continue;
    rows.push({ file: name, issues: check(stats) });
  }
  const flagged = rows.filter((r) => r.issues.length);
  if (!flagged.length) return [];
  const last = rows[rows.length - 1];
  const keep = flagged.filter((r) => {
    if (rows.length >= 3 && r === last && r.issues.every((i) => /near-blank/.test(i)) && flagged.length === 1) {
      return false;
    }
    return true;
  });
  return keep.slice(0, 4).map((r) => `${r.file}: ${r.issues[0]}`);
}
