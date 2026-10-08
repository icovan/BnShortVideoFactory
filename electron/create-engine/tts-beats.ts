import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { edgeTtsSynthesizeToFile } from '../tts'
import { loadSettings } from './settings'
import type { StoryboardBeat } from './types'

export async function synthesizeBeats(
  beats: StoryboardBeat[],
  projectDir: string,
  opts?: { indexes?: number[] },
): Promise<StoryboardBeat[]> {
  const voice = loadSettings().speechVoice || 'zh-CN-XiaoxiaoNeural'
  const set = opts?.indexes ? new Set(opts.indexes) : null
  const next = [...beats]

  for (let i = 0; i < next.length; i++) {
    if (set && !set.has(i)) continue
    const beat = next[i]
    const text = (beat.narration || beat.title || '').trim()
    if (!text) {
      next[i] = { ...beat, durationSec: beat.durationSec || 3 }
      continue
    }
    const outPath = path.join(projectDir, 'audio', `vo-${i}.mp3`)
    const result = await edgeTtsSynthesizeToFile({
      text,
      voice,
      options: {},
      withCaption: false,
      outputPath: outPath,
    })
    const duration = Number(result?.duration) || beat.durationSec || 4
    next[i] = { ...beat, durationSec: Math.max(2.5, duration) }
    writeFileSync(path.join(projectDir, 'audio', `vo-${i}.txt`), text, 'utf8')
  }
  return next
}
