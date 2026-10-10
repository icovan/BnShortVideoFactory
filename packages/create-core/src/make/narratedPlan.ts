import { chatJson, readSkill } from '../llm.ts';
import type { Settings } from '../../../shared/src/index.ts';
import { lookBrief, normalizeLook, type JobLook } from './look.ts';
import {
  DEFAULT_STAGE_TECHNIQUE,
  STAGE_TECHNIQUE_POOL,
  cameraFor,
  pickDiagramRecipe,
  pickPresentationRecipe,
  type DiagramRecipe,
  type NarratedTechnique,
  type PresentationRecipe,
  type SceneSpecBeat,
} from '../../../../packages/remotion-explainer/src/techniques.ts';

export type NarratedPlan = {
  brandName: string;
  cta: string;
  tagline: string;
  proofStat: string;
  proofLabel: string;
  variant: number;
  demoTopic: string;
  demoSlideTitle: string;
  demoSlideAccent: string;
  demoBullets: string[];
  demoSources: { title: string; subtitle: string; kind: 'web' | 'pdf' | 'note' }[];
  outlineLines: string[];
  chatUser: string;
  chatReply: string;
  techniqueByStage: Record<string, NarratedTechnique>;
  /** Full storyboard — one SceneSpec per stage (script-to-screen) */
  storyboard: SceneSpecBeat[];
  diagramRecipe: DiagramRecipe;
  presentationRecipe: PresentationRecipe;
  voByStage: {
    problem: string;
    brand: string;
    solution: string;
    research: string;
    design: string;
    proof: string;
    end: string;
  };
  onScreen: {
    problemHook: string;
    problemSticker: string;
    brandLine: string;
    promptText: string;
    researchTitle: string;
    designTitle: string;
    endTagline: string;
  };
  notes: string;
  seed?: string;
  look?: JobLook;
  canvas?: string;
  ink?: string;
  accent?: string;
  muted?: string;
  brandBg?: string;
  highlight?: string;
  bar?: string;
  energy?: string;
  surface?: 'dark' | 'light';
  motionNotes?: string;
};

const STAGES = ['problem', 'brand', 'solution', 'research', 'design', 'proof', 'end'] as const;

export async function planNarratedExplainer(prompt: string, settings: Settings): Promise<NarratedPlan> {
  const seed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const skill = readSkill('explainer-video');
  const poolHint = STAGES.map((s) => `${s}: [${(STAGE_TECHNIQUE_POOL[s] || []).join('|')}]`).join('; ');

  const plan = await chatJson<NarratedPlan>(settings, `You are the DIRECTOR for a narrated explainer (explainer-video skill).
Obey the explainer-video skill + script-to-screen + diagram recipes below.
You do NOT invent Remotion code. You output a complete storyboard SceneSpec + fill pack.

=== SKILL PACK ===
${skill.slice(0, 14000)}

=== FACTORY LOCKS ===
Stages (order fixed): ${STAGES.join(' → ')}
Technique pools: ${poolHint}
diagramRecipe ∈ flow|nodes|cascade (research uses this)
presentationRecipe ∈ deck_thumbs|hero_slide|split_chat (brand/design)
Chinese VO + on-screen Chinese (or mix if brief is English UI).
${lookBrief('narrated')}
CREATIVITY seed ${seed}:
1) Fresh demo — invent from THIS brief; never coffee/Bloom/PageOn unless brief says so.
2) storyboard[] MUST have exactly 7 beats — each with stage, technique, recipeId, vo, visualIntent, keyMotion, transition, caption.
3) research technique=diagram; solution=product_demo; proof=stat; end=cta.
4) VO Chinese ~32–40s; research+design ≥18 chars each.
5) ≥3 demoSources; outlineLines ≥4; chatUser/chatReply Chinese.
6) Every visualIntent must describe WHAT is on screen (not "nice UI").

Output JSON only.`, `User brief:
${prompt}

Return NarratedPlan including storyboard[7] and techniqueByStage.`, 0.92);

  let normalized = normalizeNarratedPlan(plan, seed);
  const check = validateStoryboard(normalized);
  if (!check.ok) {
    const fix = await chatJson<{ storyboard: SceneSpecBeat[]; techniqueByStage: Record<string, NarratedTechnique> }>(
      settings,
      `Fix incomplete explainer storyboard. Keep 7 stages. Each beat needs technique, vo, visualIntent, keyMotion, transition, caption, recipeId.`,
      `Issues: ${JSON.stringify(check.issues)}
Current storyboard: ${JSON.stringify(normalized.storyboard)}
Return {"storyboard":[...7],"techniqueByStage":{...}}`,
      0.7,
    );
    normalized = normalizeNarratedPlan({
      ...normalized,
      storyboard: fix.storyboard || normalized.storyboard,
      techniqueByStage: fix.techniqueByStage || normalized.techniqueByStage,
    }, seed);
  }
  return normalized;
}

export function validateStoryboard(plan: NarratedPlan): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!plan.storyboard?.length) issues.push('storyboard empty');
  else if (plan.storyboard.length !== 7) issues.push(`storyboard length ${plan.storyboard.length} ≠ 7`);
  for (const stage of STAGES) {
    const beat = plan.storyboard?.find((b) => b.stage === stage);
    if (!beat) {
      issues.push(`missing storyboard beat ${stage}`);
      continue;
    }
    if (!beat.technique) issues.push(`${stage}: no technique`);
    if (!beat.vo || beat.vo.trim().length < 6) issues.push(`${stage}: VO too thin`);
    if (!beat.visualIntent || beat.visualIntent.trim().length < 8) issues.push(`${stage}: visualIntent missing`);
    if (!beat.keyMotion) issues.push(`${stage}: keyMotion missing`);
    if (!beat.caption) issues.push(`${stage}: caption missing`);
  }
  const research = plan.storyboard?.find((b) => b.stage === 'research');
  if (research && research.technique !== 'diagram') issues.push('research must be diagram');
  return { ok: issues.length === 0, issues };
}

/** LLM sometimes returns structured objects instead of plain strings */
function asText(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v.trim() || fallback;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    for (const k of ['text', 'title', 'label', 'url', 'value', 'name', 'topic', 'line', 'content']) {
      if (typeof o[k] === 'string' && (o[k] as string).trim()) return (o[k] as string).trim();
    }
  }
  return fallback;
}

function asStringList(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  const out = v.map((x) => asText(x)).filter(Boolean);
  return out.length ? out : fallback;
}

export function normalizeNarratedPlan(plan: NarratedPlan, seed = 'x'): NarratedPlan {
  const tech: Record<string, NarratedTechnique> = { ...(plan.techniqueByStage || {}) };
  for (const stage of STAGES) {
    const fromBoard = plan.storyboard?.find((b) => b.stage === stage)?.technique;
    const pick = tech[stage] || fromBoard;
    const pool = STAGE_TECHNIQUE_POOL[stage] || ['kinetic'];
    tech[stage] = pick && pool.includes(pick) ? pick : (DEFAULT_STAGE_TECHNIQUE[stage] || pool[0]);
  }
  tech.research = 'diagram';
  tech.solution = 'product_demo';
  tech.proof = 'stat';
  tech.end = 'cta';

  const diagramRecipe = pickDiagramRecipe(seed, plan.diagramRecipe);
  const presentationRecipe = pickPresentationRecipe(tech.brand || tech.design, seed, plan.presentationRecipe);

  const sources = (plan.demoSources || [])
    .map((s) => ({
      title: asText((s as { title?: unknown })?.title),
      subtitle: asText((s as { subtitle?: unknown })?.subtitle, '来源'),
      kind: ((s as { kind?: string })?.kind === 'pdf' || (s as { kind?: string })?.kind === 'note'
        ? (s as { kind: 'pdf' | 'note' }).kind
        : 'web') as 'web' | 'pdf' | 'note',
    }))
    .filter((s) => s.title);
  while (sources.length < 3) {
    sources.push({
      title: ['行业报告', '用户访谈', 'brief.pdf'][sources.length],
      subtitle: sources.length < 2 ? '网页来源' : '你的文档',
      kind: sources.length < 2 ? 'web' : 'pdf',
    });
  }

  const voByStage = plan.voByStage || ({} as NarratedPlan['voByStage']);
  let storyboard = (plan.storyboard || []).filter((b) => b?.stage);
  // Ensure 7 beats — synthesize missing from vo/tech
  storyboard = STAGES.map((stage) => {
    const existing = storyboard.find((b) => b.stage === stage);
    const vo = asText(existing?.vo || voByStage[stage], `${stage} 旁白`);
    const technique = tech[stage];
    let recipeId = asText(existing?.recipeId) || undefined;
    if (technique === 'diagram') recipeId = diagramRecipe;
    else if (technique === 'chat_edit') recipeId = 'split_chat';
    else if (technique === 'chart_slide') recipeId = presentationRecipe === 'deck_thumbs' ? 'hero_slide' : presentationRecipe;
    else if (technique === 'kinetic' && stage === 'brand') recipeId = 'deck_thumbs';
    else recipeId = recipeId || technique;
    return {
      stage,
      technique,
      recipeId,
      vo,
      visualIntent: asText(existing?.visualIntent, defaultVisual(stage, technique)),
      keyMotion: asText(existing?.keyMotion, defaultMotion(technique)),
      transition: asText(existing?.transition, 'hard cut + indigo wipe'),
      caption: asText(existing?.caption, vo.slice(0, 42)),
    } satisfies SceneSpecBeat;
  });

  // Sync VO from storyboard
  for (const b of storyboard) {
    voByStage[b.stage as keyof typeof voByStage] = b.vo;
  }

  const look = normalizeLook(plan, 'narrated');
  const cta = asText(plan.cta, '开始使用');
  const tagline = asText(plan.tagline, '用在你的下一套片子上。');
  const demoTopic = asText(plan.demoTopic, '新品路演');
  const brandLine = asText(plan.onScreen?.brandLine, '一句话搭好整套片子。');

  return {
    ...plan,
    seed,
    look,
    canvas: look.canvas,
    ink: look.ink,
    accent: look.accent,
    muted: look.muted,
    brandBg: look.brandBg,
    brandName: asText(plan.brandName, 'Brand'),
    cta,
    tagline,
    proofStat: asText(plan.proofStat, '120+'),
    proofLabel: asText(plan.proofLabel, '来自 120+ 个国家的创作者'),
    variant: Math.min(2, Math.max(0, Number(plan.variant) || 0)),
    demoTopic,
    demoSlideTitle: asText(plan.demoSlideTitle, '市场在变'),
    demoSlideAccent: asText(plan.demoSlideAccent, '关键一击'),
    demoBullets: asStringList(plan.demoBullets, []).slice(0, 4),
    demoSources: sources.slice(0, 5),
    outlineLines: asStringList(plan.outlineLines, ['问题与机会', '方案一句话', '证明点', '下一步']).slice(0, 5),
    chatUser: asText(plan.chatUser, '把标题加粗，再加一张图表'),
    chatReply: asText(plan.chatReply, '好了，版式已更新。'),
    techniqueByStage: tech,
    storyboard,
    diagramRecipe,
    presentationRecipe,
    voByStage,
    onScreen: {
      problemHook: asText(plan.onScreen?.problemHook, '想法很多，片子还空着。'),
      problemSticker: asText(plan.onScreen?.problemSticker, '是不是很熟悉？'),
      brandLine: /finished/i.test(brandLine) ? '一句话搭好整套片子。' : brandLine,
      promptText: asText(plan.onScreen?.promptText, demoTopic),
      researchTitle: asText(plan.onScreen?.researchTitle, '检索、撰写，搭出大纲'),
      designTitle: asText(plan.onScreen?.designTitle, '设计幻灯片'),
      endTagline: asText(plan.onScreen?.endTagline, tagline),
    },
    notes: asText(plan.notes, ''),
  };
}

function defaultVisual(stage: string, tech: string) {
  const map: Record<string, string> = {
    problem: '空白演示文稿 + 痛点动能字',
    brand: tech === 'chart_slide' ? '成品幻灯片英雄卡' : '紫底四角多版式浮卡',
    solution: '输入主题假 UI + 光标点生成',
    research: '资料源→连接线→打字大纲 diagram',
    design: '侧栏聊天改稿 + 幻灯片更新',
    proof: '120+ 数字跳动与环绕卡',
    end: 'Logo + CTA pill',
  };
  return map[stage] || tech;
}

function defaultMotion(tech: string) {
  const map: Record<string, string> = {
    kinetic: 'word slam stagger',
    blank_deck: 'slide settle + sticker pop',
    product_demo: 'typewriter + cursor click',
    diagram: 'nodes then edges then labels',
    chat_edit: 'bubble in + slide restyle',
    chart_slide: 'slide enter + pie grow',
    stat: 'count-up',
    cta: 'logo bloom',
  };
  return map[tech] || 'soft enter';
}

export function resolveTechnique(stage: string, plan: NarratedPlan): NarratedTechnique {
  const t = plan.techniqueByStage?.[stage];
  const pool = STAGE_TECHNIQUE_POOL[stage] || ['kinetic'];
  if (t && pool.includes(t)) return t;
  return DEFAULT_STAGE_TECHNIQUE[stage] || 'kinetic';
}

export function resolveCamera(stage: string, plan: NarratedPlan) {
  return cameraFor(resolveTechnique(stage, plan), plan.variant);
}

export function beatFor(stage: string, plan: NarratedPlan): SceneSpecBeat | undefined {
  return plan.storyboard?.find((b) => b.stage === stage);
}

export type InspectResult = { ok: boolean; issues: string[]; fixHint?: string };

export function inspectNarratedProps(props: {
  brandName: string;
  scenes: {
    stage: string;
    technique?: string;
    recipeId?: string;
    visualIntent?: string;
    vo?: string;
    title?: string;
    slideTitle?: string;
    proofLabel?: string;
    narrationFile?: string;
    durationSec: number;
    thumbs?: { title?: string; kind?: string }[];
    outlineLines?: string[];
    chatUser?: string;
  }[];
}, stillFiles: string[]): InspectResult {
  const issues: string[] = [];
  const stages = props.scenes.map((s) => (s.stage === 'how' ? 'research' : s.stage));
  for (const need of STAGES) {
    if (!stages.includes(need)) issues.push(`missing stage ${need}`);
  }
  for (const s of props.scenes) {
    if (!s.vo?.trim()) issues.push(`${s.stage}: empty VO`);
    if (!s.narrationFile) issues.push(`${s.stage}: missing narrationFile`);
    if (!s.technique) issues.push(`${s.stage}: missing technique`);
    if (!s.recipeId) issues.push(`${s.stage}: missing recipeId`);
    if (!s.visualIntent) issues.push(`${s.stage}: missing visualIntent (SceneSpec incomplete)`);
    if (s.durationSec < 1.5) issues.push(`${s.stage}: duration too short`);
  }
  const research = props.scenes.find((s) => s.stage === 'research' || s.stage === 'how');
  const design = props.scenes.find((s) => s.stage === 'design');
  if (research && research.technique !== 'diagram') issues.push('research must use diagram');
  if (research && !['flow', 'nodes', 'cascade'].includes(research.recipeId || '')) {
    issues.push('research recipeId must be flow|nodes|cascade');
  }
  if (research && (research.outlineLines?.length || 0) < 3) issues.push('research missing outlineLines');
  if (design && design.technique === 'chat_edit' && !design.chatUser) issues.push('chat_edit missing chatUser');
  const brand = props.scenes.find((s) => s.stage === 'brand');
  if (brand && (brand.recipeId || 'deck_thumbs') === 'deck_thumbs') {
    if ((brand.thumbs?.length || 0) < 3) issues.push('brand deck_thumbs needs ≥3 thumbs');
    if (brand.thumbs?.length) {
      const kinds = new Set(brand.thumbs.map((t) => t.kind).filter(Boolean));
      if (kinds.size < 3) issues.push('brand thumbs need ≥3 distinct kinds');
    }
  }
  if (brand?.recipeId === 'hero_slide' && !brand.slideTitle && !brand.title) {
    issues.push('brand hero_slide needs slideTitle');
  }
  const techs = props.scenes.map((s) => s.technique).filter(Boolean);
  if (new Set(techs).size < 4) issues.push(`technique diversity too low (${new Set(techs).size})`);
  if (stillFiles.length < 4) issues.push(`too few stills (${stillFiles.length})`);
  return {
    ok: issues.length === 0,
    issues,
    fixHint: issues.length ? 'Complete SceneSpec (technique+recipeId+visualIntent); research diagram recipe; brand thumbs.' : undefined,
  };
}

/** Phase 4: verify still filenames / props map — technique actually scheduled */
export function verifyTechniqueRender(props: {
  scenes: { stage: string; technique?: string; recipeId?: string; durationSec: number }[];
}, stillFiles: string[]): InspectResult {
  const issues: string[] = [];
  if (stillFiles.length < props.scenes.length - 1) {
    issues.push(`still count ${stillFiles.length} low for ${props.scenes.length} scenes`);
  }
  for (const s of props.scenes) {
    if (!s.technique || !s.recipeId) issues.push(`${s.stage}: not renderable SceneSpec`);
  }
  const research = props.scenes.find((s) => s.stage === 'research');
  if (research && research.technique === 'diagram' && !research.recipeId) {
    issues.push('diagram scene missing recipe — would fall back to single mold');
  }
  return { ok: issues.length === 0, issues };
}
