<template>
  <v-dialog :model-value="modelValue" max-width="680" @update:model-value="$emit('update:modelValue', $event)">
    <v-card class="config-card">
      <v-card-title class="config-head">
        <span>{{ t('studio.config.title') }}</span>
        <button type="button" class="icon-close" @click="$emit('update:modelValue', false)">
          <AppIcon :icon="X" :size="18" :stroke-width="1.6" />
        </button>
      </v-card-title>

      <div class="tabs" role="tablist">
        <button
          v-for="item in tabItems"
          :key="item.id"
          type="button"
          role="tab"
          class="tab"
          :class="{ on: tab === item.id }"
          :aria-selected="tab === item.id"
          @click="tab = item.id"
        >
          {{ item.label }}
        </button>
      </div>

      <v-card-text class="config-body">
        <div v-if="tab === 'llm'" class="form">
          <p class="hint">{{ t('studio.config.llmHint') }}</p>
          <label class="field">
            <span>{{ t('studio.config.vendor') }}</span>
            <div
              class="select"
              data-select="vendor"
              :class="{ open: openSelect === 'vendor' }"
            >
              <button type="button" class="select-trigger" @click="toggleSelect('vendor', $event)">
                <span>{{ vendorLabel }}</span>
                <AppIcon :icon="ChevronDown" :size="14" :stroke-width="1.6" />
              </button>
            </div>
          </label>
          <label class="field">
            <span>{{ t('studio.config.model') }}</span>
            <div
              v-if="modelOptions.length"
              class="select"
              data-select="model"
              :class="{ open: openSelect === 'model' }"
            >
              <button type="button" class="select-trigger" @click="toggleSelect('model', $event)">
                <span>{{ llm.modelName || t('studio.config.modelPick') }}</span>
                <AppIcon :icon="ChevronDown" :size="14" :stroke-width="1.6" />
              </button>
            </div>
            <input
              v-else
              v-model="llm.modelName"
              type="text"
              :placeholder="t('studio.config.modelCustomPh')"
              autocomplete="off"
            />
          </label>
          <label class="field">
            <span>{{ t('studio.config.apiKey') }}</span>
            <input v-model="llm.apiKey" type="password" autocomplete="off" />
          </label>
          <label class="field">
            <span>{{ t('studio.config.apiUrl') }}</span>
            <input
              v-model="llm.apiUrl"
              type="text"
              :placeholder="t('studio.config.apiUrlPh')"
              autocomplete="off"
            />
          </label>
        </div>

        <div v-else-if="tab === 'speech'" class="form">
          <div class="speech-panes">
            <button
              type="button"
              class="pane"
              :class="{ on: speechPane === 'system' }"
              @click="speechPane = 'system'"
            >
              {{ t('studio.config.speechSystem') }}
            </button>
            <button
              type="button"
              class="pane"
              :class="{ on: speechPane === 'mine' }"
              @click="speechPane = 'mine'"
            >
              {{ t('studio.config.speechMine') }}
            </button>
          </div>

          <template v-if="speechPane === 'system'">
            <p class="hint">{{ t('studio.config.speechSystemHint') }}</p>
            <label class="field">
              <span>{{ t('studio.config.speechProvider') }}</span>
              <div
                class="select"
                data-select="provider"
                :class="{ open: openSelect === 'provider' }"
              >
                <button type="button" class="select-trigger" @click="toggleSelect('provider', $event)">
                  <span>{{ providerLabel }}</span>
                  <AppIcon :icon="ChevronDown" :size="14" :stroke-width="1.6" />
                </button>
              </div>
            </label>
            <label class="field">
              <span>{{ t('studio.config.voiceId') }}</span>
              <div
                class="select"
                data-select="voice"
                :class="{ open: openSelect === 'voice' }"
              >
                <button type="button" class="select-trigger" @click="toggleSelect('voice', $event)">
                  <span>{{ voiceLabel }}</span>
                  <AppIcon :icon="ChevronDown" :size="14" :stroke-width="1.6" />
                </button>
              </div>
            </label>
          </template>

          <template v-else>
            <p class="hint">{{ t('studio.config.speechMineHint') }}</p>
            <label class="field">
              <span>{{ t('studio.config.cloneProvider') }}</span>
              <div
                class="select"
                data-select="clone"
                :class="{ open: openSelect === 'clone' }"
              >
                <button type="button" class="select-trigger" @click="toggleSelect('clone', $event)">
                  <span>{{ cloneLabel }}</span>
                  <AppIcon :icon="ChevronDown" :size="14" :stroke-width="1.6" />
                </button>
              </div>
            </label>
            <template v-if="speech.cloneProvider !== 'none'">
              <label class="field">
                <span>{{ t('studio.config.cloneApiKey') }}</span>
                <input
                  v-model="speech.cloneApiKey"
                  type="password"
                  :placeholder="t('studio.config.cloneApiKeyPh')"
                  autocomplete="off"
                />
              </label>
              <label class="field">
                <span>{{ t('studio.config.cloneBaseUrl') }}</span>
                <input v-model="speech.cloneBaseUrl" type="text" autocomplete="off" />
              </label>
              <label class="field">
                <span>{{ t('studio.config.speechModel') }}</span>
                <input v-model="speech.speechModel" type="text" placeholder="cosyvoice-v2" autocomplete="off" />
              </label>
              <div class="my-add">
                <label class="field">
                  <span>{{ t('studio.config.myVoiceName') }}</span>
                  <input v-model="draftName" type="text" autocomplete="off" />
                </label>
                <label class="field">
                  <span>{{ t('studio.config.myVoiceVoiceId') }}</span>
                  <input v-model="draftVoiceId" type="text" autocomplete="off" />
                </label>
                <button type="button" class="btn soft" :disabled="!canAddMyVoice" @click="addMyVoice">
                  {{ t('studio.config.addMyVoice') }}
                </button>
              </div>
            </template>

            <div class="my-list">
              <p v-if="!speech.myVoices.length" class="hint">{{ t('studio.config.myVoicesEmpty') }}</p>
              <div v-for="v in speech.myVoices" :key="v.id" class="my-row">
                <button
                  type="button"
                  class="pick"
                  :class="{ on: speech.voice === `my:${v.id}` }"
                  @click="pickMyVoice(v.id)"
                >
                  <strong>{{ v.name }}</strong>
                  <em>{{ v.provider }} · {{ v.voiceId }}</em>
                </button>
                <button type="button" class="btn ghost" @click="removeMyVoice(v.id)">
                  {{ t('common.buttons.remove') }}
                </button>
              </div>
            </div>
          </template>
        </div>

      </v-card-text>

      <v-card-actions class="config-foot">
        <button type="button" class="btn ghost" @click="$emit('update:modelValue', false)">
          {{ t('studio.config.close') }}
        </button>
        <button type="button" class="btn primary" @click="save">{{ t('studio.config.save') }}</button>
      </v-card-actions>
    </v-card>

    <Teleport to="body">
      <div
        v-if="openSelect && menuStyle"
        class="select-menu select-menu-portal"
        :class="{ tall: openSelect === 'voice' }"
        :style="menuStyle"
        @mousedown.stop
        @wheel.stop
      >
        <template v-if="openSelect === 'vendor'">
          <button
            v-for="v in LLM_VENDORS"
            :key="v.id"
            type="button"
            class="select-option"
            :class="{ on: vendorId === v.id }"
            @click="pickVendor(v.id)"
          >
            {{ t(`studio.config.vendors.${v.labelKey}`) }}
          </button>
        </template>
        <template v-else-if="openSelect === 'model'">
          <button
            v-for="m in modelOptions"
            :key="m.id"
            type="button"
            class="select-option"
            :class="{ on: llm.modelName === m.id }"
            @click="pickModel(m.id)"
          >
            {{ m.id }}
          </button>
        </template>
        <template v-else-if="openSelect === 'provider'">
          <button
            v-for="o in providerItems"
            :key="o.value"
            type="button"
            class="select-option"
            :class="{ on: speech.provider === o.value }"
            @click="speech.provider = o.value; closeSelect()"
          >
            {{ o.title }}
          </button>
        </template>
        <template v-else-if="openSelect === 'voice'">
          <button
            v-for="o in edgeVoiceItems"
            :key="o.value"
            type="button"
            class="select-option"
            :class="{ on: speech.voice === o.value }"
            @click="pickSystemVoice(o.value)"
          >
            {{ o.title }}
          </button>
        </template>
        <template v-else-if="openSelect === 'clone'">
          <button
            v-for="o in cloneItems"
            :key="o.value"
            type="button"
            class="select-option"
            :class="{ on: speech.cloneProvider === o.value }"
            @click="onCloneProvider(o.value); closeSelect()"
          >
            {{ o.title }}
          </button>
        </template>
      </div>
    </Teleport>
  </v-dialog>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useTranslation } from 'i18next-vue'
import { ChevronDown, X } from '@lucide/vue'
import AppIcon from '@/components/AppIcon.vue'
import { classifyTaskError } from '@/lib/notice-kind'
import { pushNotice } from '@/lib/notice'
import {
  detectVendor,
  LLM_VENDORS,
  vendorById,
  type LlmVendorId,
} from '@/lib/llm/presets'
import {
  CLONE_DEFAULTS,
  defaultEdgeVoice,
  edgeVoiceLabel,
  edgeVoicesForLang,
  speechVoiceForLang,
  uiVoiceLang,
  useSettingsStore,
  voiceMatchesUiLang,
  type CloneProvider,
  type SpeechProvider,
} from '@/store/settings'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const { t, i18next } = useTranslation()
const settings = useSettingsStore()
const tab = ref<'llm' | 'speech'>('llm')
const speechPane = ref<'system' | 'mine'>('system')
const draftName = ref('')
const draftVoiceId = ref('')
const openSelect = ref<string | null>(null)
const menuStyle = ref<Record<string, string> | null>(null)
const vendorId = ref<LlmVendorId>(detectVendor(settings.llm.apiUrl))

const llm = reactive({ ...settings.llm })
const speech = reactive({
  ...settings.speech,
  voiceZh: settings.speech.voiceZh || defaultEdgeVoice('zh'),
  voiceEn: settings.speech.voiceEn || defaultEdgeVoice('en'),
  myVoices: [...(settings.speech.myVoices || [])],
})

const voiceLang = computed(() => {
  void i18next.language
  return uiVoiceLang(i18next.language)
})

const tabItems = computed(() => [
  { id: 'llm' as const, label: t('studio.config.tabLlm') },
  { id: 'speech' as const, label: t('studio.config.tabSpeech') },
])

const providerItems = computed(() => [
  { title: t('studio.config.providerAuto'), value: 'auto' as SpeechProvider },
  { title: t('studio.config.edgeTts'), value: 'edge' as SpeechProvider },
  { title: t('studio.config.providerWindows'), value: 'windows' as SpeechProvider },
])

const cloneItems = computed(() => [
  { title: t('studio.config.cloneNone'), value: 'none' as CloneProvider },
  { title: t('studio.config.cloneDashscope'), value: 'dashscope' as CloneProvider },
  { title: t('studio.config.cloneMinimax'), value: 'minimax' as CloneProvider },
  { title: t('studio.config.cloneFish'), value: 'fish' as CloneProvider },
])

const edgeVoiceItems = computed(() =>
  edgeVoicesForLang(voiceLang.value).map((v) => ({
    title: edgeVoiceLabel(v),
    value: v.id,
  })),
)

const modelOptions = computed(() => vendorById(vendorId.value).models)

const vendorLabel = computed(() =>
  t(`studio.config.vendors.${vendorById(vendorId.value).labelKey}`),
)
const providerLabel = computed(
  () => providerItems.value.find((o) => o.value === speech.provider)?.title || speech.provider,
)
const cloneLabel = computed(
  () => cloneItems.value.find((o) => o.value === speech.cloneProvider)?.title || speech.cloneProvider,
)
const voiceLabel = computed(() => {
  const hit = edgeVoiceItems.value.find((o) => o.value === speech.voice)
  if (hit) return hit.title
  if (speech.voice.startsWith('my:')) {
    const id = speech.voice.slice(3)
    const mine = speech.myVoices.find((v) => v.id === id)
    return mine ? mine.name : speech.voice
  }
  return speech.voice || t('studio.config.modelPick')
})

const canAddMyVoice = computed(
  () =>
    speech.cloneProvider !== 'none' &&
    draftName.value.trim().length > 0 &&
    draftVoiceId.value.trim().length > 0,
)

function closeSelect() {
  openSelect.value = null
  menuStyle.value = null
}

function placeMenu(id: string, trigger?: HTMLElement | null) {
  const el =
    trigger ||
    (document.querySelector(`[data-select="${id}"] .select-trigger`) as HTMLElement | null)
  if (!el) {
    menuStyle.value = null
    return
  }
  const r = el.getBoundingClientRect()
  const maxH = id === 'voice' ? 280 : 220
  const gap = 6
  const spaceBelow = window.innerHeight - r.bottom - 12
  const spaceAbove = r.top - 12
  const openUp = spaceBelow < Math.min(maxH, 140) && spaceAbove > spaceBelow
  const height = Math.max(120, Math.min(maxH, openUp ? spaceAbove - 8 : spaceBelow - 8))
  menuStyle.value = {
    position: 'fixed',
    left: `${Math.round(r.left)}px`,
    width: `${Math.round(r.width)}px`,
    zIndex: '10050',
    maxHeight: `${Math.round(height)}px`,
    ...(openUp
      ? { bottom: `${Math.round(window.innerHeight - r.top + gap)}px`, top: 'auto' }
      : { top: `${Math.round(r.bottom + gap)}px`, bottom: 'auto' }),
  }
}

function toggleSelect(id: string, ev?: MouseEvent) {
  if (openSelect.value === id) {
    closeSelect()
    return
  }
  openSelect.value = id
  const trigger = (ev?.currentTarget as HTMLElement | null) || null
  void nextTick(() => placeMenu(id, trigger))
}

function pickVendor(id: LlmVendorId) {
  vendorId.value = id
  closeSelect()
  const v = vendorById(id)
  if (v.apiUrl) llm.apiUrl = v.apiUrl
  if (v.defaultModel) llm.modelName = v.defaultModel
  else if (id === 'custom' && !llm.modelName) llm.modelName = ''
}

function pickModel(id: string) {
  llm.modelName = id
  closeSelect()
}

watch(
  () => settings.llm,
  (v) => {
    Object.assign(llm, v)
    vendorId.value = detectVendor(v.apiUrl)
  },
  { deep: true },
)
watch(
  () => settings.speech,
  (v) => {
    Object.assign(speech, v)
    speech.voiceZh = v.voiceZh || defaultEdgeVoice('zh')
    speech.voiceEn = v.voiceEn || defaultEdgeVoice('en')
    speech.myVoices = [...(v.myVoices || [])]
  },
  { deep: true },
)

watch(
  voiceLang,
  (lang) => {
    // 切中/英文：展示该语种已配置的默认配音
    const next = speechVoiceForLang(
      {
        voice: speech.voice,
        voiceZh: speech.voiceZh || settings.speech.voiceZh,
        voiceEn: speech.voiceEn || settings.speech.voiceEn,
        myVoices: speech.myVoices,
      },
      lang,
    )
    if (speech.voice !== next) speech.voice = next
  },
  { immediate: true },
)

function onCloneProvider(v: CloneProvider) {
  speech.cloneProvider = v
  if (v !== 'none') {
    const d = CLONE_DEFAULTS[v]
    if (!speech.cloneBaseUrl) speech.cloneBaseUrl = d.base
    if (!speech.speechModel || speech.speechModel === 'edge-tts') speech.speechModel = d.model
  }
}

function rememberVoiceSlot(id: string) {
  speech.voice = id
  if (id.startsWith('my:')) {
    if (voiceLang.value === 'en') speech.voiceEn = id
    else speech.voiceZh = id
    return
  }
  if (voiceMatchesUiLang(id, 'zh')) speech.voiceZh = id
  if (voiceMatchesUiLang(id, 'en')) speech.voiceEn = id
}

function pickSystemVoice(id: string) {
  rememberVoiceSlot(id)
  closeSelect()
}

function addMyVoice() {
  if (speech.cloneProvider === 'none' || !canAddMyVoice.value) return
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
  speech.myVoices = [
    ...speech.myVoices,
    {
      id,
      name: draftName.value.trim().slice(0, 40),
      provider: speech.cloneProvider,
      voiceId: draftVoiceId.value.trim().slice(0, 120),
    },
  ].slice(0, 8)
  rememberVoiceSlot(`my:${id}`)
  draftName.value = ''
  draftVoiceId.value = ''
}

function removeMyVoice(id: string) {
  speech.myVoices = speech.myVoices.filter((v) => v.id !== id)
  const gone = `my:${id}`
  if (speech.voiceZh === gone) speech.voiceZh = defaultEdgeVoice('zh')
  if (speech.voiceEn === gone) speech.voiceEn = defaultEdgeVoice('en')
  if (speech.voice === gone) speech.voice = speechVoiceForLang(speech, voiceLang.value)
}

function pickMyVoice(id: string) {
  rememberVoiceSlot(`my:${id}`)
}

async function save() {
  settings.updateLlm({ ...llm })
  settings.updateSpeech({
    provider: speech.provider,
    voice: speech.voice,
    voiceZh: speech.voiceZh,
    voiceEn: speech.voiceEn,
    langHint: voiceLang.value,
    cloneProvider: speech.cloneProvider,
    cloneApiKey: speech.cloneApiKey,
    cloneBaseUrl: speech.cloneBaseUrl,
    speechModel: speech.speechModel,
    myVoices: [...speech.myVoices],
  })
  try {
    const { syncSettingsToEngine } = await import('@/lib/sync-settings')
    await syncSettingsToEngine()
    pushNotice('ok', t('notice.saved'))
  } catch (e) {
    console.warn('[config] sync engine settings failed', e)
    const kind = classifyTaskError(e instanceof Error ? e.message : String(e))
    pushNotice('attention', t(kind === 'network' ? 'notice.network' : 'notice.other'))
  }
  emit('update:modelValue', false)
}

function onDocClick(ev: MouseEvent) {
  if (!openSelect.value) return
  const el = ev.target as HTMLElement | null
  if (el?.closest('.select') || el?.closest('.select-menu-portal')) return
  closeSelect()
}

function onWinResize() {
  if (!openSelect.value) return
  placeMenu(openSelect.value)
}

function onWinScroll(ev: Event) {
  if (!openSelect.value) return
  const t = ev.target as HTMLElement | null
  if (t?.closest?.('.select-menu-portal')) return
  closeSelect()
}

watch(tab, () => closeSelect())
watch(speechPane, () => closeSelect())

onMounted(() => {
  document.addEventListener('mousedown', onDocClick)
  window.addEventListener('resize', onWinResize)
  window.addEventListener('scroll', onWinScroll, true)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onDocClick)
  window.removeEventListener('resize', onWinResize)
  window.removeEventListener('scroll', onWinScroll, true)
})
</script>

<style scoped>
.config-card {
  border-radius: 18px !important;
  border: 1px solid var(--line);
  overflow: hidden;
  background: var(--surface) !important;
}

.config-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 8px !important;
  font-size: 16px;
  font-weight: 650;
  color: var(--ink);
}

.icon-close {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  display: grid;
  place-items: center;
  cursor: pointer;
}
.icon-close:hover {
  background: var(--paper);
  color: var(--ink);
}

.tabs {
  display: flex;
  gap: 4px;
  margin: 0 18px 4px;
  padding: 4px;
  border-radius: 999px;
  background: var(--paper);
  border: 1px solid var(--line);
}

.tab {
  flex: 1;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
  padding: 8px 10px;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.tab.on {
  background: var(--ink);
  color: var(--accent);
  font-weight: 600;
}
.tab:hover:not(.on) {
  color: var(--ink);
}

.config-body {
  padding: 14px 18px 8px !important;
  max-height: min(58vh, 480px);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--muted);
}
.field > span {
  font-weight: 550;
  color: var(--ink-soft);
}
.field input,
.field textarea {
  border: 1px solid var(--line);
  background: var(--paper);
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 13px;
  color: var(--ink);
  outline: none;
  font-family: inherit;
}
.field input:focus,
.field textarea:focus {
  border-color: var(--ink);
  background: var(--surface);
  box-shadow: 0 0 0 3px rgb(212 240 122 / 35%);
}
.field textarea {
  resize: vertical;
  min-height: 72px;
}

.select {
  position: relative;
}
.select-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px solid var(--line);
  background: var(--paper);
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 13px;
  color: var(--ink);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
}
.select.open .select-trigger,
.select-trigger:hover {
  border-color: var(--ink);
  background: var(--surface);
}
.select-trigger span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.row input {
  flex: 1;
}

.speech-panes {
  display: flex;
  gap: 6px;
}
.pane {
  border: 1px solid var(--line);
  background: var(--paper);
  color: var(--muted);
  border-radius: var(--radius-pill);
  padding: 6px 14px;
  font-size: 12px;
  cursor: pointer;
}
.pane.on {
  background: var(--accent-soft);
  color: var(--ink);
  border-color: var(--accent-deep);
  font-weight: 600;
}

.hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--muted);
}

.my-add {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  background: var(--paper);
  border: 1px solid var(--line);
}

.my-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.my-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.my-row .pick {
  flex: 1;
  text-align: left;
  border: 1px solid var(--line);
  background: var(--paper);
  border-radius: 10px;
  padding: 8px 10px;
  cursor: pointer;
}
.my-row .pick.on {
  border-color: var(--accent-deep);
  background: var(--accent-soft);
}
.my-row .pick strong {
  display: block;
  font-size: 13px;
  color: var(--ink);
}
.my-row .pick em {
  display: block;
  font-style: normal;
  font-size: 11px;
  color: var(--muted);
}

.config-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px 16px !important;
}

.btn {
  border: 1px solid var(--line);
  background: var(--paper);
  color: var(--ink);
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
}
.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.btn.ghost {
  background: transparent;
}
.btn.soft {
  background: var(--accent-soft);
  border-color: transparent;
}
.btn.primary {
  background: var(--ink);
  color: var(--accent);
  border-color: var(--ink);
  font-weight: 600;
}
</style>

<!-- portal 菜单挂在 body，需非 scoped -->
<style>
.select-menu-portal {
  max-height: 220px;
  overflow: auto;
  overscroll-behavior: contain;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: var(--shadow-pop);
  padding: 4px;
  box-sizing: border-box;
}
.select-menu-portal.tall {
  max-height: 280px;
}
.select-menu-portal .select-option {
  width: 100%;
  border: 0;
  background: transparent;
  text-align: left;
  padding: 9px 10px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--ink);
  cursor: pointer;
  display: block;
  font-family: inherit;
}
.select-menu-portal .select-option:hover,
.select-menu-portal .select-option.on {
  background: var(--accent-soft);
}
.select-menu-portal .select-option.on {
  font-weight: 600;
}
</style>
