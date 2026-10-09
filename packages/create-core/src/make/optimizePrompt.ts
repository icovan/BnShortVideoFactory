import { chatJson, readSkill } from '../llm.ts';
import type { Aspect, Settings } from '../../../shared/src/index.ts';
import { PRIMARY_SKILLS } from '../skills/registry.ts';
import {
  detectContentLang,
  resolveContentLang,
  type ContentLang,
} from './contentLang.ts';
import { craftFloorForOptimize } from './craftFloor.ts';
import { asksForStickman, stickmanMachineLockBlock, withStickmanMachineLock } from './stickmanBrief.ts';

export type FactoryBrief = {
  /**
   * @deprecated Use machinePrompt — kept as alias so older callers keep working.
   * Always English machine brief.
   */
  prompt: string;
  /** English technical brief for router / codegen (never shown as the main UI box). */
  machinePrompt: string;
  /** Densified ask in audience language — safe to show/edit in CreatePage. */
  audiencePrompt: string;
  /** Raw user ask before densify. */
  sourceAsk: string;
  lookLock: string;
  primaryGuess: string;
  assumptions: string[];
  /** Audience language for VO + on-screen copy — locked from sourceAsk. */
  contentLang: ContentLang;
};

function audienceLabel(lang: ContentLang): string {
  if (lang === 'en') return 'English';
  if (lang === 'bilingual') return 'Simplified Chinese (with short English labels allowed)';
  return 'Simplified Chinese';
}

function densifyFallback(raw: string, aspect: Aspect): FactoryBrief {
  const t = raw.trim();
  const contentLang = detectContentLang(t);
  const machinePrompt = withStickmanMachineLock(
    [
      t,
      `Locked aspect ${aspect}. One idea, spoken then shown.`,
      `Audience contentLang=${contentLang}. Machine brief is English; VO/on-screen must follow contentLang.`,
      'If voiceover is implied, write VO in contentLang; if music-led / no VO, say so.',
      craftFloorForOptimize(aspect),
      'Name surface (dark/light), energy, 2–3 motion verbs (slam, count-up, stroke, parallax). Palette from THIS topic.',
      'Do not average three messages. Keep brand colors if the ask named them.',
    ].join(' '),
    t,
  );
  const audienceExtra = contentLang === 'en'
    ? 'Keep one core message. Name surface, type scale, depth, and 2–3 motion beats. Portfolio framing — not VO/SKU rules.'
    : '只保留一个核心观点。写清画面（深/浅）、字号动能、景深、2～3 个动作。作品集级构图与动效——不谈口播/片型管线。';
  return {
    prompt: machinePrompt,
    machinePrompt,
    audiencePrompt: `${t}\n\n${audienceExtra}`,
    sourceAsk: t,
    lookLock: 'keep-from-ask',
    primaryGuess: '',
    assumptions: ['optimizer offline — densified locally'],
    contentLang,
  };
}

/**
 * Dual-track densify:
 * - audiencePrompt → UI / language lock (same script as user)
 * - machinePrompt → router + codegen (English)
 */
export async function optimizePrompt(
  raw: string,
  aspect: Aspect,
  settings: Settings,
): Promise<FactoryBrief> {
  const ask = raw.trim();
  if (!ask) throw new Error('empty prompt');
  if (!settings.llmApiKey) return densifyFallback(ask, aspect);

  const craft = readSkill(['creative-brief', 'motion-art-direction'], 18000);
  const detected = detectContentLang(ask);
  const audLang = audienceLabel(detected);
  try {
    const out = await chatJson<{
      audiencePrompt?: string;
      machinePrompt?: string;
      prompt?: string;
      lookLock?: string;
      primaryGuess?: string;
      contentLang?: string;
      assumptions?: string[];
    }>(settings, `You densify a user ask into TWO briefs for a Remotion motion-graphics factory.
${craft}

Rules:
- Do NOT ask the user questions. Fill cosmetic gaps with flagged assumptions.
- Keep every hard fact (names, numbers, colors, no-VO / 口播).
- If the ask includes a WEB SEARCH RESULTS block, treat those snippets as grounded sources — prefer their facts; do NOT invent extra URLs or statistics beyond them.
- If the ask includes a URL EXTRACT RESULTS / USER PAGE block, treat that as the primary source document for VO and on-screen facts — do not invent conflicting page content.
- Do NOT invent a competing brand palette if they already named one.
- One core message. Tone = 3 adjectives + "but not".
- Locked aspect is ${aspect}.
- Name likely primary skill from: ${PRIMARY_SKILLS.filter((s) => s !== 'manim').join(', ')}.
- contentLang is LOCKED to ${detected}. Echo it. Never flip language.
- CRAFT FLOOR in machinePrompt (canvas/motion ONLY — not VO policy, not SKU arcs): ${craftFloorForOptimize(aspect)} Palette from THIS topic (forbid default Linear/PageOn purple).
${asksForStickman(ask) ? `
STICKMAN DETECTED in the ask — you MUST append this exact block at the end of machinePrompt (English ok inside the block):
---
${stickmanMachineLockBlock()}
---
In machinePrompt also name 2–4 stickman beats as clip:<id> phrases (explain-board / compare-sides / hesitate / agree-cheer…). Do NOT list raw POSES.* names.` : ''}

DUAL TRACK (critical):
1) audiencePrompt — write in ${audLang}. Expand shots, type, depth, motion, contrast, length — STAY in that language. 80–220 words / 120–400 Chinese chars. No markdown headings.
2) machinePrompt — MACHINE ENGLISH only for router + technique. Dense, concrete, 120–280 words. No Chinese body copy. Encode contentLang=${detected}. Explicitly state type scale, spring/depth, framing, draw techniques — do NOT rewrite VO on/off here (that is a separate lock).

Do NOT invent "caption-driven (no VO)" unless the user said so.

JSON only.`, `User ask:
${ask}

Return:
{
  "audiencePrompt":"",
  "machinePrompt":"",
  "lookLock":"dark|light + energy + anti-tone",
  "primaryGuess":"explainer-video",
  "contentLang":"${detected}",
  "assumptions":["ASSUMPTION — ..."]
}`, 0.32);

    const machinePrompt = (out.machinePrompt || out.prompt || '').trim();
    let audiencePrompt = (out.audiencePrompt || '').trim();
    if (machinePrompt.length < 40) return densifyFallback(ask, aspect);
    if (audiencePrompt.length < 20) audiencePrompt = ask;

    // If model wrongly returned English-only audience for a zh ask, fall back to source ask
    if (detected === 'zh' || detected === 'bilingual') {
      const cjk = (audiencePrompt.match(/[\u4e00-\u9fff]/g) || []).length;
      if (cjk < 4) audiencePrompt = ask;
    }
    if (detected === 'en') {
      const cjk = (audiencePrompt.match(/[\u4e00-\u9fff]/g) || []).length;
      const latin = (audiencePrompt.match(/[A-Za-z]/g) || []).length;
      if (cjk > latin) audiencePrompt = ask;
    }

    const contentLang = resolveContentLang({ ask, guessed: out.contentLang });
    const lockedMachine = withStickmanMachineLock(machinePrompt, ask);
    return {
      prompt: lockedMachine,
      machinePrompt: lockedMachine,
      audiencePrompt,
      sourceAsk: ask,
      lookLock: (out.lookLock || '').toString().slice(0, 120),
      primaryGuess: (out.primaryGuess || '').toString().slice(0, 40),
      assumptions: Array.isArray(out.assumptions) ? out.assumptions.map(String).slice(0, 8) : [],
      contentLang,
    };
  } catch {
    return densifyFallback(ask, aspect);
  }
}
