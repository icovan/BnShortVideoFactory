import { describe, expect, it } from 'vitest'
import {
  keywordAffirmed,
  promptForcesMix,
  promptForcesStickman,
} from '../../packages/create-core/src/make/promptIntent'
import {
  ensureMinimumBeats,
  normalizeSkillPlan,
} from '../../packages/create-core/src/make/skillPlan'

describe('prompt intent negation', () => {
  it('does not force remix on 不要混剪', () => {
    expect(promptForcesMix('做科普片，不要混剪，不要素材拼接')).toBe(false)
    expect(promptForcesMix('请做素材混剪成片')).toBe(true)
    expect(keywordAffirmed('不要混剪', /混剪/i)).toBe(false)
  })

  it('does not force stickman on 不要火柴人', () => {
    expect(promptForcesStickman('蓝天科普，不要火柴人')).toBe(false)
    expect(promptForcesStickman('用火柴人对比动机与纪律')).toBe(true)
  })

  it('normalize ignores negated remix/stickman keywords', () => {
    const plan = normalizeSkillPlan(
      {
        primary: 'explainer-video',
        support: ['diagram-animation'],
        coreIdea: 'sky',
        beats: [
          {
            job: 'a',
            vo: '天空为什么是蓝的',
            headline: '蓝天',
            visualIntent: 'prism',
            keyMotion: 'split',
            skill: 'explainer-video',
          },
        ],
      },
      '16:9',
      undefined,
      {
        contentLang: 'zh',
        sourcePrompt: '蓝天科普。不要混剪。不要火柴人。要动能字和图解。',
      },
    )
    expect(plan.primary).not.toBe('footage-remix')
    expect(plan.engine).toBe('explainer-remotion')
    expect(plan.support).not.toContain('stickman-animation')
    expect(plan.beats.length).toBeGreaterThanOrEqual(5)
  })

  it('ensureMinimumBeats pads to 5', () => {
    const beats = ensureMinimumBeats(
      [
        {
          job: 'hook',
          vo: '开场',
          headline: '开场',
          visualIntent: 'hook card',
          keyMotion: 'slam',
          skill: 'explainer-video',
        },
      ],
      'explainer-video',
      ['kinetic-typography'],
      'zh',
      5,
    )
    expect(beats.length).toBe(5)
  })
})
