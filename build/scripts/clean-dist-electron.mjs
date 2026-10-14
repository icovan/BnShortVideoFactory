/**
 * 构建开头清空 dist-electron，避免多次构建堆积 hashed 碎片进 asar。
 * 注意：beforePack 不得再删当前 main-*.js（main.js 会 require 它们）。
 */
import { rmSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(dirname(fileURLToPath(import.meta.url)), '../../dist-electron')
if (existsSync(dir)) {
  rmSync(dir, { recursive: true, force: true })
  console.log('[clean-dist-electron] removed', dir)
} else {
  console.log('[clean-dist-electron] nothing to clean')
}
