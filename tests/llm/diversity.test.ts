// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { creativeStrategies, buildDiversityInstructions } from '../../src/lib/llm/diversity'
import {
  clearCopywritingHistory,
  getCopywritingHistory,
  getCopywritingTaskId,
  saveCopywritingHistory,
  takeNextCreativeStrategy,
} from '../../src/store/copywriting-history'

afterEach(() => clearCopywritingHistory())

describe('diversity strategy and history', () => {
  it('rotates through strategies without replacement and avoids a repeated cycle boundary', () => {
    const taskId = getCopywritingTaskId({ request: '需求', systemPromptMode: 'off' })
    const firstCycle = creativeStrategies.map(() =>
      takeNextCreativeStrategy(taskId, creativeStrategies),
    )
    expect(new Set(firstCycle.map(({ id }) => id)).size).toBe(creativeStrategies.length)
    const next = takeNextCreativeStrategy(taskId, creativeStrategies)
    expect(next.id).not.toBe(firstCycle.at(-1)?.id)
  })

  it('separates task history by prompt and prompt mode but not model configuration', () => {
    const taskA = getCopywritingTaskId({
      request: '  同一需求\r\n第二行  ',
      systemPromptMode: 'builtin',
      systemPrompt: 'rules',
    })
    const taskB = getCopywritingTaskId({
      request: '同一需求\n第二行',
      systemPromptMode: 'builtin',
      systemPrompt: 'rules',
    })
    const taskC = getCopywritingTaskId({
      request: '同一需求\n第二行',
      systemPromptMode: 'custom',
      systemPrompt: 'rules',
    })
    expect(taskA).toBe(taskB)
    expect(taskA).not.toBe(taskC)
  })

  it('keeps a bounded, newest-first history and supports clearing it', () => {
    const taskId = getCopywritingTaskId({ request: '历史测试', systemPromptMode: 'off' })
    for (let index = 0; index < 6; index += 1)
      saveCopywritingHistory(taskId, `第 ${index} 篇文案`, 'scene')
    expect(getCopywritingHistory(taskId).map(({ text }) => text)).toEqual([
      '第 5 篇文案',
      '第 4 篇文案',
      '第 3 篇文案',
    ])
    expect(clearCopywritingHistory()).toBe(true)
    expect(getCopywritingHistory(taskId)).toEqual([])
  })

  it('quotes history as reference material and preserves user requirements in its instruction', () => {
    const instructions = buildDiversityInstructions(
      creativeStrategies[0],
      [{ text: '历史文案正文', strategyId: 'scene' }],
      '首稿内容',
    )
    expect(instructions).toContain('用户明确提出的事实')
    expect(instructions).toContain('历史文案正文')
    expect(instructions).toContain('首稿内容')
  })
})
