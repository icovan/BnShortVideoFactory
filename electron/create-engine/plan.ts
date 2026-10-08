import { chatJson } from './llm'
import type { Aspect, StoryboardBeat } from './types'

type PlanResult = {
  title: string
  beats: Array<{
    title: string
    narration: string
    visual: string
    durationSec?: number
  }>
}

export async function planStoryboard(input: {
  prompt: string
  aspect: Aspect
  formMode?: string
  voMode: 'on' | 'off' | 'auto'
}): Promise<{ title: string; beats: StoryboardBeat[] }> {
  const wantVo = input.voMode !== 'off'
  const system = [
    'You are BiunowFactory storyboard planner.',
    'Reply JSON only: {"title":"...","beats":[{"title":"...","narration":"...","visual":"...","durationSec":4}]}',
    'Create 4-8 beats. Keep user language.',
    wantVo
      ? 'narration must be speakable voiceover lines.'
      : 'narration can be short on-screen captions; visual drives the shot.',
    `Target aspect ${input.aspect}. formMode=${input.formMode || 'prompt'}.`,
  ].join(' ')

  const raw = await chatJson<PlanResult>(system, input.prompt)
  const beats: StoryboardBeat[] = (raw.beats || [])
    .filter((b) => b && (b.title || b.narration || b.visual))
    .slice(0, 10)
    .map((b, i) => ({
      index: i,
      title: String(b.title || `Beat ${i + 1}`).slice(0, 80),
      narration: String(b.narration || b.title || '').slice(0, 400),
      visual: String(b.visual || b.title || '').slice(0, 400),
      durationSec: Math.min(12, Math.max(2.5, Number(b.durationSec) || 4)),
    }))

  if (!beats.length) {
    beats.push({
      index: 0,
      title: 'Opening',
      narration: input.prompt.slice(0, 120),
      visual: input.prompt.slice(0, 120),
      durationSec: 5,
    })
  }

  return {
    title: String(raw.title || input.prompt).slice(0, 40),
    beats,
  }
}
