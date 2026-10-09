/**
 * 把 packages/{create-core,shared,remotion-explainer} 打进 build/engine-stage
 * （默认不含 node_modules；skills 仅当 BIUNOW_INCLUDE_SKILLS=1 时打入）
 */
import {
  cpSync, existsSync, mkdirSync, rmSync, readdirSync, statSync, writeFileSync,
} from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../..')
const OUT = join(ROOT, 'build', 'engine-stage')
const INCLUDE_SKILLS = process.env.BIUNOW_INCLUDE_SKILLS === '1'

const SKIP = new Set([
  'node_modules', '.git', 'release', 'outputs', 'data', '.cursor',
  'dist', 'coverage', '.turbo', '.cache',
])

function copyTree(from, to, { skipSkillsBodies = false } = {}) {
  mkdirSync(to, { recursive: true })
  for (const name of readdirSync(from)) {
    if (SKIP.has(name)) continue
    const src = join(from, name)
    const dest = join(to, name)
    const st = statSync(src)
    if (st.isDirectory()) {
      if (skipSkillsBodies && name !== 'README.md') {
        // skills 正文跳过：只在后续单独处理 README
        continue
      }
      copyTree(src, dest, { skipSkillsBodies })
    } else {
      cpSync(src, dest)
    }
  }
}

const createCore = join(ROOT, 'packages', 'create-core', 'src', 'server.ts')
if (!existsSync(createCore)) {
  console.error('[stage-engine] missing packages/create-core at', ROOT)
  process.exit(1)
}

console.log('[stage-engine] product root =', ROOT)
console.log('[stage-engine] include skills =', INCLUDE_SKILLS)
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

copyTree(join(ROOT, 'packages'), join(OUT, 'packages'))

// 设计参考图：开发态在 ../cankao/style，安装包需打进 assets/style-refs
{
  const IMG = /\.(webp|png|jpe?g|gif)$/i
  const dest = join(OUT, 'assets', 'style-refs')
  mkdirSync(dest, { recursive: true })
  const sources = [
    join(ROOT, 'assets', 'style-refs'),
    join(ROOT, 'packages', 'create-core', 'assets', 'style-refs'),
    join(ROOT, '../cankao/style'),
  ]
  let n = 0
  for (const src of sources) {
    if (!existsSync(src)) continue
    for (const name of readdirSync(src)) {
      if (!IMG.test(name)) continue
      const from = join(src, name)
      if (!statSync(from).isFile()) continue
      cpSync(from, join(dest, name))
      n += 1
    }
  }
  console.log(`[stage-engine] style-refs bundled: ${n} → assets/style-refs`)
  if (n === 0) {
    console.warn('[stage-engine] WARNING: no style-refs images found (cankao/style missing?)')
  }
}

// vendor：始终带 skills-manifest；skills 正文仅正式包
mkdirSync(join(OUT, 'vendor'), { recursive: true })
const manifest = join(ROOT, 'vendor', 'skills-manifest.json')
if (existsSync(manifest)) {
  cpSync(manifest, join(OUT, 'vendor', 'skills-manifest.json'))
}
const skillsSrc = join(ROOT, 'vendor', 'skills')
const skillsDest = join(OUT, 'vendor', 'skills')
mkdirSync(skillsDest, { recursive: true })
const readme = join(skillsSrc, 'README.md')
if (existsSync(readme)) cpSync(readme, join(skillsDest, 'README.md'))
else {
  writeFileSync(
    join(skillsDest, 'README.md'),
    '# Skills\n\nPrivate pack not included in this build.\n',
    'utf8',
  )
}
if (INCLUDE_SKILLS && existsSync(skillsSrc)) {
  for (const name of readdirSync(skillsSrc)) {
    if (name === 'README.md' || name.startsWith('.')) continue
    const src = join(skillsSrc, name)
    cpSync(src, join(skillsDest, name), { recursive: true })
  }
  console.log('[stage-engine] bundled private skills')
} else {
  console.log('[stage-engine] skills bodies omitted (set BIUNOW_INCLUDE_SKILLS=1 for official build)')
}

writeFileSync(join(OUT, 'package.json'), JSON.stringify({
  name: 'bn-short-video-factory-create-core-bundle',
  private: true,
  version: '0.1.0',
}, null, 2))

writeFileSync(join(OUT, 'engine-bundle.json'), JSON.stringify({
  bundledAt: new Date().toISOString(),
  source: relative(ROOT, join(ROOT, 'packages')).replace(/\\/g, '/'),
  layout: 'packages/create-core + remotion-explainer + shared (+ skills if INCLUDE)',
  includeSkills: INCLUDE_SKILLS,
  includeNodeModules: false,
}, null, 2))

console.log('[stage-engine] out =', OUT)
