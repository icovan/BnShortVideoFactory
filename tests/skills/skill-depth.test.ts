import { describe, expect, it } from 'vitest'
import { normalizeSkillPlan } from '../../packages/create-core/src/make/skillPlan'
import {
  craftDepthBrief,
  ensureBeatSkillCoverage,
  scoreSkillDepth,
} from '../../packages/create-core/src/skills/skillDepth'

describe('skill depth layer', () => {
  it('ensures every selected craft skill lands on ≥1 beat', () => {
    const beats = ensureBeatSkillCoverage(
      [
        {
          job: 'a',
          skill: 'explainer-video',
          visualIntent: 'hook card',
          keyMotion: 'slam',
        },
        {
          job: 'b',
          skill: 'explainer-video',
          visualIntent: 'how nodes',
          keyMotion: 'stagger',
        },
        {
          job: 'c',
          skill: 'explainer-video',
          visualIntent: 'payoff',
          keyMotion: 'seal',
        },
        {
          job: 'd',
          skill: 'explainer-video',
          visualIntent: 'end',
          keyMotion: 'fade',
        },
      ],
      'explainer-video',
      ['diagram-animation', 'kinetic-typography'],
    )
    const skills = new Set(beats.map((b) => b.skill))
    expect(skills.has('explainer-video')).toBe(true)
    expect(skills.has('diagram-animation')).toBe(true)
    expect(skills.has('kinetic-typography')).toBe(true)
    expect(beats.every((b) => (b.craftMust?.length || 0) > 0)).toBe(true)
  })

  it('normalizeSkillPlan attaches craftMust and covers support', () => {
    const plan = normalizeSkillPlan(
      {
        primary: 'explainer-video',
        support: ['diagram-animation', 'kinetic-typography'],
        coreIdea: 'sky',
        beats: [
          {
            job: 'hook',
            vo: '天空为什么是蓝的',
            headline: '蓝天',
            visualIntent: 'prism splits light',
            keyMotion: 'spectrum',
            skill: 'explainer-video',
          },
          {
            job: 'how',
            vo: '分子散射蓝光',
            headline: '散射',
            visualIntent: 'molecules scatter',
            keyMotion: 'rays',
            skill: 'explainer-video',
          },
          {
            job: 'point',
            vo: '红光直穿',
            headline: '红光',
            visualIntent: 'red beam',
            keyMotion: 'beam',
            skill: 'explainer-video',
          },
          {
            job: 'payoff',
            vo: '所以看见蓝天',
            headline: '答案',
            visualIntent: 'dome blue',
            keyMotion: 'dome',
            skill: 'explainer-video',
          },
        ],
      },
      '16:9',
      undefined,
      { contentLang: 'zh', sourcePrompt: '为什么天空是蓝色的' },
    )
    const beatSkills = new Set(plan.beats.map((b) => b.skill))
    for (const s of plan.support) expect(beatSkills.has(s)).toBe(true)
    expect(plan.beats.some((b) => b.craftMust?.length)).toBe(true)
  })

  it('craftDepthBrief lists per-beat law', () => {
    const brief = craftDepthBrief(
      ['explainer-video', 'diagram-animation', 'remotion-video'],
      [
        { job: 'how', skill: 'diagram-animation', visualIntent: 'nodes then edges' },
      ],
    )
    expect(brief).toContain('CRAFT DEPTH LAW')
    expect(brief).toContain('diagram-animation')
    expect(brief).toContain('PER-BEAT SKILL')
  })

  it('scoreSkillDepth rewards real craft fingerprints', () => {
    const shallow = `
import { AbsoluteFill, Series, useCurrentFrame, spring } from 'remotion';
export const ActiveDirected = () => {
  const frame = useCurrentFrame();
  const s = spring({ frame, fps: 30, config: { damping: 12 } });
  return <Series><Series.Sequence durationInFrames={30}><AbsoluteFill style={{ transform: \`translateY(\${(1-s)*40}px)\` }} /></Series.Sequence></Series>;
};
`
    const deep = `
import { AbsoluteFill, Audio, Series, interpolate, useCurrentFrame, spring, staticFile } from 'remotion';
export const ActiveDirected = () => {
  const frame = useCurrentFrame();
  const s = spring({ frame, fps: 30, config: { damping: 12 } });
  const dash = interpolate(frame, [0, 20], [120, 0], { extrapolateRight: 'clamp' });
  const blur = interpolate(frame, [0, 10], [8, 0]);
  return (
    <Series>
      <Series.Sequence durationInFrames={40}>
        <AbsoluteFill style={{ filter: \`blur(\${blur}px)\` }}>
          <svg><path strokeDashoffset={dash} strokeDasharray="120" d="M0 0 L40 40" /></svg>
          <Audio src={staticFile('vo-0.mp3')} />
        </AbsoluteFill>
      </Series.Sequence>
      <Series.Sequence durationInFrames={30}>
        <AbsoluteFill style={{ clipPath: 'inset(0 0 0 0)' }}>
          {'标题'.split('').map((ch, i) => <span key={i} style={{ transform: \`translateY(\${(1-s)*20}px)\` }}>{ch}</span>)}
        </AbsoluteFill>
      </Series.Sequence>
    </Series>
  );
};
`
    const beats = [
      { job: 'how', skill: 'diagram-animation' as const },
      { job: 'title', skill: 'kinetic-typography' as const },
    ]
    const ids = ['explainer-video', 'diagram-animation', 'kinetic-typography'] as const
    const a = scoreSkillDepth(shallow, [...ids], beats)
    const b = scoreSkillDepth(deep, [...ids], beats)
    expect(b.score).toBeGreaterThan(a.score)
    expect(b.ok).toBe(true)
  })
})
