/**
 * a2e `narration-storyboard.md` §4 镜头设计模式（原文照搬，不自创）。
 * 坐标按 a2e 1280×720 → 本厂 16:9 1920×1080 统一 ×1.5。
 */
export type A2eModeId =
  | 'subject-parts'
  | 'metaphor-object'
  | 'setpiece-entrance'
  | 'source-year'
  | 'process-rail'
  | 'three-column'
  | 'point-cloud'
  | 'tilt-depth'
  | 'container'
  | 'two-merge'
  | 'funnel'
  | 'chart-curve'
  | 'req-resp'
  | 'parallel-lists'
  | 'balance'
  | 'network'
  | 'feedback-loop'
  | 'bignum-setpiece'
  | 'symbol-payoff'
  | 'timeline-hero'
  | 'formula'
  | 'table-board'
  | 'parallax-wall'
  | 'dual-mechanism';

/** ×1.5 from a2e 1280 */
const S = 1.5;
const px = (n: number) => Math.round(n * S);

export type A2eMode = {
  id: A2eModeId;
  /** a2e 画面关系（左列原文） */
  relation: string;
  /** a2e 画法（中列原文，坐标已 ×1.5） */
  recipe: string;
  /** a2e 主角·尺寸·光（右列，尺寸 ×1.5） */
  hero: string;
};

/** 全表 — 与 a2e §4 一一对应 */
export const A2E_MODES: A2eMode[] = [
  {
    id: 'subject-parts',
    relation: '一个主体 + 若干特性 / 短板 / 组成部分',
    recipe: `左主体图标 + 右侧编号虚线框逐个填充（左主体约 x${px(200)}–${px(400)}，右列虚线框）`,
    hero: `主体图标 ${px(110)} + 双层紫光呼吸；虚线框是配角`,
  },
  {
    id: 'metaphor-object',
    relation: '类比 / 比喻的具象物',
    recipe: '具象物（考卷 / 书 / 任何日常物件）+ 大字标签',
    hero: `具象物 ≥${px(260)} 宽；标签 Pill 紫是唯一重点光`,
  },
  {
    id: 'setpiece-entrance',
    relation: '主角登场（高光时刻·登场型）',
    recipe:
      '清场 → 三轮 LightSweep → StageLine → GhostText 预示 → 白闪 + 宽体大字 GlitchIn → 脉冲 → 副标 slideUp → 拆词 Pill SoftIn；全流程 ≥90 帧；全片 ≤2 处扫光白名单',
    hero: `宽体大字 ~${px(150)} + 紫硬投影`,
  },
  {
    id: 'source-year',
    relation: '出处 / 历史节点（论文、人物、事件、年份）',
    recipe: '来源卡（标题 + 作者 / 机构 / 事件说明）+ 大年份计数',
    hero: `来源卡 ≥${px(240)} 宽是主角；年份 BigNumber ${px(96)} 不单独站空屏`,
  },
  {
    id: 'process-rail',
    relation: '有序过程（步骤、阶段、生命周期）',
    recipe: `顶部流程轨当前步紫 + 主区「输入 → 处理器盒 → 输出」三段 + 箭头 draw-on`,
    hero: `处理器盒 ≥${px(200)}×${px(110)} 紫填充白边（主角）；输入输出 ${px(60)}–${px(110)}`,
  },
  {
    id: 'three-column',
    relation: '三档取舍（太多 / 合适 / 太少）',
    recipe: '三栏对比，红叉绿勾',
    hero: '中栏标准卡 active 紫光是主角',
  },
  {
    id: 'point-cloud',
    relation: '点集与邻近（相似、聚类、位置关系）',
    recipe: `网格平面 + 灰点云 + 紫点邻居圈 + 橙目标点；平面 ~${px(800)}×${px(410)}`,
    hero: '目标点橙光；可配一次推近',
  },
  {
    id: 'tilt-depth',
    relation: '层级 / 多层结构（纵深）',
    recipe: `分层倾斜平面（skewX(-20deg) scaleY(.5)）×3 层距 ${px(90)} + 路径跳转 draw-on + 计数；最上层白、下层 α .6`,
    hero: '最上层路径/节点是主角',
  },
  {
    id: 'container',
    relation: '容器与准入（存储、权限、进出）',
    recipe: '圆柱 / 容器 + 卡片飞入 + 标签 + 角色图标勾叉',
    hero: `容器 ≥${px(160)} 高 + 顶面紫 accent`,
  },
  {
    id: 'two-merge',
    relation: '两路汇合 / 合成',
    recipe: `左右两列 + 中央公式或汇合点 + 弧线汇入（左约 x${px(300)}–${px(380)} / 右约 x${px(900)}–${px(1000)}）`,
    hero: `结果项 ≥${px(72)} 白光是主角`,
  },
  {
    id: 'funnel',
    relation: '漏斗筛选 / 排序',
    recipe: `Trap 漏斗层 + 卡片穿过变灰落下，留下的变紫；Trap 顶宽 ≥${px(600)}、当前层紫`,
    hero: '当前漏斗层紫光是主角',
  },
  {
    id: 'chart-curve',
    relation: '一条曲线的发现（趋势、拐点、U 形）',
    recipe: `曲线图卡 + 出处灰小字（≥2.5 s 停留）；图表卡 ~${px(440)}×${px(300)}`,
    hero: '重点红点带光；讲到重点时推近 1.2',
  },
  {
    id: 'req-resp',
    relation: '请求 → 处理 → 带依据的回应',
    recipe: '请求卡逐条打字机 + 中央处理者 + 回应卡带引用角标 → 引线到来源卡',
    hero: `处理者图标 ${px(110)} 带光是主角`,
  },
  {
    id: 'parallel-lists',
    relation: '两组并列清单（指标、优缺点、正反方）',
    recipe: '左右虚线框各一列 Pill + 框架名 Pill',
    hero: '框架名 Pill 紫 + 小柔光是唯一光',
  },
  {
    id: 'balance',
    relation: '取舍 / 权衡',
    recipe: '天平（梁倾斜 easeOut）或 ≈ 号对照',
    hero: `天平 ≥${px(400)} 宽`,
  },
  {
    id: 'network',
    relation: '网络 / 关系图',
    recipe: '节点逐个亮起 + 边 draw-on + 社区圆 + 摘要卡',
    hero: '社区圆 / 焦点节点紫光',
  },
  {
    id: 'feedback-loop',
    relation: '循环 / 反馈环',
    recipe: `环形节点 + 小球跑圈 + 轮次计数 + 出口分支；环 ≥${px(300)} 直径`,
    hero: '环上当前节点带光',
  },
  {
    id: 'bignum-setpiece',
    relation: '量级 / 频数（高光时刻·大数字型）',
    recipe: 'BigNumber 20 帧计数 + 单位 + 对照物 + 橙色问号 / 结论 GlitchIn',
    hero: `大数字 ~${px(110)} + 紫硬投影`,
  },
  {
    id: 'symbol-payoff',
    relation: '收尾回扣（高光时刻·象征物型）',
    recipe: `回到开场的处境或比喻 + 象征物 slideUp Δ≤${px(170)} + HaloRing draw-on + 结论大字紫描边 GlitchIn`,
    hero: `象征物 ≥${px(260)} 高`,
  },
  {
    id: 'timeline-hero',
    relation: '时间轴 / 放慢',
    recipe: `轴 + 游标，必须配主角：大数字（BigNumber ${px(96)}）或放大的当前刻度；放慢用一次推近`,
    hero: `大数字 ${px(96)} 是主角`,
  },
  {
    id: 'formula',
    relation: '公式',
    recipe: '逐 token 出现（每 3 帧）；变量用小胶囊',
    hero: `结果项 ≥${px(72)} 橙/白光`,
  },
  {
    id: 'table-board',
    relation: '表格 / 榜单',
    recipe: `当前行放大 1.15 + 紫光，其余灰；行高 ≥${px(54)}；表外配一个大数字或图标主角；行数 >6 用整页滚动`,
    hero: '当前行是主角',
  },
  {
    id: 'parallax-wall',
    relation: '很多 / 世界很大',
    recipe: '2–3 层视差墙（截图墙 / 文档墙 / 日志流），背景层压暗 ×0.43，前景层按 a2e 视差速度',
    hero: '前景层主卡是主角；视差是运镜不是碎屑',
  },
  {
    id: 'dual-mechanism',
    relation: '两种做法看起来像、其实不同',
    recipe: '让底层机制真的不同（真投影 / 真几何），并列两框逐像素可比',
    hero: `两框各一主体 ≥${px(150)}；差别处橙光`,
  },
];

const BY_ID = Object.fromEntries(A2E_MODES.map((m) => [m.id, m])) as Record<A2eModeId, A2eMode>;

export function a2eModeById(id: A2eModeId): A2eMode {
  return BY_ID[id];
}

/** 从旁白/画面意图推断 a2e 画面关系（关键词对齐 §4 左列，不另造类别） */
export function inferA2eMode(text: string): A2eModeId {
  const t = text || '';
  if (/登场|清场|扫光|LightSweep|GlitchIn|片名砸入/.test(t)) return 'setpiece-entrance';
  if (/收尾|回扣|护城河|象征|落版|下期见|署名/.test(t)) return 'symbol-payoff';
  if (/漏斗|筛选|排序|Trap|过滤/.test(t)) return 'funnel';
  if (/天平|权衡|取舍|≈|vs\b|对比左右|两难/.test(t)) return 'balance';
  if (/太多|太少|合适|三档|三栏/.test(t)) return 'three-column';
  if (/年[份度]|论文|出处|机构|发布|历史节点/.test(t)) return 'source-year';
  if (/公式|方程|token|变量/.test(t)) return 'formula';
  if (/表格|榜单|排行|行高/.test(t)) return 'table-board';
  if (/时间轴|游标|放慢|时间线/.test(t)) return 'timeline-hero';
  if (/循环|反馈|跑圈|闭环/.test(t)) return 'feedback-loop';
  if (/网络|关系图|节点.*边|社区/.test(t)) return 'network';
  if (/点云|聚类|邻近|向量空间|相似/.test(t)) return 'point-cloud';
  if (/倾斜|纵深|多层|层级结构|TiltPlane|分层/.test(t)) return 'tilt-depth';
  if (/容器|圆柱|数据库|准入|权限|飞入/.test(t)) return 'container';
  if (/汇合|合成|两路|左右两列.*中央/.test(t)) return 'two-merge';
  if (/请求|回应|打字机|引用角标|处理者/.test(t)) return 'req-resp';
  if (/并列|优缺点|正反|两组清单|左右虚线/.test(t)) return 'parallel-lists';
  if (/视差|很多|墙|世界很大|截图墙|文档墙/.test(t)) return 'parallax-wall';
  if (/真.*假|看起来像|两框|机制不同|推.*变焦/.test(t)) return 'dual-mechanism';
  if (/曲线|拐点|折线|趋势|图表卡|U\s*形|count-up|百分比|数字|两毛|一块钱|token\s*费/.test(t)) {
    return /大数字|量级|频数|百万|1,000|计数到位/.test(t) ? 'bignum-setpiece' : 'chart-curve';
  }
  if (/步骤|阶段|流程|生命周期|工位|传送带|输入.*输出|第[一二三]步|三步/.test(t)) return 'process-rail';
  if (/比喻|具象|考卷|书本|物件|桌子|椅子|帽子|沙漏|杠杆|放大镜|硬币/.test(t)) return 'metaphor-object';
  if (/特性|组成|短板|部件|右侧.*框|若干/.test(t)) return 'subject-parts';
  // a2e：画不出的按 composition 自设计 — 默认走「具象物」而非空节点图
  return 'metaphor-object';
}

const ROTATE_FALLBACK: A2eModeId[] = [
  'metaphor-object',
  'process-rail',
  'three-column',
  'parallel-lists',
  'chart-curve',
  'two-merge',
  'subject-parts',
  'balance',
  'tilt-depth',
  'container',
  'network',
  'funnel',
  'req-resp',
  'timeline-hero',
  'bignum-setpiece',
];

/**
 * @deprecated Agent 全幅路径不再写入 layoutMode；保留空操作以免半死引用。
 */
export function assignA2eLayoutModes<T extends {
  visualIntent?: string;
  headline?: string;
  keyMotion?: string;
  vo?: string;
  job?: string;
  layoutMode?: string;
}>(beats: T[]): T[] {
  return beats;
}

export function a2eModeCraftLine(id: string): string {
  const m = BY_ID[id as A2eModeId];
  if (!m) return '';
  return `layoutMode≈${m.id} (soft) | 关系: ${m.relation} | 画法: ${m.recipe} | 主角: ${m.hero}`;
}

/** 注入 codegen 的模式表缩略（横屏专用） */
export function a2eModeTableLaw(): string {
  const lines = A2E_MODES.map(
    (m) => `- ${m.id}: [${m.relation}] → ${m.recipe} // 主角: ${m.hero}`,
  );
  return `=== SHOT MODE IDEAS (soft — optional variety; full-frame Agent path) ===
${lines.join('\n')}
Prefer varying families across neighboring beats. LightSweep-style set-pieces ≤2 film-wide when used.`;
}

/** @deprecated 不再注入 codegen；Agent 全幅自拟构图。 */
export function a2eLayoutModeBeatLaw(
  _beats: Array<{ job?: string; layoutMode?: string; visualIntent?: string }>,
): string {
  return '';
}
