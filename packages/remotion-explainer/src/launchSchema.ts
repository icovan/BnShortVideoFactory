import { z } from 'zod';

export const LaunchSceneSchema = z.object({
  kind: z.enum([
    'dot', 'cloud', 'hook', 'spinner', 'keys', 'board', 'status', 'features', 'logo',
    /** launch-video hard arc */
    'tease', 'reveal', 'feature', 'end',
  ]),
  durationSec: z.number(),
  line1: z.string().optional(),
  line2: z.string().optional(),
  pills: z.array(z.string()).optional(),
  spinnerLabel: z.string().optional(),
  keyLabel: z.string().optional(),
  boardColumns: z.array(z.object({
    title: z.string(),
    tone: z.enum(['todo', 'progress', 'review', 'done']).optional(),
    cards: z.array(z.object({
      id: z.string(),
      title: z.string(),
      avatar: z.string().optional(),
    })),
  })).optional(),
  boardTagline: z.string().optional(),
  floatingCardId: z.string().optional(),
  statusTitle: z.string().optional(),
  statusItems: z.array(z.object({
    label: z.string(),
    tone: z.enum(['muted', 'yellow', 'green', 'purple']).optional(),
  })).optional(),
  activeStatus: z.number().optional(),
  cards: z.array(z.object({
    title: z.string(),
    subtitle: z.string(),
    metric: z.string().optional(),
    detail: z.string().optional(),
  })).optional(),
  brandName: z.string().optional(),
  tagline: z.string().optional(),
  cta: z.string().optional(),
  /** Per-scene Chinese VO — drives duration when set */
  vo: z.string().optional(),
  narrationFile: z.string().optional(),
});

export const LaunchSchema = z.object({
  brandName: z.string(),
  tagline: z.string().optional(),
  canvas: z.string(),
  ink: z.string(),
  accent: z.string(),
  highlight: z.string(),
  /** 0–2 camera / density recipe (legacy) */
  variant: z.number().min(0).max(2).optional(),
  /** 0–5 shot recipe id — Phase B director pick */
  shotId: z.number().min(0).max(5).optional(),
  /** launch-video hard: music leads picture */
  dropSec: z.number().optional(),
  musicFile: z.string().optional(),
  beats: z.array(z.number()).optional(),
  scenes: z.array(LaunchSceneSchema),
  /** @deprecated prefer per-scene narrationFile */
  narrationFile: z.string().optional(),
  captions: z.array(z.object({
    from: z.number(),
    to: z.number(),
    text: z.string(),
  })).optional(),
});

export type LaunchProps = z.infer<typeof LaunchSchema>;
export type LaunchScene = z.infer<typeof LaunchSceneSchema>;

export const defaultLaunchProps: LaunchProps = {
  brandName: 'Linear',
  tagline: 'Plan and build products.',
  canvas: '#07070A',
  ink: '#F5F5F7',
  accent: '#5E6AD2',
  highlight: '#F2C94C',
  scenes: [
    { kind: 'dot', durationSec: 1.2 },
    {
      kind: 'cloud', durationSec: 2.2,
      pills: ['ENG-1290', 'ENG-2754', 'ENG-1075', 'ENG-957', 'ENG-688', 'ENG-2556', 'ENG-312', 'ENG-1840', 'ENG-2201', 'ENG-901'],
    },
    {
      kind: 'hook', durationSec: 2.6,
      line1: 'The issue tracking tool',
      line2: "you'll enjoy using",
      pills: ['ENG-1075', 'ENG-957', 'ENG-688', 'ENG-2556', 'ENG-312', 'ENG-1840'],
    },
    { kind: 'spinner', durationSec: 1.8, spinnerLabel: 'In Review' },
    { kind: 'keys', durationSec: 1.8, keyLabel: 'K', statusTitle: 'ENG-2481 Fix checkout race condition' },
    {
      kind: 'board', durationSec: 3.4,
      boardTagline: 'Plan. Build. Ship.',
      floatingCardId: 'ENG-2419',
      boardColumns: [
        {
          title: 'Todo', tone: 'todo',
          cards: [
            { id: 'ENG-2300', title: 'Search indexing latency', avatar: 'M' },
            { id: 'ENG-2304', title: 'Onboarding empty state', avatar: 'C' },
            { id: 'ENG-2311', title: 'Webhook retry budget', avatar: 'T' },
          ],
        },
        {
          title: 'In Progress', tone: 'progress',
          cards: [
            { id: 'ENG-2368', title: 'Dark mode contrast pass', avatar: 'D' },
            { id: 'ENG-2419', title: 'Cache warm-up job', avatar: 'U' },
            { id: 'ENG-2422', title: 'Mention notifications', avatar: 'M' },
          ],
        },
        {
          title: 'In Review', tone: 'review',
          cards: [
            { id: 'ENG-2470', title: 'SSO domain mapping', avatar: 'C' },
            { id: 'ENG-2477', title: 'Export CSV encoding', avatar: 'T' },
          ],
        },
        {
          title: 'Done', tone: 'done',
          cards: [
            { id: 'ENG-2481', title: 'Fix checkout race condition', avatar: 'D' },
            { id: 'ENG-2490', title: 'Invite link expiry', avatar: 'U' },
          ],
        },
      ],
    },
    {
      kind: 'status', durationSec: 2.4,
      statusTitle: 'ENG-2481 Fix checkout race condition',
      statusItems: [
        { label: 'Backlog', tone: 'muted' },
        { label: 'Todo', tone: 'muted' },
        { label: 'In Progress', tone: 'yellow' },
        { label: 'In Review', tone: 'green' },
        { label: 'Done', tone: 'purple' },
        { label: 'Canceled', tone: 'muted' },
      ],
      activeStatus: 4,
    },
    {
      kind: 'features', durationSec: 2.8,
      cards: [
        { title: 'Cycles', subtitle: 'Keep a steady cadence', metric: '11%', detail: 'Cycle 24' },
        { title: 'Projects', subtitle: 'Roadmaps that stay in sync', detail: 'Checkout v2 · 0%' },
        { title: 'Triage', subtitle: 'Review incoming work', metric: '4', detail: 'in Triage' },
        { title: 'Pull requests', subtitle: 'Issues update as code ships', detail: 'maya/eng-2481 · Open' },
      ],
    },
    {
      kind: 'logo', durationSec: 2.8,
      brandName: 'Linear',
      tagline: 'Plan and build products.',
      cta: 'linear.app',
    },
  ],
};
