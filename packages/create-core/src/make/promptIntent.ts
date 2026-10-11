/**
 * Keyword intent helpers — avoid false positives from negations
 * e.g. 「不要混剪」「别用火柴人」 must NOT force those routes.
 */

const NEGATE =
  /(?:不要|别|别用|不用|不要用|禁止|切勿|勿|非|不是|无需|不需要|千万别|绝对不要|no|not|without|don't|dont|never|avoid)\s*/i;

/** True if `needle` appears as an affirmed ask, not under a nearby negation. */
export function keywordAffirmed(text: string, needle: RegExp): boolean {
  const src = text || '';
  if (!needle.test(src)) return false;
  // Reset lastIndex for global regexes
  needle.lastIndex = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(needle.source, needle.flags.includes('g') ? needle.flags : `${needle.flags}g`);
  while ((m = re.exec(src))) {
    const start = Math.max(0, m.index - 12);
    const window = src.slice(start, m.index);
    if (!NEGATE.test(window)) return true;
  }
  return false;
}

const MIX_RE = /混剪|素材混剪|批量剪辑|footage\s*remix|batch\s*cut|raw\s*footage|分镜素材成片/i;
const STICKMAN_NAME = /stickman|stick[\s-]?fig(?:ure|ural)?|火柴人|胶囊(?:人|火柴)|simply\s*animated|motivation\s*vs\s*discipline|discipline\s*vs\s*motivation/i;
const MANIM_NAME = /\bmanim\b|3\s*b\s*1\s*b|3blue1brown|three\s+blue\s+one\s+brown/i;
const ORDER_BEFORE = /(?:用|做成|制作|渲染|请用|出成|出片)\s*$/;
const ORDER_AFTER = /^\s*(?:风格|出片|来演|来讲|出演|动画片)/;

/** Drop narration, uploads, and search snippets so a name inside the script is not an order. */
export function stripSourceMaterial(text: string): string {
  const src = text || '';
  const idx = src.search(
    /(?:^|\n)\s*(?:User-provided source documents|--- USER DOC:|WEB SEARCH RESULTS|WEB SEARCH \(|URL EXTRACT|Source docs attached:)/i,
  );
  if (idx < 0) return src;
  return src.slice(0, idx).trim();
}

function hasCraftOrder(text: string, name: RegExp): boolean {
  const re = new RegExp(name.source, name.flags.includes('g') ? name.flags : `${name.flags}g`);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 12), m.index);
    if (NEGATE.test(before)) continue;
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 8);
    const listItem = /[、,，;；]\s*$/.test(before) && /^\s*[、,，;；]/.test(after);
    if (listItem && !ORDER_BEFORE.test(before)) continue;
    if (ORDER_BEFORE.test(before) || ORDER_AFTER.test(after)) return true;
    if (/simply\s*animated|motivation\s*vs\s*discipline|discipline\s*vs\s*motivation|3blue1brown|three\s+blue\s+one\s+brown/i.test(m[0])) {
      return true;
    }
  }
  return false;
}

export function promptForcesMix(text: string): boolean {
  return keywordAffirmed(stripSourceMaterial(text), MIX_RE);
}

/** True only when the user asks to perform with stickman — not when a script merely names it. */
export function promptForcesStickman(text: string): boolean {
  const src = stripSourceMaterial(text);
  if (!keywordAffirmed(src, STICKMAN_NAME)) return false;
  return hasCraftOrder(src, STICKMAN_NAME);
}

/** True only when the user asks to render with Manim — not when a script merely names it. */
export function promptForcesManim(text: string): boolean {
  const src = stripSourceMaterial(text);
  if (!keywordAffirmed(src, MANIM_NAME)) return false;
  return hasCraftOrder(src, MANIM_NAME);
}
