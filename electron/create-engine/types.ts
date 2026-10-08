export type Aspect = '16:9' | '9:16' | '1:1' | '3:4'
export type TaskStatus = 'queued' | 'running' | 'ready' | 'error'
export type StepStatus = 'pending' | 'running' | 'done' | 'error'

export type PipelineStep = {
  id: string
  label: string
  detail?: string
  status: StepStatus
}

export type StoryboardBeat = {
  index: number
  title: string
  narration: string
  visual: string
  durationSec: number
  stillPath?: string
}

export type StoryboardPayload = {
  projectId: string
  beats: StoryboardBeat[]
}

export type CreateProject = {
  id: string
  title: string
  prompt: string
  status: TaskStatus
  aspect: Aspect
  quality: '1080p' | '720p'
  formMode?: string
  voMode: 'on' | 'off' | 'auto'
  createdAt: string
  updatedAt: string
  durationSec: number
  dir: string
  videoPath?: string
  error?: string
  pipeline: PipelineStep[]
  beats: StoryboardBeat[]
}

export type EngineSettings = {
  llmBaseUrl: string
  llmApiKey: string
  llmModel: string
  speechProvider: string
  speechVoice: string
}

export type MakeInput = {
  prompt: string
  aspect?: Aspect
  quality?: '1080p' | '720p'
  formMode?: string
  voMode?: 'on' | 'off' | 'auto'
  scriptDrive?: string
}

export type RemakeInput = {
  beatIndexes: number[]
  note: string
  mode?: 'visual+voice' | 'visual' | 'voice'
}

export type EngineHttpResult = {
  status: number
  headers: Record<string, string>
  body: string
}
