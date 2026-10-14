<template>
  <section class="create-panel">
    <header class="hero">
      <div class="hero-top">
        <h1>{{ t('studio.create.title') }}</h1>
        <p class="engine-line" :class="{ on: studio.engineReady, bad: !!studio.engineError }">
          <span>{{
            studio.engineReady
              ? t('studio.create.engineReady')
              : studio.engineError || t('studio.create.engineStarting')
          }}</span>
          <template v-if="studio.engineReady && licenseBadge">
            <span class="eng-sep">|</span>
            <button type="button" class="lic-chip" :class="licenseBadge.badge" @click="licenseOpen = true">
              {{ licenseBadge.text }}
            </button>
          </template>
        </p>
      </div>
      <p>{{ t('studio.create.subtitle') }}</p>
    </header>

    <ActivationDialog
      v-model="licenseOpen"
      :entitlement="license"
      @activated="onLicenseActivated"
    />

    <div class="composer">
      <div class="mode-tabs">
        <button
          v-for="m in modeTabs"
          :key="m.id"
          type="button"
          class="mode-tab"
          :class="{ on: formMode === m.id }"
          @click="applyMode(m.id)"
        >
          {{ m.label }}
        </button>
      </div>

      <div v-if="tagsVisible" class="tags">
        <span v-if="detectedUrls.length" class="tag url" :title="detectedUrls.join('\n')">
          {{ t('studio.create.plus.urlExtract') }} · {{ detectedUrls.length }}
        </span>
        <div v-if="stylePreset" class="tag-wrap">
          <span class="tag style-preset">
            <span class="name">{{ stylePresetLabel }}</span>
            <button type="button" class="x" aria-label="remove" @click="stylePresetId = null">
              <AppIcon :icon="X" :size="12" :stroke-width="2" />
            </button>
          </span>
        </div>
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

      <div v-if="formMode === 'remix'" class="footage-bar">
        <button type="button" class="footage-pick" @click="pickFootageFolder">
          <AppIcon :icon="FolderOpen" :size="16" />
          <span class="footage-path">{{
            footageFolder
              ? footageFolder
              : t('studio.create.footage.pick')
          }}</span>
        </button>
        <em v-if="footageCount > 0" class="footage-count">
          {{ t('studio.create.footage.count', { n: footageCount }) }}
        </em>
        <em v-else-if="footageFolder" class="footage-count warn">
          {{ t('studio.create.footage.empty') }}
        </em>
        <template v-if="remixTopicId === 'promo'">
          <input
            v-model="remixBrand"
            type="text"
            class="footage-input"
            :placeholder="t('studio.create.footage.brand')"
          />
          <input
            v-model="remixSellingPoints"
            type="text"
            class="footage-input wide"
            :placeholder="t('studio.create.footage.sellingPoints')"
          />
        </template>
        <template v-else-if="remixTopicId === 'story' || remixTopicId === 'tips'">
          <input
            v-model="remixTheme"
            type="text"
            class="footage-input wide"
            :placeholder="t('studio.create.footage.theme')"
          />
        </template>
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
            :class="{ on: formMode === 'remix' && remixTopicId === topic.id }"
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
            <div
              v-if="plusOpen"
              class="plus-pop"
              :class="{
                sheet: plusView === 'style' || plusView === 'voice',
                style: plusView === 'style',
                voice: plusView === 'voice',
              }"
              @click.stop
            >
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
                  <em v-if="stylePick || stylePresetId">{{ t('studio.create.plus.on') }}</em>
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
                  @click="cycleVoiceOver"
                >
                  <span class="plus-ico"><AppIcon :icon="Mic" :size="16" /></span>
                  <span>{{ t('studio.create.plus.vo') }}</span>
                  <em :class="{ lit: voiceOverLit }">{{ voiceOverLabel }}</em>
                </button>
              </template>
              <template v-else-if="plusView === 'voice'">
                <div class="voice-head">
                  <button type="button" class="plus-row back" @click="plusView = 'main'">
                    <span class="plus-ico"><AppIcon :icon="ChevronLeft" :size="16" /></span>
                    <span>{{ t('studio.create.plus.back') }}</span>
                  </button>
                </div>
                <div class="voice-list">
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
                </div>
                <div class="voice-foot">
                  <button
                    type="button"
                    class="plus-row preview"
                    :disabled="previewing"
                    @click="previewVoice"
                  >
                    <span class="plus-ico"><AppIcon :icon="Play" :size="16" /></span>
                    <span>{{
                      previewing ? t('studio.create.plus.previewing') : t('studio.create.plus.preview')
                    }}</span>
                  </button>
                </div>
              </template>
              <template v-else-if="plusView === 'style'">
                <div class="style-head">
                  <button type="button" class="plus-row back" @click="plusView = 'main'">
                    <span class="plus-ico"><AppIcon :icon="ChevronLeft" :size="16" /></span>
                    <span>{{ t('studio.create.plus.back') }}</span>
                  </button>
                </div>
                <p class="style-hint">{{ t('studio.create.plus.presetHint') }}</p>
                <div class="preset-chips">
                  <button
                    v-for="p in stylePresets"
                    :key="p.id"
                    type="button"
                    class="preset-chip"
                    :class="{ on: stylePresetId === p.id }"
                    :title="p.mainTechnique"
                    @click="toggleStylePreset(p.id)"
                  >
                    {{ stylePresetName(p) }}
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
  FolderOpen,
  Image as ImageIcon,
  Mic,
  Music,
  Plus,
  Search,
  Upload,
  Volume2,
  X,
} from '@lucide/vue'
import AppIcon from '@/components/AppIcon.vue'
import ActivationDialog from '@/components/ActivationDialog.vue'
import {
  engineApi,
  engineAssetUrlSync,
  rememberEngineRoot,
  defaultCreateCatalog,
  type CreateCatalog,
  type CreateCase,
  type CreateFormType,
  type EntitlementSnapshot,
  type StyleLook,
  type StyleRefItem,
  type UserAsset,
} from '@/lib/engine-api'
import { detectContentLang, estimateCreate } from '@/lib/content-lang'
import { classifyTaskError, voiceNoticeKey } from '@/lib/notice-kind'
import { pushNotice } from '@/lib/notice'
import { useAppStore } from '@/store'
import {
  defaultEdgeVoice,
  edgeVoiceLabel,
  edgeVoicesForLang,
  speechVoiceForLang,
  uiVoiceLang,
  useSettingsStore,
} from '@/store/settings'
import { type Aspect, type FormMode, useStudioStore } from '@/store/studio'

const emit = defineEmits<{ created: [id: string] }>()

const { t, i18next } = useTranslation()
const router = useRouter()
const studio = useStudioStore()
const settings = useSettingsStore()
const appStore = useAppStore()

type Attach = {
  id: string
  name: string
  kind: 'image' | 'music' | 'doc'
  dataUrl: string
  role?: 'logo' | 'product' | 'shot' | 'image'
  previewUrl?: string
}

/** 本地固定：自由 / 混剪；中间类型来自 create-catalog */
const LOCAL_MODE_ASPECT: Record<string, Aspect> = {
  prompt: '16:9',
  remix: '9:16',
}
const REMIX_TOPICS = [
  { id: 'promo', titleKey: 'studio.create.quickbook.topics.remix.promo.title' },
  { id: 'story', titleKey: 'studio.create.quickbook.topics.remix.story.title' },
  { id: 'tips', titleKey: 'studio.create.quickbook.topics.remix.tips.title' },
] as const
const ASPECTS: Aspect[] = ['16:9', '9:16', '1:1', '3:4']

const prompt = ref('')
const formMode = ref<FormMode>('prompt')
const catalogTypes = ref<CreateFormType[]>([])
const topicSheetOpen = ref(false)
const license = ref<EntitlementSnapshot | null>(null)
const licenseOpen = ref(false)

const uiIsZh = computed(() => !!i18next.language?.startsWith('zh'))

const modeTabs = computed(() => {
  const zh = uiIsZh.value
  const managed = [...catalogTypes.value]
    .filter((t) => t.enabled !== false)
    .sort((a, b) => a.sort - b.sort)
    .map((t) => ({
      id: t.id as FormMode,
      label: zh ? t.labelZh : t.labelEn,
      aspect: (LOCAL_MODE_ASPECT[t.id] || '16:9') as Aspect,
    }))
  return [
    { id: 'prompt' as FormMode, label: t('studio.create.modes.prompt'), aspect: '16:9' as Aspect },
    ...managed,
    { id: 'remix' as FormMode, label: t('studio.create.modes.remix'), aspect: '9:16' as Aspect },
  ]
})

const activeCatalogType = computed(() =>
  catalogTypes.value.find((t) => t.id === formMode.value) || null,
)

const licenseBadge = computed(() => {
  const e = license.value
  if (!e) return null
  if (e.activated && e.status === 'active') {
    if (e.daysLeft == null) return { badge: 'pro', text: t('studio.license.badgeProLife') }
    return { badge: 'pro', text: t('studio.license.badgeProDays', { n: e.daysLeft }) }
  }
  if (e.status === 'trial' && e.daysLeft != null) {
    return { badge: 'trial', text: t('studio.license.badgeTrialDays', { n: e.daysLeft }) }
  }
  if (e.status === 'expired') {
    return { badge: 'expired', text: t('studio.license.badgeExpired') }
  }
  return { badge: 'locked', text: t('studio.license.badgeLocked') }
})

async function refreshLicense() {
  try {
    license.value = await engineApi.licenseStatus()
  } catch {
    /* 引擎未就绪时忽略 */
  }
}

function onLicenseActivated(ent: EntitlementSnapshot) {
  license.value = ent
  if (ent.activated) licenseOpen.value = false
}
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
const webSearch = ref(true)
const autoSfx = ref(true)
/** 口播三态：关=无旁白；自动=按需求策划；驱动=上传文稿格式化 */
const voiceOver = ref<'off' | 'auto' | 'drive'>('auto')
const speechVoice = ref(
  speechVoiceForLang(settings.speech, uiVoiceLang(i18next.language)) ||
    settings.speech.voice ||
    defaultEdgeVoice(uiVoiceLang(i18next.language)),
)
const previewing = ref(false)
const styleRefs = ref<StyleRefItem[]>([])
const stylePresets = ref<
  Array<{
    id: string
    labelZh: string
    labelEn: string
    mainTechnique: string
    accent?: string
  }>
>([])
const styleThumbMap = ref<Record<string, string>>({})
const styleBusy = ref(false)
const stylePresetId = ref<string | null>(null)
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
const stylePreset = computed(() =>
  stylePresets.value.find((p) => p.id === stylePresetId.value) || null,
)
const stylePresetLabel = computed(() => {
  const p = stylePreset.value
  if (!p) return ''
  return stylePresetName(p)
})
function stylePresetName(p: { labelZh: string; labelEn: string }) {
  return i18next.language?.startsWith('zh') ? p.labelZh : p.labelEn
}
function toggleStylePreset(id: string) {
  stylePresetId.value = stylePresetId.value === id ? null : id
}

const placeholder = computed(() => {
  const key = `studio.create.placeholders.${formMode.value}`
  const localized = t(key)
  if (localized && !localized.startsWith('studio.create.')) return localized
  return t('studio.create.placeholders.prompt')
})
const topicEntries = computed(() => {
  if (formMode.value === 'prompt') return [] as { id: string; title: string }[]
  if (formMode.value === 'remix') {
    return REMIX_TOPICS.map((x) => ({ id: x.id, title: t(x.titleKey) }))
  }
  const type = activeCatalogType.value
  if (!type) return [] as { id: string; title: string }[]
  const zh = uiIsZh.value
  return [...(type.cases || [])]
    .filter((c) => c.enabled !== false)
    .sort((a, b) => a.sort - b.sort)
    .map((c) => ({
      id: c.id,
      title: zh ? c.titleZh : c.titleEn,
    }))
})
const topicTips = computed(() => {
  if (formMode.value === 'prompt' || !topicSheetOpen.value) return ''
  if (formMode.value === 'remix') return t('studio.create.quickbook.tips.remix')
  const type = activeCatalogType.value
  if (!type) return ''
  return (uiIsZh.value ? type.tipZh : type.tipEn) || ''
})
const hasDoc = computed(() => attachments.value.some((a) => a.kind === 'doc'))
const footageFolder = ref(appStore.videoAssetsFolder || '')
const footageCount = ref(0)
/** 混剪话题：promo=种草；story/tips=主题 */
const remixTopicId = ref<'promo' | 'story' | 'tips' | ''>('')
const remixBrand = ref('')
const remixSellingPoints = ref('')
const remixTheme = ref('')

function resetRemixFields() {
  remixTopicId.value = ''
  remixBrand.value = ''
  remixSellingPoints.value = ''
  remixTheme.value = ''
}

/** 切换分类时清空输入，回到该形态默认态（素材库路径保留） */
function resetComposerForMode() {
  prompt.value = ''
  briefHint.value = ''
  error.value = ''
  attachments.value = []
  stylePick.value = null
  stylePresetId.value = null
  plusOpen.value = false
  plusView.value = 'main'
  webSearch.value = true
  autoSfx.value = true
  resetRemixFields()
}

function remixBriefPayload() {
  if (formMode.value !== 'remix' || !remixTopicId.value) return undefined
  const brand = remixBrand.value.trim()
  const sellingPoints = remixSellingPoints.value.trim()
  const theme = remixTheme.value.trim()
  if (remixTopicId.value === 'promo') {
    if (!brand && !sellingPoints) return { topic: 'promo' as const }
    return { topic: 'promo' as const, brand: brand || undefined, sellingPoints: sellingPoints || undefined }
  }
  if (!theme) return { topic: remixTopicId.value }
  return { topic: remixTopicId.value, theme }
}
const canSubmit = computed(() => {
  const hasAsk = prompt.value.trim().length > 0 || ((formMode.value === 'narrate' || formMode.value === 'remix') && hasDoc.value)
  if (formMode.value === 'remix') return hasAsk && !!footageFolder.value && footageCount.value > 0
  return hasAsk
})

async function refreshFootageCount() {
  footageCount.value = 0
  const folder = footageFolder.value
  if (!folder) return
  try {
    const assets = await window.electron.listFilesFromFolder({ folderPath: folder })
    footageCount.value = assets.filter((a) => /\.(mp4|mov|webm|mkv|m4v)$/i.test(a.name)).length
  } catch {
    footageCount.value = 0
  }
}

async function pickFootageFolder() {
  const folderPath = await window.electron.selectFolder({
    title: t('studio.create.footage.dialog'),
    defaultPath: footageFolder.value || appStore.videoAssetsFolder || undefined,
  })
  if (!folderPath) return
  footageFolder.value = folderPath
  appStore.videoAssetsFolder = folderPath
  await refreshFootageCount()
}
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
  () =>
    !!stylePick.value
    || !!stylePresetId.value
    || attachments.value.length > 0
    || detectedUrls.value.length > 0,
)
const plusDot = computed(
  () =>
    attachments.value.length > 0 ||
    !!stylePick.value ||
    !!stylePresetId.value ||
    autoSfx.value ||
    webSearch.value ||
    voiceOver.value !== 'auto',
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
const voiceOverLabel = computed(() => {
  if (voiceOver.value === 'off') return t('studio.create.plus.off')
  if (voiceOver.value === 'drive') return t('studio.create.plus.drive')
  return t('studio.create.plus.auto')
})
/** 关=灰；自动/驱动=亮（开态） */
const voiceOverLit = computed(() => {
  return voiceOver.value === 'auto' || voiceOver.value === 'drive'
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
    if (formMode.value !== 'prompt') resetComposerForMode()
    formMode.value = 'prompt'
    topicSheetOpen.value = false
  } else if (formMode.value === id && topicSheetOpen.value) {
    topicSheetOpen.value = false
    return
  } else {
    if (formMode.value !== id) resetComposerForMode()
    formMode.value = id
    topicSheetOpen.value = true
  }

  const m = modeTabs.value.find((x) => x.id === id)
  if (m) aspect.value = m.aspect
  else if (LOCAL_MODE_ASPECT[id]) aspect.value = LOCAL_MODE_ASPECT[id]
  if (id === 'remix') void refreshFootageCount()
}

function pickPromptBody(caseRow: CreateCase): string {
  const want = uiIsZh.value ? 'zh' : 'en'
  const prompts = [...(caseRow.prompts || [])]
    .filter((p) => p.enabled !== false && p.body?.trim())
    .sort((a, b) => a.sort - b.sort)
  const hit = prompts.find((p) => p.lang === want) || prompts[0]
  return hit?.body?.trim() || ''
}

async function refreshCreateCatalog() {
  try {
    const catalog = await engineApi.getCreateCatalog()
    applyCatalog(catalog)
  } catch {
    // 引擎未就绪 / 断网：用与后台同构的本地种子，保证类型 tab 可用
    if (!catalogTypes.value.length) applyCatalog(defaultCreateCatalog())
  }
}

function applyCatalog(catalog: CreateCatalog | null | undefined) {
  const types = Array.isArray(catalog?.types) ? catalog!.types : []
  catalogTypes.value = types
    .filter((t) => t && t.id && t.enabled !== false)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
  // 当前选中类型若被后台下架，回到自由
  if (
    formMode.value !== 'prompt'
    && formMode.value !== 'remix'
    && !catalogTypes.value.some((t) => t.id === formMode.value)
  ) {
    formMode.value = 'prompt'
    topicSheetOpen.value = false
  }
}

function fillTopic(topicId: string) {
  if (formMode.value === 'prompt') return
  if (formMode.value === 'remix') {
    const fill = t(`studio.create.quickbook.topics.remix.${topicId}.fill`)
    if (fill && !fill.startsWith('studio.create.')) prompt.value = fill
    briefHint.value = ''
    error.value = ''
    if (topicId === 'promo' || topicId === 'story' || topicId === 'tips') {
      if (remixTopicId.value !== topicId) {
        remixBrand.value = ''
        remixSellingPoints.value = ''
        remixTheme.value = ''
      }
      remixTopicId.value = topicId
    }
    return
  }
  const caseRow = activeCatalogType.value?.cases?.find((c) => c.id === topicId)
  if (!caseRow) return
  const body = pickPromptBody(caseRow)
  if (!body) return
  prompt.value = body
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

function cycleVoiceOver() {
  // 关 → 自动 → 驱动 → 关（各形态自由；仅混剪仍建议有口播）
  const order: Array<'off' | 'auto' | 'drive'> =
    formMode.value === 'remix'
      ? ['auto', 'drive']
      : ['off', 'auto', 'drive']
  const i = order.indexOf(voiceOver.value)
  voiceOver.value = order[(i < 0 ? 0 : i + 1) % order.length]
}

async function openVoice() {
  plusView.value = 'voice'
}

function styleThumb(r: StyleRefItem) {
  return styleThumbMap.value[r.id] || r.url
}

async function openStyle() {
  plusView.value = 'style'
  // Re-open with cache: show immediately, refresh in background if needed
  const hadCache = styleRefs.value.length > 0 || stylePresets.value.length > 0
  if (!hadCache) styleBusy.value = true
  try {
    const st = await studio.ensureEngine()
    rememberEngineRoot(st?.url)
    const [list, presets] = await Promise.all([
      engineApi.listStyleRefs(),
      engineApi.listStylePresets().catch(() => stylePresets.value),
    ])
    styleRefs.value = list
    if (presets?.length) stylePresets.value = presets
    const map: Record<string, string> = {}
    for (const r of list) {
      map[r.id] = engineAssetUrlSync(r.url)
    }
    styleThumbMap.value = map
  } catch {
    if (!hadCache) {
      styleRefs.value = []
      styleThumbMap.value = {}
    }
  } finally {
    styleBusy.value = false
  }
}

function pickVoice(id: string) {
  speechVoice.value = id
  settings.updateSpeech({ voice: id, langHint: voiceLang.value })
  void previewVoice()
}

let previewSeq = 0

async function previewVoice() {
  const seq = ++previewSeq
  previewing.value = true
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
    if (seq !== previewSeq) return
    const { previewAudioUrl } = await import('@/lib/speech-preview-audio')
    const clip = previewAudioUrl(res.mime || 'audio/mpeg', res.base64)
    const audio = new Audio(clip.url)
    audio.onended = () => clip.revoke()
    audio.onerror = () => clip.revoke()
    try {
      await audio.play()
    } catch (playErr) {
      clip.revoke()
      const msg = playErr instanceof Error ? playErr.message : String(playErr)
      if (/no supported source|NotSupportedError|Failed to load/i.test(msg)) {
        throw new Error('试听无法播放：音频格式不被支持')
      }
      throw playErr
    }
  } catch (e: any) {
    if (seq !== previewSeq) return
    pushNotice('attention', t(voiceNoticeKey(e?.message || String(e))))
  } finally {
    if (seq === previewSeq) previewing.value = false
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
  // 轻标签：不锁技法；硬约束写在案例 fill 里
  if (formMode.value === 'narrate') {
    return en
      ? (hasDoc.value ? 'Form: explainer — docs may drive VO.' : 'Form: explainer.')
      : (hasDoc.value ? '形态：解说 — 可文稿驱动口播。' : '形态：解说。')
  }
  if (formMode.value === 'tutorial') {
    return en ? 'Form: tutorial.' : '形态：教程。'
  }
  if (formMode.value === 'story') {
    return en ? 'Form: story.' : '形态：故事。'
  }
  if (formMode.value === 'logo' || formMode.value === 'brand') {
    return en ? 'Form: logo / mark.' : '形态：标志。'
  }
  if (formMode.value === 'showreel') {
    return en ? 'Form: types / motion showreel.' : '形态：类型展片。'
  }
  if (formMode.value === 'launch') {
    return en ? 'Form: launch / promo.' : '形态：宣发。'
  }
  if (formMode.value === 'remix') {
    return en
      ? 'Form: footage remix — VO script drives cuts from the asset folder; burn captions.'
      : '形态：混剪 — 口播文案驱动素材库切镜；烧录字幕成片。'
  }
  if (formMode.value !== 'prompt' && activeCatalogType.value) {
    const label = en
      ? (activeCatalogType.value.labelEn || activeCatalogType.value.id)
      : (activeCatalogType.value.labelZh || activeCatalogType.value.id)
    return en ? `Form: ${label}.` : `形态：${label}。`
  }
  return ''
}

function packPrompt(raw: string) {
  const lang = detectContentLang(raw)
  const logoFilm = formMode.value === 'logo' || formMode.value === 'brand' || formMode.value === 'showreel'
  const sendVo = voiceOver.value
  const brandHint =
    logoFilm
      && attachments.value.some((a) => a.kind === 'image')
      && !/logo|标志|svg|icon|wordmark/i.test(raw)
      ? lang === 'en'
        ? 'Brand logo assets attached — treat uploaded mark as the hero; no invented alternate logos.'
        : '已附品牌标志素材 — 以上传标志为主角，勿另造 Logo。'
      : ''
  const portrait = aspect.value === '9:16' || aspect.value === '3:4'
  // 与自由同路：只留构图底线；片型硬约束写在案例 fill，不在此注入
  const craftFloor = formMode.value === 'remix'
    ? ''
    : portrait
      ? (lang === 'en'
        ? 'Craft (9:16): short hook type may be large; body type stays smaller. Headline and hero sit in different regions — do not stack type on the graphic. Safe area top 8% / bottom 18% / sides 8%.'
        : '画面（竖屏）：短钩子可以大，正文小。标题和主图形各占一块，不要叠在一起。安全区上 8% / 下 18% / 左右 8%。')
      : (lang === 'en'
        ? 'Craft (16:9): each beat fills the frame with a concrete metaphor from that line (object + action + space) — layered material, hero graphic, accent detail. Skills move the metaphor; do not redraw every beat as a thin node graph. Keep the headline readable. ~6% safe pad.'
        : '画面（宽屏）：每一镜用这句话的具体比喻铺满画面（物体+动作+空间），有层次：材质底、主图形、强调细节。技能动这个比喻，不要每镜都画成细线节点图。标题可读，不盖住主体。四周约 6% 安全区。')
  const stickmanAsk = /(?:用|做成|制作|请用|出片).{0,8}(?:火柴人|stickman|stick[\s-]?figure)|(?:火柴人|stickman).{0,6}(?:风格|出演|来演|来讲)|simply\s*animated|motivation\s*vs\s*discipline/i.test(raw)
  const stickmanLock = stickmanAsk
    ? (lang === 'en'
      ? 'Stickman actor lock: character beats use clip phrases (explain-board / compare-sides / hesitate / agree-cheer / desk-work / duo-debate…); do NOT list raw pose names; mix with diagram/kinetic on other beats.'
      : '火柴人角色锁：角色镜用短语 clip（explain-board / compare-sides / hesitate / agree-cheer / desk-work / duo-debate…）；禁止罗列姿态名；其他镜可混 diagram/动能字。')
    : ''
  return [
    raw,
    modeHintLine(lang),
    brandHint,
    craftFloor,
    stickmanLock,
    stylePreset.value
      ? `Style preset: ${stylePreset.value.labelEn} / ${stylePreset.value.labelZh} (mainTechnique=${stylePreset.value.mainTechnique}).`
      : '',
    stylePick.value
      ? `Design reference: ${stylePick.value.name} (lock palette/skin from image${stylePreset.value ? '; technique from style preset' : ''}).`
      : '',
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
      : sendVo === 'drive'
        ? 'Voice-over drive: format uploaded narration to narration.txt style, then lock lines for TTS.'
        : 'Voice-over auto: plan narration.txt-style VO from the brief; speak every beat.',
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
    await refreshLicense()
    if (license.value && !license.value.canMake) {
      licenseOpen.value = true
      return
    }
    await studio.ensureEngine()
    settings.updateSpeech({ voice: speechVoice.value, langHint: voiceLang.value })
    const { syncSettingsToEngine } = await import('@/lib/sync-settings')
    await syncSettingsToEngine()

    const raw =
      prompt.value.trim() ||
      (formMode.value === 'narrate' && hasDoc.value
        ? '根据上传文稿制作讲解科普动画。'
        : formMode.value === 'remix' && hasDoc.value
          ? '根据上传文稿做素材混剪短视频。'
          : '')
    if (formMode.value === 'remix') {
      if (!footageFolder.value || footageCount.value <= 0) {
        error.value = t('studio.create.footage.needFolder')
        return
      }
      await refreshFootageCount()
      if (footageCount.value <= 0) {
        error.value = t('studio.create.footage.empty')
        return
      }
    }
    const sendVoiceOver: 'off' | 'auto' | 'drive' = voiceOver.value
    if (sendVoiceOver === 'drive' && !hasDoc.value) {
      error.value = t('studio.create.plus.driveNeedDoc')
      return
    }

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
    const stylePack = formMode.value === 'remix' ? 'footage-remix' : 'skill-directed'
    const task = await studio.createAndMake({
      prompt: packPrompt(raw),
      formMode: formMode.value,
      brandSubtype:
        formMode.value === 'logo' || formMode.value === 'showreel'
          ? formMode.value
          : undefined,
      aspect: aspect.value,
      quality: quality.value,
      mediaKind: mediaKind.value,
      stylePack,
      autoSfx: formMode.value === 'remix' ? false : autoSfx.value,
      voiceOver: sendVoiceOver,
      voMode: sendVoiceOver === 'off' ? 'off' : 'on',
      scriptDrive: sendVoiceOver === 'drive' ? 'polish' : 'off',
      styleRefId: formMode.value === 'remix' ? undefined : stylePick.value?.id,
      styleRefDataUrl: formMode.value === 'remix' ? undefined : stylePick.value?.dataUrl,
      stylePresetId: formMode.value === 'remix' ? undefined : stylePresetId.value || undefined,
      userAssets: userAssets.length ? userAssets : undefined,
      contentLang,
      webSearch: formMode.value === 'remix' ? false : webSearch.value,
      footageFolder: formMode.value === 'remix' ? footageFolder.value : undefined,
      remixBrief: formMode.value === 'remix' ? remixBriefPayload() : undefined,
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
    const msg = e?.message || String(e)
    await refreshLicense()
    const licenseBlocked =
      !license.value?.canMake
      || /激活|体验已结束|请先激活/i.test(msg)
    if (licenseBlocked) {
      error.value = ''
      licenseOpen.value = true
    } else {
      const kind = classifyTaskError(msg)
      error.value = t(kind === 'voice' ? voiceNoticeKey(msg) : `notice.${kind}`)
      pushNotice('attention', error.value)
    }
  } finally {
    busy.value = false
  }
}

function onDocClick(ev: MouseEvent) {
  const target = ev.target as Node
  if (plusOpen.value) {
    const el = plusWrap.value
    if (el && !el.contains(target)) {
      plusOpen.value = false
      plusView.value = 'main'
    }
  }
  if (aspectOpen.value) {
    const host = (ev.target as HTMLElement | null)?.closest?.('.aspect-wrap')
    if (!host) aspectOpen.value = false
  }
}

watch(
  voiceLang,
  (lang) => {
    // 切中/英文：用全局配置里该语种已保存的默认音色，不覆盖另一语种
    const next = settings.applyVoiceForUiLang(lang)
    speechVoice.value = next
  },
  { immediate: true },
)

watch(
  () => [settings.speech.voice, settings.speech.voiceZh, settings.speech.voiceEn] as const,
  () => {
    speechVoice.value = speechVoiceForLang(settings.speech, voiceLang.value)
  },
)

onMounted(() => {
  // 先铺本地种子，引擎就绪后再换远程目录
  applyCatalog(defaultCreateCatalog())
  void studio
    .ensureEngine()
    .then(() => {
      void refreshLicense()
      void refreshCreateCatalog()
    })
    .catch(() => {})
  if (footageFolder.value) void refreshFootageCount()
  document.addEventListener('click', onDocClick)
})
onUnmounted(() => document.removeEventListener('click', onDocClick))

watch(
  () => studio.engineReady,
  (ok) => {
    if (ok) {
      void refreshLicense()
      void refreshCreateCatalog()
    }
  },
)
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
    display: inline-flex;
    align-items: center;
    gap: 6px;
    &.on {
      background: var(--accent-soft);
      color: var(--ink);
    }
    &.bad {
      background: #fdecea;
      color: var(--danger);
      white-space: normal;
      max-width: 220px;
      text-align: right;
    }
    .eng-sep {
      opacity: 0.45;
    }
    .lic-chip {
      border: 0;
      background: transparent;
      padding: 0;
      margin: 0;
      font: inherit;
      color: inherit;
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 2px;
      &.locked,
      &.expired {
        color: var(--danger);
      }
    }
  }
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

.footage-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px 0;
  flex-wrap: wrap;
}
.footage-pick {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  border: 1px dashed var(--line);
  background: var(--bg, #f6f6f4);
  color: var(--ink);
  border-radius: 12px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 12px;
}
.footage-path {
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.footage-count {
  font-size: 12px;
  color: var(--muted);
  font-style: normal;
  &.warn {
    color: #c45c26;
  }
}
.footage-input {
  flex: 1 1 140px;
  min-width: 120px;
  max-width: 100%;
  border: 1px dashed var(--line);
  background: var(--bg, #f6f6f4);
  color: var(--ink);
  border-radius: 12px;
  padding: 8px 12px;
  font-size: 12px;
  outline: none;
  &.wide {
    flex: 1 1 220px;
  }
  &::placeholder {
    color: var(--muted);
  }
  &:focus {
    border-color: color-mix(in srgb, var(--ink) 35%, var(--line));
  }
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
  &.on {
    background: var(--ink);
    color: var(--accent);
    border-color: var(--ink);
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
  &.sheet {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 8px;
  }
  &.style {
    width: 320px;
    max-height: 420px;
  }
  &.voice {
    max-height: 420px;
  }
}

.style-head .plus-row.back,
.voice-head .plus-row.back {
  padding: 6px 8px;
}

.voice-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 0 4px;
}

.voice-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid var(--line);
  padding-top: 6px;
  .plus-row.preview {
    flex: 1;
  }
}

.style-hint {
  margin: 0 4px 8px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--muted-2);
}

.preset-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 4px 10px;
}
.preset-chip {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 5px 10px;
  font-size: 12px;
  line-height: 1.2;
  background: var(--paper);
  color: var(--ink);
  cursor: pointer;
  &:hover {
    border-color: var(--ink-soft);
  }
  &.on {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--paper);
  }
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
