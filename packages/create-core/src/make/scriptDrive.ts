import { chatJson } from '../llm.ts';
import type { Settings } from '../../../shared/src/index.ts';
import type { SkillName } from '../llm.ts';
import type { ContentLang } from './contentLang.ts';
import type { DirectedBeat, SkillPlan } from './skillPlan.ts';
import { isSkillName } from '../skills/registry.ts';
import {
  concreteScriptBeat,
  diversifyBeatSkills,
  dropUnaskedSceneSkills,
  mergeBeatSkills,
} from './beatTechnique.ts';
import { applyDirectorToolkit, rebuildSkillsList } from './directorToolkit.ts';
import { attachCraftMust } from '../skills/skillDepth.ts';

/** off=默认链路；polish=LLM整理成优质旁白后硬锁；verbatim=原文切镜零改写；auto=有文稿则 polish */
export type ScriptDriveMode = 'off' | 'auto' | 'polish' | 'verbatim';

export type ScriptBeat = {
  job: string;
  vo: string;
  headline: string;
  visualIntent: string;
  keyMotion: string;
  skill?: SkillName;
};

export function isScriptDriveMode(v: unknown): v is ScriptDriveMode {
  return v === 'off' || v === 'auto' || v === 'polish' || v === 'verbatim';
}

export function resolveScriptDrive(opts: {
  uiMode?: unknown;
  hasDocs: boolean;
}): ScriptDriveMode {
  if (isScriptDriveMode(opts.uiMode) && opts.uiMode !== 'auto') return opts.uiMode;
  // auto：有旁白/分镜文稿 → 默认 polish（整理后锁定），无文稿不启用
  return opts.hasDocs ? 'polish' : 'off';
}

/** 文稿包装头 / 文件名，不得进 VO（Agent：narration.txt 只是路径；原厂 polish 也要求 strip） */
export function isDocChromeLine(line: string): boolean {
  const s = (line || '').trim();
  if (!s) return true;
  if (/^【[^】]{1,80}】$/.test(s)) return true;
  if (/^---\s*USER DOC:/i.test(s)) return true;
  if (/^User-provided source documents/i.test(s)) return true;
  // 纯文件名：旁白.txt / narration.md / brief.docx
  if (/^[\w.\- \u4e00-\u9fff]{1,64}\.(txt|md|markdown|docx?|pdf|rtf)$/i.test(s)) return true;
  return false;
}

/** 去掉 joinDocsText / docsBrief 留下的文件名包装，只留正文 */
export function stripDocChrome(raw: string): string {
  return (raw || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => {
      const t = line.trim();
      if (isDocChromeLine(t)) return '';
      // 行首 【旁白.txt】正文 → 只留正文
      return t.replace(/^【[^】]{1,80}】\s*/, '');
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 原文切镜：一行一句，或 --- / 空行分段（多分镜模式，不强制意群合并） */
export function splitVerbatimScript(raw: string): string[] {
  const t = stripDocChrome(raw);
  if (!t) return [];
  const keep = (s: string) => {
    const x = s.replace(/\s+/g, ' ').trim();
    return x.length >= 2 && !isDocChromeLine(x) ? x : '';
  };
  if (/\n\s*---\s*\n/.test(t)) {
    return t.split(/\n\s*---\s*\n/).map(keep).filter(Boolean);
  }
  // 连续空行分段
  if (/\n\s*\n/.test(t)) {
    const blocks = t.split(/\n\s*\n+/).map(keep).filter(Boolean);
    if (blocks.length >= 3) return blocks;
  }
  // 一行一句
  const lines = t.split('\n')
    .map((s) => keep(s.replace(/^\s*[-*•\d.、．)]+\s*/, '')))
    .filter(Boolean);
  if (lines.length >= 2) return lines;
  // 单段：按句号切
  const bySent = t.split(/(?<=[。！？!?；;])\s*/).map(keep).filter(Boolean);
  return bySent.length ? bySent : [t];
}

/** 旁白驱动镜长目标（仅 drive；给 skill 留动作窗，不截断音频） */
export const DRIVE_BEAT_MIN_SEC = 2.5;
export const DRIVE_BEAT_MAX_SOFT_SEC = 12;
/**
 * a2e 段落镜头：2–4 句/镜，约 12s 可看窗；超长再切，过碎再并。
 * 不改写用词；不重开 NarrationFilm。
 */
export const DRIVE_SHOT_MIN_SENTS = 2;
export const DRIVE_SHOT_MAX_SENTS = 4;
/** ~5 字/秒 → 目标 ≈11s，硬顶 ≈14s（给 skill 留动作，避免 20s+ 空转） */
export const DRIVE_SHOT_TARGET_CHARS = 56;
export const DRIVE_SHOT_MAX_CHARS = 72;
export const DRIVE_SENT_MAX_CHARS = 36;
/** @deprecated 兼容旧名 → 句级上限 */
export const DRIVE_LINE_MAX_CHARS = DRIVE_SENT_MAX_CHARS;
export const DRIVE_LINE_MIN_CHARS = 8;
/**
 * 仅防失控的安全上限（长片可远多于短口播）。
 * 镜数由 a2e「空行=画面单元」决定，**不做 ≤24 强制并顶**。
 */
export const DRIVE_SHOT_SAFETY_MAX = 80;
/** @deprecated 同 DRIVE_SHOT_SAFETY_MAX */
export const DRIVE_LINE_HARD_MAX = DRIVE_SHOT_SAFETY_MAX;
/** @deprecated 已取消 24 镜硬顶；保留别名以免旧引用报错 */
export const DRIVE_PICTURE_SHOT_HARD_MAX = DRIVE_SHOT_SAFETY_MAX;

/** drive 轮转池：进 support，避免导演工具箱把邻镜技压回 mainTechnique */
export const DRIVE_SKILL_POOL = [
  'kinetic-typography',
  'diagram-animation',
  'chart-animation',
  'whiteboard-animation',
  'animated-infographic',
  'isometric-animation',
] as const;

const CN_NUM: Record<string, number> = {
  一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5,
  六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

function parseStepCount(token: string): number {
  const t = (token || '').trim();
  if (!t) return 0;
  if (/^\d+$/.test(t)) return Math.min(20, parseInt(t, 10));
  if (CN_NUM[t] != null) return CN_NUM[t];
  if (t === '十') return 10;
  const m = t.match(/^十([一二三四五六七八九])$/);
  if (m) return 10 + (CN_NUM[m[1]] || 0);
  const m2 = t.match(/^([二三四五六七八九])十([一二三四五六七八九])?$/);
  if (m2) return (CN_NUM[m2[1]] || 0) * 10 + (m2[2] ? CN_NUM[m2[2]] || 0 : 0);
  return 0;
}

function splitOversizedChunk(line: string, maxChars: number): string[] {
  if (line.length <= maxChars) return [line];
  const byComma = line.split(/(?<=[，、,：:])\s*/).map((s) => s.trim()).filter(Boolean);
  if (byComma.length >= 2) {
    const packed: string[] = [];
    let buf = '';
    const pushSlices = (part: string) => {
      for (let i = 0; i < part.length; i += maxChars) {
        const chunk = part.slice(i, i + maxChars).trim();
        if (chunk.length >= 2) packed.push(chunk);
      }
    };
    for (const part of byComma) {
      if (part.length > maxChars) {
        if (buf) {
          packed.push(buf);
          buf = '';
        }
        pushSlices(part);
        continue;
      }
      if (!buf) buf = part;
      else if ((buf + part).length <= maxChars) buf += part;
      else {
        packed.push(buf);
        buf = part;
      }
    }
    if (buf) packed.push(buf);
    return packed.filter((s) => s.length >= 2);
  }
  const out: string[] = [];
  for (let i = 0; i < line.length; i += maxChars) {
    const chunk = line.slice(i, i + maxChars).trim();
    if (chunk.length >= 2) out.push(chunk);
  }
  return out.length ? out : [line];
}

function splitLongLine(line: string, maxChars: number): string[] {
  if (line.length <= maxChars) return [line];
  const sentences = line.split(/(?<=[。！？!?；;])\s*/).map((s) => s.trim()).filter(Boolean);
  if (sentences.length >= 2) {
    const groups: string[] = [];
    let buf = '';
    for (const s of sentences) {
      if (s.length > maxChars) {
        if (buf) {
          groups.push(buf);
          buf = '';
        }
        groups.push(...splitOversizedChunk(s, maxChars));
        continue;
      }
      if (!buf) buf = s;
      else if ((buf + s).length <= maxChars) buf += s;
      else {
        groups.push(buf);
        buf = s;
      }
    }
    if (buf) groups.push(buf);
    return groups.filter((s) => s.length >= 2);
  }
  return splitOversizedChunk(line, maxChars);
}

function countSentences(text: string): number {
  const parts = (text || '').split(/(?<=[。！？!?；;])\s*/).map((s) => s.trim()).filter((s) => s.length >= 2);
  return Math.max(1, parts.length || (text.trim() ? 1 : 0));
}

function flattenToSentences(rawLines: string[]): string[] {
  const out: string[] = [];
  for (const block of rawLines || []) {
    const clean = (block || '').replace(/\s+/g, ' ').trim();
    if (clean.length < 2 || isDocChromeLine(clean)) continue;
    const sents = clean.split(/(?<=[。！？!?；;])\s*/).map((s) => s.trim()).filter((s) => s.length >= 2);
    const units = sents.length ? sents : [clean];
    for (const u of units) {
      if (u.length <= DRIVE_SENT_MAX_CHARS) out.push(u);
      else {
        const parts = splitLongLine(u, DRIVE_SENT_MAX_CHARS);
        out.push(...parts);
      }
    }
  }
  return out;
}

/**
 * a2e 段落镜头结构：
 * - 句 → 装进 2–4 句/镜（目标字数 ~64，硬顶 ~88）
 * - 禁止一句一镜（过碎合并）
 * - 禁止超长单镜（过长再切）
 * - 只切分/合并，不改写用词
 */
export function normalizeDriveLines(rawLines: string[]): {
  lines: string[];
  issues: string[];
} {
  const issues: string[] = [];
  const sentences = flattenToSentences(rawLines);
  if (!sentences.length) return { lines: [], issues: ['empty drive script'] };

  const shots: string[] = [];
  let buf: string[] = [];
  let bufChars = 0;
  const flush = (why?: string) => {
    if (!buf.length) return;
    shots.push(buf.join(''));
    if (why) issues.push(why);
    buf = [];
    bufChars = 0;
  };

  for (const s of sentences) {
    const nextChars = bufChars + s.length;
    const nextCount = buf.length + 1;
    if (
      buf.length
      && (nextChars > DRIVE_SHOT_MAX_CHARS || nextCount > DRIVE_SHOT_MAX_SENTS)
    ) {
      flush(`shot flush @${buf.length} sents / ${bufChars} chars`);
    }
    buf.push(s);
    bufChars += s.length;
    if (buf.length >= DRIVE_SHOT_MIN_SENTS && bufChars >= DRIVE_SHOT_TARGET_CHARS) {
      flush();
    }
  }
  flush();

  // 尾部句镜并入前镜（a2e：短句不当独立镜头）
  const packed: string[] = [];
  for (const shot of shots) {
    const prev = packed[packed.length - 1];
    const thin = countSentences(shot) < DRIVE_SHOT_MIN_SENTS && shot.length < DRIVE_SHOT_TARGET_CHARS * 0.55;
    if (
      prev
      && thin
      && countSentences(prev) + countSentences(shot) <= DRIVE_SHOT_MAX_SENTS
      && prev.length + shot.length <= DRIVE_SHOT_MAX_CHARS
    ) {
      packed[packed.length - 1] = prev + shot;
      issues.push('merged thin one-liner into previous shot');
    } else {
      packed.push(shot);
    }
  }

  const lines = packed.slice(0, DRIVE_LINE_HARD_MAX);
  if (packed.length > DRIVE_LINE_HARD_MAX) {
    issues.push(`capped at ${DRIVE_LINE_HARD_MAX} shots (had ${packed.length})`);
  }

  // 自检：字不丢
  const srcJoin = sentences.join('');
  const outJoin = lines.join('');
  if (srcJoin !== outJoin) {
    issues.push('structure: character coverage mismatch after shot pack');
  }
  return { lines, issues: issues.slice(0, 32) };
}

/** drive 文稿形态：a2e 空行锁镜 / 散句 pack / 乱稿 polish */
export type DrivePackKind = 'a2e-lock' | 'pack' | 'polish';

/** a2e：`|` 只切字幕，不进朗读用词（去竖线保字序） */
export function stripA2eCaptionPipes(line: string): string {
  return (line || '')
    .replace(/[|｜]/g, (m, i, s) => {
      const prev = s[i - 1] || '';
      const next = s[i + 1] || '';
      // 拉丁词之间留空格，避免 powerful|but → powerfulbut
      if (/[A-Za-z0-9]/.test(prev) && /[A-Za-z0-9]/.test(next)) return ' ';
      return '';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function isA2eMetaLine(line: string): boolean {
  const t = (line || '').trim();
  if (!t) return true;
  if (/^#\s*CHAPTER\b/i.test(t)) return true;
  if (/^##\s*gap\b/i.test(t)) return true;
  return isDocChromeLine(t);
}

/** 空行分段块 → 一镜（段内多行并一句串，保留用词） */
function keepA2eBlock(block: string): string {
  const joined = (block || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((s) => s.replace(/^\s*[-*•\d.、．)]+\s*/, '').trim())
    .filter((s) => s && !isA2eMetaLine(s))
    .map(stripA2eCaptionPipes)
    .join('');
  return joined.replace(/\s+/g, ' ').trim();
}

/**
 * 真 a2e 镜头上限：约 2–4 句 × ≤35 字 ≈ 140；再长视为「散文分段」而非作者锁镜。
 * 禁止在 lock 内调用 normalizeDriveLines（1q6u 回归：锁完再切 = 15 镜）。
 */
export const A2E_SHOT_HARD_MAX_CHARS = 140;

/** 单段是否像作者有意写的 a2e 画面单元（不是长散文自然段） */
export function isAuthenticA2eShot(block: string): boolean {
  const b = (block || '').trim();
  if (b.length < 8 || b.length > A2E_SHOT_HARD_MAX_CHARS) return false;
  const n = countSentences(b);
  if (n >= 2 && n <= 4) return true;
  // 允许极短单句钩子；长单句墙不算
  if (n === 1 && b.length <= 40) return true;
  return false;
}

/**
 * a2e 权威：空行 = 镜头。须 ≥3 段且 ≥75% 为真 a2e 单元，且无超长墙段；
 * 否则返回 null → polish（口播长文带空行不得误锁）。
 * 锁定后一字不切、不改写。
 */
export function lockA2eBlankLineShots(raw: string): { lines: string[]; issues: string[] } | null {
  const t = stripDocChrome(raw);
  if (!t || !/\n\s*\n/.test(t)) return null;
  const blocks = t
    .split(/\n\s*\n+/)
    .map(keepA2eBlock)
    .filter((s) => s.length >= 2);
  if (blocks.length < 3) return null;

  // 任一墙段 → 散文分段，不是 a2e 分镜稿
  if (blocks.some((b) => b.length > A2E_SHOT_HARD_MAX_CHARS)) return null;

  const authentic = blocks.filter(isAuthenticA2eShot).length;
  if (authentic < Math.ceil(blocks.length * 0.75)) return null;

  const issues: string[] = ['pack: a2e-lock (blank line = shot)'];
  const softLong = blocks.filter((b) => b.length > DRIVE_SHOT_MAX_CHARS).length;
  if (softLong) {
    issues.push(`a2e soft-long kept as-is (${softLong} shots > ${DRIVE_SHOT_MAX_CHARS} chars, no re-split)`);
  }

  const capped = blocks.slice(0, DRIVE_LINE_HARD_MAX);
  if (blocks.length > DRIVE_LINE_HARD_MAX) {
    issues.push(`capped at ${DRIVE_LINE_HARD_MAX} shots (had ${blocks.length})`);
  }
  return { lines: capped, issues: issues.slice(0, 32) };
}

/** 已是「一行一句」口播清单（无空行锁镜）→ 走 packer 并镜 */
export function looksLikeSpokenLineList(raw: string): boolean {
  const t = stripDocChrome(raw);
  if (!t) return false;
  if (/\n\s*\n/.test(t)) {
    const blocks = t.split(/\n\s*\n+/).map(keepA2eBlock).filter((s) => s.length >= 2);
    if (blocks.length >= 3) return false;
  }
  const lines = t
    .split('\n')
    .map((s) => stripA2eCaptionPipes(s.replace(/^\s*[-*•\d.、．)]+\s*/, '').trim()))
    .filter((s) => s.length >= 2 && !isA2eMetaLine(s));
  if (lines.length < 6) return false;
  const avg = lines.reduce((a, l) => a + l.length, 0) / lines.length;
  return avg <= 52;
}

/**
 * a2e 单镜纪律（不做总数硬顶）：
 * - 过碎单句并入邻镜（禁止一句一镜）
 * - 仅当失控超过 DRIVE_SHOT_SAFETY_MAX 才截断告警
 */
export function enforcePictureShotBudget(
  lines: string[],
  issues: string[] = [],
): string[] {
  const cleaned = (lines || []).map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s.length >= 2);
  if (!cleaned.length) return [];

  const merged: string[] = [];
  for (const shot of cleaned) {
    const prev = merged[merged.length - 1];
    const thin = countSentences(shot) < DRIVE_SHOT_MIN_SENTS
      && shot.length < DRIVE_SHOT_TARGET_CHARS * 0.55;
    if (
      prev
      && thin
      && countSentences(prev) + countSentences(shot) <= DRIVE_SHOT_MAX_SENTS
      && prev.length + shot.length <= A2E_SHOT_HARD_MAX_CHARS
    ) {
      merged[merged.length - 1] = prev + shot;
      issues.push('a2e: merged thin one-liner into previous');
    } else {
      merged.push(shot);
    }
  }

  if (merged.length > DRIVE_SHOT_SAFETY_MAX) {
    issues.push(`safety: capped at ${DRIVE_SHOT_SAFETY_MAX} shots (had ${merged.length})`);
    return merged.slice(0, DRIVE_SHOT_SAFETY_MAX);
  }
  return merged;
}

/**
 * narration.txt（已格式化）→ 画面单元 VO 行。
 * 空行 = 镜（镜数随内容增减）；无空行则 normalize；只并过碎句，不并顶到 24。
 */
export function shotsFromFormattedNarration(formatted: string): {
  lines: string[];
  issues: string[];
} {
  const issues: string[] = ['pack: narration.txt → blank-line picture shots'];
  const t = stripDocChrome(formatted);
  if (!t) return { lines: [], issues: ['empty narration.txt'] };

  let blocks = t
    .split(/\n\s*\n+/)
    .map(keepA2eBlock)
    .filter((s) => s.length >= 2);

  if (blocks.length < 2) {
    const norm = normalizeDriveLines(splitVerbatimScript(t));
    issues.push('pack: no blank-line shots → normalizeDriveLines fallback');
    issues.push(...norm.issues.slice(0, 8));
    return {
      lines: enforcePictureShotBudget(norm.lines, issues),
      issues: issues.slice(0, 32),
    };
  }

  const expanded: string[] = [];
  for (const b of blocks) {
    if (b.length > A2E_SHOT_HARD_MAX_CHARS) {
      const sub = normalizeDriveLines([b]);
      expanded.push(...sub.lines);
      issues.push(`formatted overlong block → pack (${b.length} chars)`);
    } else {
      expanded.push(b);
    }
  }

  return {
    lines: enforcePictureShotBudget(expanded, issues),
    issues: issues.slice(0, 32),
  };
}

/**
 * @deprecated drive 主路径已改为 format→shotsFromFormattedNarration。
 * 保留给冒烟/兼容：不再返回 polish（碎切源），无结构时走 pack。
 */
export function resolveDrivePack(raw: string): {
  kind: DrivePackKind;
  lines: string[];
  issues: string[];
} {
  const locked = lockA2eBlankLineShots(raw);
  if (locked) {
    return {
      kind: 'a2e-lock',
      lines: enforcePictureShotBudget(locked.lines, locked.issues),
      issues: locked.issues,
    };
  }
  const rawLines = splitVerbatimScript(raw);
  const normalized = normalizeDriveLines(rawLines);
  return {
    kind: 'pack',
    lines: enforcePictureShotBudget(normalized.lines, normalized.issues),
    issues: [
      looksLikeSpokenLineList(raw)
        ? 'pack: spoken-line list → normalizeDriveLines'
        : 'pack: prose → normalizeDriveLines (no polish fragment path)',
      ...normalized.issues,
    ].slice(0, 32),
  };
}

/** 邻镜画面同族软门禁（时间轴/UI壳/节点图反复） */
export function assessDriveVisualVariety(
  beats: Array<{ visualIntent?: string; headline?: string }>,
): string[] {
  const issues: string[] = [];
  const familyOf = (s: string): string => {
    const t = (s || '').toLowerCase();
    if (/时间轴|timeline|进度|甘特|里程碑/.test(t)) return 'timeline';
    if (/界面|ui|仪表盘|dashboard|面板|设置页|列表页/.test(t)) return 'ui-shell';
    if (/节点|连线|流程图|graph|network|拓扑/.test(t)) return 'node-graph';
    if (/卡片|卡片墙|看板|kanban/.test(t)) return 'card-wall';
    if (/大字|标题字|kinetic|字块/.test(t)) return 'type-slam';
    return '';
  };
  for (let i = 1; i < beats.length; i++) {
    const a = familyOf(`${beats[i - 1].visualIntent || ''} ${beats[i - 1].headline || ''}`);
    const b = familyOf(`${beats[i].visualIntent || ''} ${beats[i].headline || ''}`);
    if (a && a === b) {
      issues.push(`consumption: consecutive same visual family @${i - 1}–${i} (${a})`);
    }
  }
  return issues.slice(0, 16);
}

/** 软门禁：步骤完整性 / 仍过长镜 / 一句一镜（不阻断出片） */
export function assessDriveScript(lines: string[]): string[] {
  const issues: string[] = [];
  const text = lines.join('\n');
  const claim = text.match(/分\s*([一二三四五六七八九十两\d]+)\s*步/)
    || text.match(/(?:共|一共|总共)\s*([一二三四五六七八九十两\d]+)\s*步/)
    || text.match(/\b(\d+)\s*steps?\b/i);
  if (claim) {
    const n = parseStepCount(claim[1]);
    if (n >= 2) {
      const found = new Set<number>();
      for (const line of lines) {
        const m = line.match(/第\s*([一二三四五六七八九十两\d]+)\s*步/)
          || line.match(/\bstep\s*(\d+)\b/i);
        if (m) {
          const idx = parseStepCount(m[1]);
          if (idx > 0) found.add(idx);
        }
      }
      for (let i = 1; i <= n; i++) {
        if (!found.has(i)) issues.push(`structure: claimed ${n} steps but missing step ${i}`);
      }
    }
  }
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length > DRIVE_SHOT_MAX_CHARS + 12) {
      issues.push(`shot ${i}: still long (${lines[i].length} chars)`);
    }
  }
  if (lines.length >= 6) {
    const thin = lines.filter((l) => countSentences(l) === 1 && l.length < 22).length;
    if (thin / lines.length >= 0.55) {
      issues.push(`structure: ${thin}/${lines.length} thin one-liner shots (a2e wants 2–4 sents/shot)`);
    }
  }
  return issues.slice(0, 24);
}

/** 消耗向软门禁：镜长 / skill 垄断 / 邻镜重复（drive only） */
export function assessDriveConsumption(opts: {
  lines?: string[];
  beats: Array<{ skill?: string; durationSec?: number; vo?: string }>;
}): string[] {
  const issues: string[] = [];
  const beats = opts.beats || [];
  if (!beats.length) return ['consumption: no beats'];

  const skills = beats.map((b) => String(b.skill || ''));
  for (let i = 1; i < skills.length; i++) {
    if (skills[i] && skills[i] === skills[i - 1]) {
      issues.push(`consumption: consecutive same skill @${i - 1}–${i} (${skills[i]})`);
    }
  }
  const counts = new Map<string, number>();
  for (const s of skills) {
    if (!s) continue;
    counts.set(s, (counts.get(s) || 0) + 1);
  }
  const cap = Math.max(2, Math.ceil(beats.length * 0.4));
  for (const [s, n] of counts) {
    if (n > cap) issues.push(`consumption: skill ${s} dominates ${n}/${beats.length}`);
  }

  let longDur = 0;
  let shortDur = 0;
  for (let i = 0; i < beats.length; i++) {
    const d = Number(beats[i].durationSec || 0);
    const voLen = (beats[i].vo || opts.lines?.[i] || '').length;
    if (d > DRIVE_BEAT_MAX_SOFT_SEC || voLen > DRIVE_SHOT_MAX_CHARS + 12) {
      longDur += 1;
      issues.push(`consumption: beat ${i} long (${d || voLen}${d ? 's' : ' chars'})`);
    }
    if (d > 0 && d < DRIVE_BEAT_MIN_SEC) shortDur += 1;
  }
  if (longDur >= 3) issues.push(`consumption: ${longDur} overlong beats (skill idle risk)`);
  if (shortDur >= 3) issues.push(`consumption: ${shortDur} under-min beats`);

  return issues.slice(0, 32);
}

/** drive 镜长：音频定节拍，下限给 skill 动作窗；不裁切 VO */
export function driveSceneDurationSec(opts: {
  scriptDrive?: string;
  audioDur: number;
  beatDurationSec?: number;
  hasVo: boolean;
  voTailSec: number;
}): { durationSec: number; softLong?: boolean } {
  if (!opts.hasVo) {
    return { durationSec: Number(Math.max(0.6, opts.beatDurationSec || 1.2).toFixed(3)) };
  }
  const base = Math.max(opts.beatDurationSec || 0, opts.audioDur + opts.voTailSec);
  const drive = opts.scriptDrive === 'verbatim' || opts.scriptDrive === 'polish';
  const durationSec = Number((drive ? Math.max(DRIVE_BEAT_MIN_SEC, base) : base).toFixed(3));
  return {
    durationSec,
    softLong: drive && opts.audioDur > DRIVE_BEAT_MAX_SOFT_SEC,
  };
}

/**
 * LLM 把用户文稿整理成「可出片旁白」：保留信息覆盖，优化句长/一句一意，便于 skill 配画。
 * 不是随便删减成 5～8 句口号。
 */
export async function polishScriptForFilm(
  settings: Settings,
  opts: {
    sourceText: string;
    contentLang: ContentLang;
    aspect: string;
    userAsk?: string;
  },
): Promise<ScriptBeat[]> {
  const src = opts.sourceText.trim().slice(0, 14_000);
  if (!src) return [];
  if (!settings.llmApiKey) {
    return splitVerbatimScript(src).slice(0, 40).map((vo, i) => concreteScriptBeat({
      job: `beat-${i}`,
      vo,
      headline: vo.slice(0, 16),
      visualIntent: '',
      keyMotion: '',
    }, i));
  }

  const langRule = opts.contentLang === 'en'
    ? 'VO lines MUST be English.'
    : opts.contentLang === 'bilingual'
      ? 'VO lines MUST be Simplified Chinese; headlines Chinese; short English sublabel optional in visualIntent only.'
      : 'VO lines and headlines MUST be Simplified Chinese.';

  try {
    const out = await chatJson<{
      beats?: Array<{
        job?: string;
        vo?: string;
        headline?: string;
        visualIntent?: string;
        keyMotion?: string;
        skill?: string;
      }>;
    }>(settings, `You convert a user narration / storyboard document into a FILM-READY voice-over script for a Remotion skill-driven explainer.

Goals (in order):
1) Maximize finished-video quality: one clear idea per beat, speakable pacing, easy to animate.
2) Maximize information coverage: do NOT drop key facts, steps, names, numbers from the source. Merge only filler / duplicate / stage directions.
3) Output is the FINAL VO — later stages must speak these lines verbatim.

Rules:
- ${langRule}
- Aspect ${opts.aspect}. Prefer 8–24 beats (up to 36 if source is long). Never compress a long lesson into 5 slogan beats.
- Each vo: one breath unit. zh ≈ 12–40 chars; en ≈ 8–22 words. Split long sentences; do not truncate mid-thought.
- Strip stage directions like「画面：」「特写」from vo — put visual cues into visualIntent instead.
- headline = a short on-screen label (≤12 zh chars / ≤4 en words), not a slice of the spoken sentence. Never include a filename.
- visualIntent = one object from THIS sentence and what it does. Do NOT start with "Illustrate:". Do NOT repeat the vo. Do NOT write "words only" or a generic node diagram unrelated to the sentence.
- keyMotion = a specific motion, different from neighboring beats. Do NOT write "spring reveal" for every beat.
- skill follows the object in visualIntent. diagram-animation only when the object is a flow of parts. kinetic-typography at most twice, and the words are not the only picture. map / isometric / chat / promo only when the sentence is that thing.
- Keep source order. No new claims not in the document.
- Strip file names (旁白.txt, 【文档名】) out of vo and headline.

JSON only.`, `User ask (context):
${(opts.userAsk || '').slice(0, 800)}

SOURCE DOCUMENT (authority for VO facts):
${src}

Return:
{
  "beats":[
    {"job":"hook","vo":"","headline":"","visualIntent":"","keyMotion":"","skill":"kinetic-typography"}
  ]
}`, 0.35);

    const beats = Array.isArray(out.beats) ? out.beats : [];
    const cleaned = beats
      .map((b, i) => ({
        job: String(b.job || `beat-${i}`).slice(0, 24),
        vo: String(b.vo || '').trim(),
        headline: String(b.headline || '').trim().slice(0, 48),
        visualIntent: String(b.visualIntent || '').trim().slice(0, 200),
        keyMotion: String(b.keyMotion || 'spring reveal').trim().slice(0, 80),
        skill: isSkillName(b.skill) ? b.skill : undefined,
      }))
      .filter((b) => b.vo.length >= 2)
      .slice(0, 36);

    if (cleaned.length >= 3) return cleaned.map((b, i) => concreteScriptBeat(b, i));
  } catch {
    /* fall through */
  }
  return splitVerbatimScript(src).slice(0, 40).map((vo, i) => concreteScriptBeat({
    job: `beat-${i}`,
    vo,
    headline: vo.slice(0, 16),
    visualIntent: '',
    keyMotion: '',
  }, i));
}

/**
 * 旁白逐字锁定，只补每一句的物体。
 * 老厂的做法：VO 不改，画面说明写出这一句里的那个东西和它的动作。
 */
export async function planPicturesForLines(
  settings: Settings,
  opts: {
    lines: string[];
    contentLang: ContentLang;
    aspect: string;
    userAsk?: string;
  },
): Promise<ScriptBeat[]> {
  const lines = opts.lines.map((s) => s.trim()).filter((s) => s.length >= 2).slice(0, DRIVE_LINE_HARD_MAX);
  const fallback = () => lines.map((vo, i) => concreteScriptBeat({
    job: `beat-${i}`,
    vo,
    headline: '',
    visualIntent: '',
    keyMotion: '',
  }, i));
  if (!lines.length) return [];
  if (!settings.llmApiKey) return fallback();

  const langRule = opts.contentLang === 'en'
    ? 'headline and visualIntent in English.'
    : 'headline and visualIntent in Simplified Chinese.';

  const paced = lines.map((vo, i) => {
    const n = [...vo].length;
    const budget = n <= 18 ? 'short·1-2 hits' : n <= 40 ? 'medium·2-4 hits' : 'long·phased/state-machine';
    return `${i}. [${budget}] ${vo}`;
  }).join('\n');

  try {
    const out = await chatJson<{
      beats?: Array<{ headline?: string; visualIntent?: string; keyMotion?: string; skill?: string }>;
    }>(settings, `You plan the PICTURE for each locked voice-over SHOT of a narration-driven film.
Each shot may contain 2–4 spoken sentences (a2e paragraph shot). Do not rewrite, split, or drop any words.

SKILL MAXIMIZATION (hard — do not collapse to isometric/diagram only):
- Neighboring shots MUST use different skills. Never two identical skills in a row.
- Across the whole film, no single skill > ~1/3 of shots. Prefer rotating:
  kinetic-typography / diagram-animation / chart-animation / whiteboard-animation / animated-infographic / isometric-animation
  (plus map / chat / promo / particle when the sentence earns it).
- Pick skill from the VISUAL RELATIONSHIP (process→diagram, number→chart, title punch→kinetic, ink/draw→whiteboard, icons+callouts→infographic, spatial stack→isometric) — not from habit.
- Same skill later is OK only if the hero OBJECT is unmistakably different.
- Never "words only". Multi-sentence shots keep ONE skill but phase motion across the spoken clauses.

MOTION BUDGET (each shot is tagged short|medium|long):
- short: 1–2 accent hits; punchy enter → settle.
- medium: 2–4 hits; object then detail — align hits to clause boundaries.
- long: multi-phase / state-machine in one skill — do NOT invent extra VO lines.

VISUAL FAMILY (hard — stops still-frame sameness):
- Neighboring shots MUST NOT share the same visual family: timeline / UI-shell / node-graph / card-wall / type-slam.
- Across the film, no single family > ~1/3 of shots. Rotate hero objects (hand, coin, cursor, meter, stamp, path, counter…) — not the same dashboard redrawn.
- One shot = one picture idea. Multi-sentence VO still ONE object + phased motion — do not invent a second hero.

For each line, one beat:
- headline: a label, ≤12 Chinese characters or ≤4 English words. Not a slice of the sentence.
- visualIntent: ONE concrete object taken from this sentence, and the action it performs. Name the object (a workstation, a coin, a cursor, a hand, a box). The object must be what a viewer sees.
  Forbidden: starting with "Illustrate:", pasting the sentence as the picture, "words only", "generic nodes and edges" unless the sentence is itself a flow of parts.
- keyMotion: 2–5 words matching the motion budget. Neighboring beats must differ — no shared "spring reveal".
- skill: follow the diversity rules above.
- ${langRule}
Aspect ${opts.aspect}.

JSON only.`, `Context:
${(opts.userAsk || '').slice(0, 600)}

LOCKED LINES (index order, do not change wording):
${paced}

Return:
{ "beats": [ { "headline": "", "visualIntent": "", "keyMotion": "", "skill": "diagram-animation" } ] }`, 0.4);

    const got = Array.isArray(out.beats) ? out.beats : [];
    return lines.map((vo, i) => {
      const b = got[i] || {};
      return concreteScriptBeat({
        job: `beat-${i}`,
        vo,
        headline: String(b.headline || '').trim(),
        visualIntent: String(b.visualIntent || '').trim(),
        keyMotion: String(b.keyMotion || '').trim(),
        skill: isSkillName(b.skill) ? b.skill : undefined,
      }, i);
    });
  } catch {
    return fallback();
  }
}

/**
 * 无上传文稿、但需要口播：把用户需求扩成可出片旁白，再走同一套硬锁。
 * 不得编造文稿里没有的数字/专名；句数按信息密度，禁止压成 5 句口号。
 */
export async function synthesizeScriptFromAsk(
  settings: Settings,
  opts: {
    userAsk: string;
    contentLang: ContentLang;
    aspect: string;
  },
): Promise<ScriptBeat[]> {
  const src = opts.userAsk.trim().slice(0, 8_000);
  if (!src) return [];
  const portrait = opts.aspect === '9:16' || opts.aspect === '3:4';
  const beatRange = portrait ? 'Prefer 6–14 beats (up to 20 if the ask is dense).' : 'Prefer 8–18 beats (up to 28 if the ask is dense).';
  const langRule = opts.contentLang === 'en'
    ? 'VO lines MUST be English.'
    : opts.contentLang === 'bilingual'
      ? 'VO lines MUST be Simplified Chinese; headlines Chinese; short English sublabel optional in visualIntent only.'
      : 'VO lines and headlines MUST be Simplified Chinese.';

  if (!settings.llmApiKey) {
    const bits = splitVerbatimScript(src);
    return bits.slice(0, 24).map((vo, i) => concreteScriptBeat({
      job: `beat-${i}`,
      vo: vo.slice(0, 40),
      headline: vo.slice(0, 16),
      visualIntent: '',
      keyMotion: '',
    }, i));
  }

  try {
    const out = await chatJson<{
      beats?: Array<{
        job?: string;
        vo?: string;
        headline?: string;
        visualIntent?: string;
        keyMotion?: string;
        skill?: string;
      }>;
    }>(settings, `You turn a USER ASK (not a finished script) into a FILM-READY voice-over for a Remotion explainer, in e2m narration.txt spirit.

Goals (in order):
1) Coverage: every concrete fact, step, name, and number in the ask must appear in some vo line. Do NOT collapse a lesson into 5 slogan beats.
2) Speakable: one idea per beat, one breath unit. Chinese vo ≤35 characters per beat (split longer thoughts).
3) Honesty: do NOT invent statistics, brands, URLs, or claims absent from the ask. If the ask is thin, write a clear short film — still one idea per beat, not filler slogans.
4) Output is the FINAL VO — later stages speak these lines verbatim.
5) Shot pacing: prefer 2–4 related beats as a visual unit (like blank-line shots in narration.txt), but still return a flat beats array.

Rules:
- ${langRule}
- Aspect ${opts.aspect}. ${beatRange}
- Each vo: zh ≤35 chars (ideal 12–35); en ≈ 8–22 words. Split long thoughts; do not truncate mid-idea.
- headline ≤12 zh chars / ≤4 en words — a label, not a second VO. No filenames.
- visualIntent = one object from this sentence and its action. Do NOT start with "Illustrate:" and do NOT repeat the vo.
- keyMotion = a specific motion. Neighboring beats must not share "spring reveal".
- Rotate skill across kinetic-typography, diagram-animation, chart-animation, whiteboard-animation, animated-infographic. Never two identical skills in a row; diagram-animation ≤ ~1/3 of beats.
- Keep a natural teaching order: hook → steps/points → payoff.

JSON only.`, `User ask (authority for facts — this is NOT already a VO script):
${src}

Return:
{
  "beats":[
    {"job":"hook","vo":"","headline":"","visualIntent":"","keyMotion":"","skill":"kinetic-typography"}
  ]
}`, 0.35);

    const beats = Array.isArray(out.beats) ? out.beats : [];
    const cleaned = beats
      .map((b, i) => ({
        job: String(b.job || `beat-${i}`).slice(0, 24),
        vo: String(b.vo || '').trim(),
        headline: String(b.headline || '').trim().slice(0, 48),
        visualIntent: String(b.visualIntent || '').trim().slice(0, 200),
        keyMotion: String(b.keyMotion || 'spring reveal').trim().slice(0, 80),
        skill: isSkillName(b.skill) ? b.skill : undefined,
      }))
      .filter((b) => b.vo.length >= 2)
      .slice(0, 28);

    if (cleaned.length >= 4) return cleaned.map((b, i) => concreteScriptBeat(b, i));
  } catch {
    /* fall through */
  }
  return [];
}

/** drive：把轮转池并进 support，防止导演工具箱把邻镜技压回 mainTechnique */
function expandDriveSupport(plan: SkillPlan): SkillName[] {
  const seed: SkillName[] = [];
  for (const id of [
    ...plan.support,
    ...DRIVE_SKILL_POOL,
  ]) {
    if (!isSkillName(id) || id === plan.primary) continue;
    if (!seed.includes(id)) seed.push(id);
  }
  // leaf 预算：保留最多 3 个（与 formMode LEAF_CAP 对齐），优先原 support
  return seed.slice(0, 3);
}

/** 把旁白脚本硬锁进 plan：VO 不改写；skill 轮转在导演工具箱之后再钉死 */
export function applyScriptDriveToPlan(
  plan: SkillPlan,
  script: ScriptBeat[],
  mode: ScriptDriveMode,
): SkillPlan {
  if (mode === 'off' || !script.length) return plan;
  const beats: DirectedBeat[] = script
    .filter((s) => !isDocChromeLine(s.vo) && !isDocChromeLine(s.headline || ''))
    .map((s, i) => {
    const vo = stripDocChrome(s.vo).trim() || s.vo.trim();
    const shaped = concreteScriptBeat({
      job: s.job || `beat-${i}`,
      vo,
      headline: stripDocChrome(s.headline || '').slice(0, 48) || vo.slice(0, 16),
      visualIntent: stripDocChrome(s.visualIntent || '').slice(0, 200),
      keyMotion: (s.keyMotion || '').slice(0, 80),
      skill: s.skill,
    }, i);
    return {
      job: shaped.job || `beat-${i}`,
      vo: shaped.vo,
      headline: shaped.headline || shaped.vo.slice(0, 16),
      visualIntent: (shaped.visualIntent || shaped.vo).slice(0, 200),
      keyMotion: (shaped.keyMotion || 'word slam overshoot').slice(0, 80),
      skill: isSkillName(shaped.skill) ? shaped.skill : plan.primary,
      durationSec: undefined,
    };
  });
  const capped = dropUnaskedSceneSkills(beats, { keep: plan.primary }).slice(0, 40);
  const driveSupport = expandDriveSupport(plan);
  const merged = mergeBeatSkills({
    ...plan,
    support: driveSupport,
    beats: capped,
    voMode: 'on',
    scriptDrive: mode === 'auto' ? 'polish' : mode,
  });
  const askHint = [plan.coreIdea, ...capped.map((b) => `${b.visualIntent || ''} ${b.vo || ''}`)].join('\n');
  // 导演工具箱会按 support 压技 → 必须先有 driveSupport；之后再硬轮换一次钉死邻镜差异
  const directed = applyDirectorToolkit(merged, askHint) as SkillPlan;
  const rotated = attachCraftMust(diversifyBeatSkills(directed.beats, { primary: directed.primary }));
  const used = new Set<SkillName>();
  for (const b of rotated) {
    if (isSkillName(b.skill) && b.skill !== directed.primary) used.add(b.skill as SkillName);
  }
  const support = [...used].slice(0, 3);
  // 若轮转不足 2 类，强制补进 drive 池
  for (const id of driveSupport) {
    if (support.length >= 3) break;
    if (!support.includes(id)) support.push(id);
  }
  return {
    ...directed,
    support,
    skills: rebuildSkillsList(directed.primary, support, directed.brandSkills || [], true),
    beats: rotated,
    scriptDrive: mode === 'auto' ? 'polish' : mode,
    voMode: 'on',
  };
}

/** 仅拼正文进切镜/VO；文件名不进字符串（避免 verbatim 把【旁白.txt】读成第 1 句） */
export function joinDocsText(docs: { name: string; text: string }[]): string {
  return docs.map((d) => stripDocChrome(d.text || '')).filter(Boolean).join('\n\n');
}
