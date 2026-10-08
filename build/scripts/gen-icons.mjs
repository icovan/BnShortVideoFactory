/**
 * 从 public/icon.png 生成完整多尺寸 Windows .ico
 * 含 16–256，并把 256 放在资源首位——360/火绒等「软件列表」常取 exe 第 0 号图标再放大，
 * 若第 0 号是 16/32 会发糊；桌面快捷方式本身会按 DPI 选尺寸所以可能已清晰。
 *
 * 用法: pnpm icons
 */
import { mkdirSync, writeFileSync, existsSync, unlinkSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import pngToIco from 'png-to-ico'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../..')
const png = join(ROOT, 'public', 'icon.png')
const outDir = join(ROOT, 'build', 'icons')
const tmpDir = join(outDir, '_pngs')
const outIco = join(outDir, 'icon.ico')
const publicIco = join(ROOT, 'public', 'icon.ico')
/** 大尺寸优先：部分安全软件固定读 index 0 */
const SIZES = [256, 128, 64, 48, 40, 32, 24, 20, 16]

function ensureSharp() {
  // 从仓库根解析依赖（pnpm 下 createRequire(本脚本) 找不到 sharp）
  const require = createRequire(join(ROOT, 'package.json'))
  try {
    return require('sharp')
  } catch {
    console.log('[gen-icons] installing sharp…')
    const r = spawnSync('pnpm', ['add', '-Dw', 'sharp'], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: true,
    })
    if (r.status !== 0) process.exit(r.status || 1)
    return createRequire(join(ROOT, 'package.json'))('sharp')
  }
}

if (!existsSync(png)) {
  console.error('[gen-icons] missing', png)
  process.exit(1)
}

const sharp = ensureSharp()
mkdirSync(tmpDir, { recursive: true })

const pngFiles = []
for (const size of SIZES) {
  const dest = join(tmpDir, `${size}.png`)
  await sharp(png)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(dest)
  pngFiles.push(dest)
}

const buf = await pngToIco(pngFiles)
mkdirSync(outDir, { recursive: true })
writeFileSync(outIco, buf)
writeFileSync(publicIco, buf)
// electron-builder 默认也会找 build/icon.ico
writeFileSync(join(ROOT, 'build', 'icon.ico'), buf)

for (const f of readdirSync(tmpDir)) {
  try {
    unlinkSync(join(tmpDir, f))
  } catch {
    /* ignore */
  }
}

console.log('[gen-icons] wrote', outIco, `(${buf.length} bytes, sizes ${SIZES.join('/')})`)
console.log('[gen-icons] wrote', publicIco)
console.log('[gen-icons] wrote build/icon.ico')
