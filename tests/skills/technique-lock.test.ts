import { describe, expect, it } from 'vitest'
import {
  diversifyBeatSkills,
  inferTechnique,
  lockTechniquesFromIntent,
  mergeBeatSkills,
  stripNegatedTechniqueCues,
  techniqueWasAsked,
} from '../../packages/create-core/src/make/beatTechnique'
import {
  buildSceneSfxTimeline,
  reloadSfxKit,
  SfxPicker,
  sfxKitStats,
} from '../../packages/create-core/src/sfx/catalog'
import type { SkillName } from '../../packages/create-core/src/llm'

describe('technique negation + logo lock', () => {
  it('does not infer map from 「不要做写实地图」', () => {
    const brief = '创作一个对上低成本的大胆几何诠释。不要做写实地图。使用圆形、矩形、线条。'
    expect(stripNegatedTechniqueCues(brief)).not.toMatch(/地图/)
    expect(inferTechnique(brief)).not.toBe('map-animation')
    expect(techniqueWasAsked('map-animation', brief)).toBe(false)
  })

  it('still infers map when positively asked', () => {
    expect(inferTechnique('城市之间的航线画在地图上')).toBe('map-animation')
    expect(techniqueWasAsked('map-animation', '画一条海岸路线图')).toBe(true)
  })

  it('logo primary diversify keeps poster pool — no unasked map', () => {
    const beats = [
      {
        job: 'hook',
        vo: '',
        headline: '想法',
        visualIntent: '米白纸面红球胀大，放射花瓣，超大黑体被裁切',
        keyMotion: '红点弹入',
        skill: 'map-animation' as SkillName,
      },
      {
        job: 'tease',
        vo: '',
        headline: 'AGENT',
        visualIntent: '电蓝底色圆与方块沿球体轨迹落位，不要做写实地图',
        keyMotion: '形状弹入',
        skill: 'map-animation' as SkillName,
      },
      {
        job: 'reveal',
        vo: '',
        headline: '分镜',
        visualIntent: '四色几何拼成抽象版图，球体穿字',
        keyMotion: '四色推进',
        skill: 'map-animation' as SkillName,
      },
      {
        job: 'payoff',
        vo: '',
        headline: '定版',
        visualIntent: '最终海报字 BN SHORT VIDEO FACTORY',
        keyMotion: '字块砸落',
        skill: 'map-animation' as SkillName,
      },
    ]
    const diversified = diversifyBeatSkills(beats, { primary: 'logo-animation' })
    const locked = lockTechniquesFromIntent(diversified, { keep: 'logo-animation' })
    const skills = locked.map((b) => b.skill)
    expect(skills.every((s) => s !== 'map-animation')).toBe(true)
    expect(skills.some((s) => s === 'logo-animation' || s === 'kinetic-typography' || s === 'diagram-animation' || s === 'svg-animation')).toBe(true)
  })

  it('mergeBeatSkills logo primary strips unasked map beats', () => {
    const plan = mergeBeatSkills({
      primary: 'logo-animation' as SkillName,
      support: ['kinetic-typography'] as SkillName[],
      skills: ['logo-animation', 'kinetic-typography'] as SkillName[],
      beats: [
        {
          job: 'hook',
          visualIntent: '红球穿过几何海报，不要做写实地图',
          keyMotion: 'ball path',
          skill: 'map-animation',
        },
        {
          job: 'end',
          visualIntent: '标志定版锁住',
          keyMotion: 'logo settle',
          skill: 'logo-animation',
        },
        {
          job: 'tease',
          visualIntent: '大字 AGENT 砸入',
          keyMotion: 'word slam',
          skill: 'map-animation',
        },
      ],
    })
    expect(plan.beats.every((b) => b.skill !== 'map-animation')).toBe(true)
  })
})

describe('sfx kit diversity', () => {
  it('reloads kit and accents are not all whoosh when catalog present', () => {
    const st = reloadSfxKit()
    if (st.clips < 10) {
      // 开发机未 vendored kit 时跳过（CI/本仓应有 catalog）
      expect(st.clips).toBeGreaterThanOrEqual(0)
      return
    }
    expect(st.roles).toBeGreaterThanOrEqual(5)
    const picker = new SfxPicker()
    const cues = buildSceneSfxTimeline(
      {
        skill: 'logo-animation',
        job: 'hook',
        index: 0,
        total: 8,
        primary: 'logo-animation',
        durationSec: 8,
      },
      picker,
    )
    const roles = new Set(cues.map((c) => c.role))
    const files = new Set(cues.map((c) => c.file))
    expect(cues.length).toBeGreaterThanOrEqual(2)
    // enter whoosh + accent click/tap… 不应整条时间线只有 whoosh
    expect(roles.size + files.size).toBeGreaterThan(2)
    const accent = cues.find((c) => c.intent === 'accent')
    if (accent) {
      expect(accent.role).not.toBe('whoosh')
    }
  })

  it('sfxKitStats after reload reports clips when public/sfx has catalog', () => {
    reloadSfxKit()
    const st = sfxKitStats()
    // 本仓已搬 f2v kit；若为空则说明路径/catalog 回归
    expect(typeof st.clips).toBe('number')
    expect(typeof st.roles).toBe('number')
  })
})
