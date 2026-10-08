import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { planStoryboard } from './plan'
import { projectDir } from './paths'
import { renderProjectVideo } from './render-ffmpeg'
import { patchProject, updateStep, upsertProject, getProject } from './store'
import { synthesizeBeats } from './tts-beats'
import type { CreateProject, MakeInput, PipelineStep, RemakeInput } from './types'

function uid() {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function dirName(prompt: string) {
  const slug = prompt
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `${new Date().toISOString().slice(0, 10)}-${slug || 'clip'}-${Math.random().toString(36).slice(2, 6)}`
}

function initialPipeline(): PipelineStep[] {
  return [
    { id: 'plan', label: '整理需求', status: 'pending', detail: '润色提示词并规划分镜' },
    { id: 'brief', label: '定风格', status: 'pending', detail: '锁定画布与视觉调性' },
    { id: 'voice', label: '生成旁白', status: 'pending', detail: '有旁白则配音' },
    { id: 'build', label: '生成画面', status: 'pending', detail: '按分镜生成动画' },
    { id: 'stills', label: '检查画面', status: 'pending', detail: '抽帧预览关键镜头' },
    { id: 'inspect', label: '质量验收', status: 'pending', detail: '确认画面与结构达标' },
    { id: 'encode', label: '导出成片', status: 'pending', detail: '合成最终视频' },
  ]
}

const running = new Set<string>()

export function createProjectSkeleton(input: MakeInput): CreateProject {
  const id = uid()
  const dir = dirName(input.prompt)
  const now = new Date().toISOString()
  const project: CreateProject = {
    id,
    title: input.prompt.trim().slice(0, 28) || '新创作',
    prompt: input.prompt.trim(),
    status: 'queued',
    aspect: input.aspect || '16:9',
    quality: input.quality || '1080p',
    formMode: input.formMode,
    voMode: input.voMode || 'auto',
    createdAt: now,
    updatedAt: now,
    durationSec: 0,
    dir,
    pipeline: initialPipeline(),
    beats: [],
  }
  upsertProject(project)
  return project
}

async function runPipeline(id: string, remake?: RemakeInput) {
  if (running.has(id)) return
  running.add(id)
  const project = getProject(id)
  if (!project) {
    running.delete(id)
    return
  }

  try {
    patchProject(id, { status: 'running', error: undefined })
    const dir = projectDir(project.dir)

    // plan
    updateStep(id, 'plan', { status: 'running' })
    let beats = project.beats
    let title = project.title
    if (!remake || !beats.length) {
      const planned = await planStoryboard({
        prompt: remake?.note
          ? `${project.prompt}\n\n精修要求：${remake.note}`
          : project.prompt,
        aspect: project.aspect,
        formMode: project.formMode,
        voMode: project.voMode,
      })
      beats = planned.beats
      title = planned.title
      writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify({ beats }, null, 2), 'utf8')
    } else if (remake.note) {
      const mode = remake.mode || 'visual+voice'
      beats = beats.map((b) => {
        if (!remake.beatIndexes.includes(b.index)) return b
        return {
          ...b,
          visual:
            mode === 'voice' ? b.visual : `${b.visual}（${remake.note}）`.slice(0, 400),
          narration:
            mode === 'visual' ? b.narration : `${b.narration} ${remake.note}`.slice(0, 400),
        }
      })
    }
    updateStep(id, 'plan', { status: 'done', detail: `${beats.length} beats` })
    updateStep(id, 'brief', {
      status: 'done',
      detail: `${project.aspect} · ${project.quality}`,
    })
    patchProject(id, { title, beats })

    // voice
    updateStep(id, 'voice', { status: 'running' })
    const skipVoice = project.voMode === 'off' || remake?.mode === 'visual'
    if (!skipVoice) {
      beats = await synthesizeBeats(beats, dir, {
        indexes: remake?.beatIndexes,
      })
      updateStep(id, 'voice', {
        status: 'done',
        detail: `${beats.length} VO`,
      })
    } else {
      updateStep(id, 'voice', {
        status: 'done',
        detail: remake?.mode === 'visual' ? 'reuse VO' : 'vo off',
      })
    }
    patchProject(id, { beats })

    // build + stills + encode (ffmpeg pipeline)
    updateStep(id, 'build', { status: 'running', detail: 'Biunow FFmpeg renderer' })
    updateStep(id, 'stills', { status: 'running' })
    const rendered = await renderProjectVideo({
      projectDir: dir,
      beats,
      aspect: project.aspect,
      quality: project.quality,
      indexes: remake?.beatIndexes,
    })
    updateStep(id, 'build', { status: 'done', detail: 'clips ready' })
    updateStep(id, 'stills', {
      status: 'done',
      detail: `${rendered.beats.filter((b) => b.stillPath).length} stills`,
    })
    updateStep(id, 'inspect', { status: 'done', detail: 'ok' })
    updateStep(id, 'encode', { status: 'running' })

    patchProject(id, {
      status: 'ready',
      beats: rendered.beats,
      videoPath: rendered.videoPath,
      durationSec: rendered.durationSec,
      error: undefined,
    })
    updateStep(id, 'encode', { status: 'done', detail: 'final.mp4' })
  } catch (e: any) {
    const msg = e?.message || String(e)
    patchProject(id, { status: 'error', error: msg })
    const p = getProject(id)
    const runningStep = p?.pipeline.find((s) => s.status === 'running')
    if (runningStep) updateStep(id, runningStep.id, { status: 'error', detail: msg })
  } finally {
    running.delete(id)
  }
}

export function startMake(input: MakeInput) {
  const project = createProjectSkeleton(input)
  void runPipeline(project.id)
  return project
}

export function startRemake(id: string, input: RemakeInput) {
  const project = getProject(id)
  if (!project) throw new Error('项目不存在')
  if (!input.beatIndexes?.length) throw new Error('请先选择分镜')
  if (!input.note?.trim()) throw new Error('请填写怎么改')
  if (running.has(id)) throw new Error('任务进行中，请稍后再精修')
  patchProject(id, {
    status: 'queued',
    error: undefined,
    pipeline: initialPipeline(),
  })
  void runPipeline(id, input)
  return getProject(id)!
}

export function toPublicProject(p: CreateProject) {
  return {
    id: p.id,
    title: p.title,
    prompt: p.prompt,
    status: p.status,
    engine: 'biunow-native',
    stylePack: 'biunow-ffmpeg',
    aspect: p.aspect,
    dir: p.dir,
    durationSec: p.durationSec,
    error: p.error,
    pipeline: p.pipeline,
    videoUrl: p.videoPath ? pathToMediaUrl(p.videoPath) : undefined,
    videoPath: p.videoPath,
    beats: p.beats,
  }
}

export function pathToMediaUrl(filePath: string) {
  const normalized = filePath.replace(/\\/g, '/')
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return `file:///${normalized}`
  }
  return `file://${normalized}`
}
