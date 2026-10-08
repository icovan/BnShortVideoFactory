<template>
  <div class="home-root w-full h-full flex flex-col">
    <div
      class="w-full h-[40px] relative border-b"
      :class="isMac ? 'title-bar' : 'window-drag'"
      @mousedown="handleTitleBarMouseDown"
      @dblclick="handleTitleBarDoubleClick"
    >
      <div class="window-control-bar-no-drag-mask" @mousedown.stop @dblclick.stop></div>
    </div>

    <TopBar class="home-topbar-float window-control-bar-no-drag" />

    <div class="home-body">
      <div class="col-left">
        <CreatePanel />
      </div>
      <div class="col-right">
        <PlayerPanel :task="previewTask" />
        <HistoryPanel @preview="previewHistory" @open="openWorkbench" />
      </div>
    </div>

    <EngineSetupDialog v-if="showSetup" @done="onSetupDone" />
  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import TopBar from './components/TopBar.vue'
import CreatePanel from './components/CreatePanel.vue'
import PlayerPanel from './components/PlayerPanel.vue'
import HistoryPanel from './components/HistoryPanel.vue'
import EngineSetupDialog from '@/components/EngineSetupDialog.vue'
import { useStudioStore } from '@/store/studio'

const router = useRouter()
const studio = useStudioStore()
const isMac = window.electron.platform === 'darwin'
const showSetup = ref(false)

async function checkSetup() {
  try {
    const st = await window.electron.engineProbe()
    showSetup.value = !st.deps?.ok || !st.skills?.ready
  } catch {
    showSetup.value = true
  }
}

function onSetupDone() {
  showSetup.value = false
  void studio.ensureEngine().catch(() => {})
}

onMounted(() => {
  void checkSetup()
})

const previewTask = computed(() => studio.activeTask || studio.latestReady)

function previewHistory(id: string) {
  // 只切换上方播放器，不刷新/不置顶
  studio.openTask(id)
}

function openWorkbench(id: string) {
  studio.openTask(id)
  void router.push({ name: 'workbench', params: { id } })
}

let dragState: {
  startMouseX: number
  startMouseY: number
  startClientX: number
  startWindowX: number
  startWindowY: number
  dragging: boolean
  preparing: boolean
} | null = null

const clearTitleBarDragListeners = () => {
  window.removeEventListener('mousemove', handleTitleBarMouseMove)
  window.removeEventListener('mouseup', handleTitleBarMouseUp)
}

const handleTitleBarMouseMove = async (event: MouseEvent) => {
  if (!isMac || !dragState) return

  const deltaX = event.screenX - dragState.startMouseX
  const deltaY = event.screenY - dragState.startMouseY
  if (!dragState.dragging && Math.hypot(deltaX, deltaY) < 2) return

  if (!dragState.dragging) {
    if (dragState.preparing) return
    dragState.preparing = true

    const dragInfo = await window.electron.prepareWindowDrag()
    if (!dragState || !dragInfo) return

    let initialX = dragInfo.bounds.x
    let initialY = dragInfo.bounds.y
    if (dragInfo.wasMaximized) {
      const pointerRatio = dragState.startClientX / window.innerWidth
      initialX = event.screenX - dragInfo.bounds.width * pointerRatio
      initialY = Math.max(0, event.screenY - 20)
      window.electron.setWindowPosition(initialX, initialY)
    }

    dragState.startMouseX = event.screenX
    dragState.startMouseY = event.screenY
    dragState.startWindowX = initialX
    dragState.startWindowY = initialY
  }

  dragState.dragging = true
  window.electron.setWindowPosition(
    dragState.startWindowX + event.screenX - dragState.startMouseX,
    dragState.startWindowY + event.screenY - dragState.startMouseY,
  )
}

const handleTitleBarMouseUp = () => {
  dragState = null
  clearTitleBarDragListeners()
}

const handleTitleBarMouseDown = async (event: MouseEvent) => {
  if (!isMac) return
  if (event.button !== 0 || event.detail > 1) return

  const bounds = await window.electron.getWindowBounds()
  if (!bounds) return

  dragState = {
    startMouseX: event.screenX,
    startMouseY: event.screenY,
    startClientX: event.clientX,
    startWindowX: bounds.x,
    startWindowY: bounds.y,
    dragging: false,
    preparing: false,
  }
  clearTitleBarDragListeners()
  window.addEventListener('mousemove', handleTitleBarMouseMove)
  window.addEventListener('mouseup', handleTitleBarMouseUp)
}

const handleTitleBarDoubleClick = () => {
  if (!isMac) return
  dragState = null
  clearTitleBarDragListeners()
  window.electron.toggleWindowMaximize()
}

onBeforeUnmount(() => {
  clearTitleBarDragListeners()
})
</script>

<style lang="scss" scoped>
.home-root {
  position: relative;
}

.home-topbar-float {
  position: absolute;
  top: calc(var(--title-bar-height, 40px) + 8px);
  right: 16px;
  z-index: 40;
  width: auto;
  height: auto;
  pointer-events: none;
  :deep(.cluster) {
    pointer-events: auto;
  }
}

.home-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.9fr);
  gap: 16px;
  padding: 10px 16px 18px;
  box-sizing: border-box;
}

.col-left,
.col-right {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.col-right {
  background: transparent;
}
</style>
