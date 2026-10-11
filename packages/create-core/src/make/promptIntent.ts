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
const STICKMAN_RE = /stickman|stick[\s-]?fig(?:ure|ural)?|火柴人|胶囊(?:人|火柴)|motivation\s*vs\s*discipline|discipline\s*vs\s*motivation|simply\s*animated/i;

export function promptForcesMix(text: string): boolean {
  return keywordAffirmed(text, MIX_RE);
}

export function promptForcesStickman(text: string): boolean {
  return keywordAffirmed(text, STICKMAN_RE);
}
