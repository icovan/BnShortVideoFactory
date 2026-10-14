<template>
  <v-dialog v-model="dialogVisible" max-width="480">
    <v-card class="update-card">
      <header class="head">
        <span class="ico">
          <AppIcon :icon="ArrowUpCircle" :size="20" :stroke-width="1.6" />
        </span>
        <div>
          <strong>{{ t('update.title') }}</strong>
          <p>{{ t('update.releaseNotes') }}</p>
        </div>
        <button type="button" class="close" @click="dialogVisible = false">
          <AppIcon :icon="X" :size="16" :stroke-width="1.6" />
        </button>
      </header>

      <div class="meta">
        <div class="row">
          <span>{{ t('update.currentVersion') }}</span>
          <em>v{{ currentVersion }}</em>
        </div>
        <div class="row">
          <span>{{ t('update.latestVersion') }}</span>
          <em class="new">v{{ updateInfo.version }}</em>
        </div>
        <div v-if="updateInfo.releaseDate" class="row">
          <span>{{ t('update.releaseDate') }}</span>
          <em>{{ formatDate(updateInfo.releaseDate) }}</em>
        </div>
      </div>

      <div v-if="releaseNotes" class="notes" v-html="renderedReleaseNotes" />

      <footer class="foot">
        <button type="button" class="btn ghost" @click="dialogVisible = false">
          {{ t('update.updateLater') }}
        </button>
        <button type="button" class="btn primary" :disabled="opening" @click="openWebsite">
          {{ t('update.visitWebsite') }}
        </button>
      </footer>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import MarkdownIt from 'markdown-it'
import { useTranslation } from 'i18next-vue'
import { ArrowUpCircle, X } from '@lucide/vue'
import AppIcon from '@/components/AppIcon.vue'
import type { UpdateInfo } from '~/electron/updater'
import { useAppStore } from '@/store'
import { engineApi } from '@/lib/engine-api'

/** 后台未配置时：中文 Gitee / 英文 GitHub */
const FALLBACK_DOWNLOAD_ZH =
  'https://gitee.com/zaokework/bn-short-video-factory/releases/latest'
const FALLBACK_DOWNLOAD_EN =
  'https://github.com/icovan/BnShortVideoFactory/releases/latest'

const props = defineProps<{
  modelValue: boolean
  updateInfo: UpdateInfo
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const { t } = useTranslation()
const appStore = useAppStore()
const currentVersion = __APP_VERSION__
const md = new MarkdownIt({ html: false, linkify: true, breaks: true })
const opening = ref(false)

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const isZh = computed(() => {
  const locale = (appStore.locale || '').toLowerCase()
  return locale === 'zh' || locale.startsWith('zh-') || locale.startsWith('zh_')
})

const releaseNotes = computed(() => {
  const notes = props.updateInfo.releaseNotes
  if (!notes) return ''
  if (typeof notes === 'string') return notes
  const locale = appStore.locale || 'zh-CN'
  return (
    notes[locale] ??
    notes[locale.split('-')[0]] ??
    notes['zh-CN'] ??
    notes.en ??
    Object.values(notes)[0] ??
    ''
  )
})

const renderedReleaseNotes = computed(() => md.render(releaseNotes.value))

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return Number.isNaN(date.getTime()) ? dateString : date.toLocaleDateString()
}

async function resolveDownloadUrl(): Promise<string> {
  const lang = isZh.value ? 'zh-CN' : 'en'
  const fallback = isZh.value ? FALLBACK_DOWNLOAD_ZH : FALLBACK_DOWNLOAD_EN
  try {
    const site = await engineApi.sitePublic(lang)
    const fromAdmin = String(site?.downloadUrl || '').trim()
    if (fromAdmin) return fromAdmin
  } catch {
    /* 引擎未就绪 / 后台不可达 → 固定仓库 Release */
  }
  return fallback
}

const openWebsite = async () => {
  if (opening.value) return
  opening.value = true
  try {
    const url = await resolveDownloadUrl()
    window.electron.openExternal({ url })
  } finally {
    opening.value = false
  }
}
</script>

<style scoped lang="scss">
.update-card {
  border-radius: 18px !important;
  border: 1px solid var(--line);
  overflow: hidden;
  background: var(--surface) !important;
}

.head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 18px 18px 8px;
  .ico {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    background: var(--accent-soft);
    color: var(--ink);
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }
  strong {
    display: block;
    font-size: 15px;
    color: var(--ink);
  }
  p {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--muted);
  }
  .close {
    margin-left: auto;
    width: 30px;
    height: 30px;
    border: 0;
    border-radius: 99px;
    background: transparent;
    color: var(--muted);
    display: grid;
    place-items: center;
    cursor: pointer;
    &:hover {
      background: var(--paper);
      color: var(--ink);
    }
  }
}

.meta {
  margin: 8px 18px 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--paper);
  border: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--muted);
  em {
    font-style: normal;
    font-weight: 600;
    color: var(--ink);
    &.new {
      background: var(--accent);
      padding: 2px 8px;
      border-radius: 999px;
    }
  }
}

.notes {
  margin: 0 18px;
  max-height: 220px;
  overflow: auto;
  padding: 12px;
  border-radius: 12px;
  background: var(--paper);
  border: 1px solid var(--line);
  font-size: 13px;
  line-height: 1.6;
  color: var(--ink-soft);

  :deep(p) {
    margin: 0 0 10px;
  }
  :deep(p:last-child) {
    margin-bottom: 0;
  }
  :deep(ul),
  :deep(ol) {
    margin: 0 0 10px;
    padding-inline-start: 18px;
  }
}

.foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 18px 16px;
}

.btn {
  border: 1px solid var(--line);
  background: var(--paper);
  color: var(--ink);
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
  &.ghost {
    background: transparent;
  }
  &.primary {
    background: var(--ink);
    color: var(--accent);
    border-color: var(--ink);
    font-weight: 600;
  }
}
</style>
