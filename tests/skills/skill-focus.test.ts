import { describe, expect, it } from 'vitest'
import {
  craftSkillIds,
  codegenSkillIds,
  normalizeSkillPlan,
} from '../../packages/create-core/src/make/skillPlan'
import { assertSkillsInTsx } from '../../packages/create-core/src/skills/registry'
import { validateDirectedTsx } from '../../packages/create-core/src/make/remotionCodegen'

describe('skill focus (fewer skills, softer craft gates)', () => {
  it('caps support at 2 and keeps chassis out of craft ids', () => {
    const plan = normalizeSkillPlan(
      {
        primary: 'explainer-video',
        support: [
          'kinetic-typography',
          'diagram-animation',
          'caption-animation',
          'color-motion',
          'motion-art-direction',
        ],
        coreIdea: 'sky is blue',
        beats: [
          {
            job: 'hook',
            vo: '天空为什么是蓝的',
            headline: '蓝天',
            visualIntent: 'prism splits white light into spectrum band',
            keyMotion: 'spectrum unfurls',
            skill: 'diagram-animation',
          },
          {
            job: 'how',
            vo: '分子把短波蓝光散射开',
            headline: '散射',
            visualIntent: 'molecules scatter blue rays outward',
            keyMotion: 'rays burst',
            skill: 'diagram-animation',
          },
          {
            job: 'point',
            vo: '长波红光几乎直穿',
            headline: '红光',
            visualIntent: 'red beam drives straight through',
            keyMotion: 'beam straight',
            skill: 'kinetic-typography',
          },
          {
            job: 'payoff',
            vo: '所以你看见整片蓝天',
            headline: '答案',
            visualIntent: 'dome fills blue',
            keyMotion: 'dome seals',
            skill: 'kinetic-typography',
          },
        ],
      },
      '16:9',
      undefined,
      { contentLang: 'zh', sourcePrompt: '为什么天空是蓝色的' },
    )

    expect(plan.support.length).toBeLessThanOrEqual(2)
    expect(plan.support).not.toContain('motion-art-direction')
    const craft = craftSkillIds(plan)
    expect(craft).toEqual([plan.primary, ...plan.support])
    expect(craft).not.toContain('shot-composition')
    expect(codegenSkillIds(plan)).toContain('remotion-video')
    expect(codegenSkillIds(plan).length).toBeLessThanOrEqual(4)
  })

  it('does not hard-fail on missing 72px / depth layers', () => {
    const tsx = `
import { AbsoluteFill, Audio, Series, interpolate, useCurrentFrame, spring, staticFile } from 'remotion';
import type { DirectedProps } from '../directedSchema';
export const ActiveDirected: React.FC<DirectedProps> = (props) => {
  const frame = useCurrentFrame();
  const s = spring({ frame, fps: 30, config: { damping: 12 } });
  const y = interpolate(s, [0, 1], [40, 0]);
  const wipe = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const soft = interpolate(frame, [0, 15], [8, 0], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: props.canvas }}>
      <Series>
        {(props.scenes || []).map((scene, i) => (
          <Series.Sequence key={i} durationInFrames={90}>
            {scene.narrationFile ? <Audio src={staticFile(scene.narrationFile)} /> : null}
            <AbsoluteFill style={{ opacity: s, transform: \`translateY(\${y}px) scale(\${0.9 + s * 0.1})\` }}>
              <div style={{ fontSize: 48, color: props.ink, filter: \`blur(\${soft}px)\`, clipPath: \`inset(0 \${(1 - wipe) * 100}% 0 0)\` }}>{scene.headline}</div>
              <svg width="400" height="200"><path d="M0 0" strokeDasharray="1" /></svg>
            </AbsoluteFill>
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
`
    const issues = validateDirectedTsx(tsx, ['explainer-video', 'diagram-animation'], 'zh', '16:9', 4)
    expect(issues.some((i) => /72px|depth|AbsoluteFills/i.test(i))).toBe(false)
    expect(issues.some((i) => i.startsWith('reveal families'))).toBe(false)
    const gate = assertSkillsInTsx(
      ['explainer-video', 'diagram-animation', 'remotion-video', 'shot-composition'],
      tsx,
      { hardIds: ['explainer-video', 'diagram-animation'] },
    )
    expect(gate.ok).toBe(true)
  })
})
