/**
 * 打包前清空 dist-electron，避免历史 hashed main-*.js 堆积进 asar。
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
