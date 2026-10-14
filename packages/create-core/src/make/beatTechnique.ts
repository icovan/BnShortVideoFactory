/**
 * 一镜一技法：画面要求里写了地图 / 等距 / 白板 / 聊天，就用这一镜的技能，
 * 不要整片都挂成主技能（促销片的「划价」不得写进地图镜）。
 */
import type { SkillName } from '../llm.ts';
import { attachCraftMust } from '../skills/skillDepth.ts';
import { isSkillName } from '../skills/registry.ts';
/**
 * 匹配顺序 = 优先级。画面材质/器物类必须先于 kinetic，
 * 否则「剪纸/拼贴/插画」会被 LLM 默认 kinetic 抢走。
 */
const RULES: { re: RegExp; skill: SkillName }[] = [
  // —— 画面材质 / 插画族（可作主技法）——
  { re: /剪纸|拼贴|纸雕|剪贴|错位纸|纸片层|剪影层|paper[\s-]?cut|collage|papercraft/i, skill: 'generative-illustration' },
  { re: /木刻|版画|woodcut|linocut|蚀刻|雕版/i, skill: 'generative-illustration' },
  { re: /插画|手绘插图|illustration|水彩|水墨(?!白板)|黏土|clay\s*mation|拼布/i, skill: 'generative-illustration' },
  // —— 场景点名技法 ——
  { re: /地图|航线|海岸|路线图|航线图|城市之间|marker|coastline|\broute\b|\bmap\b/i, skill: 'map-animation' },
  { re: /等距|三面墙|爆炸图|isometric|rotateX/i, skill: 'isometric-animation' },
  { re: /白板|一笔|描边|笔画|奶油纸|杯子|whiteboard|stroke draw|ink draw|手绘流程/i, skill: 'whiteboard-animation' },
  { re: /聊天|气泡|短信|输入点|iMessage|chat bubble|typing/i, skill: 'text-message-animation' },
  { re: /手机|光标|磨砂|玻璃|收据|界面走查|device frame|\bcursor\b/i, skill: 'product-demo-video' },
  { re: /倒计时|countdown|3\s*[,、/]\s*2\s*[,、/]\s*1/i, skill: 'countdown-video' },
  { re: /粒子|纸屑|纸星|particle/i, skill: 'particle-system' },
  { re: /划掉|旧价|新价|price strike|% off|￥\s*\d|¥\s*\d/i, skill: 'promo-video' },
  { re: /标志|折角|wordmark|\blogo\b|字母.*定版|定版锁/i, skill: 'logo-animation' },
  { re: /柱状|折线|图表|曲线|人口|十亿|亿人|count-up|bar grow|ticker|从\s*0\s*长|billion|population\s*growth/i, skill: 'chart-animation' },
  { re: /矢量描边|svg\s*path|pathLength/i, skill: 'svg-animation' },
  // kinetic 靠后：仅当字本身是主体，或 brief 明示动能字
  { re: /砸字|逐词|动能大字|word slam|kinetic|纯文字片|大字报/i, skill: 'kinetic-typography' },
  { re: /年度回顾|wrapped|recap stat/i, skill: 'wrapped-video' },
];

/** 材质/插画向：可升格为主技法（即使在 SOFT 列表里） */
export const PICTURE_MAIN_SKILLS: SkillName[] = [
  'generative-illustration',
  'svg-animation',
];

/** brief 是否画面材质主导（非「字即主体」） */
export function isPictureMaterialBrief(text: string): boolean {
  return /剪纸|拼贴|纸雕|插画|木刻|版画|水彩|水墨|黏土|paper[\s-]?cut|collage|illustration|woodcut|papercraft|错位纸|纸片/i.test(text || '');
}

/** brief 是否明示动能字为主 */
export function isTypeLedBrief(text: string): boolean {
  return /砸字|逐词|动能大字|word slam|kinetic|纯文字|typography\s*only|大字报/i.test(text || '');
}

type TechniqueBeat = {
  job?: string;
  vo?: string;
  headline?: string;
  visualIntent?: string;
  keyMotion?: string;
  skill: SkillName | string;
  layoutMode?: string;
  craftMust?: string[];
};

const ROTATION: { skill: SkillName; keyMotion: string; intent: (title: string) => string }[] = [
  {
    skill: 'kinetic-typography',
    keyMotion: 'word slam overshoot',
    intent: (title) => `这一镜只有字：「${title}」逐词入画。字就是主体，后面不要再叠节点、柱或卡片`,
  },
  {
    skill: 'diagram-animation',
    keyMotion: 'nodes then edges',
    intent: (title) => `标题「${title}」放在上方一条里。节点和连线占下面的主画面，先出点再出线，标题不压在图形上`,
  },
];

/**
 * 讲解片可硬轮换的技法（无需门禁关键词）。
 * 对齐 a2e「画面关系模式」：旁白不同 → 画法族不同，禁止整片 diagram 糊成一张皮。
 */
const DIVERSITY_POOL: SkillName[] = [
  'diagram-animation',
  'kinetic-typography',
  'chart-animation',
  'whiteboard-animation',
  'animated-infographic',
];

/** logo / launch / 几何海报开场：禁止无正面点名时灌入 map/iso/chat 等 SCENE 技 */
const POSTER_DIVERSITY_POOL: SkillName[] = [
  'logo-animation',
  'kinetic-typography',
  'diagram-animation',
  'svg-animation',
];

const DIVERSITY_MOTION: Record<string, string[]> = {
  'diagram-animation': ['object path wipe', 'stations light in turn', 'cards stamp stack'],
  'kinetic-typography': ['word slam overshoot', 'line stagger rise', 'mask reveal type'],
  'chart-animation': ['bar grow count-up', 'ticker climb', 'gauge needle settle'],
  'whiteboard-animation': ['stroke draw-on', 'ink path grow', 'chalk underline'],
  'animated-infographic': ['icon grid cascade', 'callout pop chain', 'layered plate peel'],
  'logo-animation': ['geo assemble overshoot', 'clipPath wipe settle', 'mark scale spring'],
  'svg-animation': ['pathLength draw-on', 'clipPath wipe', 'stroke dash grow'],
};

function diversifyMotion(skill: SkillName, index: number): string {
  const opts = DIVERSITY_MOTION[skill] || ['object then action'];
  return opts[index % opts.length];
}

/** 主技是否按海报/开场锁定轮转池 */
export function isPosterPrimary(primary?: string): boolean {
  return primary === 'logo-animation' || primary === 'launch-video';
}

/** brief 是否几何海报 / 开场 reel（辅助锁定） */
export function isPosterShowreelBrief(text: string): boolean {
  return /几何海报|粗野主义|包豪斯|动态图形开场|海报构图|showreel|tech summit|峰会揭晓|wordmark|标志揭示/i.test(
    text || '',
  );
}

/**
 * 硬轮换技能：禁止连续两镜同一 skill；任一 skill 占比 >35% 打散。
 * （旁白驱动后必须再跑一次，否则导演工具箱会把邻镜压回 mainTechnique。）
 * opts.primary：logo/launch 时用海报友好池，禁止无点名 SCENE 技。
 */
export function diversifyBeatSkills<T extends TechniqueBeat>(
  beats: T[],
  opts?: { primary?: SkillName | string },
): T[] {
  if (beats.length < 2) return beats;
  const anyCap = Math.max(2, Math.ceil(beats.length * 0.35));
  const counts = new Map<string, number>();
  const out: T[] = [];
  const posterLock = isPosterPrimary(opts?.primary);
  /** isometric 也进轮转池，避免整片 isometric 糊成一张皮；海报片除外 */
  const pool: SkillName[] = posterLock
    ? [...POSTER_DIVERSITY_POOL]
    : [...DIVERSITY_POOL, 'isometric-animation'];
  const fallback: SkillName = posterLock
    ? (isSkillName(opts?.primary) ? (opts!.primary as SkillName) : 'logo-animation')
    : 'kinetic-typography';

  for (let i = 0; i < beats.length; i++) {
    const raw = beats[i];
    const cue = beatCueText(raw);
    let skill: SkillName = isSkillName(raw.skill) ? (raw.skill as SkillName) : fallback;
    // 海报主技：未正向点名的 SCENE 技先压回 primary
    if (
      posterLock
      && sceneSkillNeedsCue(skill)
      && skill !== opts?.primary
      && !techniqueWasAsked(skill, cue)
    ) {
      skill = fallback;
    }
    // 不用 craftMust 里的 isometric 指纹反推整片挂技（那是 attachCraftMust 副作用）
    const inferred = inferTechnique(`${raw.visualIntent || ''} ${raw.headline || ''} ${raw.vo || ''}`);
    if (inferred && techniqueWasAsked(inferred, cue) && inferred !== skill) {
      // 仅当原文意图点名时升级；不覆盖已轮转技
      if (!out.length || inferred !== out[i - 1]?.skill) skill = inferred;
    }

    const prev = out[i - 1] ? String(out[i - 1].skill) : '';
    const prev2 = out[i - 2] ? String(out[i - 2].skill) : '';
    const heavy = (counts.get(skill) || 0) >= anyCap;
    const sameAsPrev = skill === prev;
    if (sameAsPrev || heavy) {
      const avoid = new Set<string>([prev, prev2, ...(heavy ? [skill] : [])].filter(Boolean));
      let next: SkillName | null = null;
      if (
        inferred
        && !avoid.has(inferred)
        && (!sceneSkillNeedsCue(inferred) || techniqueWasAsked(inferred, `${raw.visualIntent || ''} ${raw.vo || ''}`))
      ) {
        next = inferred;
      }
      if (!next) {
        const ranked = pool
          .filter((s) => !avoid.has(s))
          .sort((a, b2) => (counts.get(a) || 0) - (counts.get(b2) || 0));
        next = ranked[0] || fallback;
      }
      skill = next;
    }

    const prevMotion = out[i - 1]?.keyMotion || '';
    const motion = !raw.keyMotion || raw.keyMotion === prevMotion
      ? diversifyMotion(skill, i)
      : raw.keyMotion;
    counts.set(skill, (counts.get(skill) || 0) + 1);
    out.push({ ...raw, skill, keyMotion: motion });
  }
  return out;
}

/** 硬门禁可承受的技法。标志片门禁要整段描边，只留在这一镜的 craftMust 上。 */
const MERGEABLE: Set<SkillName> = new Set([
  'map-animation',
  'isometric-animation',
  'whiteboard-animation',
  'text-message-animation',
  'product-demo-video',
  'countdown-video',
  'chart-animation',
  'kinetic-typography',
  'diagram-animation',
  'wrapped-video',
  'animated-infographic',
  'caption-animation',
  'promo-video',
]);

export function numberedShotCount(text: string): number {
  const nums = new Set<number>();
  for (const m of text.matchAll(/第\s*(\d+)\s*镜/g)) nums.add(Number(m[1]));
  return nums.size;
}

export function montageBeatCap(text: string): number {
  const n = numberedShotCount(text);
  if (n >= 4) return Math.min(16, Math.max(n, 4));
  return 10;
}

/** 去掉否定修饰的命中，避免「不要做写实地图」触发 map-animation */
const NEGATION_PREFIX =
  /(?:不要|别|勿|禁止|并非|切勿|避免|avoid|don'?t|do\s+not|no\s+realistic|never)\s*/gi;

/** 将否定短语内的关键词抹掉，供推断/点名检测使用 */
export function stripNegatedTechniqueCues(text: string): string {
  let t = text || '';
  // 「不要做写实地图」「don't make a realistic map」整段抹掉关键词附近
  t = t.replace(
    /(?:不要|别|勿|禁止|并非|切勿|避免|avoid|don'?t|do\s+not|never)\s*[^。！？\n.!?]{0,24}?(?:写实)?(?:地图|航线|海岸|路线图|等距|白板|聊天|气泡|倒计时|粒子|划掉|标志|\bmap\b|\broute\b|marker|isometric|whiteboard|countdown|logo|particle)/gi,
    ' ',
  );
  t = t.replace(NEGATION_PREFIX, ' ');
  return t;
}

export function inferTechnique(text: string): SkillName | null {
  const t = stripNegatedTechniqueCues(text || '');
  for (const rule of RULES) {
    if (rule.re.test(t)) return rule.skill;
  }
  return null;
}

/** 这些技法的门禁词不会在普通讲解片里自然出现。没被画面点名就不要挂上，否则整片出不了。 */
const SCENE_SKILL_NEEDS_CUE: Set<SkillName> = new Set([
  'isometric-animation',
  'map-animation',
  'text-message-animation',
  'product-demo-video',
  'countdown-video',
  'particle-system',
  'wrapped-video',
  'logo-animation',
]);

export function sceneSkillNeedsCue(skill: string): boolean {
  return SCENE_SKILL_NEEDS_CUE.has(skill as SkillName);
}

export function techniqueWasAsked(skill: string, text: string): boolean {
  if (!sceneSkillNeedsCue(skill)) return true;
  const rule = RULES.find((r) => r.skill === skill);
  if (!rule) return false;
  const cleaned = stripNegatedTechniqueCues(text || '');
  return rule.re.test(cleaned);
}

export function beatCueText(b: {
  visualIntent?: string;
  headline?: string;
  keyMotion?: string;
  vo?: string;
  job?: string;
}): string {
  return `${b.visualIntent || ''} ${b.headline || ''} ${b.keyMotion || ''} ${b.vo || ''} ${b.job || ''}`;
}

export function stripDocChrome(text: string): string {
  return (text || '')
    .replace(/【[^】\n]{1,80}】/g, '')
    .replace(/[A-Za-z0-9_\-.]{1,40}\.(txt|md|pdf|docx)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isWeakVisual(intent: string, vo: string): boolean {
  const v = (intent || '').trim();
  if (v.length < 8) return true;
  if (/^illustrate\s*:/i.test(v)) return true;
  if (/只有字|节点和连线占下面/.test(v)) return true;
  const norm = (s: string) => s.replace(/\s+/g, '');
  const a = norm(v.replace(/^illustrate\s*:/i, ''));
  const b = norm(vo);
  if (b.length >= 12 && a.slice(0, 24) === b.slice(0, 24)) return true;
  return false;
}

/** 屏幕上的短标题。已经写好的短句保留；从整句旁白截下来的，改成一句短语。 */
export function shortHeadline(vo: string, existing?: string): string {
  const line = stripDocChrome(vo);
  const given = stripDocChrome(existing || '');
  if (given.length >= 2 && given.length <= 12 && given.length <= Math.max(0, line.length - 4)) return given;
  const clause = (line.split(/[，。！？!?；;]/)[0] || line).trim();
  if (clause.length >= 2 && clause.length <= 12) return clause;
  return (clause || line).slice(0, 8).replace(/[\s，、]$/u, '');
}

/** 弱画面：从这句旁白里取一个物体，不套「只有字 / 通用节点」。 */
export function objectVisual(vo: string, title: string): { skill: SkillName; keyMotion: string; visualIntent: string } {
  const gist = stripDocChrome(vo).slice(0, 48);
  const inferred = inferTechnique(`${gist} ${title}`);
  const asked = inferred && techniqueWasAsked(inferred, `${gist} ${title}`);
  return {
    skill: asked && inferred ? inferred : 'diagram-animation',
    keyMotion: 'object then action',
    visualIntent: `画面主体是这句里的一个物体及其动作：「${gist}」。短标题「${title}」放在物体外面，两者不重叠。不要整句旁白铺满，不要只剩大字，也不要套一套与这句无关的节点。`,
  };
}

export function rotateVisual(index: number, title: string, skill?: SkillName | null) {
  const label = (title || '这一镜').slice(0, 16);
  if (skill === 'map-animation') {
    return { skill, keyMotion: 'route draw', visualIntent: `标题「${label}」放在上方一条。地图占满下面的主画面，路线一笔连起来，标题不压在地图上` };
  }
  if (skill === 'isometric-animation') {
    return { skill, keyMotion: 'iso stagger drop', visualIntent: `标题「${label}」放在上方一条。等距场景占满下面的主画面，物件错峰落位，标题不压在场景上` };
  }
  if (skill === 'text-message-animation') {
    return { skill, keyMotion: 'typing then send', visualIntent: `标题「${label}」放在上方一条。聊天气泡占满下面的主画面，先输入再发出，标题不压在气泡上` };
  }
  if (skill === 'product-demo-video') {
    return { skill, keyMotion: 'cursor on device', visualIntent: `界面本身占满画面，光标点开「${label}」。界面里的字写在控件上，不要再叠一条大标题盖住界面` };
  }
  if (skill === 'chart-animation') {
    return { skill, keyMotion: 'bar grow count-up', visualIntent: `标题「${label}」放在上方一条。大柱或大数字从 0 长在下面的主画面里，数字跟着柱顶走，标题不压在柱上` };
  }
  if (skill === 'whiteboard-animation') {
    return { skill, keyMotion: 'stroke draw-on', visualIntent: `标题「${label}」放在上方一条。墨线在下面的主画面里沿路径长出来，标题不压在线上` };
  }
  const row = ROTATION.find((r) => r.skill === skill)
    || ROTATION[((index % ROTATION.length) + ROTATION.length) % ROTATION.length];
  return {
    skill: skill && isSkillName(skill) ? skill : row.skill,
    keyMotion: row.keyMotion,
    visualIntent: row.intent(label),
  };
}

/**
 * 只卸掉画面没点名的等距 / 地图 / 聊天等。
 * keep：回落目标（logo/launch 回 primary；讲解默认 diagram）。
 */
export function dropUnaskedSceneSkills<T extends TechniqueBeat>(
  beats: T[],
  opts?: { keep?: SkillName },
): T[] {
  const fallback: SkillName = opts?.keep && isSkillName(opts.keep)
    ? opts.keep
    : 'diagram-animation';
  return beats.map((b) => {
    if (!sceneSkillNeedsCue(String(b.skill)) || b.skill === opts?.keep) return b;
    if (techniqueWasAsked(String(b.skill), beatCueText(b))) return b;
    return { ...b, skill: fallback };
  });
}

/**
 * 按这一镜的画面要求改技能。
 * 画面点了别的技法就改过去。
 * 等距 / 地图 / 聊天这类技能，画面没点名就改回 keep（或 diagram）。
 * keep：整片主技能是 logo/launch/等距片时，没写关键词的镜仍留在主技能上。
 */
export function lockTechniquesFromIntent<T extends TechniqueBeat>(
  beats: T[],
  opts?: { keep?: SkillName },
): T[] {
  const upgraded = beats.map((b) => {
    const inferred = inferTechnique(beatCueText(b));
    // 仅正向点名才升格；否定句已在 inferTechnique 内抹掉
    if (inferred && inferred !== b.skill && techniqueWasAsked(inferred, beatCueText(b))) {
      return { ...b, skill: inferred };
    }
    return b;
  });
  return dropUnaskedSceneSkills(upgraded, opts);
}

export function concreteScriptBeat<T extends TechniqueBeat & { vo: string; headline?: string; visualIntent?: string; keyMotion?: string; skill?: SkillName }>(
  beat: T,
  index: number,
): T {
  const vo = stripDocChrome(beat.vo) || beat.vo.trim();
  const headline = shortHeadline(vo, beat.headline);
  const weak = isWeakVisual(beat.visualIntent || '', vo);
  const genericMotion = !beat.keyMotion || /^spring reveal$/i.test(beat.keyMotion);
  if (!weak) {
    return {
      ...beat,
      vo,
      headline,
      skill: (beat.skill && isSkillName(beat.skill) ? beat.skill : 'diagram-animation') as T['skill'],
      keyMotion: genericMotion ? 'object then action' : beat.keyMotion,
      visualIntent: beat.visualIntent,
    };
  }
  const picture = objectVisual(vo, headline);
  const spun = picture.skill === 'diagram-animation'
    ? picture
    : rotateVisual(index, headline, picture.skill);
  return {
    ...beat,
    vo,
    headline,
    skill: spun.skill as T['skill'],
    keyMotion: spun.keyMotion,
    visualIntent: spun.visualIntent,
  };
}

export function mergeBeatSkills<T extends {
  primary: SkillName;
  support: SkillName[];
  skills: SkillName[];
  beats: TechniqueBeat[];
}>(plan: T, opts?: { allowStickman?: boolean }): T {
  // 先按画面 diversify，再从结果镜收集 support（否则仍是 promo 挂技，iso/map 进不了抽屉）
  let diversified = diversifyBeatSkills(plan.beats, { primary: plan.primary });
  if (isPosterPrimary(plan.primary)) {
    diversified = lockTechniquesFromIntent(diversified, { keep: plan.primary });
  }

  const support = plan.support.filter((id) => {
    if (!sceneSkillNeedsCue(id)) return true;
    if (id === plan.primary) return true;
    return diversified.some((b) => b.skill === id && techniqueWasAsked(id, beatCueText(b)));
  });
  const extra: SkillName[] = [];
  for (const b of diversified) {
    const id = b.skill as SkillName;
    if (!isSkillName(id) || !MERGEABLE.has(id)) continue;
    if (id === plan.primary) continue;
    if (id === 'stickman-animation' && !opts?.allowStickman) continue;
    if (sceneSkillNeedsCue(id) && !techniqueWasAsked(id, beatCueText(b))) continue;
    if (!extra.includes(id)) extra.push(id);
  }
  for (const id of extra) {
    // 与 formMode LEAF_CAP 对齐：合并后 support 仍 ≤3 leaf
    if (!support.includes(id) && support.length < 3) support.push(id);
  }
  const skills = plan.skills.filter((id) => {
    if (!sceneSkillNeedsCue(id)) return true;
    if (id === plan.primary) return true;
    return support.includes(id);
  });
  for (const id of support) {
    if (!skills.includes(id)) skills.push(id);
  }
  const crafted = attachCraftMust(diversified);
  return {
    ...plan,
    support,
    skills,
    beats: crafted as T['beats'],
  };
}
