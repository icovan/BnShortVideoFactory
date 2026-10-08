import { z } from 'zod';

/** Locked gallery stages — research & design are separate so step 2 is never rushed */
export const NarratedStageSchema = z.enum([
  'problem', 'brand', 'solution', 'research', 'design', 'proof', 'end',
  /** @deprecated mapped to research */
  'how',
]);

export const NarratedSceneSchema = z.object({
  stage: NarratedStageSchema,
  /** Director pick from technique pool — drives which recipe module renders */
  technique: z.enum([
    'kinetic', 'blank_deck', 'product_demo', 'diagram', 'chat_edit', 'chart_slide', 'stat', 'cta',
  ]).optional(),
  /** Sub-recipe within technique (flow|nodes|cascade / deck_thumbs|hero_slide|split_chat) */
  recipeId: z.string().optional(),
  visualIntent: z.string().optional(),
  keyMotion: z.string().optional(),
  transition: z.string().optional(),
  vo: z.string().optional(),
  title: z.string(),
  accentWord: z.string().optional(),
  subtitle: z.string().optional(),
  body: z.string().optional(),
  step: z.number().optional(),
  promptText: z.string().optional(),
  cards: z.array(z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    kind: z.enum(['web', 'pdf', 'note']).optional(),
  })).optional(),
  slideTitle: z.string().optional(),
  slideAccent: z.string().optional(),
  slideBullets: z.array(z.string()).optional(),
  thumbs: z.array(z.object({
    title: z.string(),
    sub: z.string().optional(),
    tone: z.string().optional(),
    kind: z.enum(['cover', 'bullets', 'chart', 'customers']).optional(),
    bullets: z.array(z.string()).optional(),
  })).optional(),
  outlineLines: z.array(z.string()).optional(),
  chatUser: z.string().optional(),
  chatReply: z.string().optional(),
  proofLabel: z.string().optional(),
  brandName: z.string().optional(),
  cta: z.string().optional(),
  /** Visual variant 0–2 from planner — changes layout accents without new templates */
  variant: z.number().min(0).max(2).optional(),
  zoomFrom: z.number().optional(),
  enterFrames: z.number().optional(),
  durationSec: z.number(),
  narrationFile: z.string().optional(),
});

export const CaptionCueSchema = z.object({
  from: z.number(),
  to: z.number(),
  text: z.string(),
});

export type CaptionCue = z.infer<typeof CaptionCueSchema>;

export const NarratedSchema = z.object({
  brandName: z.string(),
  canvas: z.string(),
  ink: z.string(),
  accent: z.string(),
  muted: z.string(),
  brandBg: z.string().optional(),
  scenes: z.array(NarratedSceneSchema),
  captions: z.array(CaptionCueSchema).optional(),
  narrationFile: z.string().optional(),
});

export type NarratedProps = z.infer<typeof NarratedSchema>;
export type NarratedScene = z.infer<typeof NarratedSceneSchema>;

export const defaultNarratedProps: NarratedProps = {
  brandName: 'PageOn',
  canvas: '#FFFFFF',
  ink: '#1A1540',
  accent: '#5B4CDB',
  muted: '#6B6585',
  brandBg: '#4C3BCF',
  scenes: [
    { stage: 'problem', title: 'Big meeting tomorrow.', accentWord: 'Sound familiar?', durationSec: 5.0, vo: '明天有个大会议……空白页正盯着你。' },
    { stage: 'brand', title: 'You give it a topic.', accentWord: 'It builds the whole deck.', durationSec: 4.5, vo: '这就是 PageOn。它把想法变成成品片子。' },
    {
      stage: 'solution', title: 'Type a topic', subtitle: '...or paste in a doc you already have.',
      promptText: 'Pitch deck for Bloom, a plant-based coffee brand', durationSec: 5.0, vo: '第一步：输入主题，或贴进已有文档。', step: 1,
    },
    {
      stage: 'research', title: 'It researches, writes, and builds', step: 2, durationSec: 5.5, vo: '第二步：它检索资料、写好文案，并搭出幻灯片。',
      cards: [
        { title: 'Coffee market trends', subtitle: 'Web source', kind: 'web' },
        { title: 'Plant-based buyer survey', subtitle: 'Web source', kind: 'web' },
        { title: 'market-research.pdf', subtitle: 'Your document', kind: 'pdf' },
      ],
    },
    {
      stage: 'design', title: 'Designs the slides.', step: 3, durationSec: 5.5, vo: '第三步：用聊天就能改标题、加图表。',
      slideTitle: 'A market moving', slideAccent: 'plant-based',
    },
    {
      stage: 'proof', title: 'Creators from', accentWord: '120+',
      proofLabel: 'Creators from 120+ countries', durationSec: 4.0, vo: '已有来自一百二十多个国家的创作者。',
    },
    {
      stage: 'end', title: 'PageOn', brandName: 'PageOn', cta: 'pageon.ai',
      subtitle: 'Try it on your next deck.', durationSec: 3.5, vo: 'PageOn 点 A I。用在你的下一套片子上试试。',
    },
  ],
};
