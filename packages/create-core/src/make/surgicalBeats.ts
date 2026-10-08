/**
 * 分镜级二次创作：优先只改 BEATS[i]（或等价数据表），避免 LLM 整片重写 ActiveDirected.tsx。
 */

/** 跳过字符串/模板/注释，找与 open 配对的闭合括号位置（含两端字符） */
export function findMatchingBracket(src: string, openIdx: number): number {
  const open = src[openIdx];
  const close = open === '[' ? ']' : open === '{' ? '}' : open === '(' ? ')' : '';
  if (!close) return -1;
  let depth = 0;
  let i = openIdx;
  let quote: '"' | "'" | '`' | null = null;
  let escape = false;
  let lineComment = false;
  let blockComment = false;
  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];
    if (lineComment) {
      if (ch === '\n') lineComment = false;
      i += 1;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    if (quote) {
      if (escape) {
        escape = false;
        i += 1;
        continue;
      }
      if (ch === '\\' && quote !== '`') {
        escape = true;
        i += 1;
        continue;
      }
      if (quote === '`' && ch === '$' && next === '{') {
        // template expression — treat nested braces coarsely
        i += 2;
        let nest = 1;
        while (i < src.length && nest > 0) {
          if (src[i] === '{') nest += 1;
          else if (src[i] === '}') nest -= 1;
          i += 1;
        }
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '/') {
      lineComment = true;
      i += 2;
      continue;
    }
    if (ch === '/' && next === '*') {
      blockComment = true;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === open) {
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === close) {
      depth -= 1;
      if (depth === 0) return i;
      i += 1;
      continue;
    }
    i += 1;
  }
  return -1;
}

export type ArrayItems = {
  /** `const NAME` 声明起点 */
  declStart: number;
  /** `[` 位置 */
  openIdx: number;
  /** `]` 位置 */
  closeIdx: number;
  items: { start: number; end: number; text: string }[];
};

/** 解析 `const NAME: T = [ ... ]` 顶层元素区间 */
export function extractConstArray(source: string, name: string): ArrayItems | null {
  const re = new RegExp(`const\\s+${name}\\s*(?::[^=]*)?=\\s*\\[`);
  const m = re.exec(source);
  if (!m || m.index == null) return null;
  const openIdx = m.index + m[0].length - 1;
  const closeIdx = findMatchingBracket(source, openIdx);
  if (closeIdx < 0) return null;

  const items: { start: number; end: number; text: string }[] = [];
  let i = openIdx + 1;
  while (i < closeIdx) {
    while (i < closeIdx && /[\s,]/.test(source[i])) i += 1;
    if (i >= closeIdx) break;
    if (source[i] === '/' && source[i + 1] === '/') {
      while (i < closeIdx && source[i] !== '\n') i += 1;
      continue;
    }
    if (source[i] === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < closeIdx && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    const start = i;
    if (source[i] === '{' || source[i] === '[' || source[i] === '(') {
      const end = findMatchingBracket(source, i);
      if (end < 0 || end > closeIdx) return null;
      items.push({ start, end: end + 1, text: source.slice(start, end + 1) });
      i = end + 1;
      continue;
    }
    // 标量 / 标识符（少见）
    while (i < closeIdx && source[i] !== ',') i += 1;
    items.push({ start, end: i, text: source.slice(start, i).trim() });
  }
  return { declStart: m.index, openIdx, closeIdx, items };
}

/** 收集文件中已出现的 kind: 'xxx'，约束补丁不得发明未知 kind */
export function collectBeatKinds(source: string): string[] {
  const set = new Set<string>();
  for (const m of source.matchAll(/\bkind\s*:\s*'([^']+)'/g)) set.add(m[1]);
  for (const m of source.matchAll(/\bkind\s*:\s*"([^"]+)"/g)) set.add(m[1]);
  return [...set];
}

/** JSON 对象 → 近似 TS object literal（键不加引号） */
export function jsonToTsObjectLiteral(value: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);
  const padIn = '  '.repeat(indent + 1);
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    const lines = value.map((v) => `${padIn}${jsonToTsObjectLiteral(v, indent + 1)}`);
    return `[\n${lines.join(',\n')}\n${pad}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined,
    );
    if (!entries.length) return '{}';
    const lines = entries.map(([k, v]) => {
      const key = /^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? k : JSON.stringify(k);
      return `${padIn}${key}: ${jsonToTsObjectLiteral(v, indent + 1)}`;
    });
    return `{\n${lines.join(',\n')}\n${pad}}`;
  }
  return 'null';
}

/** 把选中 index 的元素替换进数组字面量（保留其余元素原文） */
export function spliceConstArrayItems(
  source: string,
  name: string,
  patches: Map<number, string>,
): string | null {
  const arr = extractConstArray(source, name);
  if (!arr) return null;
  if (![...patches.keys()].every((i) => i >= 0 && i < arr.items.length)) return null;

  let out = '';
  let cursor = arr.openIdx + 1;
  out += source.slice(0, arr.openIdx + 1);
  for (let i = 0; i < arr.items.length; i += 1) {
    const item = arr.items[i];
    // 保留元素前空白/逗号
    out += source.slice(cursor, item.start);
    out += patches.has(i) ? patches.get(i)! : item.text;
    cursor = item.end;
  }
  out += source.slice(cursor);
  return out;
}

/** 文案向：用分镜 headline/vo/line 轻量改 BEATS 文本字段，不调 LLM */
export function syncBeatsCopyFromScenes(
  source: string,
  scenes: { headline?: string; vo?: string; line?: string }[],
  indexes: number[],
): string | null {
  const arr = extractConstArray(source, 'BEATS');
  if (!arr) return null;
  const patches = new Map<number, string>();
  for (const i of indexes) {
    if (i < 0 || i >= arr.items.length) continue;
    const scene = scenes[i];
    if (!scene) continue;
    let text = arr.items[i].text;
    const headline = (scene.headline || '').trim();
    const vo = (scene.vo || '').trim();
    const line = (scene.line || '').trim();
    if (headline) {
      text = text.replace(/(tag\s*:\s*)(['"])([\s\S]*?)\2/, `$1$2${escapeTsString(headline)}$2`);
    }
    if (vo) {
      if (/\bsub\s*:/.test(text)) {
        text = text.replace(/(sub\s*:\s*)(['"])([\s\S]*?)\2/, `$1$2${escapeTsString(vo)}$2`);
      } else {
        text = text.replace(/^\s*\{/, `{ sub: ${JSON.stringify(vo)}, `);
      }
    } else if (line && /\bsub\s*:/.test(text)) {
      text = text.replace(/(sub\s*:\s*)(['"])([\s\S]*?)\2/, `$1$2${escapeTsString(line)}$2`);
    }
    patches.set(i, text);
  }
  if (!patches.size) return null;
  return spliceConstArrayItems(source, 'BEATS', patches);
}

function escapeTsString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

/** 粗测：新文件相对旧文件是否整片重写（未选中镜也被大改） */
export function surgicalDriftTooHigh(prior: string, next: string, selectedRatio: number): boolean {
  if (!prior || !next) return false;
  if (prior.replace(/\s+/g, '') === next.replace(/\s+/g, '')) return false;
  const a = prior.split(/\r?\n/);
  const b = next.split(/\r?\n/);
  if (a.length < 40 || b.length < 40) return false;
  const setB = new Set(b.map((l) => l.trim()).filter((l) => l.length > 8));
  let hit = 0;
  let total = 0;
  for (const line of a) {
    const t = line.trim();
    if (t.length <= 8) continue;
    total += 1;
    if (setB.has(t)) hit += 1;
  }
  if (!total) return false;
  const keep = hit / total;
  // 只改少量分镜时，应保留大部分旧行；保留率过低 = 整片重写
  const minKeep = selectedRatio >= 0.5 ? 0.35 : 0.55;
  return keep < minKeep;
}
