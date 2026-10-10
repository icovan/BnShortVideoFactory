<template>
  <v-dialog v-model="dialogVisible" max-width="440">
    <v-card class="act-card">
      <header class="head">
        <span class="ico" :class="ent?.badge || 'locked'">
          <AppIcon :icon="statusIcon" :size="20" :stroke-width="1.6" />
        </span>
        <div>
          <strong>{{ t('studio.license.dialogTitle') }}</strong>
          <p>{{ statusLine }}</p>
        </div>
        <button type="button" class="close" @click="dialogVisible = false">
          <AppIcon :icon="X" :size="16" :stroke-width="1.6" />
        </button>
      </header>

      <div class="body">
        <template v-if="ent?.activated && ent.status === 'active'">
          <div class="row">
            <span>{{ t('studio.license.expiresAt') }}</span>
            <em>{{ expiresLabel }}</em>
          </div>
        </template>
        <template v-else>
          <label class="field">
            <span>{{ t('studio.license.code') }}</span>
            <div class="code-row">
              <input
                v-model="code"
                type="text"
                class="input"
                :placeholder="t('studio.license.codePlaceholder')"
                :disabled="busy"
                @keydown.enter.prevent="activate"
              />
              <button type="button" class="btn primary" :disabled="busy || !code.trim()" @click="activate">
                {{ busy ? t('studio.license.activating') : t('studio.license.activate') }}
              </button>
            </div>
          </label>
          <p v-if="err" class="err">{{ err }}</p>
        </template>

        <div class="row machine">
          <span>{{ t('studio.license.user') }}</span>
          <em class="mono" :title="ent?.machineId">{{ ent?.machineId || '—' }}</em>
        </div>
      </div>

      <div class="sep" />

      <footer class="foot">
        <p class="more">
          {{ t('studio.license.learnMore') }}
          <a
            v-if="site?.aboutUrl"
            :href="site.aboutUrl"
            target="_blank"
            rel="noreferrer"
            @click.prevent="openAbout"
          >{{ t('studio.license.about', { name: site.siteName || 'BnShortVideoFactory' }) }}</a>
          <span v-else class="muted">{{ t('studio.license.about', { name: 'BnShortVideoFactory' }) }}</span>
        </p>
        <p class="copy">{{ site?.copyright || t('studio.license.copyrightFallback') }}</p>
      </footer>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useTranslation } from 'i18next-vue'
import { CheckCircle2, Lock, Sparkles, X } from '@lucide/vue'
import AppIcon from '@/components/AppIcon.vue'
import {
  engineApi,
  type EntitlementSnapshot,
  type PublicAppSite,
} from '@/lib/engine-api'
import { useAppStore } from '@/store'

const props = defineProps<{
  modelValue: boolean
  entitlement: EntitlementSnapshot | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  activated: [ent: EntitlementSnapshot]
}>()

const { t, i18next } = useTranslation()
const appStore = useAppStore()

const code = ref('')
const busy = ref(false)
const err = ref('')
const site = ref<PublicAppSite | null>(null)

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const ent = computed(() => props.entitlement)

const statusIcon = computed(() => {
  if (ent.value?.activated && ent.value.status === 'active') return CheckCircle2
  if (ent.value?.badge === 'trial') return Sparkles
  return Lock
})

const statusLine = computed(() => {
  if (!ent.value) return t('studio.license.loading')
  if (ent.value.activated && ent.value.status === 'active') {
    if (ent.value.daysLeft == null) return t('studio.license.proLife')
    return t('studio.license.proDays', { n: ent.value.daysLeft })
  }
  if (ent.value.status === 'trial' && ent.value.daysLeft != null) {
    return t('studio.license.trialDays', { n: ent.value.daysLeft })
  }
  return ent.value.message || t('studio.license.locked')
})

const expiresLabel = computed(() => {
  if (!ent.value?.activated) return '—'
  if (!ent.value.expiresAt) return t('studio.license.lifetime')
  try {
    return new Date(ent.value.expiresAt).toLocaleString(i18next.language)
  } catch {
    return ent.value.expiresAt
  }
})

async function loadSite() {
  try {
    const lang = (appStore.locale || i18next.language || 'zh-CN').startsWith('zh') ? 'zh-CN' : 'en'
    site.value = await engineApi.sitePublic(lang)
  } catch {
    site.value = null
  }
}

async function activate() {
  const c = code.value.trim()
  if (!c || busy.value) return
  busy.value = true
  err.value = ''
  try {
    const res = await engineApi.licenseActivate(c)
    code.value = ''
    emit('activated', res.entitlement)
  } catch (e: any) {
    err.value = e?.message || String(e)
  } finally {
    busy.value = false
  }
}

function openAbout() {
  const url = site.value?.aboutUrl
  if (!url) return
  if (window.electron?.openExternal) {
    void window.electron.openExternal({ url })
  } else {
    window.open(url, '_blank', 'noopener')
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      err.value = ''
      void loadSite()
    }
  },
)
</script>

<style scoped lang="scss">
.act-card {
  border-radius: 16px;
  overflow: hidden;
  background: var(--surface);
  color: var(--ink);
}
.head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 18px 18px 8px;
  strong {
    display: block;
    font-size: 16px;
  }
  p {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--muted);
  }
}
.ico {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: var(--paper-2);
  color: var(--ink);
  &.pro {
    background: var(--accent-soft);
  }
  &.trial {
    background: #eef6ff;
    color: #1d4f91;
  }
  &.locked,
  &.expired {
    background: #fdecea;
    color: var(--danger);
  }
}
.close {
  margin-left: auto;
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  padding: 4px;
}
.body {
  padding: 8px 18px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  span {
    color: var(--muted);
    flex-shrink: 0;
  }
  em {
    font-style: normal;
    text-align: right;
    word-break: break-all;
  }
  &.machine em.mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
    color: var(--muted-2);
  }
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--muted);
}
.code-row {
  display: flex;
  gap: 8px;
}
.input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 8px 10px;
  background: var(--paper);
  color: var(--ink);
  font-size: 13px;
}
.btn {
  border: 0;
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
  &.primary {
    background: var(--ink);
    color: var(--paper);
    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  }
}
.err {
  margin: 0;
  font-size: 12px;
  color: var(--danger);
}
.sep {
  height: 1px;
  background: var(--line);
  margin: 0 18px;
}
.foot {
  padding: 12px 18px 16px;
  .more {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
    line-height: 1.5;
    a {
      color: var(--ink);
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .muted {
      color: var(--muted-2);
    }
  }
  .copy {
    margin: 8px 0 0;
    font-size: 11px;
    color: var(--muted-2);
  }
}
</style>
