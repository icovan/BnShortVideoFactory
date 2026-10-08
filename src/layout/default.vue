<template>
  <div class="layout-container" :class="{ 'is-mac': isMac }" :style="layoutStyle">
    <div class="logo" v-if="!route.meta.hideAppIcon">
      <img src="/icon.png" alt="" />
      <span>{{ t('app.name') }}</span>
    </div>
    <div class="window-control-bar">
      <div class="window-no-drag">
        <v-menu location="bottom right">
          <template v-slot:activator="{ props }">
            <div class="control-btn control-btn-translate" v-bind="props">
              <AppIcon :icon="Languages" :size="16" />
            </div>
          </template>
          <v-list
            class="p-2 space-y-1"
            activatable
            :activated="i18next.language"
            @update:activated="handleChangeLanguage"
          >
            <v-list-item
              v-for="(item, index) in i18nLanguages"
              :key="index"
              :value="item.code"
              color="primary"
              density="compact"
              rounded
            >
              <v-list-item-title>{{ item.name }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
      <div class="window-no-drag">
        <div
          class="control-btn control-btn-zoom"
          :title="t('studio.config.menuTitle')"
          @click="showConfig = true"
        >
          <AppIcon :icon="Settings" :size="16" />
        </div>
      </div>
      <ConfigDialog v-model="showConfig" />
      <template v-if="!isMac">
        <div class="control-btn control-btn-min" @click="handleMin">
          <AppIcon :icon="Minus" :size="16" />
        </div>
        <div class="control-btn control-btn-max" @click="handleMax">
          <AppIcon :icon="Maximize2" :size="14" />
        </div>
        <div class="control-btn control-btn-close" @click="handleClose">
          <AppIcon :icon="X" :size="16" />
        </div>
      </template>
    </div>
    <RouterView />
  </div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useTranslation } from 'i18next-vue'
import { Languages, Maximize2, Minus, Settings, X } from '@lucide/vue'
import AppIcon from '@/components/AppIcon.vue'
import { i18nLanguages } from '~/electron/i18n/common-options'
import ConfigDialog from '@/components/ConfigDialog.vue'

const { i18next, t } = useTranslation()

document.title = t('app.name')
watch(
  () => i18next.language,
  () => {
    document.title = t('app.name')
  },
)

const route = useRoute()
const isMac = window.electron.platform === 'darwin'
const layoutStyle = {
  '--window-control-mask-width': isMac ? '84px' : '210px',
}
const windowIsMaxed = ref(false)
const showConfig = ref(false)

const handleChangeLanguage = (lng: unknown) => {
  if ((lng as string[])[0]) {
    window.i18n.changeLanguage((lng as string[])[0])
  }
}

window.addEventListener('resize', async () => {
  windowIsMaxed.value = await window.electron.isWinMaxed()
})

const handleMin = () => {
  window.electron.winMin()
}
const handleMax = () => {
  window.electron.winMax()
}
const handleClose = () => {
  window.electron.winClose()
}
</script>

<style lang="scss" scoped>
.layout-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;

  --title-bar-height: 40px;

  .logo {
    position: absolute;
    z-index: 9999;
    top: 0;
    left: 0;
    height: var(--title-bar-height);
    padding-left: 15px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 650;
    color: var(--ink);
    user-select: none;
    -webkit-app-region: drag;

    img {
      width: 18px;
      height: 18px;
      border-radius: 5px;
    }

    span {
      font-family: var(--display);
      letter-spacing: -0.02em;
    }
  }

  &.is-mac {
    .logo {
      padding-left: 84px;
      pointer-events: none;
      -webkit-app-region: no-drag;
    }
  }

  .window-control-bar {
    position: absolute;
    z-index: 9999;
    top: 0;
    right: 0;
    display: flex;
    align-items: center;
    font-size: 14px;
    user-select: none;

    .control-btn {
      transition: all 0.1s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      width: 42px;
      height: var(--title-bar-height);
      box-sizing: border-box;
      -webkit-app-region: no-drag;

      color: var(--muted);
      &:hover {
        background: var(--accent-soft);
        color: var(--ink);
      }

      &-close {
        &:hover {
          background: var(--danger);
          color: #fff;
        }
      }
    }
  }
}
</style>
