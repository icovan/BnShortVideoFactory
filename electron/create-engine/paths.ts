import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { resolveFfmpegBinary } from '../engine/runtimeBins'

export function engineDataRoot() {
  const root = path.join(app.getPath('userData'), 'create-engine')
  mkdirSync(root, { recursive: true })
  return root
}

export function projectsFile() {
  return path.join(engineDataRoot(), 'projects.json')
}

export function settingsFile() {
  return path.join(engineDataRoot(), 'settings.json')
}

export function outputsRoot() {
  const root = path.join(engineDataRoot(), 'outputs')
  mkdirSync(root, { recursive: true })
  return root
}

export function projectDir(dirName: string) {
  const dir = path.join(outputsRoot(), dirName)
  mkdirSync(dir, { recursive: true })
  mkdirSync(path.join(dir, 'stills'), { recursive: true })
  mkdirSync(path.join(dir, 'audio'), { recursive: true })
  return dir
}

export function getFfmpegPath(): string {
  const p = resolveFfmpegBinary()
  if (!p || (p !== 'ffmpeg' && !existsSync(p))) {
    throw new Error('FFmpeg not found — run one-click runtime install')
  }
  return p
}
