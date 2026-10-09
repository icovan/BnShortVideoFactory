import { chatJson } from '../llm.ts';
import type { Settings } from '../../../shared/src/index.ts';
import type { SkillName } from '../llm.ts';
import type { ContentLang } from './contentLang.ts';
import type { DirectedBeat, SkillPlan } from './skillPlan.ts';
import { isSkillName } from '../skills/registry.ts';

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

/** 原文切镜：一行一句，或 --- / 空行分段 */
export function splitVerbatimScript(raw: string): string[] {
  const t = (raw || '').replace(/\r\n/g, '\n').trim();
  if (!t) return [];
  if (/\n\s*---\s*\n/.test(t)) {
    return t.split(/\n\s*---\s*\n/).map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s.length >= 2);
  }
  // 连续空行分段
  if (/\n\s*\n/.test(t)) {
    const blocks = t.split(/\n\s*\n+/).map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s.length >= 2);
    if (blocks.length >= 3) return blocks;
  }
  // 一行一句
  const lines = t.split('\n').map((s) => s.replace(/^\s*[-*•\d.、．)]+\s*/, '').trim()).filter((s) => s.length >= 2);
  if (lines.length >= 2) return lines;
  // 单段：按句号切
  const bySent = t.split(/(?<=[。！？!?；;])\s*/).map((s) => s.trim()).filter((s) => s.length >= 2);
  return bySent.length ? bySent : [t];
}

function pickSkillForBeat(
  hint: string | undefined,
  primary: SkillName,
  support: SkillName[],
  index: number,
  total: number,
): SkillName {
  if (hint && isSkillName(hint)) return hint;
  const pool = [primary, ...support.filter((s) => s !== 'motion-art-direction')];
  if (index === 0) return pool.find((s) => s === 'kinetic-typography') || primary;
  if (index === total - 1) return pool.find((s) => s === 'caption-animation') || primary;
  return pool[index % Math.max(pool.length, 1)] || primary;
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
    return splitVerbatimScript(src).slice(0, 40).map((vo, i) => ({
      job: `beat-${i}`,
      vo,
      headline: vo.slice(0, 16),
      visualIntent: `Illustrate: ${vo.slice(0, 80)}`,
      keyMotion: 'spring reveal',
    }));
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
- headline = short on-screen title for that beat (≤16 zh chars / ≤6 en words).
- visualIntent = concrete motion graphic action for skills (diagram / kinetic / chart / caption).
- keyMotion = 2–5 word motion verb phrase.
- skill optional hint: explainer-video | kinetic-typography | diagram-animation | chart-animation | caption-animation | whiteboard-animation.
- Keep source order. No new claims not in the document.

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

    if (cleaned.length >= 3) return cleaned;
  } catch {
    /* fall through */
  }
  return splitVerbatimScript(src).slice(0, 40).map((vo, i) => ({
    job: `beat-${i}`,
    vo,
    headline: vo.slice(0, 16),
    visualIntent: `Illustrate: ${vo.slice(0, 80)}`,
    keyMotion: 'spring reveal',
  }));
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
    return bits.slice(0, 24).map((vo, i) => ({
      job: `beat-${i}`,
      vo: vo.slice(0, 40),
      headline: vo.slice(0, 16),
      visualIntent: `Illustrate: ${vo.slice(0, 80)}`,
      keyMotion: 'spring reveal',
    }));
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
    }>(settings, `You turn a USER ASK (not a finished script) into a FILM-READY voice-over for a Remotion explainer.

Goals (in order):
1) Coverage: every concrete fact, step, name, and number in the ask must appear in some vo line. Do NOT collapse a lesson into 5 slogan beats.
2) Speakable: one idea per beat, one breath unit.
3) Honesty: do NOT invent statistics, brands, URLs, or claims absent from the ask. If the ask is thin, write a clear short film — still one idea per beat, not filler slogans.
4) Output is the FINAL VO — later stages speak these lines verbatim.

Rules:
- ${langRule}
- Aspect ${opts.aspect}. ${beatRange}
- Each vo: zh ≈ 12–40 chars; en ≈ 8–22 words. Split long thoughts; do not truncate mid-idea.
- headline ≤16 zh chars / ≤6 en words — on-screen title, not a second VO.
- visualIntent = concrete motion-graphic action (diagram / kinetic hook / chart / caption).
- keyMotion = 2–5 word motion verb phrase.
- skill optional: explainer-video | kinetic-typography | diagram-animation | chart-animation | caption-animation | whiteboard-animation.
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

    if (cleaned.length >= 4) return cleaned;
  } catch {
    /* fall through */
  }
  return [];
}

/** 把旁白脚本硬锁进 plan：VO 不再被短句规则改写 */
export function applyScriptDriveToPlan(
  plan: SkillPlan,
  script: ScriptBeat[],
  mode: ScriptDriveMode,
): SkillPlan {
  if (mode === 'off' || !script.length) return plan;
  const total = script.length;
  const beats: DirectedBeat[] = script.map((s, i) => ({
    job: s.job || `beat-${i}`,
    vo: s.vo.trim(),
    headline: (s.headline || s.vo).slice(0, 48),
    visualIntent: (s.visualIntent || s.vo).slice(0, 200),
    keyMotion: (s.keyMotion || 'spring reveal').slice(0, 80),
    skill: pickSkillForBeat(s.skill, plan.primary, plan.support, i, total),
    durationSec: undefined,
  }));
  return {
    ...plan,
    beats,
    voMode: 'on',
    scriptDrive: mode === 'auto' ? 'polish' : mode,
  };
}

export function joinDocsText(docs: { name: string; text: string }[]): string {
  return docs.map((d) => `【${d.name}】\n${d.text}`).join('\n\n');
}
