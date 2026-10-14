import { describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readSkillPack } from '../../packages/create-core/src/llm'
import {
  codegenSkillIds,
  craftSkillIds,
  normalizeSkillPlan,
} from '../../packages/create-core/src/make/skillPlan'
import {
  HARD_COMPANIONS,
  resolveCompanions,
  techniqueCraftIds,
} from '../../packages/create-core/src/skills/skillCompanion'
import { SOFT_CRAFT_SKILLS, assertSkillsInTsx } from '../../packages/create-core/src/skills/registry'
import { scoreSkillDepth } from '../../packages/create-core/src/skills/skillDepth'
import { assertFilmCraftDensity, assertLabeledSteps, assertLayoutVariety } from '../../packages/create-core/src/make/craftFloor'
import { validateDirectedTsx } from '../../packages/create-core/src/make/remotionCodegen'
import {
  beatIndexForFrame,
  beatHoldFrames,
  beatsForStillVerify,
  stillIssuesNeedCodeRepair,
  verifyStillSkillBeats,
} from '../../packages/create-core/src/skills/skillStillVerify'

describe('P0 companions + brand slots', () => {
  it('HARD_COMPANIONS cover key film types', () => {
    for (const id of [
      'explainer-video',
      'launch-video',
      'logo-animation',
      'short-form-video',
      'presentation-video',
    ] as const) {
      expect(HARD_COMPANIONS[id]?.technique?.length).toBeGreaterThan(0)
    }
  })

  it('launch technique cap ≤2; brand never steals seats', () => {
    const { technique, brand } = resolveCompanions('launch-video', [
      'kinetic-typography',
      'diagram-animation',
      'caption-animation',
      'brand-motion-guidelines',
    ])
    expect(technique.length).toBeLessThanOrEqual(2)
    expect(technique).toContain('kinetic-typography')
    expect(technique).toContain('soundtrack')
    expect(brand).toContain('brand-motion-guidelines')
    expect(technique).not.toContain('brand-motion-guidelines')
  })

  it('explainer prefers LLM leaf techniques; caption is not forced', () => {
    const { technique } = resolveCompanions('explainer-video', [
      'chart-animation',
      'whiteboard-animation',
      'caption-animation',
    ])
    expect(technique).toContain('chart-animation')
    expect(technique).toContain('whiteboard-animation')
    expect(technique).not.toContain('caption-animation')
    expect(technique.length).toBeGreaterThanOrEqual(2)
    expect(technique.length).toBeLessThanOrEqual(4)
  })

  it('logo plan: svg in technique, brand in brandSkills', () => {
    const plan = normalizeSkillPlan(
      {
        primary: 'logo-animation',
        support: [],
        coreIdea: 'Acme mark',
        beats: [
          {
            job: 'geo',
            vo: '',
            headline: '',
            visualIntent: 'geometry tease',
            keyMotion: 'orbit',
            skill: 'logo-animation',
            durationSec: 1.2,
          },
          {
            job: 'draw',
            vo: '',
            headline: '',
            visualIntent: 'stroke draw-on',
            keyMotion: 'strokeDash',
            skill: 'logo-animation',
            durationSec: 1.4,
          },
          {
            job: 'assemble',
            vo: '',
            headline: '',
            visualIntent: 'assemble mark',
            keyMotion: 'spring',
            skill: 'logo-animation',
            durationSec: 1.0,
          },
          {
            job: 'settle',
            vo: '',
            headline: '',
            visualIntent: 'settle lockup',
            keyMotion: 'settle',
            skill: 'logo-animation',
            durationSec: 1.0,
          },
          {
            job: 'hold',
            vo: '',
            headline: '',
            visualIntent: 'hold settled mark',
            keyMotion: 'hold',
            skill: 'logo-animation',
            durationSec: 0.8,
          },
        ],
      },
      '16:9',
      undefined,
      { contentLang: 'zh', filmKind: 'logo', sourcePrompt: '做一条 Acme Logo 动画' },
    )
    expect(plan.support).toContain('svg-animation')
    expect(plan.support).not.toContain('brand-motion-guidelines')
    expect(plan.brandSkills).toContain('brand-motion-guidelines')
    expect(plan.brandSkills).toContain('video-delivery-specs')
    const craft = craftSkillIds(plan)
    expect(craft).toContain('logo-animation')
    expect(craft).toContain('svg-animation')
    expect(craft).not.toContain('brand-motion-guidelines')
    const codegen = codegenSkillIds(plan)
    expect(codegen).toContain('brand-motion-guidelines')
    expect(SOFT_CRAFT_SKILLS).toContain('brand-motion-guidelines')
    expect(SOFT_CRAFT_SKILLS).not.toContain('svg-animation')
    expect(SOFT_CRAFT_SKILLS).not.toContain('diagram-animation')
  })

  it('techniqueCraftIds = primary + technique only', () => {
    expect(techniqueCraftIds('explainer-video', ['diagram-animation', 'caption-animation'])).toEqual([
      'explainer-video',
      'diagram-animation',
      'caption-animation',
    ])
  })
})

describe('film craft density (beat old thin HUD films)', () => {
  it('rejects chrome spam + thin ActiveDirected on long explainers', () => {
    const hud = `
import { AbsoluteFill, Series, spring, useCurrentFrame, Audio, staticFile } from 'remotion';
import type { DirectedProps } from '../directedSchema';
export const ActiveDirected: React.FC<DirectedProps> = (props) => {
  const frame = useCurrentFrame();
  const s = spring({ frame, fps: 30, config: { damping: 12 } });
  return (
    <AbsoluteFill>
      <Series>
        {(props.scenes||[]).map((sc,i)=>(
          <Series.Sequence key={i} durationInFrames={60}>
            <AbsoluteFill>
              <div>REC</div><div>CAM 01</div><div>TC 00:00:01:00</div><div>LAB - B4</div>
              <div style={{ transform: \`scale(\${s})\` }}>{sc.headline}</div>
              <Audio src={staticFile('a.mp3')} />
            </AbsoluteFill>
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
`
    const dens = assertFilmCraftDensity(hud, {
      sceneCount: 12,
      skillIds: ['explainer-video', 'diagram-animation', 'kinetic-typography'],
    })
    expect(dens.some((i) => /chrome spam|craft density|diagram|kinetic/i.test(i))).toBe(true)
    const v = validateDirectedTsx(
      hud,
      ['explainer-video', 'diagram-animation', 'kinetic-typography'],
      'zh',
      '16:9',
      12,
    )
    expect(v.some((i) => /chrome spam|craft density|diagram|kinetic|reveal/i.test(i))).toBe(true)
  })

  it('rejects top-left title sandwich and empty 01–N shells', () => {
    const beats = Array.from({ length: 12 }, (_, i) => `
      <div style={{ left: 96, top: ${60 + (i % 3) * 4} }}>T${i}</div>
      <div>0{i + 1}</div>
    `).join('\n')
    const sandwich = `
import { AbsoluteFill, Series, spring } from 'remotion';
import type { DirectedProps } from '../directedSchema';
export const ActiveDirected: React.FC<DirectedProps> = () => {
  const s = spring({ frame: 1, fps: 30, config: { damping: 12 } });
  return <AbsoluteFill><Series>${beats}<div style={{ transform: \`scale(\${s})\` }} /></Series></AbsoluteFill>;
};
`
    expect(assertLayoutVariety(sandwich, 12).join(' ')).toMatch(/layout sandwich/)
    expect(assertLabeledSteps(`{Array.from({ length: 5 }).map((_, i) => <div>0{i + 1}<span>模块</span></div>)}`).join(' ')).toMatch(/numbered shells/)
    expect(assertLabeledSteps(`const labels = ['分析','分镜','渲染','配音','封装']; Array.from({ length: 5 }).map((_, i) => <div>0{i + 1}{labels[i]}</div>)`)).toEqual([])
    const split = `
import { AbsoluteFill, Series, spring } from 'remotion';
export const ActiveDirected = () => {
  const s = spring({ frame: 1, fps: 30, config: { damping: 12 } });
  return <AbsoluteFill style={{ left: 80 }}><div style={{ left: 980, top: 200 }}>right</div></AbsoluteFill>;
};
`
    expect(assertLayoutVariety(split, 12)).toEqual([])
  })
})

describe('P1 readSkillPack', () => {
  it('prioritizes primary craft and keeps technique cores', () => {
    const pack = readSkillPack({
      primary: 'explainer-video',
      technique: ['diagram-animation', 'caption-animation'],
      brand: ['brand-motion-guidelines'],
      budget: 12000,
    })
    expect(pack.length).toBeGreaterThan(2000)
    expect(pack).toMatch(/SKILL:\s*explainer-video/i)
    expect(pack).toMatch(/diagram-animation/i)
    expect(pack.length).toBeLessThanOrEqual(12000 + 80)
  })
})

describe('P0 soft-accept ban (unit)', () => {
  it('shallow kinetic fails depth; craft gate catches missing technique', () => {
    const shallow = `
import { AbsoluteFill, useCurrentFrame, spring, Series, Sequence, Audio, staticFile } from 'remotion';
export const ActiveDirected: React.FC<any> = (props) => {
  const frame = useCurrentFrame();
  const y = spring({ frame, fps: 30, config: { damping: 20 } });
  return (
    <AbsoluteFill>
      <Series>
        <Series.Sequence durationInFrames={90}>
          <AbsoluteFill style={{ transform: \`translateY(\${(1-y)*40}px)\` }}>title</AbsoluteFill>
          <Audio src={staticFile('vo-0.mp3')} />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
`
    const craft = ['explainer-video', 'diagram-animation', 'kinetic-typography'] as const
    const gate = assertSkillsInTsx([...craft], shallow, { hardIds: [...craft] })
    expect(gate.ok).toBe(false)
    expect(gate.issues.some((i) => /diagram|kinetic/i.test(i))).toBe(true)
    const depth = scoreSkillDepth(shallow, [...craft], [
      { job: 'a', skill: 'diagram-animation' },
      { job: 'b', skill: 'kinetic-typography' },
    ])
    expect(depth.ok).toBe(false)
  })
})

describe('P2 still skill verify', () => {
  it('maps frames to beats with remotion mid-hold heuristic', () => {
    const beats = [
      { durationSec: 2 },
      { durationSec: 3 },
      { durationSec: 2 },
    ]
    const holds = beatHoldFrames(beats, 30)
    expect(holds).toHaveLength(3)
    expect(beatIndexForFrame(holds[0], beats, 30)).toBe(0)
    expect(beatIndexForFrame(holds[1], beats, 30)).toBe(1)
    expect(beatIndexForFrame(holds[2], beats, 30)).toBe(2)
  })

  it('prefers scene durations over plan defaults', () => {
    const aligned = beatsForStillVerify(
      [
        { skill: 'a', durationSec: 2.5, job: 'h' },
        { skill: 'b', durationSec: 2.5, job: 'i' },
      ],
      [{ durationSec: 4.2 }, { durationSec: 6.1 }],
    )
    expect(aligned[0].durationSec).toBe(4.2)
    expect(aligned[1].durationSec).toBe(6.1)
  })

  it('does not hard-fail long films on sparse sample coverage', () => {
    const dir = join(tmpdir(), `bn-still-cover-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    try {
      // 22 beats × ~4s ≈ real VO timeline; 8 mid samples + end holds
      const planBeats = Array.from({ length: 22 }, (_, i) => ({
        skill: i % 3 === 0 ? 'diagram-animation' : i % 3 === 1 ? 'caption-animation' : 'kinetic-typography',
        job: `b${i}`,
      }))
      const scenes = planBeats.map(() => ({ durationSec: 4 }))
      const beats = beatsForStillVerify(planBeats, scenes)
      const holds = beatHoldFrames(beats, 30)
      const totalFrames = Math.round(22 * 4 * 30)
      const unique = [...new Set([...holds, totalFrames - 1])]
      const sample =
        unique.length <= 8
          ? unique
          : [unique[0], ...unique.filter((_, i) => i % 2 === 0).slice(1, -1), unique[unique.length - 1]]
      sample.forEach((frame, i) => {
        writeFileSync(join(dir, `f-${i}-frame${frame}.png`), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
      })

      const goodTsx = `
import { AbsoluteFill, useCurrentFrame, Series, Sequence, Audio, staticFile, spring } from 'remotion';
export const ActiveDirected = () => {
  const frame = useCurrentFrame();
  const nodes = [1,2];
  const words = 'hello'.split('');
  return (
    <AbsoluteFill>
      <Series>
        <Series.Sequence durationInFrames={60}>
          <svg><path strokeDasharray="1" /></svg>
          {nodes.map((n) => <div key={n} />)}
          {words.map((w,i) => <span key={i} style={{ transform: \`translateY(\${i}px)\` }}>{w}</span>)}
          <div className="caption karaoke activeWord" />
          <Audio src={staticFile('a.mp3')} />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
`
      const report = verifyStillSkillBeats({
        stillsDir: dir,
        tsx: goodTsx,
        beats,
        craftIds: ['explainer-video', 'diagram-animation', 'caption-animation'],
      })
      expect(report.coveredBeats).toBeGreaterThanOrEqual(2)
      expect(report.ok).toBe(true)
      expect(stillIssuesNeedCodeRepair(report)).toBe(false)
      // coverage note may exist as soft, but must not hard-block
      expect(report.hardIssues.filter((i) => /coverage/i.test(i))).toHaveLength(0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('hard-fails when wrong durations collapse all stills onto last beat', () => {
    const dir = join(tmpdir(), `bn-still-collapse-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    try {
      // Frames from a long film, but beats claim short 2.5s each → collapse
      writeFileSync(join(dir, 'f-0-frame57.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
      writeFileSync(join(dir, 'f-1-frame1807.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
      writeFileSync(join(dir, 'f-2-frame2082.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
      writeFileSync(join(dir, 'f-3-frame2315.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
      writeFileSync(join(dir, 'f-4-frame2525.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
      writeFileSync(join(dir, 'f-5-frame2695.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))

      const shortBeats = Array.from({ length: 22 }, (_, i) => ({
        skill: 'kinetic-typography',
        durationSec: 2.5,
        job: `b${i}`,
      }))
      const report = verifyStillSkillBeats({
        stillsDir: dir,
        tsx: `
import { AbsoluteFill, useCurrentFrame, Series, Sequence, Audio, staticFile, spring } from 'remotion';
export const ActiveDirected = () => {
  const frame = useCurrentFrame();
  const words = 'hi'.split('');
  return <AbsoluteFill><Series><Series.Sequence durationInFrames={30}>{words.map((w,i)=><span key={i}>{w}</span>)}<Audio src={staticFile('a.mp3')} /></Series.Sequence></Series></AbsoluteFill>;
};
`,
        beats: shortBeats,
        craftIds: ['explainer-video', 'kinetic-typography'],
      })
      expect(report.ok).toBe(false)
      expect(report.hardIssues.some((i) => /collapsed|coverage/i.test(i))).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('fails when leaf craft fingerprint missing; passes when present', () => {
    const dir = join(tmpdir(), `bn-still-skill-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    try {
      // frames at mid of beat0 / beat1 / beat2
      writeFileSync(join(dir, 'f-0-frame27.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
      writeFileSync(join(dir, 'f-1-frame95.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
      writeFileSync(join(dir, 'f-2-frame170.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))

      const beats = [
        { skill: 'explainer-video', durationSec: 2, job: 'hook' },
        { skill: 'diagram-animation', durationSec: 3, job: 'how' },
        { skill: 'kinetic-typography', durationSec: 2, job: 'payoff' },
      ]
      const craft = ['explainer-video', 'diagram-animation', 'kinetic-typography'] as const

      const miss = verifyStillSkillBeats({
        stillsDir: dir,
        tsx: `
import { AbsoluteFill, useCurrentFrame, Series, Sequence, Audio, staticFile, spring } from 'remotion';
export const ActiveDirected = () => {
  const frame = useCurrentFrame();
  return <AbsoluteFill><Series><Series.Sequence durationInFrames={60}><Audio src={staticFile('a.mp3')} /></Series.Sequence></Series></AbsoluteFill>;
};
`,
        beats,
        craftIds: [...craft],
      })
      expect(miss.ok).toBe(false)
      expect(miss.hardIssues.some((i) => /diagram|kinetic/i.test(i))).toBe(true)
      expect(stillIssuesNeedCodeRepair(miss)).toBe(true)

      const hit = verifyStillSkillBeats({
        stillsDir: dir,
        tsx: `
import { AbsoluteFill, useCurrentFrame, Series, Sequence, Audio, staticFile, spring, interpolate } from 'remotion';
export const ActiveDirected = () => {
  const frame = useCurrentFrame();
  const nodes = [{id:1},{id:2}];
  const words = 'hello world'.split(' ');
  return (
    <AbsoluteFill>
      <Series>
        <Series.Sequence durationInFrames={60}>
          <svg><path strokeDasharray="1" /></svg>
          {nodes.map((n,i) => <div key={n.id} style={{ opacity: spring({frame, fps:30}) }} />)}
          {words.map((w,i) => <span key={i} style={{ transform: \`translateY(\${i}px)\` }}>{w}</span>)}
          <Audio src={staticFile('a.mp3')} />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
`,
        beats,
        craftIds: [...craft],
      })
      expect(hit.ok).toBe(true)
      expect(hit.mapped.length).toBe(3)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
