/**
 * 片内 / SRT 字幕切块：中文意群 + 英文/数字整词，禁止等长硬切拆 token。
 */

const MAX_UNITS = 16;

/** 拆成不可再断的显示单元：CJK 字、拉丁词、数字串、标点 */
export function tokenizeCaptionUnits(vo: string): string[] {
  const raw = (vo || '').replace(/\s+/g, ' ').trim();
  if (!raw) return [];
  const units: string[] = [];
  const re =
    /[\u4e00-\u9fff]|[A-Za-z]+(?:'[A-Za-z]+)?|\d+(?:[.,]\d+)?%?|[，。！？；、,.!?;:…—\-]+|[^\s]/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const u = m[0];
    if (!u || /^\s+$/.test(u)) continue;
    units.push(u);
  }
  return units.length ? units : [raw];
}

function unitWeight(u: string): number {
  if (/^[\u4e00-\u9fff]$/.test(u)) return 1;
  if (/^[A-Za-z]/.test(u)) return Math.min(8, Math.max(2, Math.ceil(u.length / 3)));
  if (/^\d/.test(u)) return Math.min(6, Math.max(1, Math.ceil(u.length / 2)));
  return 0; // 标点不占额，跟前一单元
}

/**
 * a2e 纪律：≈≤16 中文显示单位；拉丁词 / 数字整段保留。
 */
export function splitCaptionBlocks(vo: string): string[] {
  const raw = (vo || '').replace(/\s+/g, ' ').trim();
  if (!raw) return [];

  // 先按强标点分成子句，再装袋
  const clauses = raw
    .split(/(?<=[。！？；!?;|｜])\s*/)
    .map((s) => s.replace(/[|｜]/g, '').trim())
    .filter(Boolean);
  const sources = clauses.length ? clauses : [raw];
  const out: string[] = [];

  for (const clause of sources) {
    const units = tokenizeCaptionUnits(clause);
    let buf = '';
    let weight = 0;
    const flush = () => {
      const t = buf.replace(/\s+/g, ' ').trim();
      if (t) out.push(t);
      buf = '';
      weight = 0;
    };
    for (const u of units) {
      const w = unitWeight(u);
      const isPunct = w === 0;
      if (!isPunct && weight > 0 && weight + w > MAX_UNITS) flush();
      // 中文后接拉丁/数字时补空格，避免粘连；不拆开已有英文词
      if (buf && /^[A-Za-z0-9]/.test(u) && /[\u4e00-\u9fff]$/.test(buf)) buf += ' ';
      buf += u;
      weight += w;
      // 逗号等弱标点：满一半可切
      if (isPunct && /[，、,]/.test(u) && weight >= Math.floor(MAX_UNITS * 0.55)) flush();
    }
    flush();
  }
  return out.length ? out : [raw.slice(0, MAX_UNITS)];
}

/** 软门禁：捕获仍被拆坏的英文碎词 */
export function captionFragmentIssues(blocks: string[]): string[] {
  const issues: string[] = [];
  for (const b of blocks) {
    const t = (b || '').trim();
    if (!t) continue;
    // 纯 1–3 个拉丁字母（如 sk / ill）
    if (/^[A-Za-z]{1,3}[，。、,.!?;:]*$/.test(t)) {
      issues.push(`caption mid-token: "${t}"`);
    }
  }
  return issues.slice(0, 16);
}
