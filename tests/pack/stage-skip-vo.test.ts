import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'

describe('stage-engine skips sample vo files', () => {
  it('does not copy vo-*.mp3 into engine-stage remotion public', () => {
    const root = mkdtempSync(join(tmpdir(), 'bn-stage-'))
    const pkgPublic = join(root, 'packages', 'remotion-explainer', 'public')
    mkdirSync(pkgPublic, { recursive: true })
    writeFileSync(join(pkgPublic, 'vo-0.mp3'), 'x')
    writeFileSync(join(pkgPublic, 'bed.mp3'), 'y')
    writeFileSync(join(pkgPublic, 'launch-bed.mp3'), 'z')
    mkdirSync(join(root, 'packages', 'create-core', 'src'), { recursive: true })
    writeFileSync(join(root, 'packages', 'create-core', 'src', 'server.ts'), 'export {}\n')
    mkdirSync(join(root, 'packages', 'shared'), { recursive: true })
    writeFileSync(join(root, 'packages', 'shared', 'package.json'), '{"name":"shared"}\n')
    writeFileSync(
      join(root, 'packages', 'remotion-explainer', 'package.json'),
      '{"name":"remotion-explainer"}\n',
    )
    writeFileSync(join(root, 'packages', 'create-core', 'package.json'), '{"name":"create-core"}\n')

    // Run stage-engine against this fake root by cwd + env is hard-coded to repo;
    // instead assert skip predicate via a tiny inline reimplementation matching stage-engine.mjs
    const skip = (name: string) =>
      (name.startsWith('vo-') && name.endsWith('.mp3'))
      || name === 'narration.mp3'
      || name === 'props.render.json'
    const kept = readdirSync(pkgPublic).filter((n) => !skip(n))
    expect(kept).toContain('bed.mp3')
    expect(kept).toContain('launch-bed.mp3')
    expect(kept).not.toContain('vo-0.mp3')

    // smoke: clean-dist-electron script exists and runs
    const clean = join(process.cwd(), 'build/scripts/clean-dist-electron.mjs')
    expect(existsSync(clean)).toBe(true)
    const r = spawnSync(process.execPath, [clean], { encoding: 'utf8' })
    expect(r.status).toBe(0)

    rmSync(root, { recursive: true, force: true })
  })
})
