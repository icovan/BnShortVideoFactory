<template>
  <div class="mask" role="dialog" aria-modal="true">
    <div class="card">
      <h2>{{ t('setup.title') }}</h2>
      <p class="lead">{{ t('setup.lead') }}</p>

      <ul class="checks">
        <li :class="{ ok: depsOk, bad: !depsOk }">
          <span>{{ t('setup.runtime') }}</span>
          <em>{{ depsOk ? t('setup.ready') : t('setup.needInstall') }}</em>
        </li>
        <li :class="{ ok: skillsOk, bad: !skillsOk }">
          <span>{{ t('setup.skills') }}</span>
          <em>{{ skillsOk ? t('setup.ready') : t('setup.skillsMissing') }}</em>
        </li>
        <li v-if="nodeHint" class="hint">{{ nodeHint }}</li>
        <li v-if="ffmpegHint" class="hint">{{ ffmpegHint }}</li>
      </ul>

      <pre v-if="log" class="log">{{ log }}</pre>
      <p v-if="error" class="err">{{ error }}</p>

      <div class="actions">
        <button type="button" class="btn primary" :disabled="busy" @click="installRuntime">
          {{ busy && phase === 'deps' ? t('setup.installing') : t('setup.installRuntime') }}
        </button>
        <button type="button" class="btn" :disabled="busy" @click="importSkills">
          {{ t('setup.importSkills') }}
        </button>
        <button type="button" class="btn ghost" :disabled="busy" @click="refresh">
          {{ t('setup.refresh') }}
        </button>
        <button
          v-if="canContinue"
          type="button"
          class="btn primary"
          :disabled="busy"
          @click="emit('done')"
        >
          {{ t('setup.continue') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useTranslation } from 'i18next-vue'

const emit = defineEmits<{ done: [] }>()
const { t } = useTranslation()

const depsOk = ref(false)
const skillsOk = ref(false)
const busy = ref(false)
const phase = ref<'idle' | 'deps' | 'skills'>('idle')
const log = ref('')
const error = ref('')
const nodeHint = ref('')
const ffmpegHint = ref('')

const canContinue = computed(() => depsOk.value && skillsOk.value)

async function refresh() {
  error.value = ''
  const st = await window.electron.engineProbe()
  depsOk.value = !!st.deps?.ok
  skillsOk.value = !!st.skills?.ready
  nodeHint.value = st.deps && !st.deps.hasNode ? t('setup.needNode') : ''
  ffmpegHint.value = st.deps && st.deps.hasFfmpeg === false ? t('setup.needFfmpeg') : ''
}

async function installRuntime() {
  if (busy.value) return
  busy.value = true
  phase.value = 'deps'
  error.value = ''
  log.value = ''
  try {
    const r = await window.electron.engineInstallDeps()
    if (!r.ok) error.value = r.error || t('setup.installFailed')
    await refresh()
  } catch (e: any) {
    error.value = e?.message || String(e)
  } finally {
    busy.value = false
    phase.value = 'idle'
  }
}

async function importSkills() {
  if (busy.value) return
  busy.value = true
  phase.value = 'skills'
  error.value = ''
  try {
    const st = await window.electron.skillsImport()
    skillsOk.value = !!st.ready
    if (!st.ready) {
      error.value = t('setup.skillsStillMissing', {
        list: st.missingRequired?.slice(0, 4).join(', ') || '—',
      })
    }
  } catch (e: any) {
    error.value = e?.message || String(e)
  } finally {
    busy.value = false
    phase.value = 'idle'
  }
}

function onInstallLog(_e: unknown, payload: { chunk?: string }) {
  if (payload?.chunk) {
    log.value = (log.value + payload.chunk).slice(-4000)
  }
}

onMounted(() => {
  void refresh()
  window.ipcRenderer.on('engine-install-log', onInstallLog)
})

onBeforeUnmount(() => {
  window.ipcRenderer.off('engine-install-log', onInstallLog)
})
</script>

<style lang="scss" scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgb(0 0 0 / 45%);
  display: grid;
  place-items: center;
  padding: 24px;
}
.card {
  width: min(520px, 100%);
  background: var(--paper, #fff);
  color: var(--ink, #111);
  border-radius: 16px;
  padding: 22px 22px 18px;
  box-shadow: 0 20px 60px rgb(0 0 0 / 25%);
}
h2 {
  margin: 0 0 8px;
  font-size: 18px;
}
.lead {
  margin: 0 0 14px;
  color: var(--muted, #666);
  font-size: 13px;
  line-height: 1.5;
}
.checks {
  list-style: none;
  margin: 0 0 14px;
  padding: 0;
  display: grid;
  gap: 8px;
  li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 13px;
    padding: 8px 10px;
    border-radius: 10px;
    background: rgb(0 0 0 / 4%);
    &.ok em {
      color: #2f7d32;
    }
    &.bad em {
      color: #b42318;
    }
    &.hint {
      display: block;
      color: var(--muted, #666);
      font-size: 12px;
    }
    em {
      font-style: normal;
      font-weight: 600;
    }
  }
}
.log {
  max-height: 120px;
  overflow: auto;
  font-size: 11px;
  background: #111;
  color: #c8f5c0;
  padding: 8px 10px;
  border-radius: 8px;
  margin: 0 0 10px;
}
.err {
  color: #b42318;
  font-size: 12px;
  margin: 0 0 10px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.btn {
  border: 1px solid var(--line, #ddd);
  background: var(--paper, #fff);
  color: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 8px 12px;
  border-radius: 999px;
  cursor: pointer;
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  &.primary {
    background: var(--ink, #111);
    color: #fff;
    border-color: transparent;
  }
  &.ghost {
    background: transparent;
  }
}
</style>
