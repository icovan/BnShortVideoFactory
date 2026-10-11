import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { SKILL_CONTRACTS, isSkillName } from '../../packages/create-core/src/skills/registry'
import { resolveSkillsDir } from '../../packages/create-core/src/skills/paths'
import type { SkillName } from '../../packages/create-core/src/llm'

function listCankaoSkills(): string[] {
  const candidates = [
    join(process.cwd(), '../cankao'),
    join(process.cwd(), '../../cankao'),
    'E:/SIM+/creator/cankao',
  ]
  const root = candidates.find((p) => existsSync(p))
  if (!root) return []
  const out = new Set<string>()
  for (const pack of readdirSync(root, { withFileTypes: true })) {
    if (!pack.isDirectory()) continue
    const skillsDir = join(root, pack.name, 'skills')
    if (!existsSync(skillsDir)) continue
    for (const s of readdirSync(skillsDir, { withFileTypes: true })) {
      if (s.isDirectory() && existsSync(join(skillsDir, s.name, 'SKILL.md'))) out.add(s.name)
    }
  }
  return [...out].sort()
}

describe('cankao skill parity', () => {
  it('vendor has every cankao skill folder with SKILL.md', () => {
    const cankao = listCankaoSkills()
    expect(cankao.length, `cankao root not found from cwd=${process.cwd()}`).toBeGreaterThan(40)
    const vendorRoot = resolveSkillsDir()
    const missing = cankao.filter((id) => !existsSync(join(vendorRoot, id, 'SKILL.md')))
    expect(missing, `missing: ${missing.join(', ')}`).toEqual([])
  })

  it('every SkillName has contract + vendor SKILL.md', () => {
    const vendorRoot = resolveSkillsDir()
    const names = Object.keys(SKILL_CONTRACTS) as SkillName[]
    expect(names.length).toBeGreaterThan(45)
    for (const id of names) {
      expect(isSkillName(id), id).toBe(true)
      expect(existsSync(join(vendorRoot, id, 'SKILL.md')), id).toBe(true)
    }
  })

  it('newly filled 13 skills are registered', () => {
    for (const id of [
      '60fps-animation',
      'accessible-animation',
      'after-effects',
      'ascii-animation',
      'client-revisions',
      'glassmorphism',
      'javascript-animation',
      'micro-interaction',
      'motion-pricing',
      'page-transition-animation',
      'particle-system',
      'shader-glsl',
      'threejs-animation',
    ]) {
      expect(isSkillName(id), id).toBe(true)
      expect(SKILL_CONTRACTS[id as SkillName]?.id).toBe(id)
    }
  })
})
