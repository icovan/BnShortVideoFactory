/**
 * 开发态可选：若已安装 ffmpeg-static，确保二进制可用。
 * 生产安装包不再打包 ffmpeg；由应用内一键安装下载便携 FFmpeg。
 */
const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

let ffmpeg
try {
  ffmpeg = require('ffmpeg-static')
} catch {
  console.log('[postinstall] ffmpeg-static not installed (OK for production slim builds)')
  process.exit(0)
}

if (!ffmpeg || !fs.existsSync(ffmpeg)) {
  console.log('[postinstall] Downloading ffmpeg-static for local dev…')
  try {
    execSync(
      `cross-env FFMPEG_BINARIES_URL=${process.env['npm_config_ffmpeg_binaries_url'] || ''} npm rebuild ffmpeg-static`,
      { stdio: 'inherit' },
    )
    ffmpeg = require('ffmpeg-static')
  } catch (e) {
    console.warn('[postinstall] ffmpeg-static rebuild skipped:', e?.message || e)
    process.exit(0)
  }
}

console.log(`[postinstall] FFmpeg (dev): ${ffmpeg}`)

const isWindows = process.platform === 'win32'
if (!isWindows && ffmpeg && fs.existsSync(ffmpeg)) {
  try {
    fs.chmodSync(ffmpeg, 0o755)
  } catch {
    /* ignore */
  }
}

// silence unused
void path
