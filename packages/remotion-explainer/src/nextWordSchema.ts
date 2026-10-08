import { z } from 'zod';

export const NextWordKindSchema = z.enum([
  'hook', 'type', 'read', 'odds', 'spin', 'add', 'loop',
]);

export const CandidateSchema = z.object({
  word: z.string(),
  pct: z.number().min(0).max(100),
});

export const NextWordSceneSchema = z.object({
  kind: NextWordKindSchema,
  durationSec: z.number(),
  headline: z.string().optional(),
  line: z.string().optional(),
  vo: z.string().optional(),
  narrationFile: z.string().optional(),
  promptBubble: z.string().optional(),
  tokens: z.array(z.string()).optional(),
  writingText: z.string().optional(),
  candidates: z.array(CandidateSchema).optional(),
  winner: z.string().optional(),
});

export const CaptionCueSchema = z.object({
  from: z.number(),
  to: z.number(),
  text: z.string(),
});

export const NextWordSchema = z.object({
  canvas: z.string(),
  ink: z.string(),
  accent: z.string(),
  muted: z.string(),
  bar: z.string().optional(),
  scenes: z.array(NextWordSceneSchema),
  captions: z.array(CaptionCueSchema).optional(),
  narrationFile: z.string().optional(),
});

export type NextWordProps = z.infer<typeof NextWordSchema>;
export type NextWordScene = z.infer<typeof NextWordSceneSchema>;

export const defaultNextWordProps: NextWordProps = {
  canvas: '#12141C',
  ink: '#FFFFFF',
  accent: '#FFB830',
  muted: '#8B90A8',
  bar: '#8E94F2',
  scenes: [
    {
      kind: 'hook',
      durationSec: 3.5,
      headline: 'How does ChatGPT actually pick the next word?',
      promptBubble: 'Name a classic sandwich',
      writingText: '',
      vo: '大模型是怎么选出下一个词的？',
    },
    {
      kind: 'type',
      durationSec: 3.2,
      writingText: 'Peanut butter and',
      vo: '它先像打字一样，逐词写出回答。',
    },
    {
      kind: 'read',
      durationSec: 4,
      headline: 'First, it reads everything so far',
      tokens: ['Name', 'a', 'classic', 'sandwich', 'Peanut', 'butter', 'and'],
      line: 'your question + everything written so far',
      vo: '第一步 READ：把你的问题和已写出的每个词一起读进去。',
    },
    {
      kind: 'odds',
      durationSec: 4.2,
      headline: 'Every possible next word gets odds',
      writingText: 'Peanut butter and',
      candidates: [
        { word: 'jelly', pct: 62 },
        { word: 'jam', pct: 17 },
        { word: 'bread', pct: 8 },
        { word: 'banana', pct: 5 },
        { word: 'honey', pct: 5 },
        { word: 'other', pct: 3 },
      ],
      line: '?',
      vo: '第二步 ODDS：给每个候选词算概率。',
    },
    {
      kind: 'spin',
      durationSec: 4.5,
      headline: 'Then it spins. Bigger slice, better chance.',
      line: "Usually a big slice wins. Not always: that's why answers can vary.",
      candidates: [
        { word: 'jelly', pct: 62 },
        { word: 'jam', pct: 17 },
        { word: 'bread', pct: 8 },
        { word: 'banana', pct: 5 },
        { word: 'honey', pct: 5 },
        { word: 'other', pct: 3 },
      ],
      winner: 'jelly',
      vo: '第三步 SPIN：按概率转轮，抽中一个词。',
    },
    {
      kind: 'add',
      durationSec: 3.8,
      headline: 'It adds the winner... then does it all again.',
      writingText: 'Peanut butter and jelly',
      winner: 'jelly',
      candidates: [
        { word: 'jelly', pct: 62 },
        { word: 'jam', pct: 17 },
        { word: 'bread', pct: 8 },
        { word: 'banana', pct: 5 },
        { word: 'honey', pct: 5 },
        { word: 'other', pct: 3 },
      ],
      vo: '第四步 ADD：把词写进回答，然后回到 READ。',
    },
    {
      kind: 'loop',
      durationSec: 4,
      headline: 'Every word goes round this loop',
      line: 'READ → ODDS → SPIN → ADD → …',
      vo: '每个词都走同一套回路，直到整段话说完。',
    },
  ],
};
