<script lang="ts" setup>
/**
 * Lucide 纤细圆润图标封装（默认 stroke 1.6）
 */
import { computed } from 'vue'
import type { Component } from 'vue'

const props = withDefaults(
  defineProps<{
    icon: Component
    size?: number | string
    strokeWidth?: number | string
  }>(),
  {
    size: 18,
    strokeWidth: 1.6,
  },
)

const style = computed(() => ({
  width: typeof props.size === 'number' ? `${props.size}px` : props.size,
  height: typeof props.size === 'number' ? `${props.size}px` : props.size,
  flexShrink: '0',
}))
</script>

<template>
  <component
    :is="icon"
    class="app-icon"
    :size="size"
    :stroke-width="strokeWidth"
    :style="style"
    aria-hidden="true"
  />
</template>

<style scoped>
.app-icon {
  display: block;
  color: currentColor;
}
</style>
