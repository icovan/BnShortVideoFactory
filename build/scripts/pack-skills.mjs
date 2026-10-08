/**
 * 打包私有 skills → release/skills/biunow-skills-<version>.zip
 * （不进入开源仓；正式分发或首启导入用）
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const archiver = require('archiver')

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../..')
const skillsDir = join(ROOT, 'vendor', 'skills')
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const outDir = join(ROOT, 'release', 'skills')
const outFile = join(outDir, `biunow-skills-${pkg.version}.zip`)

if (!existsSync(skillsDir)) {
  console.error('[pack-skills] missing', skillsDir)
  process.exit(1)
}
const bodies = readdirSync(skillsDir).filter((n) => n !== 'README.md' && !n.startsWith('.'))
if (!bodies.length) {
  console.error('[pack-skills] no skill bodies to pack')
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })
const output = createWriteStream(outFile)
const archive = archiver('zip', { zlib: { level: 9 } })
archive.on('error', (err) => {
  throw err
})
archive.pipe(output)
archive.directory(skillsDir, 'skills')
const manifest = join(ROOT, 'vendor', 'skills-manifest.json')
if (existsSync(manifest)) archive.file(manifest, { name: 'skills-manifest.json' })
await archive.finalize()
await new Promise((resolve, reject) => {
  output.on('close', resolve)
  output.on('error', reject)
})
console.log('[pack-skills]', outFile, `(${bodies.length} skills, ${archive.pointer()} bytes)`)
