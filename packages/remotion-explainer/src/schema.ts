import { z } from 'zod';

/** Skill 内联技法：动能字 / 图示揭露 / 数字跳动 / 收束 CTA */
export const TechniqueSchema = z.enum(['kinetic', 'diagram', 'stat', 'cta']);

export const SceneSchema = z.object({
  stage: z.enum(['problem', 'stakes', 'solution', 'how', 'payoff']),
  vo: z.string(),
  visual: z.string(),
  keyword: z.string(),
  durationSec: z.number(),
  technique: TechniqueSchema.default('kinetic'),
  nodes: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  statValue: z.number().optional(),
  statSuffix: z.string().optional(),
  caption: z.string().optional(),
  transition: z.enum(['cut', 'match']).optional(),
});

export const CaptionCueSchema = z.object({
  from: z.number(),
  to: z.number(),
  text: z.string(),
});

export const ExplainerSchema = z.object({
  title: z.string(),
  coreIdea: z.string(),
  analogy: z.string().optional(),
  cta: z.string().optional(),
  // Style system lock（Skill § Style-system；色值可品牌覆盖，语义不重派）
  accent: z.string(),
  ink: z.string(),
  canvas: z.string(),
  muted: z.string().optional(),
  scenes: z.array(SceneSchema),
  captions: z.array(CaptionCueSchema).optional(),
  narrationFile: z.string().optional(),
});

export type ExplainerProps = z.infer<typeof ExplainerSchema>;
export type SceneProps = z.infer<typeof SceneSchema>;
export type CaptionCue = z.infer<typeof CaptionCueSchema>;

export const defaultProps: ExplainerProps = {
  title: '讲解片',
  coreIdea: '一句话核心观点',
  analogy: '装配线',
  cta: '现在就开始',
  accent: '#0A84FF',
  ink: '#F5F7FA',
  canvas: '#0B0F14',
  muted: '#8B939E',
  scenes: [
    {
      stage: 'problem', vo: '手工发布太慢。', visual: '清单堆积', keyword: '太慢',
      durationSec: 4, technique: 'kinetic', caption: '手工发布太慢。',
    },
    {
      stage: 'stakes', vo: '漏一步，凌晨就崩。', visual: '风险', keyword: '风险',
      durationSec: 3, technique: 'stat', statValue: 2, statSuffix: 'am 故障', caption: '漏一步，凌晨就崩。',
    },
    {
      stage: 'solution', vo: '一键接管整条流水线。', visual: '一键', keyword: '一键',
      durationSec: 3, technique: 'kinetic', caption: '一键接管整条流水线。',
    },
    {
      stage: 'how', vo: '测试、构建、灰度，一步步自动。', visual: '三步机制', keyword: '自动',
      durationSec: 6, technique: 'diagram',
      nodes: ['测', '建', '放'], labels: ['并行测', '签名构建', '分区域放'],
      caption: '测试、构建、灰度，一步步自动。',
    },
    {
      stage: 'payoff', vo: '安心发版。现在就开始。', visual: '收束', keyword: '开始',
      durationSec: 4, technique: 'cta', caption: '安心发版。现在就开始。',
    },
  ],
  captions: [
    { from: 0.3, to: 4.0, text: '手工发布太慢。' },
    { from: 4.2, to: 7.2, text: '漏一步，凌晨就崩。' },
    { from: 7.4, to: 10.4, text: '一键接管整条流水线。' },
    { from: 10.6, to: 16.6, text: '测试、构建、灰度，一步步自动。' },
    { from: 16.8, to: 20.8, text: '安心发版。现在就开始。' },
  ],
};
