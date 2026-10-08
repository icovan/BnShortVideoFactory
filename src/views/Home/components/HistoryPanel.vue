<template>
  <section class="history">
    <header>
      <h3>{{ t('studio.history.title') }}</h3>
      <span class="count">{{ items.length }}</span>
    </header>
    <div v-if="!items.length" class="empty">{{ t('studio.history.empty') }}</div>
    <ul v-else>
      <li v-for="item in items" :key="item.id" :class="{ active: item.id === activeId }">
        <button type="button" class="row" @click="$emit('preview', item.id)">
          <div class="thumb" :class="item.status">
            <AppIcon
              :icon="item.status === 'running' || item.status === 'queued' ? Loader2 : Film"
              :size="16"
              :class="{ spin: item.status === 'running' || item.status === 'queued' }"
            />
          </div>
          <div class="info">
            <strong>{{ item.title }}</strong>
            <span
              >{{ item.aspect }} · {{ statusLine(item) }} ·
              {{ formatTime(item.updatedAt) }}</span
            >
          </div>
          <div class="ops" @click.stop>
            <button
              v-if="item.status === 'queued'"
              type="button"
              class="op"
              :title="t('studio.history.cancelQueue')"
              @click="cancelQueue(item)"
            >
              {{ t('studio.history.cancelQueue') }}
            </button>
            <button
              type="button"
              class="op del"
              :title="t('studio.history.delete')"
              @click="askDelete(item)"
            >
              <AppIcon :icon="Trash2" :size="14" />
            </button>
            <button
              type="button"
              class="op go"
              :title="t('studio.history.openWorkbench')"
              @click="$emit('open', item.id)"
            >
              {{ t('studio.history.openWorkbench') }}
              <AppIcon :icon="ChevronRight" :size="14" />
            </button>
          </div>
        </button>
      </li>
    </ul>

    <div
      v-if="pending"
      class="confirm-mask"
      role="dialog"
      aria-modal="true"
      @click="!deleting && (pending = null)"
    >
      <div class="confirm-card" @click.stop>
        <h3>{{ t('studio.history.deleteTitle', { title: pending.title }) }}</h3>
        <p>{{ t('studio.history.deleteHint') }}</p>
        <div class="confirm-actions">
          <button type="button" class="btn" :disabled="deleting" @click="pending = null">
            {{ t('studio.history.cancel') }}
          </button>
          <button type="button" class="btn danger" :disabled="deleting" @click="confirmDelete">
            {{ deleting ? t('studio.history.deleting') : t('studio.history.deleteConfirm') }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useTranslation } from 'i18next-vue'
import { ChevronRight, Film, Loader2, Trash2 } from '@lucide/vue'
import AppIcon from '@/components/AppIcon.vue'
import { useStudioStore, type StudioTask } from '@/store/studio'

defineEmits<{ preview: [id: string]; open: [id: string] }>()

const { t } = useTranslation()
const studio = useStudioStore()
const items = computed(() => studio.history)
const activeId = computed(() => studio.activeTaskId)
const pending = ref<StudioTask | null>(null)
const deleting = ref(false)

function formatTime(ts: number) {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function statusLine(item: StudioTask) {
  if (item.status === 'queued' && item.queuePosition && item.queuePosition > 0) {
    return t('studio.history.queuePos', { n: item.queuePosition })
  }
  return t(`studio.status.${item.status}`)
}

function askDelete(item: StudioTask) {
  pending.value = item
}

async function cancelQueue(item: StudioTask) {
  try {
    await studio.cancelQueuedTask(item.id)
  } catch {
    /* ignore */
  }
}

async function confirmDelete() {
  if (!pending.value || deleting.value) return
  deleting.value = true
  try {
    await studio.deleteTask(pending.value.id)
    pending.value = null
  } finally {
    deleting.value = false
  }
}
</script>

<style lang="scss" scoped>
.history {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow);
  position: relative;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 650;
    color: var(--ink);
  }
  .count {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: var(--radius-pill);
    background: var(--accent);
    color: var(--ink);
  }
}

.empty {
  padding: 24px 14px;
  color: var(--muted-2);
  font-size: 13px;
}

ul {
  list-style: none;
  margin: 0;
  padding: 6px;
  overflow: auto;
  flex: 1;
}

li.active .row {
  background: var(--accent-soft);
}

.row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 0;
  background: transparent;
  text-align: left;
  padding: 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  &:hover {
    background: var(--paper);
  }
}

.thumb {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--ink);
  color: var(--accent);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  &.error {
    background: #fdecea;
    color: var(--danger);
  }
  &.running,
  &.queued {
    background: var(--accent-soft);
    color: var(--ink);
  }
}

.spin {
  animation: hist-spin 0.9s linear infinite;
}

@keyframes hist-spin {
  to {
    transform: rotate(360deg);
  }
}

.info {
  min-width: 0;
  flex: 1;
  strong {
    display: block;
    font-size: 13px;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  span {
    font-size: 11px;
    color: var(--muted-2);
  }
}

.ops {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
}

.row:hover .ops,
li.active .ops {
  opacity: 1;
  pointer-events: auto;
}

.op {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: 0;
  cursor: pointer;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 600;
  padding: 4px 8px;
}

.op.del {
  width: 30px;
  height: 30px;
  padding: 0;
  place-content: center;
  background: transparent;
  color: var(--muted);
  &:hover {
    background: #fdecea;
    color: var(--danger);
  }
}

.op.go {
  color: var(--ink);
  background: var(--accent-soft);
  padding: 4px 8px 4px 10px;
  &:hover {
    background: var(--accent);
  }
}

.confirm-mask {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 35%);
  display: grid;
  place-items: center;
  z-index: 5;
  padding: 16px;
}

.confirm-card {
  width: min(100%, 320px);
  background: var(--surface);
  border-radius: 14px;
  border: 1px solid var(--line);
  box-shadow: var(--shadow-pop);
  padding: 16px;
  h3 {
    margin: 0 0 8px;
    font-size: 14px;
    color: var(--ink);
  }
  p {
    margin: 0 0 14px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--muted);
  }
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  border: 1px solid var(--line);
  background: var(--paper);
  border-radius: var(--radius-pill);
  padding: 6px 14px;
  font-size: 12px;
  cursor: pointer;
  color: var(--ink);
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  &.danger {
    background: var(--ink);
    color: var(--accent);
    border-color: var(--ink);
  }
}
</style>
