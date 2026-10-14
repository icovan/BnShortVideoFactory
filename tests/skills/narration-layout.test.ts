import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseTsxSyntaxIssues } from '../../packages/create-core/src/make/remotionCodegen'
import {
  GLYPH_IDS,
  NARRATION_LAYOUTS,
  bindNarrationScene,
  composeNarrationDirectedSource,
  glyphsFor,
  narrationLayoutIssues,
  pickNarrationLayout,
  usesNarrationLayouts,
} from '../../packages/create-core/src/make/narrationLayout'
import { narrationOccupancyIssues, occupancyIssues } from '../../packages/create-core/src/make/stillOccupancy'
import { verifyStillSkillBeats } from '../../packages/create-core/src/skills/skillStillVerify'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const filmSrc = readFileSync(join(root, 'packages/remotion-explainer/src/narration/NarrationFilm.tsx'), 'utf8')

describe('narration layouts', () => {
  it('keeps a named object on an object layout, and a flow only when the sentence is a flow', () => {
    const brush = bindNarrationScene({
      skill: 'diagram-animation',
      visualIntent: '一支画笔在纸上落下第一笔',
      headline: '第一笔',
      keyMotion: 'draw',
    })
    expect(brush.layout).toBe('object')
    expect(brush.glyphs).toContain('brush')

    const flow = pickNarrationLayout({
      skill: 'diagram-animation',
      visualIntent: '三个模块用连线串成流程图',
      headline: '流程',
    })
    expect(flow).toBe('flow')

    const route = pickNarrationLayout({
      skill: 'diagram-animation',
      visualIntent: '一条技术路线，从调研走到上线',
      headline: '路线',
    })
    expect(route).not.toBe('route')
    expect(route).toBe('object')

    expect(pickNarrationLayout({
      visualIntent: '航线从上海画到福冈',
      headline: '航线',
    })).toBe('route')

    expect(pickNarrationLayout({
      visualIntent: '四张分镜卡片铺开成草稿',
      headline: '分镜',
    })).toBe('deck')

    expect(pickNarrationLayout({
      visualIntent: '整块预览窗口，光标点保存再发布',
      headline: '预览',
    })).toBe('device')

    const pair = glyphsFor('骰子转一圈，齿轮跟着咬合')
    expect(pair).toEqual(['dice', 'gear'])
  })

  it('uses layouts for locked narration and leaves silent product films on codegen', () => {
    expect(usesNarrationLayouts({
      scriptDrive: 'verbatim',
      voMode: 'on',
      primary: 'explainer-video',
    })).toBe(true)
    expect(usesNarrationLayouts({
      scriptDrive: 'verbatim',
      voMode: 'off',
      primary: 'product-demo-video',
    })).toBe(false)
    expect(usesNarrationLayouts({
      scriptDrive: 'verbatim',
      voMode: 'on',
      primary: 'stickman-animation',
    })).toBe(false)
    expect(usesNarrationLayouts({
      scriptDrive: 'off',
      voMode: 'on',
      primary: 'explainer-video',
    })).toBe(false)
  })

  it('ships every layout and three-beat motion inside the hand-written film', () => {
    const tsx = composeNarrationDirectedSource()
    expect(tsx.length).toBeGreaterThanOrEqual(800)
    expect(narrationLayoutIssues(tsx, [{ layout: 'object' }, { layout: 'route' }, { layout: 'deck' }])).toEqual([])
    expect(parseTsxSyntaxIssues(tsx, 'ActiveDirected.tsx')).toEqual([])
    expect(parseTsxSyntaxIssues(filmSrc, 'NarrationFilm.tsx')).toEqual([])
    for (const id of NARRATION_LAYOUTS) expect(filmSrc).toContain(`'${id}'`)
    for (const id of GLYPH_IDS) expect(filmSrc).toContain(`'${id}'`)
    expect(filmSrc).toContain('durationInFrames * 0.8')
    expect(filmSrc).toContain('durationInFrames * 0.2')
    expect(filmSrc).toContain('durationInFrames * 0.5')
    expect(filmSrc).toContain('gridTemplateColumns')
    expect(filmSrc).toContain('fps,')
  })

  it('does not fail a layout film for missing diagram tokens', () => {
    const report = verifyStillSkillBeats({
      stillsDir: join(root, 'packages/remotion-explainer/src/narration'),
      tsx: composeNarrationDirectedSource(),
      beats: [
        { skill: 'diagram-animation', durationSec: 8, job: 'a' },
        { skill: 'kinetic-typography', durationSec: 6, job: 'b' },
      ],
      craftIds: ['explainer-video', 'diagram-animation', 'kinetic-typography'],
    })
    expect(report.hardIssues.some((i) => /fingerprint/i.test(i))).toBe(false)
  })

  it('rejects a center speck that the loose empty-frame gate would accept', () => {
    const speck = { inkRatio: 0.02, bboxWRatio: 0.28, bboxHRatio: 0.22 }
    expect(occupancyIssues(speck)).toEqual([])
    expect(narrationOccupancyIssues(speck)[0]).toMatch(/55%|42%|sparse/)
    expect(narrationOccupancyIssues({ inkRatio: 0.08, bboxWRatio: 0.7, bboxHRatio: 0.55 })).toEqual([])
  })
})
