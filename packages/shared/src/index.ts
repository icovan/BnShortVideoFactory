export type Kind =
  | 'promo'
  | 'explainer'
  | 'logo'
  | 'stories'
  | 'overlays'
  | 'social'
  | 'data';

export type Aspect = '9:16' | '16:9' | '1:1' | '3:4';
export type Quality = '1080p' | '720p';
export type Engine = 'explainer-remotion' | 'manim' | 'footage-remix';
/** 成片管线配方（工作流 StylePack） */
export type StylePack =
  | 'skill-directed'
  | 'footage-remix'
  | 'launch-showreel'
  | 'narrated-explainer'
  | 'next-word-loop';
/** 创作页模板分类（国内短/中视频赛道） */
export type TemplateCategory =
  | 'narrate'
  | 'promo'
  | 'tutorial'
  | 'commerce'
  | 'story'
  | 'other';

export type Template = {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  kind: Kind;
  /** 创作页筛选分类；与 kind（管线类型）解耦 */
  category: TemplateCategory;
  engine?: Engine;
  stylePack?: StylePack;
  aspect: Aspect;
  cover: string;
  previewVideo?: string;
  tall: number;
};

export type ProjectFile = {
  name: string;
  rel: string;
  kind: 'image' | 'video' | 'text' | 'audio' | 'other';
};

/** 成片后再创作：同项目成片版本快照 */
export type ProjectVersion = {
  id: string;
  label: string;
  /** 相对 outputs/{dir}/_versions/{id}/ */
  rel: string;
  createdAt: string;
  note?: string;
  beatIndexes?: number[];
  durationSec?: number;
  /** 初始版本 | 改过版本 */
  kind?: 'initial' | 'remake';
  /** 改过版本序号：1…n */
  remakeIndex?: number;
};

export type StoryboardBeat = {
  index: number;
  job: string;
  headline: string;
  line?: string;
  vo?: string;
  visualIntent?: string;
  keyMotion?: string;
  skill?: string;
  durationSec: number;
  startSec: number;
  endSec: number;
  thumbUrl?: string;
};

export type StoryboardPayload = {
  projectId: string;
  dir: string;
  aspect?: Aspect;
  durationSec: number;
  videoUrl?: string;
  currentVersionId?: string;
  versions: ProjectVersion[];
  beats: StoryboardBeat[];
  files?: ProjectFile[];
};

export type RemakeMode = 'both' | 'visual' | 'copy';

export type Project = {
  id: string;
  title: string;
  kind: Kind;
  engine?: Engine;
  stylePack?: StylePack;
  prompt: string;
  createdAt: string;
  durationSec: number;
  aspect?: Aspect;
  /** 出片分辨率档：影响 Remotion 宽高 */
  quality?: Quality;
  favorite?: boolean;
  status?: 'queued' | 'running' | 'ready' | 'error';
  dir?: string;
  files?: ProjectFile[];
  error?: string;
  /** 成片/验帧封面，列表页用 */
  posterUrl?: string;
  /** 出片过程步骤；工位轮询读取 */
  pipeline?: PipelineStep[];
  userId?: string;
  /** 当前成片版本（未归档前的工作区即 current） */
  currentVersionId?: string;
  /** 历史成片快照（重做前归档） */
  versions?: ProjectVersion[];
};

export type Brand = {
  id: string;
  name: string;
  tagline: string;
  about: string;
  audience: string;
  website: string;
  canvas: string;
  ink: string;
  accent: string;
  logoDataUrl?: string;
  headingFont?: string;
  bodyFont?: string;
  voiceTone?: string;
  voiceAvoid?: string;
};

export type PipelineStep = {
  id: string;
  label: string;
  status: 'done' | 'running' | 'pending';
  detail?: string;
};

export type SpeechProvider = 'auto' | 'edge' | 'openai' | 'windows';

/** 国内声音复刻通道；推荐 CosyVoice / MiniMax */
export type CloneProvider = 'none' | 'dashscope' | 'minimax' | 'fish';

export type MyVoice = {
  id: string;
  name: string;
  provider: Exclude<CloneProvider, 'none'>;
  /** 服务商侧音色 ID（复刻完成后填入） */
  voiceId: string;
};

export type Settings = {
  displayName: string;
  email: string;
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
  speechProvider: SpeechProvider;
  speechBaseUrl: string;
  speechApiKey: string;
  speechModel: string;
  speechVoice: string;
  cloneProvider: CloneProvider;
  cloneApiKey: string;
  cloneBaseUrl: string;
  myVoices: MyVoice[];
  /** 可选：Tavily API Key；空则尝试 keyless / DuckDuckGo */
  webSearchApiKey?: string;
};

export const DEFAULT_SETTINGS: Settings = {
  displayName: '本机',
  email: '',
  llmBaseUrl: 'https://api.deepseek.com/v1',
  llmApiKey: '',
  llmModel: 'deepseek-chat',
  speechProvider: 'auto',
  speechBaseUrl: '',
  speechApiKey: '',
  speechModel: 'edge-tts',
  speechVoice: 'zh-CN-YunxiNeural',
  cloneProvider: 'none',
  cloneApiKey: '',
  cloneBaseUrl: '',
  myVoices: [],
  webSearchApiKey: '',
};

/** 本地兜底模板卡片（优先拉管理后台模板货架） */
export const WORKFLOW_CARDS: Template[] = [
  {
    id: 't-launch',
    title: '发布秀卷',
    subtitle: '宣传发布 · Launch',
    kind: 'promo',
    category: 'promo',
    engine: 'explainer-remotion',
    stylePack: 'launch-showreel',
    aspect: '16:9',
    cover: 'launch',
    tall: 210,
    prompt: '做一个约 20 秒动态发布秀卷：按我描述的产品走 hook→揭晓→能力切镜→品牌收束。少旁白、强画面。配色和材质跟主题走，不要默认做成 Linear 紫黑。',
  },
  {
    id: 't-narrated',
    title: '旁白解说片',
    subtitle: '口播讲解 · Narrated',
    kind: 'explainer',
    category: 'narrate',
    engine: 'explainer-remotion',
    stylePack: 'narrated-explainer',
    aspect: '16:9',
    cover: 'present',
    tall: 220,
    prompt: '做一条约 30 秒旁白讲解：痛点、我是谁、怎么用、一个证明、收束。中文旁白像讲解不是硬广。画风跟随主题，不要默认白底紫 PageOn。证明点不要编造统计数字。',
  },
  {
    id: 't-next-word',
    title: '下一词回路',
    subtitle: '竖屏口播 · Next-Word',
    kind: 'explainer',
    category: 'narrate',
    engine: 'explainer-remotion',
    stylePack: 'next-word-loop',
    aspect: '9:16',
    cover: 'next-word',
    tall: 240,
    prompt: '做一条约 26 秒竖屏口播：讲清大模型如何 READ→算概率→抽样→写入下一词并循环。例子、配色、界面文案都跟提示词走，不要锁死花生酱三明治橙黑。画面英文 UI、中文配音。',
  },
  {
    id: 't-manim',
    title: '数理公式动画',
    subtitle: '数理 · Manim',
    kind: 'explainer',
    category: 'other',
    engine: 'manim',
    aspect: '16:9',
    cover: 'data',
    tall: 200,
    prompt: '用 Manim 做一段公式变形：把欧拉公式 e^{iπ}+1=0 写上并逐项高亮。',
  },
];

export function workflowLabel(t: Pick<Template, 'engine' | 'stylePack' | 'aspect'>): string {
  if (t.engine === 'manim') return `Manim · ${t.aspect}`;
  if (t.stylePack === 'footage-remix') return `混剪 · ${t.aspect}`;
  if (t.stylePack === 'launch-showreel') return `发布秀卷 · ${t.aspect}`;
  if (t.stylePack === 'next-word-loop') return `下一词回路 · ${t.aspect}`;
  if (t.stylePack === 'narrated-explainer') return `旁白解说 · ${t.aspect}`;
  return `技能导向 · ${t.aspect}`;
}

export const TEMPLATE_CATEGORY_TABS: { id: 'all' | TemplateCategory; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'narrate', label: '口播解说' },
  { id: 'promo', label: '宣传与发布' },
  { id: 'tutorial', label: '教程干货' },
  { id: 'commerce', label: '种草带货' },
  { id: 'story', label: '剧情故事' },
  { id: 'other', label: '其他' },
];

export const KIND_TABS: { id: 'all' | Kind; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'explainer', label: '讲解' },
];

export const QUICK_KINDS: { id: Kind; label: string }[] = [
  { id: 'explainer', label: '讲解片' },
];

export * from './commerce.ts';
