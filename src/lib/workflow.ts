/** 工作流模板已移除；保留空导出避免旧 import 炸裂 */
import type { StylePack, Template } from '../../packages/shared/src/index'
import { workflowLabel } from '../../packages/shared/src/index'
import type { FormMode } from '@/store/studio'

export type { Template, StylePack }
export { workflowLabel }

export const WORKFLOWS: Template[] = []

export function workflowById(_id?: string | null): Template | undefined {
  return undefined
}

export function templateIdForFormMode(_mode: FormMode): string | undefined {
  return undefined
}

export function formModeForTemplate(_id: string): FormMode {
  return 'prompt'
}

export function isBoundToTemplate(_prompt: string, _tpl?: Template): boolean {
  return false
}
