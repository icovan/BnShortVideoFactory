import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { projectsFile } from './paths'
import type { CreateProject, PipelineStep } from './types'

let projects: CreateProject[] = []
let loaded = false

function load() {
  if (loaded) return
  loaded = true
  try {
    if (existsSync(projectsFile())) {
      projects = JSON.parse(readFileSync(projectsFile(), 'utf8'))
    }
  } catch {
    projects = []
  }
}

function persist() {
  writeFileSync(projectsFile(), JSON.stringify(projects, null, 2), 'utf8')
}

export function listProjects() {
  load()
  return [...projects]
}

export function getProject(id: string) {
  load()
  return projects.find((p) => p.id === id) || null
}

export function upsertProject(p: CreateProject) {
  load()
  const i = projects.findIndex((x) => x.id === p.id)
  if (i >= 0) projects[i] = p
  else projects.unshift(p)
  persist()
}

export function patchProject(id: string, patch: Partial<CreateProject>) {
  load()
  const i = projects.findIndex((x) => x.id === id)
  if (i < 0) return null
  projects[i] = { ...projects[i], ...patch, updatedAt: new Date().toISOString() }
  persist()
  return projects[i]
}

export function setPipeline(id: string, pipeline: PipelineStep[]) {
  return patchProject(id, { pipeline })
}

export function updateStep(
  id: string,
  stepId: string,
  patch: Partial<PipelineStep>,
) {
  const p = getProject(id)
  if (!p) return null
  const pipeline = p.pipeline.map((s) => (s.id === stepId ? { ...s, ...patch } : s))
  return patchProject(id, { pipeline })
}
