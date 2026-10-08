<template>
  <section class="create-panel">
    <header class="hero">
      <div class="hero-top">
        <h1>{{ t('studio.create.title') }}</h1>
        <p class="engine-line" :class="{ on: studio.engineReady, bad: !!studio.engineError }">
          {{
            studio.engineReady
              ? t('studio.create.engineReady')
              : studio.engineError || t('studio.create.engineStarting')
          }}
        </p>
      </div>
      <p>{{ t('studio.create.subtitle') }}</p>
    </header>

    <div class="composer">
      <div class="mode-tabs">
        <button
          v-for="m in FORM_MODES"
          :key="m.id"
          type="button"
          class="mode-tab"
          :class="{ on: formMode === m.id }"
          @click="applyMode(m.id)"
        >
          {{ t(`studio.create.modes.${m.id}`) }}
        </button>
      </div>

      <div v-if="tagsVisible" class="tags">
        <span v-if="detectedUrls.length" class="tag url" :title="detectedUrls.join('\n')">
          {{ t('studio.create.plus.urlExtract') }} · {{ detectedUrls.length }}
        </span>
        <div v-if="stylePick" class="tag-wrap" :class="{ 'has-preview': !!stylePreviewSrc }">
          <span class="tag style">
            <span v-if="stylePick.look" class="swatches" aria-hidden="true">
              <i :style="{ background: stylePick.look.canvas || '#eee' }" />
              <i :style="{ background: stylePick.look.accent || '#D4F07A' }" />
              <i :style="{ background: stylePick.look.ink || '#000' }" />
            </span>
            <span class="name">{{ stylePick.name }}</span>
            <button type="button" class="x" aria-label="remove" @click="stylePick = null">
              <AppIcon :icon="X" :size="12" :stroke-width="2" />
            </button>
          </span>
          <div v-if="stylePreviewSrc" class="tag-preview">
            <i />
            <img :src="stylePreviewSrc" alt="" />
          </div>
        </div>
        <div
          v-for="a in attachments"
          :key="a.id"
          class="tag-wrap"
          :class="{ 'has-preview': !!a.previewUrl }"
        >
          <span class="tag">
            <span class="name">{{ a.role && a.kind === 'image' ? `${a.role} · ${a.name}` : a.name }}</span>
            <button type="button" class="x" aria-label="remove" @click="removeAttach(a.id)">
              <AppIcon :icon="X" :size="12" :stroke-width="2" />
            </button>
          </span>
          <div v-if="a.previewUrl" class="tag-preview">
            <i />
            <img :src="a.previewUrl" alt="" />
          </div>
        </div>
      </div>

      <textarea
        class="prompt"
        rows="7"
        :value="prompt"
        :placeholder="placeholder"
        @input="onPromptEv"
        @keydown.meta.enter.prevent="submit"
        @keydown.ctrl.enter.prevent="submit"
      />

      <div v-if="topicSheetOpen && topicEntries.length" class="topic-sheet">
        <div class="topic-chips">
          <button
            v-for="topic in topicEntries"
            :key="topic.id"
            type="button"
            class="topic-chip"
            @click="fillTopic(topic.id)"
          >
            {{ topic.title }}
          </button>
        </div>
        <p v-if="topicTips" class="topic-tips">{{ topicTips }}</p>
      </div>

      <footer class="bar">
        <div class="bar-left">
          <div class="plus-wrap" ref="plusWrap">
            <button
              type="button"
              class="icon-btn"
              :class="{ on: plusOpen }"
              :title="t('studio.create.attachTitle')"
              @click="togglePlus"
            >
              <AppIcon :icon="Plus" :size="18" />
              <span v-if="plusDot" class="dot" />
            </button>
            <div v-if="plusOpen" class="plus-pop" :class="{ style: plusView === 'style' }" @click.stop>
              <template v-if="plusView === 'main'">
                <button type="button" class="plus-row" @click="fileInput?.click()">
                  <span class="plus-ico"><AppIcon :icon="Upload" :size="16" /></span>
                  <span>{{ t('studio.create.plus.upload') }}</span>
                </button>
                <button
                  type="button"
                  class="plus-row muted"
                  disabled
                  :title="t('studio.create.plus.musicDisabled')"
                >
                  <span class="plus-ico"><AppIcon :icon="Music" :size="16" /></span>
                  <span>{{ t('studio.create.plus.music') }}</span>
                  <em>{{ t('studio.create.plus.off') }}</em>
                </button>
                <button type="button" class="plus-row" @click="openVoice">
                  <span class="plus-ico"><AppIcon :icon="AudioLines" :size="16" /></span>
                  <span>{{ t('studio.create.plus.voice') }}</span>
                  <em>{{ speechVoiceShort }}</em>
                </button>
                <button type="button" class="plus-row" @click="openStyle">
                  <span class="plus-ico"><AppIcon :icon="ImageIcon" :size="16" /></span>
                  <span>{{ t('studio.create.plus.styleRef') }}</span>
                  <em v-if="stylePick">{{ t('studio.create.plus.on') }}</em>
                </button>
                <button type="button" class="plus-row" @click="webSearch = !webSearch">
                  <span class="plus-ico"><AppIcon :icon="Search" :size="16" /></span>
                  <span>{{ t('studio.create.plus.webSearch') }}</span>
                  <em :class="{ lit: webSearch }">{{
                    webSearch ? t('studio.create.plus.on') : t('studio.create.plus.off')
                  }}</em>
                </button>
                <button type="button" class="plus-row" @click="autoSfx = !autoSfx">
                  <span class="plus-ico"><AppIcon :icon="Volume2" :size="16" /></span>
                  <span>{{ t('studio.create.plus.autoSfx') }}</span>
                  <em :class="{ lit: autoSfx }">{{ autoSfx ? t('studio.create.plus.on') : t('studio.create.plus.off') }}</em>
                </button>
                <button
                  type="button"
                  class="plus-row"
                  :disabled="formMode === 'narrate'"
                  @click="cycleVo"
                >
                  <span class="plus-ico"><AppIcon :icon="Mic" :size="16" /></span>
                  <span>{{ t('studio.create.plus.vo') }}</span>
                  <em :class="{ lit: voMode !== 'auto' || formMode === 'narrate' }">{{ voLabel }}</em>
                </button>
                <button type="button" class="plus-row" @click="cycleDrive">
                  <span class="plus-ico"><AppIcon :icon="FileText" :size="16" /></span>
                  <span>{{ t('studio.create.plus.scriptDrive') }}</span>
                  <em>{{ driveLabel }}</em>
                </button>
              </template>
              <template v-else-if="plusView === 'voice'">
                <button type="button" class="plus-row" @click="plusView = 'main'">
                  <span class="plus-ico"><AppIcon :icon="ChevronLeft" :size="16" /></span>
                  <span>{{ t('studio.create.plus.back') }}</span>
                </button>
                <p v-if="myVoiceOptions.length" class="plus-empty">{{ t('studio.create.myVoices') }}</p>
                <button
                  v-for="v in myVoiceOptions"
                  :key="v.id"
                  type="button"
                  class="plus-row"
                  :class="{ on: speechVoice === v.id }"
                  @click="pickVoice(v.id)"
                >
                  <span>{{ v.label }}</span>
                  <em v-if="speechVoice === v.id"><AppIcon :icon="Check" :size="14" /></em>
                </button>
                <button
                  v-for="v in systemVoices"
                  :key="v.id"
                  type="button"
                  class="plus-row"
                  :class="{ on: speechVoice === v.id }"
                  @click="pickVoice(v.id)"
                >
                  <span>{{ edgeVoiceLabel(v) }}</span>
                  <em v-if="speechVoice === v.id"><AppIcon :icon="Check" :size="14" /></em>
                </button>
                <button type="button" class="plus-row" :disabled="previewing" @click="previewVoice">
                  <span class="plus-ico"><AppIcon :icon="Play" :size="16" /></span>
                  <span>{{ previewing ? t('studio.create.plus.previewing') : t('studio.create.plus.preview') }}</span>
                </button>
              </template>
              <template v-else-if="plusView === 'style'">
                <div class="style-head">
                  <button type="button" class="plus-row back" @click="plusView = 'main'">
                    <span class="plus-ico"><AppIcon :icon="ChevronLeft" :size="16" /></span>
                    <span>{{ t('studio.create.plus.back') }}</span>
                  </button>
                </div>
                <p class="style-hint">{{ t('studio.create.plus.styleHint') }}</p>
                <div class="style-grid">
                  <button
                    v-for="r in styleRefs"
                    :key="r.id"
                    type="button"
                    class="style-cell"
                    :class="{ on: stylePick?.id === r.id }"
                    :disabled="styleBusy"
                    :title="r.name"
                    @click="pickStyleRef(r)"
                  >
                    <img :src="styleThumb(r)" :alt="r.name" loading="lazy" />
                    <span v-if="stylePick?.id === r.id" class="style-check">
                      <AppIcon :icon="Check" :size="12" />
                    </span>
                  </button>
                </div>
                <p v-if="!styleRefs.length && !styleBusy" class="plus-empty">{{ t('studio.create.plus.noStyleRefs') }}</p>
                <div class="style-foot">
                  <button type="button" class="plus-row upload" :disabled="styleBusy" @click="styleInput?.click()">
                    <span class="plus-ico"><AppIcon :icon="Upload" :size="16" /></span>
                    <span>{{ t('studio.create.plus.uploadStyle') }}</span>
                  </button>
                  <em v-if="styleBusy">{{ t('studio.create.plus.styleBusy') }}</em>
                </div>
              </template>
            </div>
          </div>

          <input
            ref="fileInput"
            type="file"
            class="hidden-file"
            multiple
            accept="image/*,.txt,.md,.pdf"
            @change="onAttach"
          />
          <input ref="musicInput" type="file" class="hidden-file" accept="audio/*" @change="onMusic" />
          <input ref="styleInput" type="file" class="hidden-file" accept="image/*" @change="onStyleFile" />

          <button
            type="button"
            class="pill"
            :class="{ on: mediaKind === 'animation' }"
            @click="mediaKind = 'animation'"
          >
            {{ t('studio.create.animation') }}
          </button>
          <button type="button" class="pill muted" disabled :title="t('studio.create.aiVideoSoon')">
            {{ t('studio.create.aiVideo') }}
          </button>

          <div class="aspect-wrap">
            <button type="button" class="pill aspect" @click="aspectOpen = !aspectOpen">
              {{ aspect }} · {{ quality }}
              <AppIcon :icon="ChevronDown" :size="16" />
            </button>
            <div v-if="aspectOpen" class="aspect-menu">
              <button
                v-for="a in ASPECTS"
                :key="a"
                type="button"
                :class="{ on: aspect === a }"
                @click="aspect = a; aspectOpen = false"
              >
                {{ a }}
              </button>
              <div class="sep" />
              <button type="button" :class="{ on: quality === '1080p' }" @click="quality = '1080p'; aspectOpen = false">
                1080p
              </button>
              <button type="button" :class="{ on: quality === '720p' }" @click="quality = '720p'; aspectOpen = false">
                720p
              </button>
            </div>
          </div>
        </div>

        <div class="bar-right">
          <button type="button" class="link" :disabled="optimizing || !prompt.trim()" @click="optimize">
            {{ optimizing ? t('studio.create.optimizing') : t('studio.create.optimize') }}
          </button>
          <button
            type="button"
            class="submit"
            :disabled="busy || !canSubmit"
            :title="t('studio.create.submit')"
            @click="submit"
          >
            <AppIcon :icon="ArrowUp" :size="20" :stroke-width="1.8" />
          </button>
        </div>
      </footer>
    </div>

    <p v-if="busy" class="hint">{{ t('studio.create.densifying') }}</p>
    <p v-else-if="estimateLine" class="hint">{{ estimateLine }}</p>
    <p v-if="briefHint" class="hint">{{ briefHint }}</p>
    <p v-if="error" class="err">{{ error }}</p>
  </section>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTranslation } from 'i18next-vue'
import {
  ArrowUp,
  AudioLines,
  Check,
  ChevronDown,
  ChevronLeft,
  FileText,
  Image as ImageIcon,
  Mic,
  Music,
  Play,
  Plus,
  Search,
  Upload,
  Volume2,
  X,
} from '@lucide/vue'
import AppIcon from '@/components/AppIcon.vue'
import {
  engineApi,
  engineAssetUrl,
  type StyleLook,
  type StyleRefItem,
  type UserAsset,
} from '@/lib/engine-api'
import { detectContentLang, estimateCreate } from '@/lib/content-lang'
import {
  defaultEdgeVoice,
  edgeVoiceLabel,
  edgeVoicesForLang,
  uiVoiceLang,
  useSettingsStore,
  voiceMatchesUiLang,
} from '@/store/settings'
import { type Aspect, type FormMode, useStudioStore } from '@/store/studio'

const emit = defineEmits<{ created: [id: string] }>()

const { t, i18next } = useTranslation()
const router = useRouter()
const studio = useStudioStore()
const settings = useSettingsStore()

type Attach = {
  id: string
  name: string
  kind: 'image' | 'music' | 'doc'
  dataUrl: string
  role?: 'logo' | 'product' | 'shot' | 'image'
  previewUrl?: string
}

const FORM_MODES: { id: FormMode; aspect: Aspect }[] = [
  { id: 'prompt', aspect: '16:9' },
  { id: 'narrate', aspect: '16:9' },
  { id: 'short', aspect: '9:16' },
  { id: 'stickman', aspect: '16:9' },
  { id: 'launch', aspect: '16:9' },
]
const ASPECTS: Aspect[] = ['16:9', '9:16', '1:1', '3:4']

/** 各形态傻瓜话题手册（id 仍用 narrate/short/stickman/launch 兼容后端） */
const TOPIC_IDS: Record<Exclude<FormMode, 'prompt'>, string[]> = {
  narrate: ['ramen', 'honey', 'cats', 'beijing'],
  short: ['hook', 'list', 'loop'],
  stickman: ['draw', 'icon', 'build'],
  launch: ['three', 'chapters'],
}

const prompt = ref('')
const formMode = ref<FormMode>('prompt')
const topicSheetOpen = ref(false)
const aspect = ref<Aspect>('16:9')
const quality = ref<'1080p' | '720p'>('1080p')
const mediaKind = ref<'animation' | 'ai-video'>('animation')
const aspectOpen = ref(false)
const busy = ref(false)
const optimizing = ref(false)
const error = ref('')
const briefHint = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const musicInput = ref<HTMLInputElement | null>(null)
const styleInput = ref<HTMLInputElement | null>(null)
const plusWrap = ref<HTMLElement | null>(null)
const plusOpen = ref(false)
const plusView = ref<'main' | 'voice' | 'style'>('main')
const attachments = ref<Attach[]>([])
const webSearch = ref(false)
const autoSfx = ref(false)
const voMode = ref<'on' | 'off' | 'auto'>('auto')
const scriptDrive = ref<'off' | 'auto' | 'polish' | 'verbatim'>('auto')
const speechVoice = ref(settings.speech.voice || 'zh-CN-XiaoxiaoNeural')
const previewing = ref(false)
const styleRefs = ref<StyleRefItem[]>([])
const styleThumbMap = ref<Record<string, string>>({})
const styleBusy = ref(false)
const stylePick = ref<{
  id?: string
  name: string
  dataUrl?: string
  previewUrl?: string
  look?: StyleLook
} | null>(null)

const stylePreviewSrc = computed(
  () => stylePick.value?.previewUrl || stylePick.value?.dataUrl || '',
)

const placeholder = computed(() => t(`studio.create.placeholders.${formMode.value}`))
const topicEntries = computed(() => {
  if (formMode.value === 'prompt') return [] as { id: string; title: string }[]
  const ids = TOPIC_IDS[formMode.value] || []
  return ids.map((id) => ({
    id,
    title: t(`studio.create.quickbook.topics.${formMode.value}.${id}.title`),
  }))
})
const topicTips = computed(() => {
  if (formMode.value === 'prompt' || !topicSheetOpen.value) return ''
  return t(`studio.create.quickbook.tips.${formMode.value}`)
})
const hasDoc = computed(() => attachments.value.some((a) => a.kind === 'doc'))
const canSubmit = computed(
  () => prompt.value.trim().length > 0 || (formMode.value === 'narrate' && hasDoc.value),
)
const detectedUrls = computed(() => {
  const found = prompt.value.match(/https?:\/\/[^\s<>"'）】\]]+/gi) || []
  const uniq: string[] = []
  for (const raw of found) {
    const u = raw.replace(/[.,;:!?。，；：！？]+$/u, '')
    if (!uniq.includes(u)) uniq.push(u)
    if (uniq.length >= 3) break
  }
  return uniq
})
const tagsVisible = computed(
  () => !!stylePick.value || attachments.value.length > 0 || detectedUrls.value.length > 0,
)
const plusDot = computed(
  () =>
    attachments.value.length > 0 ||
    !!stylePick.value ||
    autoSfx.value ||
    webSearch.value ||
    voMode.value !== 'auto' ||
    scriptDrive.value !== 'auto',
)
/** 形态提示用语：跟提示词观众语走，不用界面语言当 contentLang */
const packLang = computed(() => detectContentLang(prompt.value))
const voiceLang = computed(() => {
  void i18next.language
  return uiVoiceLang(i18next.language)
})
const systemVoices = computed(() => edgeVoicesForLang(voiceLang.value))
const myVoiceOptions = computed(() =>
  (settings.speech.myVoices || []).map((v) => ({
    id: `my:${v.id}`,
    label: `${v.name} · ${v.provider}`,
  })),
)
const speechVoiceShort = computed(() => {
  const mine = myVoiceOptions.value.find((v) => v.id === speechVoice.value)
  if (mine) return mine.label.split('·')[0]?.trim() || mine.label
  const sys = systemVoices.value.find((v) => v.id === speechVoice.value)
  if (sys) return sys.name
  const any = edgeVoicesForLang(voiceLang.value === 'zh' ? 'en' : 'zh').find(
    (v) => v.id === speechVoice.value,
  )
  if (any) return any.name
  return speechVoice.value.startsWith('my:') ? t('studio.create.myVoices') : speechVoice.value
})
const estimateLine = computed(() => {
  if (!prompt.value.trim() && !hasDoc.value) return ''
  const e = estimateCreate(prompt.value, hasDoc.value, formMode.value)
  return t('studio.create.estimate', {
    sec: e.durationSec,
    low: e.waitMinLow,
    high: e.waitMinHigh,
  })
})
const voLabel = computed(() => {
  if (formMode.value === 'narrate') return t('studio.create.plus.voLocked')
  if (voMode.value === 'on') return t('studio.create.plus.on')
  if (voMode.value === 'off') return t('studio.create.plus.off')
  return t('studio.create.plus.auto')
})
const driveLabel = computed(() => {
  const m: Record<string, string> = {
    off: t('studio.create.plus.off'),
    auto: t('studio.create.plus.auto'),
    polish: t('studio.create.plus.polish'),
    verbatim: t('studio.create.plus.verbatim'),
  }
  return m[scriptDrive.value] || scriptDrive.value
})
function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result || ''))
    r.onerror = () => reject(r.error || new Error('read failed'))
    r.readAsDataURL(file)
  })
}

function uid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

function guessRole(name: string): Attach['role'] {
  const n = name.toLowerCase()
  if (/logo/.test(n)) return 'logo'
  if (/product|pack|sku/.test(n)) return 'product'
  if (/shot|scene|frame/.test(n)) return 'shot'
  return 'image'
}

async function addFiles(files: File[], kindHint?: Attach['kind']) {
  const next: Attach[] = []
  for (const f of files.slice(0, 8)) {
    if (f.size > 12 * 1024 * 1024) {
      error.value = t('studio.create.fileTooLarge', { name: f.name })
      continue
    }
    const dataUrl = await readDataUrl(f)
    if (!dataUrl.startsWith('data:')) continue
    const kind: Attach['kind'] = kindHint
      || (f.type.startsWith('image/') ? 'image' : f.type.startsWith('audio/') ? 'music' : 'doc')
    next.push({
      id: uid(),
      name: f.name.slice(0, 120),
      kind,
      dataUrl,
      role: kind === 'image' ? guessRole(f.name) : undefined,
      previewUrl: kind === 'image' ? dataUrl : undefined,
    })
  }
  if (kindHint === 'music') {
    attachments.value = [...attachments.value.filter((a) => a.kind !== 'music'), ...next.slice(0, 1)]
  } else {
    attachments.value = [...attachments.value, ...next].slice(0, 10)
  }
}

async function onAttach(ev: Event) {
  const input = ev.target as HTMLInputElement
  await addFiles(Array.from(input.files || []))
  input.value = ''
  plusOpen.value = false
}

async function onMusic(ev: Event) {
  const input = ev.target as HTMLInputElement
  await addFiles(Array.from(input.files || []), 'music')
  input.value = ''
  plusOpen.value = false
}

function removeAttach(id: string) {
  attachments.value = attachments.value.filter((a) => a.id !== id)
}

function applyMode(id: FormMode) {
  // 自由创作：无话题手册；其他形态：点开/再点关
  if (id === 'prompt') {
    formMode.value = 'prompt'
    topicSheetOpen.value = false
  } else if (formMode.value === id && topicSheetOpen.value) {
    topicSheetOpen.value = false
    return
  } else {
    formMode.value = id
    topicSheetOpen.value = true
  }

  const m = FORM_MODES.find((x) => x.id === id)
  if (m) aspect.value = m.aspect
  if (id === 'narrate') {
    voMode.value = 'on'
    scriptDrive.value = 'auto'
  } else if (id === 'stickman') {
    // 产品品牌 · Logo 片：默认可无旁白
    voMode.value = 'off'
    scriptDrive.value = 'off'
  } else if (id === 'launch') {
    // 素材叙事：旁白 + 文稿/链接驱动
    voMode.value = 'on'
    scriptDrive.value = 'auto'
  } else if (id === 'short') {
    voMode.value = 'on'
    scriptDrive.value = 'auto'
  } else {
    voMode.value = 'auto'
    scriptDrive.value = 'auto'
  }
}

function fillTopic(topicId: string) {
  if (formMode.value === 'prompt') return
  const fill = t(`studio.create.quickbook.topics.${formMode.value}.${topicId}.fill`)
  if (!fill || fill.startsWith('studio.create.')) return
  prompt.value = fill
  briefHint.value = ''
  error.value = ''
}

function onPromptInput(next: string) {
  prompt.value = next
  briefHint.value = ''
}

function onPromptEv(ev: Event) {
  onPromptInput((ev.target as HTMLTextAreaElement).value)
}

function togglePlus() {
  plusOpen.value = !plusOpen.value
  plusView.value = 'main'
}

function cycleVo() {
  if (formMode.value === 'narrate') return
  voMode.value = voMode.value === 'auto' ? 'on' : voMode.value === 'on' ? 'off' : 'auto'
}

function cycleDrive() {
  const order: Array<'off' | 'auto' | 'polish' | 'verbatim'> = ['auto', 'polish', 'verbatim', 'off']
  const i = order.indexOf(scriptDrive.value)
  scriptDrive.value = order[(i + 1) % order.length]
}

async function openVoice() {
  plusView.value = 'voice'
}

function styleThumb(r: StyleRefItem) {
  return styleThumbMap.value[r.id] || r.url
}

async function openStyle() {
  plusView.value = 'style'
  styleBusy.value = true
  try {
    await studio.ensureEngine()
    const list = await engineApi.listStyleRefs()
    styleRefs.value = list
    const map: Record<string, string> = {}
    await Promise.all(
      list.map(async (r) => {
        map[r.id] = await engineAssetUrl(r.url)
      }),
    )
    styleThumbMap.value = map
  } catch {
    styleRefs.value = []
    styleThumbMap.value = {}
  } finally {
    styleBusy.value = false
  }
}

function pickVoice(id: string) {
  speechVoice.value = id
  settings.updateSpeech({ voice: id })
}

async function previewVoice() {
  previewing.value = true
  error.value = ''
  try {
    await studio.ensureEngine()
    const { syncSettingsToEngine } = await import('@/lib/sync-settings')
    await syncSettingsToEngine()
    const res = await engineApi.speechPreview({
      voice: speechVoice.value,
      // 跟当前音色语种一致，避免英文音色配中文试听句被服务端换声
      text:
        voiceLang.value === 'en'
          ? 'Hello, this is a voice preview.'
          : t('studio.create.plus.previewText'),
    })
    const audio = new Audio(`data:${res.mime};base64,${res.base64}`)
    await audio.play()
  } catch (e: any) {
    error.value = e?.message || String(e)
  } finally {
    previewing.value = false
  }
}

async function applyStyle(next: {
  id?: string
  name: string
  dataUrl?: string
  previewUrl?: string
}) {
  styleBusy.value = true
  error.value = ''
  try {
    await studio.ensureEngine()
    const res = await engineApi.extractStyleRef({
      styleRefId: next.id,
      styleRefDataUrl: next.dataUrl,
    })
    stylePick.value = { ...next, look: res.look }
    plusOpen.value = false
    plusView.value = 'main'
  } catch (e: any) {
    error.value = e?.message || String(e)
    stylePick.value = next
  } finally {
    styleBusy.value = false
  }
}

function pickStyleRef(r: StyleRefItem) {
  void applyStyle({
    id: r.id,
    name: r.name,
    previewUrl: styleThumb(r),
  })
}

async function onStyleFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  const dataUrl = await readDataUrl(f)
  await applyStyle({ name: f.name.slice(0, 80), dataUrl, previewUrl: dataUrl })
}

function modeHintLine(lang?: 'zh' | 'en' | 'bilingual') {
  const en = (lang || packLang.value) === 'en'
  if (formMode.value === 'narrate') {
    if (en) {
      return hasDoc.value
        ? 'Form: explainer / knowledge film; VO on; script-drive polish from uploaded docs.'
        : 'Form: explainer / knowledge film; VO on.'
    }
    return hasDoc.value
      ? '形态：讲解科普；VO on；文稿驱动（script-drive polish）。'
      : '形态：讲解科普；VO on。'
  }
  if (formMode.value === 'stickman') {
    return en
      ? 'Form: brand / logo motion; prefer uploaded SVG/PNG as the hero mark.'
      : '形态：产品品牌 · Logo 动效；优先用上传的 SVG/PNG 作为主角标志。'
  }
  if (formMode.value === 'short') {
    return en ? 'Form lean: vertical short-form video (9:16).' : '形态倾向：竖屏短视频（9:16）。'
  }
  if (formMode.value === 'launch') {
    return en
      ? 'Form: source-driven story — article URL / topic / attachments into a narrated film.'
      : '形态：素材叙事 — 文章链接 / 话题 / 附件驱动讲解片。'
  }
  return ''
}

function packPrompt(raw: string) {
  const lang = detectContentLang(raw)
  const sendVo = formMode.value === 'narrate' ? 'on' : voMode.value
  const sendDrive =
    formMode.value === 'narrate'
      ? hasDoc.value
        ? 'polish'
        : scriptDrive.value === 'off'
          ? 'auto'
          : scriptDrive.value
      : scriptDrive.value
  const brandHint =
    formMode.value === 'stickman'
      && attachments.value.some((a) => a.kind === 'image')
      && !/logo|标志|svg|icon|wordmark/i.test(raw)
      ? lang === 'en'
        ? 'Brand logo assets attached — treat uploaded mark as the hero; no invented alternate logos.'
        : '已附品牌标志素材 — 以上传标志为主角，勿另造 Logo。'
      : ''
  // 仅画布/动效：字体、弹簧、景深、构图、绘图、配色（旁白/片型另管）
  const craftFloor = lang === 'en'
    ? 'Craft floor (canvas/motion): hero type ≥72–140px; spring slam; perspective/depth layers; full-bleed or oversized subject; stroke/diagram draw when useful; palette from THIS topic — forbid tiny centered micro-UI.'
    : '画面增效（仅画布/动效）：字号≥72 动能排版；弹簧动画；透视/分层景深；满幅或超大主体；需要时用描边/图表绘制；配色跟主题走——禁止缩在画面中央的小控件。'
  return [
    raw,
    modeHintLine(lang),
    brandHint,
    craftFloor,
    stylePick.value ? `Design reference: ${stylePick.value.name} (lock skin from image).` : '',
    attachments.value.some((a) => a.kind === 'image')
      ? `Screen assets attached: ${attachments.value
          .filter((a) => a.kind === 'image')
          .map((a) => `${a.role || 'image'}:${a.name}`)
          .join(', ')} — place on canvas.`
      : '',
    hasDoc.value
      ? `Source docs attached: ${attachments.value
          .filter((a) => a.kind === 'doc')
          .map((a) => a.name)
          .join(', ')}`
      : '',
    detectedUrls.value.length
      ? `URL extract: auto — fetch page body from ${detectedUrls.value.length} link(s) into the brief (no LLM).`
      : '',
    webSearch.value
      ? 'Web search: on — engine will fetch live snippets and ground the brief (do not invent sources).'
      : '',
    autoSfx.value
      ? 'Auto SFX: on — multi-hit enter/accent/settle timeline from open Kenney+Remotion library.'
      : '',
    sendVo === 'off'
      ? 'No voice-over — music/SFX led only.'
      : sendVo === 'on'
        ? 'Voice-over required on every beat.'
        : '',
    sendDrive === 'polish' || (sendDrive === 'auto' && hasDoc.value)
      ? 'Script-drive: polish uploaded narration into film-ready VO, then lock lines verbatim for TTS.'
      : '',
    sendDrive === 'verbatim'
      ? 'Script-drive: split uploaded narration verbatim — do not rewrite VO lines.'
      : '',
  ]
    .filter(Boolean)
    .join('\n')
}

async function optimize() {
  if (!prompt.value.trim()) return
  optimizing.value = true
  error.value = ''
  briefHint.value = ''
  try {
    if (!settings.llm.apiKey || !settings.llm.apiUrl || !settings.llm.modelName) {
      error.value = t('studio.create.needLlm')
      return
    }
    const { syncSettingsToEngine } = await import('@/lib/sync-settings')
    await syncSettingsToEngine()
    const modeHint = modeHintLine()
    const out = await engineApi.optimizePrompt(
      [prompt.value.trim(), modeHint].filter(Boolean).join('\n'),
      aspect.value,
    )
    if (out.audiencePrompt || out.prompt) prompt.value = out.audiencePrompt || out.prompt
    briefHint.value = [
      t('studio.create.briefDual'),
      out.contentLang ? `${t('studio.create.briefLang')} ${out.contentLang}` : '',
      out.primaryGuess,
      out.lookLock,
      t('studio.create.briefMachine'),
    ]
      .filter(Boolean)
      .join(' · ')
  } catch (e: any) {
    error.value = e?.message || String(e)
  } finally {
    optimizing.value = false
  }
}

async function submit() {
  if (!canSubmit.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await studio.ensureEngine()
    settings.updateSpeech({ voice: speechVoice.value })
    const { syncSettingsToEngine } = await import('@/lib/sync-settings')
    await syncSettingsToEngine()

    const raw =
      prompt.value.trim() ||
      (formMode.value === 'narrate' && hasDoc.value
        ? '根据上传文稿制作讲解科普动画。'
        : '')
    const sendVo = formMode.value === 'narrate' ? 'on' : voMode.value
    const sendDrive =
      formMode.value === 'narrate'
        ? hasDoc.value
          ? 'polish'
          : scriptDrive.value === 'off'
            ? 'auto'
            : scriptDrive.value
        : scriptDrive.value

    // 配乐功能已禁用：不上传、不提交 audio
    const userAssets: UserAsset[] = attachments.value
      .filter((a) => a.kind !== 'music' && a.dataUrl.startsWith('data:'))
      .map((a) => ({
        name: a.name,
        dataUrl: a.dataUrl,
        kind: a.kind,
        role: a.role,
      }))

    const contentLang = detectContentLang(raw)
    const task = await studio.createAndMake({
      prompt: packPrompt(raw),
      formMode: formMode.value,
      aspect: aspect.value,
      quality: quality.value,
      mediaKind: mediaKind.value,
      autoSfx: autoSfx.value,
      voMode: sendVo,
      scriptDrive: sendDrive,
      styleRefId: stylePick.value?.id,
      styleRefDataUrl: stylePick.value?.dataUrl,
      userAssets: userAssets.length ? userAssets : undefined,
      contentLang,
      webSearch: webSearch.value,
    })
    emit('created', task.id)
    // 排在别人后面时留在创作页，方便连提下一单；首位/已开跑则进工作台
    const behind = task.status === 'queued' && (task.queuePosition || 0) > 0
    if (behind) {
      prompt.value = ''
      briefHint.value = t('studio.create.queuedStay', {
        n: task.queuePosition,
      })
    } else {
      await router.push({ name: 'workbench', params: { id: task.id } })
    }
  } catch (e: any) {
    error.value = e?.message || String(e)
  } finally {
    busy.value = false
  }
}

function onDocClick(ev: MouseEvent) {
  if (!plusOpen.value) return
  const el = plusWrap.value
  if (el && !el.contains(ev.target as Node)) {
    plusOpen.value = false
    plusView.value = 'main'
  }
}

watch(
  voiceLang,
  (lang) => {
    if (!voiceMatchesUiLang(speechVoice.value, lang)) {
      const next = defaultEdgeVoice(lang)
      speechVoice.value = next
      settings.updateSpeech({ voice: next })
    }
  },
  { immediate: true },
)

onMounted(() => {
  void studio.ensureEngine().catch(() => {})
  document.addEventListener('click', onDocClick)
})
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<style lang="scss" scoped>
.create-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.hero {
  .hero-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  h1 {
    margin: 0;
    font-family: var(--display);
    font-size: 34px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--ink);
    min-width: 0;
  }
  > p {
    margin: 8px 0 0;
    font-size: 13px;
    line-height: 1.55;
    color: var(--muted);
    max-width: 42em;
  }
  .engine-line {
    flex-shrink: 0;
    margin: 4px 0 0;
    padding: 4px 10px;
    border-radius: var(--radius-pill);
    font-size: 12px;
    background: var(--paper-2);
    color: var(--muted);
    white-space: nowrap;
    &.on {
      background: var(--accent-soft);
      color: var(--ink);
    }
    &.bad {
      background: #fdecea;
      color: var(--danger);
      white-space: normal;
      max-width: 180px;
      text-align: right;
    }
  }
}

.workflows {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.wf-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  strong {
    font-size: 13px;
    font-weight: 650;
    color: var(--ink);
  }
  span {
    font-size: 12px;
    color: var(--muted);
  }
}

.wf-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.wf-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-height: 118px;
  padding: 14px 14px 12px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background:
    linear-gradient(160deg, rgb(212 240 122 / 18%), transparent 42%),
    var(--surface);
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
  strong {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  span {
    font-size: 12px;
    color: var(--muted);
    line-height: 1.35;
  }
  i {
    margin-top: auto;
    font-style: normal;
    font-size: 11px;
    color: var(--ink);
    opacity: 0.72;
  }
  &[data-cover='present'] {
    background:
      linear-gradient(160deg, rgb(120 180 255 / 16%), transparent 46%),
      var(--surface);
  }
  &[data-cover='next-word'] {
    background:
      linear-gradient(160deg, rgb(255 170 90 / 18%), transparent 46%),
      var(--surface);
  }
  &[data-cover='data'] {
    background:
      linear-gradient(160deg, rgb(160 140 255 / 14%), transparent 46%),
      var(--surface);
  }
  &[data-aspect='9:16'] {
    min-height: 132px;
  }
  &:hover {
    border-color: rgb(0 0 0 / 22%);
    transform: translateY(-1px);
    box-shadow: var(--shadow);
  }
  &.on {
    border-color: var(--ink);
    box-shadow: 0 0 0 1px var(--ink);
  }
}

.wf-aspect {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgb(0 0 0 / 8%);
  font-size: 10px;
  font-style: normal;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.composer {
  flex: 1;
  min-height: 280px;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-radius: 22px;
  box-shadow: var(--shadow);
  border: 1px solid var(--line);
  overflow: visible;
}

.mode-tabs {
  display: flex;
  gap: 4px;
  padding: 12px 14px 0;
  flex-wrap: wrap;
}

.mode-tab {
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
  padding: 8px 14px;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  &.on {
    background: var(--ink);
    color: var(--accent);
  }
  &.tpl {
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 14px 0;
  position: relative;
  z-index: 5;
}

.tag-wrap {
  position: relative;
  max-width: 100%;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 220px;
  padding: 5px 8px 5px 10px;
  border-radius: var(--radius-pill);
  background: var(--accent-soft);
  border: 1px solid rgb(212 240 122 / 55%);
  font-size: 12px;
  color: var(--ink);
  &.url {
    border-color: rgb(90 140 255 / 40%);
    background: rgb(90 140 255 / 12%);
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .swatches {
    display: inline-flex;
    gap: 3px;
    flex-shrink: 0;
    i {
      width: 10px;
      height: 10px;
      border-radius: 99px;
      border: 1px solid rgb(0 0 0 / 12%);
      display: block;
    }
  }
  .x {
    width: 18px;
    height: 18px;
    border: 0;
    border-radius: 99px;
    background: transparent;
    cursor: pointer;
    color: var(--muted);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 0;
    line-height: 0;
    &:hover {
      background: rgb(0 0 0 / 6%);
      color: var(--ink);
    }
  }
}

.tag-preview {
  display: none;
  position: absolute;
  z-index: 40;
  left: 50%;
  top: calc(100% + 10px);
  transform: translateX(-50%);
  width: 220px;
  padding: 8px;
  background: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--line);
  box-shadow: var(--shadow-pop);
  i {
    position: absolute;
    left: 50%;
    top: -5px;
    width: 10px;
    height: 10px;
    background: var(--surface);
    border-left: 1px solid var(--line);
    border-top: 1px solid var(--line);
    transform: translateX(-50%) rotate(45deg);
  }
  img {
    width: 100%;
    border-radius: 8px;
    display: block;
    aspect-ratio: 16 / 10;
    object-fit: cover;
  }
}

.tag-wrap.has-preview:hover .tag-preview {
  display: block;
}

.topic-sheet {
  padding: 10px 14px 4px;
  border-top: 1px solid var(--line);
  background: linear-gradient(180deg, rgb(0 0 0 / 2%), transparent);
}

.topic-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.topic-chip {
  border: 1px solid var(--line);
  background: var(--paper);
  color: var(--ink);
  font-size: 12px;
  font-weight: 600;
  padding: 7px 12px;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
  &:hover {
    background: var(--accent-soft);
    border-color: rgb(212 240 122 / 55%);
  }
}

.topic-tips {
  margin: 10px 2px 4px;
  font-size: 11px;
  color: var(--muted);
  line-height: 1.4;
}

.prompt {
  flex: 1;
  width: 100%;
  border: 0;
  resize: none;
  padding: 16px 18px;
  font-size: 15px;
  line-height: 1.6;
  outline: none;
  background: transparent;
  color: var(--ink);
  font-family: inherit;
}

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px 12px;
  border-top: 1px solid var(--line);
}

.bar-left,
.bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.plus-wrap {
  position: relative;
}

.icon-btn {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  display: grid;
  place-items: center;
  cursor: pointer;
  &.on {
    background: var(--accent-soft);
    border-color: var(--accent-deep);
  }
  .dot {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 7px;
    height: 7px;
    border-radius: 99px;
    background: var(--accent);
    box-shadow: 0 0 0 1px var(--ink);
  }
}

.plus-pop {
  position: absolute;
  left: 0;
  bottom: calc(100% + 8px);
  width: 268px;
  max-height: 360px;
  overflow: auto;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 16px;
  box-shadow: var(--shadow-pop);
  padding: 6px;
  z-index: 20;
  &.style {
    width: 320px;
    max-height: 420px;
    display: flex;
    flex-direction: column;
    padding: 8px;
  }
}

.style-head .plus-row.back {
  padding: 6px 8px;
}

.style-hint {
  margin: 0 4px 8px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--muted-2);
}

.style-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  padding: 0 4px 8px;
  overflow: auto;
  flex: 1;
  min-height: 0;
}

.style-cell {
  position: relative;
  width: 100%;
  padding: 0 0 100%;
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
  background: var(--paper);
  cursor: pointer;
  &:hover {
    border-color: var(--ink-soft);
  }
  &.on {
    outline: 2px solid var(--ink);
    outline-offset: 1px;
  }
  &:disabled {
    opacity: 0.55;
    cursor: wait;
  }
  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.style-check {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 1;
  width: 18px;
  height: 18px;
  border-radius: 99px;
  background: rgb(0 0 0 / 55%);
  color: #fff;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.style-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid var(--line);
  padding-top: 6px;
  .plus-row.upload {
    flex: 1;
  }
  em {
    font-style: normal;
    font-size: 11px;
    color: var(--muted-2);
    white-space: nowrap;
  }
}

.plus-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  text-align: left;
  padding: 9px 10px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  color: var(--ink);
  > span:not(.plus-ico) {
    flex: 1;
  }
  .plus-ico {
    width: 28px;
    height: 28px;
    border-radius: 9px;
    background: var(--paper);
    display: grid;
    place-items: center;
    color: var(--ink);
  }
  em {
    font-style: normal;
    font-size: 11px;
    color: var(--muted-2);
    &.lit {
      color: var(--ink);
      background: var(--accent);
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      font-weight: 600;
    }
  }
  &:disabled,
  &.muted {
    opacity: 0.55;
    cursor: not-allowed;
  }
  &:hover,
  &.on {
    background: var(--paper);
  }
  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.plus-empty {
  margin: 0;
  padding: 8px 10px;
  font-size: 12px;
  color: var(--muted-2);
}

.pill {
  height: 36px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line);
  background: var(--surface);
  font-size: 13px;
  color: var(--ink-soft);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  &.on {
    background: var(--accent);
    border-color: var(--accent-deep);
    color: var(--ink);
    font-weight: 600;
  }
  &.muted {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.aspect-wrap {
  position: relative;
}

.aspect-menu {
  position: absolute;
  left: 0;
  bottom: calc(100% + 8px);
  min-width: 120px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-pop);
  padding: 6px;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 2px;
  button {
    border: 0;
    background: transparent;
    text-align: left;
    padding: 8px 10px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    color: var(--ink);
    &.on,
    &:hover {
      background: var(--accent-soft);
    }
  }
  .sep {
    height: 1px;
    background: var(--line);
    margin: 4px 0;
  }
}

.link {
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
  &:hover:not(:disabled) {
    color: var(--ink);
  }
  &:disabled {
    opacity: 0.4;
  }
}

.submit {
  width: 42px;
  height: 42px;
  border-radius: var(--radius-pill);
  border: 0;
  background: var(--line-strong);
  color: var(--muted);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  &:not(:disabled) {
    background: var(--ink);
    color: var(--accent);
  }
  &:disabled {
    cursor: not-allowed;
  }
}

.hint,
.err {
  margin: 0;
  font-size: 12px;
}
.hint {
  color: var(--muted-2);
}
.err {
  color: var(--danger);
}
.hidden-file {
  display: none;
}
</style>
