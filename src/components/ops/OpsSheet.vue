<script setup lang="ts">
withDefaults(defineProps<{ modelValue: boolean; title: string; busy?: boolean; persistent?: boolean }>(), { busy: false, persistent: false })
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; closed: [] }>()
</script>
<template>
  <wd-popup :model-value="modelValue" position="bottom" :z-index="30" :close-on-click-modal="!busy && !persistent" safe-area-inset-bottom custom-style="border-radius: 28rpx 28rpx 0 0;" @update:model-value="emit('update:modelValue', $event)" @after-leave="emit('closed')">
    <view class="sheet-heading"><text class="sheet-title">{{ title }}</text><wd-button v-if="!persistent" type="text" :disabled="busy" @click="emit('update:modelValue', false)">关闭</wd-button></view>
    <scroll-view scroll-y class="sheet-scroll"><view class="sheet-content"><slot /></view></scroll-view>
  </wd-popup>
</template>
<style scoped lang="scss">
.sheet-heading { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; padding: 24rpx 32rpx; border-bottom: 1rpx solid $line; }
.sheet-title { font-weight: 600; font-size: 32rpx; }
.sheet-scroll { height: calc(80vh - 100rpx); }
.sheet-content { padding: 16rpx 32rpx 48rpx; }
</style>
