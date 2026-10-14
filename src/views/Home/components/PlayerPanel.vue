<template>
  <section class="player-panel">
    <div class="stage">
      <div class="frame" :class="aspectClass">
        <div class="grid" aria-hidden="true" />
        <video
          v-if="task?.videoPath"
          :key="task.id + ':' + (task.videoPath || '')"
          ref="videoEl"
          class="video"
          :src="task.videoPath"
          controls
          playsinline
          @loadeddata="tryPlay"
        />
        <div v-else class="empty">
          <div class="empty-badge">
            <AppIcon :icon="Clapperboard" :size="18" />
            <p>{{ emptyText }}</p>
          </div>
          <span v-if="task">{{ task.aspect }} · {{ task.quality }}</span>
        </div>
      </div>
    </div>
    <div v-if="task" class="meta">
      <strong>{{ task.title }}</strong>
      <span class="pill" :class="task.status">{{ statusLabel }}</span>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useTranslation } from 'i18next-vue'
import { Clapperboard } from '@lucide/vue'
import AppIcon from '@/components/AppIcon.vue'
import { type Aspect, type StudioTask } from '@/store/studio'

const props = defineProps<{ task: StudioTask | null }>()
const { t } = useTranslation()
const videoEl = ref<HTMLVideoElement | null>(null)

const aspect = computed<Aspect>(() => props.task?.aspect || '16:9')
const aspectClass = computed(() => `ar-${aspect.value.replace(':', '-')}`)

function tryPlay() {
  const el = videoEl.value
  if (!el || !props.task?.videoPath) return
  void el.play().catch(() => {
    /* 浏览器可能拦截无手势自动播放，有 controls 即可手动播 */
  })
}

watch(
  () => props.task?.id,
  async () => {
    await nextTick()
    tryPlay()
  },
)

const emptyText = computed(() => {
  if (!props.task) return t('studio.player.empty')
  if (props.task.status === 'running' || props.task.status === 'queued') {
    return t('studio.player.generating')
  }
  if (props.task.status === 'paused') return t('studio.player.paused')
  if (props.task.status === 'error') return props.task.error || t('studio.player.failed')
  return t('studio.player.waiting')
})

const statusLabel = computed(() => {
  if (!props.task) return ''
  return t(`studio.status.${props.task.status}`)
})
</script>

<style lang="scss" scoped>
.player-panel {
  flex: 1 1 50%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

/* 占满半区；各比例播放器随容器等比例缩放 */
.stage {
  flex: 1;
  min-height: 0;
  width: 100%;
  container-type: size;
  display: grid;
  place-items: center;
  padding: 4px 0;
  box-sizing: border-box;
}

.frame {
  position: relative;
  border-radius: var(--radius);
  border: 1px solid var(--line);
  overflow: hidden;
  display: grid;
  place-items: center;
  background: var(--paper);
  box-shadow: var(--shadow);
  max-width: 100%;
  max-height: 100%;
}

.frame.ar-16-9 {
  aspect-ratio: 16 / 9;
  width: min(100cqw, calc(100cqh * 16 / 9));
  height: auto;
}

.frame.ar-9-16 {
  aspect-ratio: 9 / 16;
  width: min(100cqw, calc(100cqh * 9 / 16));
  height: auto;
}

.frame.ar-1-1 {
  aspect-ratio: 1 / 1;
  width: min(100cqw, 100cqh);
  height: auto;
}

.frame.ar-3-4 {
  aspect-ratio: 3 / 4;
  width: min(100cqw, calc(100cqh * 3 / 4));
  height: auto;
}

.grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.55;
  background-image:
    linear-gradient(rgb(0 0 0 / 4%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(0 0 0 / 4%) 1px, transparent 1px);
  background-size: 28px 28px;
}

.video {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: var(--player-bg);
  display: block;
}

.empty {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: 16px 12px;
  color: var(--muted);
  span {
    display: block;
    margin-top: 8px;
    font-size: 11px;
    color: var(--muted-2);
  }
}

.empty-badge {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-radius: var(--radius-pill);
  background: var(--ink);
  color: #f4f1ea;
  p {
    margin: 0;
    font-size: 12px;
    font-weight: 500;
    color: #f4f1ea;
  }
}

.meta {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--muted);
  strong {
    color: var(--ink);
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.pill {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: var(--radius-pill);
  background: var(--paper-2);
  color: var(--muted);
  &.ready {
    background: var(--accent);
    color: var(--ink);
  }
  &.running,
  &.queued {
    background: var(--ink);
    color: var(--accent);
  }
  &.paused {
    background: var(--paper-2);
    color: var(--ink);
  }
  &.error {
    background: #fdecea;
    color: var(--danger);
  }
}
</style>
