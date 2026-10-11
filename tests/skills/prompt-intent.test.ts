import { describe, expect, it } from 'vitest'
import {
  keywordAffirmed,
  promptForcesManim,
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

  it('does not treat a feature list or uploaded narration as a stickman or manim order', () => {
    const list = '纯动效、地图讲解、火柴人、数据动画、Manim、剪纸风，全都能来。'
    expect(promptForcesStickman(list)).toBe(false)
    expect(promptForcesManim(list)).toBe(false)
    const packed = [
      '基于旁白和素材创作B站动画视频',
      'Source docs attached: 旁白.txt',
      'User-provided source documents (use for facts):',
      '--- USER DOC: 旁白.txt ---',
      list,
    ].join('\n')
    expect(promptForcesStickman(packed)).toBe(false)
    expect(promptForcesManim(packed)).toBe(false)
    expect(promptForcesStickman('请用火柴人讲这三条')).toBe(true)
    expect(promptForcesManim('用 Manim 出片，讲勾股定理')).toBe(true)
    expect(promptForcesManim('Manim 风格的数学短片')).toBe(true)
  })

  it('drops stickman and manim when the model echoes a name-drop', () => {
    const beats = [
      {
        job: 'hook',
        vo: '一条片子两毛三',
        headline: '两毛三',
        visualIntent: 'title slam',
        keyMotion: 'slam',
        skill: 'stickman-animation' as const,
      },
      {
        job: 'math',
        vo: '公式也能画',
        headline: '公式',
        visualIntent: 'axes',
        keyMotion: 'draw',
        skill: 'manim' as const,
      },
    ]
    const echoed = normalizeSkillPlan(
      {
        primary: 'manim',
        support: ['stickman-animation', 'diagram-animation'],
        coreIdea: 'factory',
        beats,
      },
      '16:9',
      undefined,
      { contentLang: 'zh', sourcePrompt: '按旁白做成讲解片。旁白里会提到火柴人和 Manim。' },
    )
    expect(echoed.primary).toBe('explainer-video')
    expect(echoed.engine).toBe('explainer-remotion')
    expect(echoed.support).not.toContain('stickman-animation')
    expect(echoed.skills).not.toContain('manim')
    expect(echoed.beats.every((b) => b.skill !== 'stickman-animation' && b.skill !== 'manim')).toBe(true)

    const ordered = normalizeSkillPlan(
      {
        primary: 'explainer-video',
        support: ['diagram-animation'],
        coreIdea: 'stick',
        beats: beats.slice(0, 1),
      },
      '16:9',
      undefined,
      { contentLang: 'zh', sourcePrompt: '用火柴人讲完这三条' },
    )
    expect(ordered.support).toContain('stickman-animation')
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
