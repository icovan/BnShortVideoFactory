import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Settings } from '../../shared/src/index.ts';
import { resolveSkillsDir } from './skills/paths.ts';

/** 运行时 skills 根目录（可被 BIUNOW_SKILLS_DIR 覆盖） */
export function getVendorSkillsDir() {
  return resolveSkillsDir();
}

export type SkillName =
  | 'explainer-video'
  | 'manim'
  | 'diagram-animation'
  | 'kinetic-typography'
  | 'launch-video'
  | 'presentation-video'
  | 'remotion-video'
  | 'shot-composition'
  | 'short-form-video'
  | 'caption-animation'
  | 'chart-animation'
  | 'wrapped-video'
  | 'whiteboard-animation'
  | 'stickman-animation'
  | 'isometric-animation'
  | 'text-message-animation'
  | 'promo-video'
  | 'product-demo-video'
  | 'photo-slideshow'
  | 'ad-creative-video'
  | 'testimonial-video'
  | 'countdown-video'
  | 'lower-thirds'
  | 'animated-infographic'
  | 'map-animation'
  | 'logo-animation'
  | 'motion-background'
  | 'color-motion'
  | 'animation-principles'
  | 'beat-sync-editing'
  | 'motion-art-direction'
  | 'creative-brief'
  | 'brand-motion-guidelines'
  | 'video-delivery-specs'
  | 'svg-animation'
  | 'lottie-animation'
  | 'generative-illustration'
  | 'soundtrack'
  | 'gsap-web'
  | '60fps-animation'
  | 'accessible-animation'
  | 'after-effects'
  | 'ascii-animation'
  | 'client-revisions'
  | 'glassmorphism'
  | 'javascript-animation'
  | 'micro-interaction'
  | 'motion-pricing'
  | 'page-transition-animation'
  | 'particle-system'
  | 'shader-glsl'
  | 'threejs-animation'
  | 'audiogram'
  | 'youtube-intro-outro'
  /** Electron 本机混剪台（素材 + EdgeTTS + FFmpeg） */
  | 'footage-remix';

const SKILL_REFS: Partial<Record<SkillName, string[]>> = {
  'logo-animation': [
    'references/logo-patterns.md',
    'references/remotion-logo-craft.md',
  ],
  'explainer-video': [
    'references/script-to-screen-workflow.md',
    'references/diagram-and-chart-recipes.md',
  ],
  manim: [
    'references/math-and-text.md',
    'references/graphs-and-updaters.md',
    'references/3d-and-camera.md',
  ],
  'diagram-animation': ['references/diagram-and-chart-recipes.md'],
  'launch-video': ['references/launch-structure.md'],
  'presentation-video': [
    'references/sequencing.md',
    'references/slide-components.md',
  ],
  'remotion-video': ['references/api-and-patterns.md'],
  'shot-composition': ['references/camera-and-grids.md'],
  'kinetic-typography': ['references/reveal-recipes.md'],
  'short-form-video': ['references/retention-pacing.md'],
  'caption-animation': ['references/word-timed-captions.md'],
  'chart-animation': ['references/data-pipeline.md', 'references/bar-chart-race.md'],
  'text-message-animation': ['references/imessage-timing.md'],
  'stickman-animation': [
    'references/stickman-pipeline.md',
    'references/pose-and-motion.md',
  ],
};

function skillRefs(n: SkillName): string[] {
  if (SKILL_REFS[n]?.length) return SKILL_REFS[n]!;
  const dir = join(resolveSkillsDir(), n, 'references');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => `references/${f}`);
}

function loadSkillRaw(n: SkillName): string {
  const root = resolveSkillsDir();
  const skill = join(root, n, 'SKILL.md');
  if (!existsSync(skill)) return '';
  const parts = [`# SKILL: ${n}\n\n` + readFileSync(skill, 'utf8')];
  for (const ref of skillRefs(n)) {
    const p = join(root, n, ref);
    if (existsSync(p)) parts.push(readFileSync(p, 'utf8'));
  }
  return parts.join('\n\n');
}

/** Keep core craft sections when budgeting (P1 chunked read). */
function extractCraftCore(md: string, maxChars: number): string {
  if (!md || md.length <= maxChars) return md;
  const blocks = md.split(/(?=^#{1,3}\s)/m);
  const prefer = /when to use|core |technique|output checklist|deliver|timing|pattern|remotion|must|non-negotiable|logo|diagram|caption|kinetic/i;
  const picked: string[] = [];
  let used = 0;
  for (const b of blocks) {
    if (!b.trim()) continue;
    const take = prefer.test(b.slice(0, 80)) || picked.length < 2;
    if (!take && used > maxChars * 0.55) continue;
    if (used + b.length > maxChars) {
      picked.push(b.slice(0, Math.max(200, maxChars - used)) + '\n\n[…section truncated…]');
      break;
    }
    picked.push(b);
    used += b.length;
  }
  if (!picked.length) return md.slice(0, maxChars) + '\n\n[…skill truncated…]';
  return picked.join('');
}

/** Load one or more vendored skills; optional char budget (default 28k). */
export function readSkill(name: SkillName | SkillName[], maxChars = 28000) {
  const names = Array.isArray(name) ? name : [name];
  const parts: string[] = [];
  for (const n of names) {
    const raw = loadSkillRaw(n);
    if (raw) parts.push(raw);
  }
  const joined = parts.join('\n\n---\n\n');
  return joined.length > maxChars ? joined.slice(0, maxChars) + '\n\n[…skill truncated…]' : joined;
}

/**
 * P1: Budgeted pack read — primary full-priority, technique cores, brand last.
 * Never starve primary for soft companions.
 */
export function readSkillPack(opts: {
  primary: SkillName;
  technique: SkillName[];
  brand?: SkillName[];
  extra?: SkillName[];
  budget?: number;
}): string {
  const budget = opts.budget ?? 36000;
  const primaryBudget = Math.floor(budget * 0.42);
  const techBudgetEach = Math.floor((budget * 0.40) / Math.max(1, opts.technique.length));
  const brandBudget = Math.floor(budget * 0.12);
  const extraBudget = Math.floor(budget * 0.06);

  const parts: string[] = [];
  parts.push(extractCraftCore(loadSkillRaw(opts.primary), primaryBudget));
  for (const t of opts.technique) {
    if (t === opts.primary) continue;
    parts.push(extractCraftCore(loadSkillRaw(t), techBudgetEach));
  }
  // remotion chassis always (own slice — do not steal brand budget)
  parts.push(extractCraftCore(loadSkillRaw('remotion-video'), Math.min(5500, Math.floor(budget * 0.14))));
  for (const b of opts.brand || []) {
    parts.push(extractCraftCore(loadSkillRaw(b), Math.floor(brandBudget / Math.max(1, (opts.brand || []).length))));
  }
  for (const e of opts.extra || []) {
    parts.push(extractCraftCore(loadSkillRaw(e), Math.floor(extraBudget / Math.max(1, (opts.extra || []).length))));
  }
  const joined = parts.filter(Boolean).join('\n\n---\n\n');
  return joined.length > budget ? joined.slice(0, budget) + '\n\n[…pack truncated…]' : joined;
}

export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmError';
  }
}

export async function chatJson<T>(
  settings: Settings,
  system: string,
  user: string,
  temperature = 0.5,
): Promise<T> {
  if (!settings.llmApiKey) throw new LlmError('还没有配置大模型 Key。请在左下角 → 大模型配置里填写。');
  const base = settings.llmBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.llmApiKey}`,
    },
    body: JSON.stringify({
      model: settings.llmModel,
      temperature,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new LlmError(`模型接口失败 ${res.status}: ${body.slice(0, 400)}`);
  }
  const data = await res.json() as {
    choices?: { message?: { content?: string; reasoning_content?: string } }[];
  };
  const text = messageText(data.choices?.[0]?.message);
  if (!text) throw new LlmError('模型返回空内容（若用 deepseek-flash/R1，请改用 deepseek-chat，或确保 content 非空）。');
  const jsonText = extractJson(text);
  try {
    return JSON.parse(jsonText) as T;
  } catch {
    throw new LlmError('模型没有返回可用 JSON。');
  }
}

export async function chatText(
  settings: Settings,
  system: string,
  user: string,
  temperature = 0.35,
): Promise<string> {
  if (!settings.llmApiKey) throw new LlmError('还没有配置大模型 Key。请在左下角 → 大模型配置里填写。');
  const base = settings.llmBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.llmApiKey}`,
    },
    body: JSON.stringify({
      model: settings.llmModel,
      temperature,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new LlmError(`模型接口失败 ${res.status}: ${body.slice(0, 400)}`);
  }
  const data = await res.json() as {
    choices?: { message?: { content?: string; reasoning_content?: string } }[];
  };
  const text = messageText(data.choices?.[0]?.message);
  if (!text) throw new LlmError('模型返回空内容。');
  return text;
}

/** OpenAI-compatible vision：user content = text + image_url */
export async function chatVisionJson<T>(
  settings: Settings,
  system: string,
  userText: string,
  imageDataUrl: string,
  temperature = 0.2,
): Promise<T> {
  if (!settings.llmApiKey) throw new LlmError('还没有配置大模型 Key。请在左下角 → 大模型配置里填写。');
  const base = settings.llmBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.llmApiKey}`,
    },
    body: JSON.stringify({
      model: settings.llmModel,
      temperature,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            { type: 'text', text: userText },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new LlmError(`视觉模型接口失败 ${res.status}: ${body.slice(0, 400)}`);
  }
  const data = await res.json() as {
    choices?: { message?: { content?: string; reasoning_content?: string } }[];
  };
  const text = messageText(data.choices?.[0]?.message);
  if (!text) throw new LlmError('视觉模型返回空内容。');
  const jsonText = extractJson(text);
  try {
    return JSON.parse(jsonText) as T;
  } catch {
    throw new LlmError('视觉模型没有返回可用 JSON。');
  }
}

/** flash/R1 可能把正文放在 reasoning_content，或 content 为空。 */
function messageText(msg?: { content?: string; reasoning_content?: string }) {
  const content = msg?.content?.trim() || '';
  if (content) return content;
  const reasoning = msg?.reasoning_content?.trim() || '';
  if (!reasoning) return '';
  const fenced = reasoning.match(/```(?:json|tsx|typescript|python)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[0];
  const start = reasoning.indexOf('{');
  const end = reasoning.lastIndexOf('}');
  if (start >= 0 && end > start) return reasoning.slice(start, end + 1);
  return reasoning;
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text.trim();
}
