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
/** 成片管线：自由 skill-directed / 混剪；旧硬 SKU 名仅兼容历史项目数据 */
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

/** 创作页工作流卡片已移除；保留空数组兼容 catalog / 旧引用 */
export const WORKFLOW_CARDS: Template[] = [];

export function workflowLabel(t: Pick<Template, 'engine' | 'stylePack' | 'aspect'>): string {
  if (t.engine === 'manim') return `Manim · ${t.aspect}`;
  if (t.stylePack === 'footage-remix') return `混剪 · ${t.aspect}`;
  return `自由创作 · ${t.aspect}`;
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
