<template>
  <div class="notice-host" aria-live="polite">
    <Transition name="notice">
      <div
        v-if="item"
        :key="item.id"
        class="notice"
        :class="item.tone"
        role="status"
      >
        <i class="mark" />
        <p>{{ item.text }}</p>
        <button
          v-if="item.tone === 'attention'"
          type="button"
          class="x"
          :aria-label="t('notice.dismiss')"
          @click="dismissNotice"
        >
          <AppIcon :icon="X" :size="14" :stroke-width="1.8" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useTranslation } from 'i18next-vue'
import { X } from '@lucide/vue'
import AppIcon from '@/components/AppIcon.vue'
import { dismissNotice, noticeState } from '@/lib/notice'

const { t } = useTranslation()
const item = computed(() => noticeState.item)
</script>

<style lang="scss" scoped>
.notice-host {
  position: fixed;
  left: 20px;
  bottom: 20px;
  z-index: 4000;
  pointer-events: none;
}

.notice {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: min(360px, calc(100vw - 40px));
  padding: 14px 12px 14px 14px;
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow-pop);
}

.notice.ok {
  background: linear-gradient(180deg, #f7fbe8 0%, var(--surface) 48%);
}

.mark {
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 99px;
  flex: none;
  background: var(--accent-deep);
  box-shadow: 0 0 0 4px var(--accent-soft);
}

.notice.attention .mark {
  background: var(--ink);
  box-shadow: 0 0 0 4px var(--paper-2);
}

p {
  margin: 0;
  flex: 1;
  font-size: 13px;
  line-height: 1.5;
  font-weight: 500;
  letter-spacing: -0.01em;
}

.x {
  border: 0;
  background: transparent;
  color: var(--muted);
  width: 22px;
  height: 22px;
  border-radius: 99px;
  display: grid;
  place-items: center;
  cursor: pointer;
  flex: none;
  &:hover {
    background: var(--paper-2);
    color: var(--ink);
  }
}

.notice-enter-active,
.notice-leave-active {
  transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.28s;
}

.notice-enter-from,
.notice-leave-to {
  opacity: 0;
  transform: translateX(-18px);
}
</style>
