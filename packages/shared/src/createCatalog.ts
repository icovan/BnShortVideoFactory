/**
 * 创作目录：类型 → 案例 → 提示词（不含自由 prompt / 混剪 remix）
 * 供管理后台 CRUD + APP/Web 拉取快填
 */

export const MANAGED_FORM_TYPE_IDS = [
  'narrate',
  'tutorial',
  'story',
  'launch',
  'logo',
  'showreel',
] as const;

export type ManagedFormTypeId = (typeof MANAGED_FORM_TYPE_IDS)[number];

export function isManagedFormTypeId(id: string): id is ManagedFormTypeId {
  return (MANAGED_FORM_TYPE_IDS as readonly string[]).includes(id);
}

export type CreatePrompt = {
  id: string;
  lang: 'zh' | 'en';
  body: string;
  sort: number;
  enabled: boolean;
};

export type CreateCase = {
  id: string;
  titleZh: string;
  titleEn: string;
  sort: number;
  enabled: boolean;
  prompts: CreatePrompt[];
};

/** 后台不管理：自由 prompt / 混剪 remix（及同义 id） */
export const UNMANAGED_FORM_TYPE_IDS = ['prompt', 'free', 'remix', 'short'] as const;

export function isUnmanagedFormTypeId(id: string): boolean {
  return (UNMANAGED_FORM_TYPE_IDS as readonly string[]).includes(id);
}

export type CreateFormType = {
  /** formMode id；禁止 prompt / remix 等自由与混剪 */
  id: string;
  labelZh: string;
  labelEn: string;
  tipZh: string;
  tipEn: string;
  sort: number;
  enabled: boolean;
  cases: CreateCase[];
  updatedAt: string;
};

export type CreateCatalog = {
  types: CreateFormType[];
  updatedAt: string;
};

function p(id: string, lang: 'zh' | 'en', body: string, sort = 0): CreatePrompt {
  return { id, lang, body, sort, enabled: true };
}

function c(
  id: string,
  titleZh: string,
  titleEn: string,
  sort: number,
  prompts: CreatePrompt[],
): CreateCase {
  return { id, titleZh, titleEn, sort, enabled: true, prompts };
}

/** 官方种子（与 PC 面板 quickbook 对齐，排除自由/混剪） */
export function defaultCreateCatalog(): CreateCatalog {
  const now = new Date().toISOString();
  const types: CreateFormType[] = [
    {
      id: 'narrate',
      labelZh: '解说',
      labelEn: 'Explainer',
      tipZh: '解说案例 · 技法自由匹配 · 配置栏可改',
      tipEn: 'Explainer cases · free skill match · ops stay flexible',
      sort: 0,
      enabled: true,
      updatedAt: now,
      cases: [
        c('ramen', '美食故事', 'Food story', 0, [
          p('ramen-zh', 'zh', '讲清拉面如何从廉价深夜小吃变成全球狂热。约 45–60 秒 16:9 解说：开场钩子 → 2–3 个历史/工艺比喻镜（可硬切换场景）→ 热气腾腾的碗面收束。旁白一句一意，每镜一个具体物体。落点：一碗安慰，全世界都上头。'),
          p('ramen-en', 'en', 'Explain how ramen went from cheap late-night food to a global obsession. ~45–60s 16:9 explainer: hook → 2–3 history/craft metaphor beats (hard cuts OK) → steaming bowl payoff. One concrete object per beat. Land it: comfort in a bowl, the world is hooked.'),
        ]),
        c('honey', '你知道吗', 'Did you know', 1, [
          p('honey-zh', 'zh', '蜂蜜怎么来的？约 40 秒解说：花 → 蜂巢 → 滴落到罐，每段换一个清晰比喻画面（允许剪辑切换），旁白短句。落点：一勺蜂蜜，需要整巢蜜蜂。'),
          p('honey-en', 'en', 'How is honey made? ~40s explainer: flower → hive → jar drip. Hard cut between metaphors; short VO lines. Land it: one spoonful takes a whole hive.'),
        ]),
        c('cats', '动物知识', 'Animal facts', 2, [
          p('cats-zh', 'zh', '猫为什么呼噜？约 40 秒有趣解说：误解揭穿 → 机制示意 → 自愈彩蛋。分镜可硬切，别做成同屏 UI 形变。落点：你家猫是台小小自愈机器。'),
          p('cats-en', 'en', 'Why do cats purr? ~40s fun explainer: myth-bust → mechanism → healing Easter egg. Hard cuts OK — not a same-screen UI morph. Land it: your cat is a tiny self-repair machine.'),
        ]),
        c('beijing', '旅游指南', 'Travel guide', 3, [
          p('beijing-zh', 'zh', '北京 5 件游客常错过的体验。约 45 秒清单解说：每点一镜（观景点/小馆/电车等），镜间硬切，节奏明快。落点：存下来，下次旅行用。'),
          p('beijing-en', 'en', '5 underrated Beijing experiences. ~45s list explainer: one beat per tip with hard cuts. Land it: save this for your trip.'),
        ]),
      ],
    },
    {
      id: 'tutorial',
      labelZh: '教程',
      labelEn: 'Tutorial',
      tipZh: '教程案例 · 技法自由匹配 · 配置栏可改',
      tipEn: 'Tutorial cases · free skill match · ops stay flexible',
      sort: 1,
      enabled: true,
      updatedAt: now,
      cases: [
        c('steps', '三步上手', '3-step how-to', 0, [
          p('steps-zh', 'zh', '约 50 秒教程：目标一镜 → 三步操作（每步可硬切换场景）→ 检查清单收束。旁白一句一意，界面/物体要具体。'),
          p('steps-en', 'en', '~50s tutorial: goal beat → three concrete steps (hard cuts between steps OK) → checklist close. One idea per VO line.'),
        ]),
        c('demo', '界面状态机演示', 'UI state-machine demo', 1, [
          p('demo-zh', 'zh', '约 45 秒产品教程：同一个面板形状在同屏内改尺寸与内容（步骤 1→2→3），绝不硬切换场景；一只光标完成点击与一次拖拽。真实 UI 文案，旁白口语可选。'),
          p('demo-en', 'en', '~45s product tutorial: one panel morphs size/content through steps 1→2→3 on the same screen — never hard-cut scenes. One cursor does clicks and one drag. Real UI copy; VO optional.'),
        ]),
        c('math', '公式推导', 'Formula walk', 2, [
          p('math-zh', 'zh', '约 45 秒公式讲解：前提 → 推导 → 结论，可用白板/几何感；段与段可硬切，别做成产品 UI 形变。'),
          p('math-en', 'en', '~45s formula explain: setup → derivation → takeaway. Whiteboard/geometry OK; hard cuts between sections — not a product UI morph.'),
        ]),
      ],
    },
    {
      id: 'story',
      labelZh: '故事',
      labelEn: 'Story',
      tipZh: '故事案例 · 技法自由匹配 · 配置栏可改',
      tipEn: 'Story cases · free skill match · ops stay flexible',
      sort: 2,
      enabled: true,
      updatedAt: now,
      cases: [
        c('chat', '聊天串戏', 'Chat story', 0, [
          p('chat-zh', 'zh', '约 40 秒聊天故事：误会 → 反转 → 和解。气泡逐条弹出，场景可硬切换背景，节奏跟对话走。'),
          p('chat-en', 'en', '~40s chat story: misunderstanding → twist → resolve. Bubbles pop in sequence; hard-cut backgrounds OK.'),
        ]),
        c('map', '地图旅程', 'Map journey', 1, [
          p('map-zh', 'zh', '约 45 秒旅程故事：起点 → 途经 → 终点收获。路线推进清晰，地点切换允许硬切。'),
          p('map-en', 'en', '~45s journey: start → stops → payoff. Clear route; hard cuts between places OK.'),
        ]),
        c('photos', '照片流故事', 'Photo story', 2, [
          p('photos-zh', 'zh', '约 40 秒照片故事：钩子 → 三张关键静帧推进 → 收束。张与张之间硬切或轻转场，不要同屏 UI 形变。'),
          p('photos-en', 'en', '~40s photo story: hook → three key stills → close. Hard cuts or light transitions between frames — not a same-screen UI morph.'),
        ]),
      ],
    },
    {
      id: 'launch',
      labelZh: '宣发',
      labelEn: 'Launch',
      tipZh: '宣发案例 · 技法自由匹配 · 配置栏可改',
      tipEn: 'Launch cases · free skill match · ops stay flexible',
      sort: 3,
      enabled: true,
      updatedAt: now,
      cases: [
        c('three', '产品 UI 一镜形变', 'Product UI morph loop', 0, [
          p('three-zh', 'zh', '为虚构 App「Flow」做约 18 秒 16:9 产品宣发：一个圆角卡片形状贯穿全片，绝不剪辑切换；光标点击/输入驱动状态机（余额→转账→成功）；末帧接回首帧可循环。品牌绿强调色，真实 UI 感数字，无旁白。'),
          p('three-en', 'en', 'Make an ~18s 16:9 product launch for a fictional app “Flow”: one rounded card owns the whole film — never hard-cut. A cursor drives a state machine (balance → transfer → success). End frame matches start for a loop. Brand-green accents, real-looking UI numbers, no VO.'),
        ]),
        c('chapters', '动能发布秀', 'Kinetic launch hype', 1, [
          p('chapters-zh', 'zh', '约 20 秒产品发布宣发：钩子大字硬切 → 卖点三连（每点一镜可硬切）→ Logo 定版 CTA。节奏紧、高对比，允许剪辑切换，不要做成同屏 UI 形变。无旁白或短 SFX。'),
          p('chapters-en', 'en', '~20s product launch: kinetic hook hard-cut → three selling-point beats (hard cuts OK) → logo lockup CTA. Fast, high-contrast — not a same-screen UI morph. No VO or light SFX only.'),
        ]),
        c('sale', '促销倒计时', 'Sale countdown', 2, [
          p('sale-zh', 'zh', '约 28 秒促销宣发：痛点钩子硬切 → 卖点三连 → 倒计时 CTA。节奏紧，可配一句评价金句；镜间允许硬切。'),
          p('sale-en', 'en', '~28s promo: pain hook hard-cut → three offers → countdown CTA. Hard cuts OK; optional one testimonial line.'),
        ]),
      ],
    },
    {
      id: 'logo',
      labelZh: '标志',
      labelEn: 'Logo',
      tipZh: '标志案例 · 一标形变等约束写在案例内',
      tipEn: 'Logo cases · one-mark morph lives in the case text',
      sort: 4,
      enabled: true,
      updatedAt: now,
      cases: [
        c('draw', '描线揭示我的标志', 'Stroke-draw my mark', 0, [
          p('draw-zh', 'zh', '我有线条/单线 SVG Logo。约 6–8 秒标志片：一个形状贯穿全片，绝不硬切换场景——几何起势 → 强调色点带路径 → 描笔过冲定版。标志是唯一主角，不要讲解字幕。深灰颗粒底。'),
          p('draw-en', 'en', 'I have a line-art SVG logo. ~6–8s logo film: one shape owns the whole film — never hard-cut scenes. Geo tease → accent path → stroke-draw with overshoot settle. Mark is the only hero; no explainer captions. Dark grain.'),
        ]),
        c('icon', '图标弹入定版', 'Bounce in my icon', 1, [
          p('icon-zh', 'zh', '我有紧凑图标/徽章 SVG。约 5–7 秒：同一标志在同屏内缩放/过冲/落地，零剪辑切换，可微热点辉光。只要标志，不要文案条。'),
          p('icon-en', 'en', 'I have a compact icon/badge SVG. ~5–7s: the same mark scales/overshoots/settles on one continuous screen — zero hard cuts. Mark only, no copy bars.'),
        ]),
        c('build', '逐件组装字标', 'Assemble my wordmark', 2, [
          p('build-zh', 'zh', '我有多部件字标 SVG。约 6–8 秒：同一 lockup 在同屏内按件组装并过冲扣死，绝不切到别的场景；可选一行小 URL。无讲解字幕。'),
          p('build-en', 'en', 'I have a multi-part wordmark SVG. ~6–8s: assemble parts into one lockup on the same screen — never cut away; optional one-line URL. No explainer captions.'),
        ]),
      ],
    },
    {
      id: 'showreel',
      labelZh: '类型',
      labelEn: 'Types / Showreel',
      tipZh: '类型展片案例 · 章节切镜等约束写在案例内',
      tipEn: 'Types cases · chapter hard-cuts live in the case text',
      sort: 5,
      enabled: true,
      updatedAt: now,
      cases: [
        c('principles', '动画法则展片', 'Principles reel', 0, [
          p('principles-zh', 'zh', '约 14 秒 16:9 类型展片，品牌名「Studio」。六章技法各一镜：弹压、动能字、错峰、径向、碎裂、定版——章与章之间硬切换画面，高对比红白黑，无旁白，可有小角标。'),
          p('principles-en', 'en', '~14s 16:9 types reel branded “Studio”. Six chapters: squash, kinetic type, stagger, radial, shatter, lockup — hard cut between chapters. High-contrast red/white/black, no VO, tiny HUD ok.'),
        ]),
        c('brand', '品牌色 MG 展片', 'Brand-color MG reel', 1, [
          p('brand-zh', 'zh', '约 14 秒品牌色 showreel：六章（弹压/动能字/网格错峰/径向/碎裂/定版），每章换构图可硬切，终章落品牌名。无旁白，满幅几何。'),
          p('brand-en', 'en', '~14s brand-color showreel: six chapters (squash/kinetic/stagger/radial/shatter/lockup), hard cuts between chapters, end on brand name. No VO, full-bleed vector.'),
        ]),
        c('dark', '暗场技术秀', 'Dark tech reel', 2, [
          p('dark-zh', 'zh', '深黑底、橙红强调。约 15 秒作品集开场：弹压→动能大字→错峰→径向→碎裂→lockup，章间硬切，无旁白。'),
          p('dark-en', 'en', 'Deep black, orange-red accents. ~15s portfolio opener: squash→kinetic→stagger→radial→shatter→lockup with hard cuts. No VO.'),
        ]),
      ],
    },
  ];
  return { types, updatedAt: now };
}
