import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  codegenSkillIds,
  normalizeSkillPlan,
} from '../../packages/create-core/src/make/skillPlan'
import {
  BRAND_CRAFT_SKILLS,
  SKILL_CONTRACTS,
  isSkillName,
} from '../../packages/create-core/src/skills/registry'
import { resolveSkillsDir } from '../../packages/create-core/src/skills/paths'

describe('brand motion wiring', () => {
  it('vendors brand + vector + launch craft skills', () => {
    const root = resolveSkillsDir()
    for (const id of [
      'brand-motion-guidelines',
      'video-delivery-specs',
      'svg-animation',
      'lottie-animation',
      'generative-illustration',
      'soundtrack',
      'gsap-web',
    ]) {
      expect(existsSync(join(root, id, 'SKILL.md')), id).toBe(true)
    }
    expect(existsSync(join(root, 'logo-animation', 'references', 'remotion-logo-craft.md'))).toBe(true)
    expect(existsSync(join(root, 'svg-animation', 'references', 'remotion-bridge.md'))).toBe(true)
  })

  it('registers new skill names', () => {
    expect(isSkillName('brand-motion-guidelines')).toBe(true)
    expect(isSkillName('video-delivery-specs')).toBe(true)
    expect(isSkillName('svg-animation')).toBe(true)
    expect(isSkillName('lottie-animation')).toBe(true)
    expect(isSkillName('generative-illustration')).toBe(true)
    expect(isSkillName('soundtrack')).toBe(true)
    expect(isSkillName('gsap-web')).toBe(true)
    expect(SKILL_CONTRACTS['logo-animation'].gates.length).toBeGreaterThanOrEqual(2)
    expect(BRAND_CRAFT_SKILLS).toContain('brand-motion-guidelines')
  })

  it('logo primary pulls brand craft into codegen ids', () => {
    const plan = normalizeSkillPlan(
      {
        primary: 'logo-animation',
        support: [],
        coreIdea: 'Acme mark',
        beats: [
          {
            job: 'geo-tease',
            vo: '',
            headline: '',
            visualIntent: 'circle and bar tease the mark geometry',
            keyMotion: 'orbit',
            skill: 'logo-animation',
            durationSec: 1.2,
          },
          {
            job: 'accent',
            vo: '',
            headline: '',
            visualIntent: 'accent path bounce',
            keyMotion: 'bounce',
            skill: 'logo-animation',
            durationSec: 1.0,
          },
          {
            job: 'assemble',
            vo: '',
            headline: '',
            visualIntent: 'stroke draw-on the mark',
            keyMotion: 'strokeDash',
            skill: 'logo-animation',
            durationSec: 1.4,
          },
          {
            job: 'overshoot',
            vo: '',
            headline: '',
            visualIntent: 'spring overshoot',
            keyMotion: 'spring',
            skill: 'logo-animation',
            durationSec: 0.8,
          },
          {
            job: 'settle',
            vo: '',
            headline: '',
            visualIntent: 'settle lockup hold',
            keyMotion: 'settle',
            skill: 'logo-animation',
            durationSec: 1.0,
          },
        ],
      },
      '16:9',
      undefined,
      { contentLang: 'zh', filmKind: 'logo', sourcePrompt: '做一条 Acme Logo 动画' },
    )
    expect(plan.primary).toBe('logo-animation')
    // P0: brand seats separate from technique — never steal svg seat
    expect(plan.support).toContain('svg-animation')
    expect(plan.support).not.toContain('brand-motion-guidelines')
    expect(plan.brandSkills).toContain('brand-motion-guidelines')
    expect(plan.brandSkills).toContain('video-delivery-specs')
    const ids = codegenSkillIds(plan)
    expect(ids).toContain('brand-motion-guidelines')
    expect(ids).toContain('video-delivery-specs')
    expect(ids).toContain('logo-animation')
    expect(ids).toContain('svg-animation')
    expect(ids).toContain('lottie-animation')
    expect(ids).toContain('gsap-web')
  })
})
