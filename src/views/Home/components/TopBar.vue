<template>
  <div class="topbar">
    <div class="cluster">
      <div class="chip static">
        <span>v{{ version }}</span>
      </div>
      <i class="sep" />
      <button type="button" class="chip" @click="openAbout">
        <AppIcon :icon="Info" :size="13" :stroke-width="1.6" />
        <span>{{ t('menu.app.about') }}</span>
      </button>
      <button type="button" class="chip" :disabled="checking" @click="handleCheckUpdate">
        <AppIcon :icon="ArrowUpCircle" :size="13" :stroke-width="1.6" :class="{ spin: checking }" />
        <span>{{ checking ? t('update.checking') : t('version.checkUpdate') }}</span>
      </button>
    </div>

    <UpdateDialog v-if="updateInfo" v-model="showUpdateDialog" :update-info="updateInfo" />
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useTranslation } from 'i18next-vue'
import { ArrowUpCircle, Info } from '@lucide/vue'
import AppIcon from '@/components/AppIcon.vue'
import UpdateDialog from '@/components/UpdateDialog.vue'
import type { UpdateInfo } from '~/electron/updater'
import { classifyTaskError } from '@/lib/notice-kind'
import { pushNotice } from '@/lib/notice'

const version = __APP_VERSION__
const { t } = useTranslation()
const showUpdateDialog = ref(false)
const updateInfo = ref<UpdateInfo | null>(null)
const checking = ref(false)

const openAbout = () => {
  window.electron.openExternal({ url: 'https://bvp1vrzjvhe.feishu.cn/wiki/QpxmwLC5NiwkzXkl48ZcWXp2nmg?from=from_copylink' })
}

const handleCheckUpdate = async () => {
  if (checking.value) return
  checking.value = true
  try {
    const result = await window.electron.checkForUpdates()
    if (result.status === 'available') {
      updateInfo.value = result.info
      showUpdateDialog.value = true
    } else if (result.status === 'up-to-date') {
      pushNotice('ok', t('update.upToDate'))
    } else {
      const kind = classifyTaskError(result.message || '')
      pushNotice('attention', t(kind === 'network' ? 'notice.network' : 'notice.other'))
    }
  } catch (e: any) {
    const kind = classifyTaskError(e?.message || '')
    pushNotice('attention', t(kind === 'network' ? 'notice.network' : 'notice.other'))
  } finally {
    checking.value = false
  }
}
</script>

<style lang="scss" scoped>
.topbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.cluster {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow);
  backdrop-filter: blur(8px);
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 11px;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  &:hover:not(.static):not(:disabled) {
    background: var(--accent-soft);
    color: var(--ink);
  }
  &.static {
    cursor: default;
    padding-inline: 8px;
  }
  &:disabled {
    opacity: 0.65;
    cursor: wait;
  }
}

.sep {
  width: 1px;
  height: 12px;
  background: var(--line);
  margin: 0 1px;
}

.spin {
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
