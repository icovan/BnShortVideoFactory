/**
 * 横族画布 — 完全按 a2e（anything2explainer）技法：
 * - style-guide.md §1 安全区 / §3 字号 / §5 版式规律
 * - composition-and-light.md §1 主体层级 / §2 光 / §4 纵深 / §7 持续+停留
 * 基准画幅 a2e 1280×720；本厂 16:9=1920×1080 → 一律 ×1.5。1:1 / 3:4 按短边再缩。
 */
import type { Aspect } from '../../../../shared/src/index.ts';
import { a2eModeTableLaw } from './a2eModes.ts';

export type LandscapeAspect = '16:9' | '1:1' | '3:4';

const A2E_W = 1280;
const A2E_H = 720;

export function isLandscapeFamily(aspect: Aspect): boolean {
  return aspect === '16:9' || aspect === '1:1' || aspect === '3:4';
}

export function frameSize(aspect: LandscapeAspect): { w: number; h: number } {
  if (aspect === '1:1') return { w: 1080, h: 1080 };
  if (aspect === '3:4') return { w: 1080, h: 1440 };
  return { w: 1920, h: 1080 };
}

/** 相对 a2e 1280×720 的均匀缩放（短边对齐，保持 a2e 比例纪律） */
export function a2eScale(aspect: LandscapeAspect): number {
  const { w, h } = frameSize(aspect);
  return Math.min(w / A2E_W, h / A2E_H);
}

export function landscapeZone(aspect: LandscapeAspect): {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  w: number;
  h: number;
} {
  const { w, h } = frameSize(aspect);
  const s = a2eScale(aspect);
  // a2e 无轨章内容主区 x60–1220 / y110–620
  return {
    w,
    h,
    x0: Math.round(60 * s),
    x1: Math.round(1220 * s),
    y0: Math.round(110 * s),
    y1: Math.round(620 * s),
  };
}

export type ZoneRect = { x0: number; y0: number; x1: number; y1: number; w: number; h: number };

/**
 * a2e style-guide.md §1 安全区（× scale）— 照搬，不自创「标题切内容」。
 * - 内容主区 y110–620（有轨 y175–620）
 * - 字幕带 top 637 / 墨迹 644–684（白字黑描边，无底框）
 * - 进度条 y687–720 本厂关闭；HUD 胶囊可选（默认关，不强制）
 * 标题卡在内容主区内（§5），不是单独预留带。
 */
export function landscapeBands(aspect: LandscapeAspect): {
  frame: { w: number; h: number };
  content: ZoneRect;
  contentWithRailY0: number;
  captionTop: number;
  captionInkY0: number;
  captionInkY1: number;
  barY0: number;
  hud: { x: number; y: number; w: number; h: number };
  /** @deprecated alias = content（兼容旧调用） */
  title: ZoneRect;
  /** @deprecated caption band helper */
  caption: ZoneRect;
} {
  const z = landscapeZone(aspect);
  const s = a2eScale(aspect);
  const n = (v: number) => Math.round(v * s);
  const rect = (x0: number, y0: number, x1: number, y1: number): ZoneRect => ({
    x0, y0, x1, y1, w: x1 - x0, h: y1 - y0,
  });
  const content = rect(z.x0, z.y0, z.x1, z.y1);
  const captionTop = n(637);
  return {
    frame: { w: z.w, h: z.h },
    content,
    contentWithRailY0: n(175),
    captionTop,
    captionInkY0: n(644),
    captionInkY1: n(684),
    barY0: n(687),
    hud: { x: n(533), y: n(28), w: n(216), h: n(51) },
    title: content,
    caption: rect(z.x0, captionTop, z.x1, z.h),
  };
}

/** a2e composition §1 三档尺寸（× scale） */
export function landscapeTypeScale(aspect: LandscapeAspect) {
  const s = a2eScale(aspect);
  const n = (v: number) => Math.round(v * s);
  return {
    heroMin: n(170),
    heroTypeMin: n(96),
    heroTypeWide: n(110),
    supportMin: n(60),
    supportMax: n(110),
    labelMin: n(22),
    labelMax: n(30),
    caption: n(44),
    chartCardW: n(440),
    chartCardH: n(300),
    compareLeftX: `${n(300)}–${n(380)}`,
    compareRightX: `${n(900)}–${n(1000)}`,
    metaphorMinW: n(260),
    processBox: `${n(200)}×${n(110)}`,
    emptyFramePx: n(110),
  };
}

/** a2e style-guide §5 版式规律（坐标已缩放） */
function styleGuideLayouts(aspect: LandscapeAspect): string {
  const s = a2eScale(aspect);
  const n = (v: number) => Math.round(v * s);
  return `=== a2e STYLE-GUIDE LAYOUTS (§5, scaled ×${s.toFixed(2)}) ===
- 标题卡: 中心大字 + 下方短线 + 副标；章序号可单独放上方。
- 流程图: 节点 Pill ~${n(150)}×${n(44)} 或 Box ~${n(200)}×${n(70)}，间距 ~${n(200)}，箭头 draw-on；当前紫、已过灰、未到灰边。
- 卡片阵列: 卡 ~${n(150)}×${n(92)}，列距 ~${n(24)}，2 帧错峰；≥12 张缩窄。
- 左右对比: 左 x≈${n(300)}–${n(380)} / 右 x≈${n(900)}–${n(1000)}，上各一标签 Pill；中间 ≈ / vs / +。
- 图表卡: ~${n(440)}×${n(300)} 白边，网格细线，曲线 3px，重点红点。
- 标签+说明: Pill 在上，说明字在下 ~12px；说明字灰色次级。
- 信息层级: 一帧一个焦点；数字用强调色；说明字降一级。`;
}

/** a2e composition-and-light 硬规则 */
function compositionLightLaw(aspect: LandscapeAspect): string {
  const t = landscapeTypeScale(aspect);
  return `=== a2e COMPOSITION & LIGHT (composition-and-light.md) ===
1. 每镜头一个主角: 图形高 ≥${t.heroMin} 或大字 ≥${t.heroTypeMin}（短词可到 ~${t.heroTypeWide}）；第 1–2 节拍入场。
2. 三档尺寸 ONLY: 主角 ≥${t.heroMin} / 配角 ${t.supportMin}–${t.supportMax} / 标签 ${t.labelMin}–${t.labelMax}。配角 ≤4，标签 ≤6。
3. 细题材（时间轴/公式/表格/流程）必须另配大主角（大数字/放大当前项），禁止「细线+小胶囊」撑镜。
4. 「多」用整齐矩阵点亮，禁止背景碎屑小图标；背景只有幕底材质。
5. 空场: 内容区最大物体 <${t.emptyFramePx} 持续过久 = 缺陷。
6. 光: 主角必带光（柔光/硬投影/脚下光环）；配角默认无光；一帧内强调光 ≤1 处。
7. 纵深: 讲层级用倾斜平面叠 2–3 层；筛选用漏斗；少用全片平铺卡片墙。
8. 持续动作: 每个字幕块的动词要有持续到下一拍的动作；入场后禁止无意义静站 >~3s；不为凑动效加漂浮呼吸。
9. 落位停留: 末拍元素落位后稳定 ~30–45 帧再离场；运镜不进末拍（慢推贯穿除外）。
10. 高光时刻: 登场型 LightSweep 栈全片 ≤2；大数字型 / 象征物型用各自变体，勿每镜扫光。`;
}

/**
 * 实验参考：完整 a2e §1 长文。默认 codegen 走 canvasLawForAspect（Agent 软画布），不注入本函数。
 */
export function landscapeCanvasLaw(aspect: LandscapeAspect): string {
  const z = landscapeZone(aspect);
  const b = landscapeBands(aspect);
  const t = landscapeTypeScale(aspect);
  const s = a2eScale(aspect);
  return `=== CANVAS PACK landscape (${aspect}) — EXPERIMENTAL a2e reference (×${s.toFixed(2)}; NOT default Agent path) ===
Composition ${z.w}×${z.h}. Only when props.a2eCanvas===true. Default films use Agent soft full-frame.
Optional zones: content y${b.content.y0}–${b.content.y1}; caption top ${b.captionTop}; HUD off unless a2eHud.
TYPE TIERS (soft): hero ≥${t.heroMin} / support ${t.supportMin}–${t.supportMax} / labels ${t.labelMin}–${t.labelMax}.

${compositionLightLaw(aspect)}

${styleGuideLayouts(aspect)}

${a2eModeTableLaw()}

layoutMode = soft variety hint for full-frame beats; ContentSlot optional.`;
}
