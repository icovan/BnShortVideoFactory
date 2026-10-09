<template>
  <div class="workbench">
    <aside class="side">
      <header>
        <button type="button" class="back" @click="goHome">
          <AppIcon :icon="ArrowLeft" :size="16" />
          {{ t('studio.workbench.back') }}
        </button>
        <h2>{{ t('studio.workbench.title') }}</h2>
      </header>

      <div class="board-head">
        <strong>{{ t('studio.workbench.storyboard') }}</strong>
        <span v-if="beats.length">· {{ beats.length }}</span>
        <template v-if="remakeReady && beats.length">
          <button type="button" class="mini" @click="selectAll">{{ t('studio.workbench.selectAll') }}</button>
          <button type="button" class="mini" @click="selected = []">{{ t('studio.workbench.clearSelect') }}</button>
          <label class="loop">
            <input v-model="loopBeat" type="checkbox" />
            {{ t('studio.workbench.loopBeat') }}
          </label>
        </template>
      </div>

      <div class="beats">
        <p v-if="!beats.length" class="note">{{ t('studio.workbench.noBeats') }}</p>
        <button
          v-for="b in beats"
          :key="b.index"
          type="button"
          class="beat"
          :class="{ on: activeBeat === b.index, picked: selected.includes(b.index) }"
          @click="onBeatClick(b)"
        >
          <span
            class="check"
            :class="{ yes: selected.includes(b.index) }"
            @click.stop="toggleSelect(b.index)"
          />
          <img v-if="thumbSrc(b)" :src="thumbSrc(b)" alt="" />
          <span v-else class="thumb-empty" />
          <div class="beat-meta">
            <strong>{{ String(b.index + 1).padStart(2, '0') }} · {{ beatTitle(b) }}</strong>
            <span>{{ formatSec(b.durationSec) }} · {{ formatSec(b.startSec) }}–{{ formatSec(b.endSec) }}</span>
          </div>
        </button>
      </div>

      <div v-if="versions.length" class="versions">
        <h4>{{ t('studio.workbench.versions') }}</h4>
        <button
          v-for="v in versionRows"
          :key="v.id"
          type="button"
          class="version-row"
          :class="{ on: currentVersionId === v.id }"
          :disabled="busy || task?.status === 'running'"
          @click="restoreVersion(v.id)"
        >
          <strong>{{ versionTitle(v) }}</strong>
          <em>{{ versionHint(v) }}</em>
        </button>
      </div>
    </aside>

    <main class="canvas-wrap">
      <div class="canvas-top">
        <strong>{{ task?.title || t('studio.workbench.untitled') }}</strong>
        <div class="actions">
          <a
            v-if="task?.videoPath"
            class="export"
            :href="task.videoPath"
            :download="`${task?.title || 'film'}.mp4`"
          >
            <AppIcon :icon="Download" :size="14" />
            {{ t('studio.workbench.export') }}
          </a>
          <span class="status" :class="task?.status">
            <AppIcon v-if="task?.status === 'running'" :icon="LoaderCircle" :size="14" class="spin" />
            {{ statusText }}
          </span>
        </div>
      </div>

      <div class="stage">
        <div class="stage-frame" :class="aspectClass">
          <video
            v-if="task?.videoPath && !hideVideo"
            ref="videoEl"
            :src="task.videoPath"
            controls
            class="vid"
            @timeupdate="onTimeUpdate"
          />
          <div v-else class="wait">{{ t('studio.workbench.waitingVideo') }}</div>
        </div>
      </div>

      <div class="progress">
        <div class="progress-label">
          <span>{{ progressLabel }}</span>
          <span
            >{{ progressPct }}% ·
            {{ t('studio.workbench.stepsOf', { done: doneCount, total: totalSteps }) }} ·
            {{ etaText }}</span
          >
        </div>
        <div class="bar">
          <i :style="{ width: `${progressPct}%` }" />
        </div>
      </div>
      <p v-if="task?.error" class="err">{{ task.error }}</p>
    </main>

    <aside class="right">
      <div v-if="task" class="prompt-bubble">{{ task.prompt }}</div>

      <ul class="steps">
        <li v-for="s in task?.pipeline || []" :key="s.id">
          <div class="step-head">
            <strong>{{ stepLabel(s) }}</strong>
            <span :class="s.status">{{ stepStatus(s.status) }}</span>
          </div>
          <p v-if="stepDetail(s)">{{ stepDetail(s) }}</p>
        </li>
      </ul>

      <div class="chips">
        <div class="chip-row">
          <span>{{ t('studio.workbench.modify') }}</span>
          <button
            type="button"
            :class="{ on: remakeMode === 'both' }"
            :disabled="!remakeReady || busy"
            @click="remakeMode = 'both'"
          >
            {{ t('studio.workbench.remakeModeBoth') }}
          </button>
          <button
            type="button"
            :class="{ on: remakeMode === 'visual' }"
            :disabled="!remakeReady || busy"
            @click="remakeMode = 'visual'"
          >
            {{ t('studio.workbench.remakeModeVisual') }}
          </button>
          <button
            type="button"
            :class="{ on: remakeMode === 'copy' }"
            :disabled="!remakeReady || busy"
            @click="remakeMode = 'copy'"
          >
            {{ t('studio.workbench.remakeModeVoice') }}
          </button>
        </div>
      </div>

      <div class="composer">
        <textarea
          v-model="note"
          rows="3"
          :placeholder="t('studio.workbench.composerPlaceholder')"
          :disabled="!remakeReady || busy"
        />
        <button
          type="button"
          class="send"
          :disabled="!canRemake"
          :title="t('studio.workbench.remake')"
          @click="doRemake"
        >
          <AppIcon :icon="ArrowUp" :size="16" :stroke-width="1.6" />
        </button>
      </div>
      <p v-if="remakeError" class="err">{{ remakeError }}</p>
    </aside>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTranslation } from 'i18next-vue'
import { ArrowLeft, ArrowUp, Download, LoaderCircle } from '@lucide/vue'
import AppIcon from '@/components/AppIcon.vue'
import {
  engineApi,
  engineAssetUrl,
  type EngineBeat,
  type EngineVersion,
  type RemakeMode,
} from '@/lib/engine-api'
import { localizeStepDetail } from '@/lib/pipeline-i18n'
import { useStudioStore, type PipelineStep } from '@/store/studio'

const { t, i18next } = useTranslation()
const route = useRoute()
const router = useRouter()
const studio = useStudioStore()

const taskId = computed(() => String(route.params.id || ''))
const task = computed(() => studio.tasks.find((x) => x.id === taskId.value) || null)

const beats = ref<EngineBeat[]>([])
const versions = ref<EngineVersion[]>([])
const currentVersionId = ref<string>('current')
const thumbMap = ref<Record<number, string>>({})
const selected = ref<number[]>([])
const activeBeat = ref<number | null>(null)

/** 初始在下、最新改过在上 */
const versionRows = computed(() => [...versions.value].reverse())

function versionTitle(v: EngineVersion) {
  if (v.kind === 'initial' || /^(初始版本|Initial)\b/i.test(v.label || '')) {
    return t('studio.workbench.versionInitial')
  }
  const n = v.remakeIndex
    || Number(String(v.label || '').match(/(\d+)/)?.[1] || 0)
    || 1
  return t('studio.workbench.versionRemake', { n })
}

function versionHint(v: EngineVersion) {
  if (currentVersionId.value === v.id) return t('studio.workbench.versionCurrent')
  if (v.beatIndexes?.length) return t('studio.workbench.versionBeats', { n: v.beatIndexes.length })
  return v.kind === 'initial'
    ? t('studio.workbench.versionInitialHint')
    : t('studio.workbench.versionRemakeHint')
}
const note = ref('')
const remakeMode = ref<RemakeMode>('both')
const busy = ref(false)
const remakeError = ref('')
const loopBeat = ref(false)
/** 二次创作前卸掉播放器，避免 Windows 锁住 final.mp4 */
const hideVideo = ref(false)
const videoEl = ref<HTMLVideoElement | null>(null)
const nowTick = ref(Date.now())
let etaTimer: ReturnType<typeof setInterval> | null = null

const remakeReady = computed(
  () => !!task.value && (task.value.status === 'ready' || task.value.status === 'error') && !busy.value,
)
const canRemake = computed(
  () =>
    remakeReady.value &&
    selected.value.length > 0 &&
    note.value.trim().length > 0 &&
    !busy.value,
)

const aspectClass = computed(() => {
  const a = task.value?.aspect || '16:9'
  return `ar-${a.replace(':', '-')}`
})

const totalSteps = computed(() => task.value?.pipeline.length || 0)
const doneCount = computed(
  () => task.value?.pipeline.filter((s) => s.status === 'done').length || 0,
)
const progressPct = computed(() =>
  totalSteps.value ? Math.round((doneCount.value / totalSteps.value) * 100) : 0,
)

const progressLabel = computed(() => {
  void i18next.language
  if (!task.value) return t('studio.status.noTask')
  if (task.value.status === 'ready') return t('studio.status.ready')
  if (task.value.status === 'running') {
    const cur = task.value.pipeline.find((s) => s.status === 'running')
    return cur ? stepLabel(cur) : t('studio.status.running')
  }
  if (busy.value) return t('studio.workbench.remakeBusy')
  if (task.value.status === 'queued') {
    const n = task.value.queuePosition
    return n && n > 0
      ? t('studio.workbench.queuePos', { n })
      : t('studio.status.waitingStart')
  }
  return '—'
})

function formatEta(ms: number) {
  const sec = Math.max(0, Math.round(ms / 1000))
  if (sec < 60) return i18next.language?.startsWith('zh') ? `约 ${sec} 秒` : `~${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m < 60) {
    if (i18next.language?.startsWith('zh')) return s ? `约 ${m} 分 ${s} 秒` : `约 ${m} 分钟`
    return s ? `~${m}m ${s}s` : `~${m}m`
  }
  const h = Math.floor(m / 60)
  const rm = m % 60
  if (i18next.language?.startsWith('zh')) return rm ? `约 ${h} 小时 ${rm} 分` : `约 ${h} 小时`
  return rm ? `~${h}h ${rm}m` : `~${h}h`
}

const etaText = computed(() => {
  void i18next.language
  void nowTick.value
  const p = task.value
  if (!p) return t('studio.workbench.etaIdle')
  if (p.status === 'ready') return t('studio.workbench.etaReady')
  if (p.status === 'error') return t('studio.workbench.etaError')
  if (p.status !== 'running' && p.status !== 'queued') return t('studio.workbench.etaIdle')
  const started = p.createdAt || Date.now()
  const elapsed = Math.max(0, nowTick.value - started)
  const pct = progressPct.value / 100
  if (pct >= 0.12 && elapsed > 4000) {
    return t('studio.workbench.etaRemain', { eta: formatEta((elapsed / pct) * (1 - pct)) })
  }
  if (elapsed > 0) return t('studio.workbench.etaElapsed', { eta: formatEta(elapsed) })
  return t('studio.workbench.etaEstimating')
})

const statusText = computed(() => {
  void i18next.language
  if (busy.value) return t('studio.workbench.remakeBusy')
  if (!task.value) return '—'
  if (task.value.status === 'queued' && (task.value.queuePosition || 0) > 0) {
    return t('studio.history.queuePos', { n: task.value.queuePosition })
  }
  return t(`studio.status.${task.value.status}`)
})

function stepLabel(s: PipelineStep) {
  const key = `studio.steps.${s.id}`
  return i18next.exists(key) ? t(key) : s.label
}

function stepDetail(s: PipelineStep) {
  void i18next.language
  return localizeStepDetail(s, t, (key) => i18next.exists(key))
}

function stepStatus(s: string) {
  if (s === 'pending') return t('studio.status.pending')
  if (s === 'running') return t('studio.status.running')
  if (s === 'done') return t('studio.status.done')
  if (s === 'error') return t('studio.status.error')
  return s
}

function formatSec(n?: number) {
  const v = Number(n) || 0
  return `${v.toFixed(v < 10 ? 1 : 0)}s`
}

function beatTitle(b: EngineBeat) {
  return b.headline || b.title || b.job || `Beat ${b.index + 1}`
}

function thumbSrc(b: EngineBeat) {
  return thumbMap.value[b.index] || b.stillUrl || ''
}

function toggleSelect(i: number) {
  if (!remakeReady.value) return
  if (selected.value.includes(i)) selected.value = selected.value.filter((x) => x !== i)
  else selected.value = [...selected.value, i].sort((a, b) => a - b)
}

function selectAll() {
  selected.value = beats.value.map((b) => b.index)
}

function seekBeat(b: EngineBeat, play = true) {
  activeBeat.value = b.index
  const el = videoEl.value
  if (!el) return
  const start = Number(b.startSec) || 0
  el.currentTime = Math.max(0, start)
  if (play) void el.play().catch(() => {})
}

function onBeatClick(b: EngineBeat) {
  if (!selected.value.includes(b.index)) selected.value = [b.index]
  seekBeat(b, true)
}

function onTimeUpdate() {
  if (!loopBeat.value || activeBeat.value == null) return
  const b = beats.value.find((x) => x.index === activeBeat.value)
  const el = videoEl.value
  if (!b || !el) return
  const end = Number(b.endSec) || 0
  const start = Number(b.startSec) || 0
  if (end > start && el.currentTime >= end - 0.05) {
    el.currentTime = start
  }
}

async function loadBoard() {
  if (!taskId.value) return
  try {
    const board = await engineApi.storyboard(taskId.value)
    beats.value = board.beats || []
    versions.value = board.versions || []
    currentVersionId.value = board.currentVersionId || 'current'
    const next: Record<number, string> = {}
    await Promise.all(
      beats.value.map(async (b) => {
        const raw = b.thumbUrl || b.stillUrl || b.stillPath
        if (raw) next[b.index] = await engineAssetUrl(raw)
      }),
    )
    thumbMap.value = next
  } catch {
    beats.value = []
    versions.value = []
  }
}

function releaseVideoFile() {
  const el = videoEl.value
  if (el) {
    try {
      el.pause()
      el.removeAttribute('src')
      el.load()
    } catch {
      /* ignore */
    }
  }
  hideVideo.value = true
}

async function doRemake() {
  remakeError.value = ''
  if (!selected.value.length) {
    remakeError.value = t('studio.workbench.remakeNeedSelect')
    return
  }
  if (!note.value.trim()) {
    remakeError.value = t('studio.workbench.remakeNeedNote')
    return
  }
  busy.value = true
  releaseVideoFile()
  // 给 OS 一点时间释放文件句柄
  await new Promise((r) => setTimeout(r, 200))
  try {
    await studio.ensureEngine()
    await engineApi.remakeBeats(taskId.value, {
      beatIndexes: selected.value,
      note: note.value.trim(),
      mode: remakeMode.value,
    })
    note.value = ''
    await studio.pollTask(taskId.value)
    await loadBoard()
    // 强制重新拉成片 URL，避免浏览器/播放器缓存旧 final.mp4
    if (task.value?.status === 'ready') {
      await studio.refreshTask(taskId.value)
    }
    if (task.value?.status === 'error') {
      remakeError.value = task.value.error || t('studio.workbench.remakeFailed')
    }
  } catch (e: any) {
    remakeError.value = e?.message || String(e)
    try {
      await studio.refreshTask(taskId.value)
    } catch {
      /* ignore */
    }
    try {
      await studio.ensureEngine()
    } catch {
      /* ignore */
    }
  } finally {
    busy.value = false
    hideVideo.value = false
  }
}

async function restoreVersion(versionId: string) {
  if (!taskId.value || busy.value) return
  busy.value = true
  remakeError.value = ''
  releaseVideoFile()
  await new Promise((r) => setTimeout(r, 150))
  try {
    await engineApi.restoreVersion(taskId.value, versionId)
    currentVersionId.value = versionId
    await studio.refreshTask(taskId.value)
    await loadBoard()
  } catch (e: any) {
    remakeError.value = e?.message || String(e)
  } finally {
    busy.value = false
    hideVideo.value = false
  }
}

function goHome() {
  void router.push({ name: 'home' })
}

onMounted(() => {
  etaTimer = setInterval(() => {
    nowTick.value = Date.now()
  }, 1000)
  if (taskId.value) {
    studio.openTask(taskId.value)
    void studio
      .refreshTask(taskId.value)
      .then(() => loadBoard())
      .catch(() => {})
  }
})

onUnmounted(() => {
  if (etaTimer) {
    clearInterval(etaTimer)
    etaTimer = null
  }
})

watch(taskId, (id) => {
  if (id) {
    studio.openTask(id)
    void studio
      .refreshTask(id)
      .then(() => loadBoard())
      .catch(() => {})
  }
})

watch(
  () => task.value?.status,
  (s) => {
    if (s === 'ready' || s === 'error') void loadBoard()
  },
)

</script>

<style lang="scss" scoped>
.workbench {
  height: 100%;
  display: grid;
  grid-template-columns: 268px minmax(0, 1fr) minmax(320px, 400px);
  gap: 0;
  /* 透出 html/body 与首页相同的径向渐变底 */
  background: transparent;
  color: var(--ink);
}

.side {
  border-right: 1px solid var(--line);
  padding: 48px 12px 12px;
  background: rgb(255 255 255 / 55%);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  min-height: 0;
  header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 12px;
    h2 {
      margin: 0;
      font-size: 16px;
    }
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 1px solid var(--line);
    background: var(--surface);
    border-radius: 999px;
    padding: 6px 12px;
    font-size: 12px;
    cursor: pointer;
  }
}

.board-head {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  font-size: 12px;
  margin-bottom: 8px;
  .mini {
    border: 0;
    background: var(--paper);
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 11px;
    cursor: pointer;
  }
  .loop {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--muted);
  }
}

.beats {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
}

.beat {
  display: flex;
  gap: 8px;
  align-items: center;
  border: 1px solid transparent;
  background: var(--surface);
  border-radius: 12px;
  padding: 6px;
  text-align: left;
  cursor: pointer;
  &.on {
    background: var(--paper);
  }
  &.picked {
    background: var(--accent-soft);
  }
  .check {
    width: 14px;
    height: 14px;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    flex-shrink: 0;
    &.yes {
      background: var(--accent);
      border-color: var(--ink);
      box-shadow: inset 0 0 0 1px var(--ink);
    }
  }
  img,
  .thumb-empty {
    width: 56px;
    height: 40px;
    object-fit: cover;
    border-radius: 8px;
    background: var(--line);
    flex-shrink: 0;
  }
  .beat-meta {
    min-width: 0;
    strong {
      display: block;
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    span {
      display: block;
      font-size: 11px;
      color: var(--muted-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.versions {
  margin-top: 10px;
  h4 {
    margin: 0 0 6px;
    font-size: 12px;
  }
  .version-row {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    border: 1px solid var(--line);
    background: var(--surface);
    border-radius: 10px;
    padding: 8px 10px;
    margin-bottom: 6px;
    cursor: pointer;
    text-align: left;
    strong {
      font-size: 12px;
    }
    em {
      font-style: normal;
      font-size: 11px;
      color: var(--muted-2);
    }
    &.on {
      border-color: rgb(212 240 122 / 70%);
      background: var(--accent-soft);
    }
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.note {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--muted-2);
}

.canvas-wrap {
  background: transparent;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 48px 16px 12px;
  gap: 12px;
}

.canvas-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  strong {
    font-size: 14px;
  }
  .actions {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }
  .export {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--ink-soft);
    text-decoration: none;
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 4px 10px;
    background: var(--surface);
  }
  .status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--muted);
    &.running {
      color: var(--accent-deep);
    }
  }
}

.stage {
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
  padding: 8px 0;
  background: rgb(255 255 255 / 62%);
  backdrop-filter: blur(6px);
  border-radius: 14px;
  border: 1px solid var(--line);
}

.stage-frame {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 0 0 1px var(--line), 0 12px 28px rgb(0 0 0 / 6%);
  background: var(--paper-2);
  max-width: 100%;
  max-height: 100%;
  display: grid;
  place-items: center;
}

.stage-frame.ar-16-9 {
  aspect-ratio: 16 / 9;
  width: min(100%, 640px);
  height: auto;
}

.stage-frame.ar-9-16 {
  aspect-ratio: 9 / 16;
  width: min(100%, 260px);
  height: auto;
}

.stage-frame.ar-1-1 {
  aspect-ratio: 1 / 1;
  width: min(100%, 400px);
  height: auto;
}

.stage-frame.ar-3-4 {
  aspect-ratio: 3 / 4;
  width: min(100%, 320px);
  height: auto;
}

.wait {
  background: var(--ink);
  color: var(--surface);
  font-size: 13px;
  padding: 10px 16px;
  border-radius: 999px;
}

.vid {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: var(--player-bg);
  display: block;
}

.progress {
  .progress-label {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: var(--muted);
    margin-bottom: 6px;
  }
  .bar {
    height: 6px;
    border-radius: 99px;
    background: var(--line);
    overflow: hidden;
    i {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, var(--accent-deep), var(--accent));
      border-radius: inherit;
    }
  }
}

.right {
  border-left: 1px solid var(--line);
  background: rgb(255 255 255 / 55%);
  backdrop-filter: blur(8px);
  padding: 48px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.prompt-bubble {
  background: var(--paper);
  border-radius: 14px;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--ink-soft);
  max-height: 88px;
  overflow: auto;
}

.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow: auto;
  flex: 1;
  li {
    padding: 10px 4px;
    border-bottom: 1px solid var(--paper);
  }
  .step-head {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 13px;
    span {
      font-size: 11px;
      color: var(--muted-2);
      &.running {
        color: var(--accent-deep);
      }
      &.done {
        color: var(--success);
      }
    }
  }
  p {
    margin: 4px 0 0;
    font-size: 11px;
    color: var(--muted-2);
  }
}

.chips {
  display: flex;
  flex-direction: column;
  gap: 8px;
  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    span {
      font-size: 11px;
      color: var(--muted-2);
      width: 100%;
    }
    button {
      border: 1px solid var(--line);
      background: var(--sidebar);
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 11px;
      color: var(--muted);
      cursor: pointer;
      &.on {
        background: var(--accent);
        border-color: var(--accent-deep);
        color: var(--ink);
        font-weight: 600;
      }
      &:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }
    }
  }
}

.composer {
  position: relative;
  width: 100%;
  textarea {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 12px 48px 12px 12px;
    resize: none;
    font: inherit;
    font-size: 13px;
    line-height: 1.45;
    color: var(--ink);
    background: var(--paper);
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    &:focus {
      border-color: var(--ink);
      box-shadow: 0 0 0 3px rgb(212 240 122 / 40%);
      background: var(--surface);
    }
    &:disabled {
      opacity: 0.55;
    }
  }
  .send {
    position: absolute;
    right: 8px;
    bottom: 8px;
    width: 34px;
    height: 34px;
    border-radius: 999px;
    border: 0;
    background: var(--ink);
    color: var(--accent);
    display: grid;
    place-items: center;
    cursor: pointer;
    &:disabled {
      background: var(--line-strong);
      color: var(--muted);
      cursor: not-allowed;
    }
  }
}

.err {
  margin: 0;
  font-size: 12px;
  color: var(--danger);
}
.spin {
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
