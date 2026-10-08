/**
 * Biunow 自研成片渲染：分镜色板 + 标题/旁白字幕 + VO → final.mp4
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { assertFontOrWarn, fontfileFilterArg } from './fonts'
import { getFfmpegPath } from './paths'
import type { Aspect, StoryboardBeat } from './types'

const SIZE: Record<Aspect, { w: number; h: number }> = {
  '16:9': { w: 1920, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
  '1:1': { w: 1080, h: 1080 },
  '3:4': { w: 1080, h: 1440 },
}

const PALETTE = ['1c1917', '292524', '44403c', '0c4a6e', '7c2d12', '14532d', '4c1d95', '1e3a5f']

function scaleForQuality(aspect: Aspect, quality: '1080p' | '720p') {
  const base = SIZE[aspect]
  if (quality === '1080p') return base
  return { w: Math.round(base.w * 2 / 3), h: Math.round(base.h * 2 / 3) }
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const bin = getFfmpegPath()
    const child = spawn(bin, args, { windowsHide: true })
    let err = ''
    child.stderr?.on('data', (d) => {
      err += String(d)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg failed (${code}): ${err.slice(-1200)}`))
    })
  })
}

function escapeDraw(text: string) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/%/g, '%%')
    .replace(/\n/g, ' ')
    .slice(0, 60)
}

/** concat demuxer 需要稳定路径；含空格/单引号时用安全相对写法 */
function concatFileLine(absPath: string) {
  const normalized = absPath.replace(/\\/g, '/')
  return `file '${normalized.replace(/'/g, "'\\''")}'`
}

async function renderBeatClip(
  beat: StoryboardBeat,
  outPath: string,
  aspect: Aspect,
  quality: '1080p' | '720p',
  color: string,
): Promise<void> {
  const { w, h } = scaleForQuality(aspect, quality)
  const dur = Math.max(2.5, beat.durationSec || 4)
  const title = escapeDraw(beat.title || 'Beat')
  const line = escapeDraw(beat.visual || beat.narration || '')
  const vo = path.join(path.dirname(path.dirname(outPath)), 'audio', `vo-${beat.index}.mp3`)
  const hasVo = existsSync(vo)
  const font = fontfileFilterArg()

  const vf = [
    `drawtext=${font}text='${title}':fontcolor=white:fontsize=${Math.max(28, Math.round(h * 0.05))}:x=(w-text_w)/2:y=h*0.36`,
    `drawtext=${font}text='${line}':fontcolor=0xdddddd:fontsize=${Math.max(18, Math.round(h * 0.028))}:x=(w-text_w)/2:y=h*0.50`,
  ].join(',')

  // 统一带音轨，避免 concat 时有的片有声、有的无声导致失败
  const args = [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=0x${color}:s=${w}x${h}:d=${dur}`,
  ]
  if (hasVo) {
    args.push('-i', vo)
  } else {
    args.push('-f', 'lavfi', '-i', `anullsrc=r=44100:cl=stereo:d=${dur}`)
  }
  args.push(
    '-vf',
    vf,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-shortest',
    '-t',
    String(dur),
    outPath,
  )
  await runFfmpeg(args)
}

export async function renderProjectVideo(input: {
  projectDir: string
  beats: StoryboardBeat[]
  aspect: Aspect
  quality?: '1080p' | '720p'
  indexes?: number[]
}): Promise<{ videoPath: string; durationSec: number; beats: StoryboardBeat[] }> {
  assertFontOrWarn()
  const clipsDir = path.join(input.projectDir, 'clips')
  mkdirSync(clipsDir, { recursive: true })
  mkdirSync(path.join(input.projectDir, 'stills'), { recursive: true })

  const quality = input.quality || '1080p'
  const set = input.indexes ? new Set(input.indexes) : null
  const beats = [...input.beats]
  const listPath = path.join(input.projectDir, 'concat.txt')
  const lines: string[] = []
  let total = 0

  for (let i = 0; i < beats.length; i++) {
    const clip = path.join(clipsDir, `beat-${i}.mp4`)
    const needRebuild = !set || set.has(i) || !existsSync(clip)
    if (needRebuild) {
      const color = PALETTE[i % PALETTE.length]
      await renderBeatClip(beats[i], clip, input.aspect, quality, color)
    }
    const still = path.join(input.projectDir, 'stills', `f-${i}.png`)
    try {
      await runFfmpeg(['-y', '-ss', '0.35', '-i', clip, '-frames:v', '1', still])
      beats[i] = { ...beats[i], stillPath: still }
    } catch {
      /* still optional */
    }
    lines.push(concatFileLine(clip))
    total += beats[i].durationSec || 4
  }

  writeFileSync(listPath, `${lines.join('\n')}\n`, 'utf8')
  const videoPath = path.join(input.projectDir, 'final.mp4')
  // 统一重编码，避免 copy 拼接因参数不一致失败
  await runFfmpeg([
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listPath,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    videoPath,
  ])
  return { videoPath, durationSec: total, beats }
}
