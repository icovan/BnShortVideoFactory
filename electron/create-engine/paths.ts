import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

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
  const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = require('ffmpeg-static') as string
  const p = VITE_DEV_SERVER_URL ? raw : raw.replace('app.asar', 'app.asar.unpacked')
  if (!existsSync(p)) throw new Error(`FFmpeg not found: ${p}`)
  return p
}
