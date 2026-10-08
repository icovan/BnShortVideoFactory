import { WORKFLOW_CARDS, type Brand, type PipelineStep, type Project, type Template } from '../../shared/src/index.ts';

/** 模板列表 = 工作流卡片。空分类不造假模板。 */
export const templates: Template[] = WORKFLOW_CARDS;

export const projects: Project[] = [
  {
    id: 'p1',
    title: '旁白解说样片',
    kind: 'explainer',
    engine: 'explainer-remotion',
    stylePack: 'narrated-explainer',
    prompt: '做一个演示工具的讲解：输入主题就能出带图表的幻灯片。',
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    durationSec: 32,
  },
  {
    id: 'p2',
    title: '勾股定理动画',
    kind: 'explainer',
    engine: 'manim',
    prompt: '用 Manim 演示勾股定理：直角三角形标 a b c，再显示 a^2+b^2=c^2。',
    createdAt: new Date(Date.now() - 56 * 60 * 1000).toISOString(),
    durationSec: 14,
    favorite: true,
  },
];

export const brands: Brand[] = [
  {
    id: 'b1',
    name: '工坊',
    tagline: '本机出片，品牌不跑偏',
    about: '本机动效创作台',
    audience: '知识创作者 / 独立团队',
    website: '',
    canvas: '#F6F3EE',
    ink: '#2C2825',
    accent: '#B85C38',
  },
];

export const demoPipeline: PipelineStep[] = [
  { id: 'hydrate', label: '准备工位', status: 'done', detail: '工作区已就绪' },
  { id: 'think1', label: '拆解需求', status: 'done', detail: '钩子 → 机制 → 行动号召，横屏讲解。' },
  { id: 'think2', label: '画面方向', status: 'done', detail: '品牌三色，字卡克制。' },
  { id: 'voice', label: '配音', status: 'done', detail: '默认微软云希，可自配克隆。' },
  { id: 'edit', label: '剪辑', status: 'pending', detail: '成片流水线稍后接入。' },
  { id: 'inspect', label: '预览检查', status: 'pending' },
];
