import { describe, expect, it } from 'vitest'
import {
  assertRevealFamilyRotation,
  detectRevealFamilies,
  minRevealFamilies,
  revealFamilyHardRules,
} from '../../packages/create-core/src/make/craftFloor'
import { validateDirectedTsx } from '../../packages/create-core/src/make/remotionCodegen'

const LAZY_SPRING = `
import { AbsoluteFill, Series, spring, useCurrentFrame } from 'remotion';
import type { DirectedProps } from '../directedSchema';
export const ActiveDirected: React.FC<DirectedProps> = (props) => {
  const frame = useCurrentFrame();
  const s = spring({ frame, fps: 30, config: { damping: 12 } });
  const y = (1 - s) * 40;
  return (
    <AbsoluteFill style={{ background: props.canvas }}>
      <Series>
        {(props.scenes || []).map((scene, i) => (
          <Series.Sequence key={i} durationInFrames={90}>
            <AbsoluteFill style={{ transform: \`translateY(\${y}px)\` }}>
              <div style={{ fontSize: 64, color: props.ink }}>{scene.headline}</div>
            </AbsoluteFill>
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
`

const RICH_ROTATION = `
import { AbsoluteFill, Series, interpolate, spring, useCurrentFrame } from 'remotion';
import type { DirectedProps } from '../directedSchema';
export const ActiveDirected: React.FC<DirectedProps> = (props) => {
  const frame = useCurrentFrame();
  const s = spring({ frame, fps: 30, config: { damping: 12 } });
  const y = interpolate(s, [0, 1], [40, 0]);
  const wipe = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const soft = interpolate(frame, [0, 10], [6, 0], { extrapolateRight: 'clamp' });
  const sc = interpolate(s, [0, 1], [1.2, 1]);
  return (
    <AbsoluteFill style={{ background: props.canvas }}>
      <Series>
        {(props.scenes || []).map((scene, i) => (
          <Series.Sequence key={i} durationInFrames={90}>
            <AbsoluteFill>
              <div style={{
                fontSize: 80,
                color: props.ink,
                transform: \`translateY(\${y}px) scale(\${sc})\`,
                filter: \`blur(\${soft}px)\`,
                clipPath: \`inset(0 \${(1 - wipe) * 100}% 0 0)\`,
                maskImage: 'linear-gradient(90deg, #000 0%, transparent 100%)',
              }}>{scene.headline}</div>
            </AbsoluteFill>
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
`

describe('reveal family rotation', () => {
  it('detects mask / blur / clip / slam markers', () => {
    expect(detectRevealFamilies(LAZY_SPRING)).toEqual(['slam'])
    const rich = detectRevealFamilies(RICH_ROTATION)
    expect(rich).toContain('slam')
    expect(rich).toContain('blur')
    expect(rich).toContain('clip')
    expect(rich).toContain('mask')
  })

  it('requires ≥3 families for 6+ scene films', () => {
    expect(minRevealFamilies({ sceneCount: 6 })).toBe(3)
    expect(assertRevealFamilyRotation(LAZY_SPRING, { sceneCount: 6 }).length).toBeGreaterThan(0)
    expect(assertRevealFamilyRotation(RICH_ROTATION, { sceneCount: 6 })).toEqual([])
  })

  it('hard-fails validateDirectedTsx on spring+translateY-only', () => {
    const issues = validateDirectedTsx(
      LAZY_SPRING,
      ['short-form-video', 'kinetic-typography'],
      'en',
      '9:16',
      8,
    )
    expect(issues.some((i) => i.startsWith('reveal families'))).toBe(true)
  })

  it('passes validateDirectedTsx when families rotate', () => {
    const issues = validateDirectedTsx(
      RICH_ROTATION,
      ['short-form-video', 'kinetic-typography'],
      'en',
      '9:16',
      8,
    )
    expect(issues.some((i) => i.startsWith('reveal families'))).toBe(false)
  })

  it('skips reveal gate for logo sting craft', () => {
    expect(minRevealFamilies({ craftKind: 'logo', sceneCount: 6 })).toBe(0)
    expect(assertRevealFamilyRotation(LAZY_SPRING, { craftKind: 'logo', sceneCount: 6 })).toEqual([])
  })

  it('emits hard rules for codegen prompts', () => {
    const rules = revealFamilyHardRules(8)
    expect(rules).toMatch(/mask/)
    expect(rules).toMatch(/blur/)
    expect(rules).toMatch(/clip/)
    expect(rules).toMatch(/slam/)
    expect(rules).toMatch(/≥3/)
  })
})
