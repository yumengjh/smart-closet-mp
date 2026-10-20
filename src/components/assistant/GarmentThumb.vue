<script setup lang="ts">
import { ref, watch } from 'vue'
import { closetApi } from '../../services/api'
import AuthImage from '../AuthImage.vue'
/** Small garment picture. Recommendation cards pass displayUrl; otherwise one detail request is cached per garment. */
const props = defineProps<{ garmentId: string; displayUrl?: string | null; size?: number }>()
const cache = new Map<string, Promise<string>>()
const url = ref('')
async function load() {
  if (props.displayUrl !== undefined) { url.value = props.displayUrl || ''; return }
  let p = cache.get(props.garmentId)
  if (!p) { p = closetApi.detail(props.garmentId).then(g => g.displayUrl || '').catch(() => ''); cache.set(props.garmentId, p) }
  url.value = await p
}
watch(() => [props.garmentId, props.displayUrl], load, { immediate: true })
</script>
<template><view class="thumb" :style="{ width: (size || 112) + 'rpx', height: (size || 112) + 'rpx' }"><AuthImage v-if="url" :src="url" :width="240" mode="aspectFit" /></view></template>
<style lang="scss" scoped>.thumb { border-radius: $radius-sm; overflow: hidden; background: $surface-alt; flex-shrink: 0; }</style>
