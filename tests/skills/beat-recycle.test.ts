import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  assertBeatLayouts,
  assertNoSkillIdCopy,
  assertScreenAssetsDrawn,
} from '../../packages/create-core/src/make/craftFloor'
import { assertSpringFps, validateDirectedTsx } from '../../packages/create-core/src/make/remotionCodegen'
import { sumSceneFrames } from '../../packages/create-core/src/make/sceneFrames'

const NAMES = Array.from({ length: 12 }, (_, i) => `B${i}Beat`)

function shell(body: string) {
  return `
import { AbsoluteFill, Audio, Img, Series, interpolate, spring, staticFile, useCurrentFrame } from 'remotion';
import type { DirectedProps } from '../directedSchema';
export const ActiveDirected: React.FC<DirectedProps> = (props) => {
  const frame = useCurrentFrame();
  const s = spring({ frame, fps: 30, config: { damping: 12 } });
  const y = interpolate(s, [0, 1], [40, 0]);
  const wipe = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const soft = interpolate(frame, [0, 10], [6, 0], { extrapolateRight: 'clamp' });
  ${body}
  return (
    <AbsoluteFill style={{ background: props.canvas }}>
      <Series>
        {(props.scenes || []).map((scene, i) => (
          <Series.Sequence key={i} durationInFrames={90}>
            <AbsoluteFill style={{ transform: \`translateY(\${y}px)\`, filter: \`blur(\${soft}px)\`, clipPath: \`inset(0 \${(1 - wipe) * 100}% 0 0)\` }}>
              <div>{scene.headline}</div>
            </AbsoluteFill>
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
`
}

describe('beat layout recycle gate', () => {
  it('rejects a short BEATS registry indexed with modulo', () => {
    const src = shell(`
      const BEATS = [${NAMES.join(', ')}];
      const Beat = BEATS[i % BEATS.length];
    `)
    const issues = assertBeatLayouts(src, 21)
    expect(issues.some((i) => i.startsWith('beat recycle'))).toBe(true)
    const gated = validateDirectedTsx(src, ['explainer-video', 'kinetic-typography'], 'zh', '16:9', 21)
    expect(gated.some((i) => i.startsWith('beat recycle'))).toBe(true)
  })

  it('accepts one component per scene', () => {
    const full = Array.from({ length: 21 }, (_, i) => `B${i}Beat`)
    const src = shell(`const BEATS = [${full.join(', ')}];`)
    expect(assertBeatLayouts(src, 21)).toEqual([])
  })

  it('ignores object-literal beat tables', () => {
    const rows = Array.from({ length: 4 }, (_, i) => `{ job: 'b${i}' }`)
    const src = shell(`const BEATS = [${rows.join(', ')}];`)
    expect(assertBeatLayouts(src, 21)).toEqual([])
  })
})

describe('skill id copy and screen assets', () => {
  it('rejects a skill-id list painted as copy', () => {
    const src = shell(`
      const skills = ['explainer-video', 'stickman-animation', 'diagram-animation'];
    `)
    expect(assertNoSkillIdCopy(src).some((i) => i.startsWith('skill ids on screen'))).toBe(true)
  })

  it('allows a single skill comparison', () => {
    const src = shell(`const on = scene.skill === 'diagram-animation';`)
    expect(assertNoSkillIdCopy(src)).toEqual([])
  })

  it('requires each uploaded file next to <Img>', () => {
    const file = 'assets/ScreenShot_2026-10-11_15-8abf5399.png'
    const bare = shell(`const shots = (props.assets || []).map((a) => a.file);`)
    expect(assertScreenAssetsDrawn(bare, [file])[0]).toMatch(/screen assets/)
    const drawn = shell(`<Img src={staticFile('${file}')} />`)
    expect(assertScreenAssetsDrawn(drawn, [file])).toEqual([])
  })
})

describe('spring fps', () => {
  it('rejects passing the current frame as fps', () => {
    const bad = 'const lockP = sp(frame, frame, 66); spring({ frame, fps: frame });'
    expect(assertSpringFps(bad).some((i) => i.startsWith('spring fps'))).toBe(true)
    const ok = 'const { fps } = useVideoConfig(); spring({ frame: Math.max(0, frame - 1), fps, config: { damping: 12 } });'
    expect(assertSpringFps(ok)).toEqual([])
  })
})

describe('scene frame sum', () => {
  it('rounds each scene before summing so the tail frame stays inside the series', () => {
    const scenes = [{ durationSec: 1.016 }, { durationSec: 1.016 }]
    const summedThenRounded = Math.round((1.016 + 1.016) * 30)
    expect(sumSceneFrames(scenes, 30)).toBe(60)
    expect(summedThenRounded).toBe(61)
  })
})

describe('latest thin explainer', () => {
  const tsxPath = join(
    process.cwd(),
    'outputs/2026-10-11-directed-primary-skill-explainer--x7xx/ActiveDirected.tsx',
  )

  it('fails the recycle and asset gates', () => {
    if (!existsSync(tsxPath)) return
    const src = readFileSync(tsxPath, 'utf8')
    const issues = validateDirectedTsx(
      src,
      ['explainer-video', 'stickman-animation', 'diagram-animation', 'kinetic-typography'],
      'zh',
      '16:9',
      21,
      [
        'assets/ScreenShot_2026-10-11_15-8abf5399.png',
        'assets/ScreenShot_2026-10-11_15-27450833.png',
        'assets/ScreenShot_2026-10-11_15-a31537a7.png',
        'assets/ScreenShot_2026-10-11_15-4553219b.png',
      ],
    )
    expect(issues.some((i) => i.startsWith('beat recycle'))).toBe(true)
    expect(issues.some((i) => i.startsWith('screen assets'))).toBe(true)
    expect(issues.some((i) => i.startsWith('skill ids on screen'))).toBe(true)
  })
})
