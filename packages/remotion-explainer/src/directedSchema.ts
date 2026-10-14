import { z } from 'zod';

export const DirectedBeatSchema = z.object({
  job: z.string(),
  durationSec: z.number(),
  vo: z.string().optional(),
  headline: z.string().optional(),
  line: z.string().optional(),
  visualIntent: z.string().optional(),
  keyMotion: z.string().optional(),
  skill: z.string().optional(),
  /** @deprecated optional composition hint; not enforced */
  layoutMode: z.string().optional(),
  craftMust: z.array(z.string()).optional(),
  /** Hand-written narration layout id. Pixels come from NarrationFilm. */
  layout: z.string().optional(),
  /** Object glyphs for this line (brush, coin, gear, …). */
  glyphs: z.array(z.string()).optional(),
  items: z.array(z.string()).optional(),
  stat: z.object({ label: z.string(), value: z.number() }).optional(),
  narrationFile: z.string().optional(),
  /** 多挂点时间轴（enter / accent / settle） */
  sfxCues: z.array(z.object({
    role: z.string(),
    intent: z.enum(['enter', 'accent', 'settle']).optional(),
    file: z.string(),
    volume: z.number(),
    atSec: z.number(),
  })).optional(),
  /** 兼容旧单挂点 */
  sfxFile: z.string().optional(),
  sfxVolume: z.number().optional(),
  sfxRole: z.string().optional(),
});

export const DirectedSchema = z.object({
  aspect: z.enum(['9:16', '16:9', '1:1', '3:4']),
  /** 出片分辨率：1080p 默认满像素；720p 为各画幅对应矮档 */
  quality: z.enum(['1080p', '720p']).optional(),
  canvas: z.string(),
  ink: z.string(),
  accent: z.string(),
  muted: z.string(),
  brandBg: z.string().optional(),
  /** Look material sentence: ink, paper, halftone, clay. Skin only. */
  material: z.string().optional(),
  primary: z.string(),
  skills: z.array(z.string()),
  coreIdea: z.string().optional(),
  /** Director toolkit: leaf that most beats deepen */
  mainTechnique: z.string().optional(),
  /** Continuous same-page motif across Sequences */
  motifLock: z.object({
    continuousPage: z.boolean(),
    motif: z.string(),
  }).optional(),
  /** Audience language: zh | en | bilingual */
  contentLang: z.enum(['zh', 'en', 'bilingual']).optional(),
  dropSec: z.number().optional(),
  musicFile: z.string().optional(),
  /** 全局自动音效开关（分镜级 sfxCues / sfxFile） */
  autoSfx: z.boolean().optional(),
  /** @deprecated unused; Agent films ignore Stage shell */
  a2eCanvas: z.boolean().optional(),
  /** @deprecated unused */
  a2eHud: z.boolean().optional(),
  /** @deprecated unused */
  a2eBg: z.enum(['dots', 'stars', 'none']).optional(),
  /** 用户上屏素材（相对 public） */
  assets: z.array(z.object({
    role: z.enum(['logo', 'product', 'shot', 'image']),
    name: z.string(),
    file: z.string(),
  })).optional(),
  scenes: z.array(DirectedBeatSchema),
  captions: z.array(z.object({ from: z.number(), to: z.number(), text: z.string() })).optional(),
});

export type DirectedProps = z.infer<typeof DirectedSchema>;
export type DirectedScene = z.infer<typeof DirectedBeatSchema>;

export const defaultDirectedProps: DirectedProps = {
  aspect: '16:9',
  quality: '1080p',
  canvas: '#12141C',
  ink: '#FFFFFF',
  accent: '#FFB830',
  muted: '#8B90A8',
  brandBg: '#1A1C28',
  primary: 'explainer-video',
  skills: ['explainer-video', 'kinetic-typography', 'caption-animation'],
  coreIdea: 'One idea, spoken then shown.',
  scenes: [
    { job: 'hook', durationSec: 3, headline: 'One idea', vo: '先把核心观点说清楚。' },
    { job: 'how', durationSec: 4, headline: 'Then show how', items: ['Read', 'Odds', 'Spin'], vo: '再用画面把机制拆开。' },
    { job: 'payoff', durationSec: 3, headline: 'Payoff', stat: { label: 'clarity', value: 100 }, vo: '最后落到可行动的一步。' },
  ],
};
