import { describe, expect, it } from 'vitest'
import {
  assertMotionSpansScene,
  assertSpringFps,
  repairSpringFps,
} from '../../packages/create-core/src/make/remotionCodegen'

describe('spring fps repair', () => {
  it('inserts fps when the call only has frame and config', () => {
    const src = `import { spring } from 'remotion';
const x = spring({
  frame,
  config: { damping: 12, stiffness: 80 },
});`
    const fixed = repairSpringFps(src)
    expect(fixed).toMatch(/fps:\s*useVideoConfig\(\)\.fps/)
    expect(fixed).toMatch(/useVideoConfig,/)
    expect(assertSpringFps(fixed)).toEqual([])
  })

  it('replaces fps: frame and keeps a nested config', () => {
    const src = `import { spring, useVideoConfig } from 'remotion';
const x = spring({ frame, fps: frame, config: { damping: 10 } });`
    const fixed = repairSpringFps(src)
    expect(fixed).not.toMatch(/fps:\s*frame/)
    expect(assertSpringFps(fixed)).toEqual([])
  })

  it('does not rewrite a call that already passes fps after config', () => {
    const src = `import { spring, useVideoConfig } from 'remotion';
const x = spring({
  frame,
  config: { damping: 12 },
  fps,
});`
    expect(assertSpringFps(src)).toEqual([])
    expect(repairSpringFps(src)).toBe(src)
  })
})

describe('motion span', () => {
  it('rejects a reveal that ends while a long line is still being read', () => {
    const src = `interpolate(frame, [0, 40], [0, 1]);
interpolate(frame, [0, durationInFrames], [1.0, 1.05]);`
    const issues = assertMotionSpansScene(src, [30.6])
    expect(issues.join(' ')).toMatch(/motion span/)
  })

  it('accepts a reveal paced to the spoken beat', () => {
    const src = `interpolate(frame, [0, durationInFrames * 0.8], [0, 1]);`
    expect(assertMotionSpansScene(src, [30.6])).toEqual([])
  })

  it('accepts frame divided by the beat length', () => {
    const src = `const p = Math.min(1, frame / (dur * 0.8));`
    expect(assertMotionSpansScene(src, [9])).toEqual([])
  })
})
