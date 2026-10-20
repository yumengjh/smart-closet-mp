<script setup lang="ts">
/** <image> for server media: /api paths are fetched with the session cookie first (services/media.ts). */
import { ref, watch } from 'vue'
import { resolveMedia } from '../services/media'

const props = withDefaults(defineProps<{ src?: string | null; width?: number; mode?: string; radius?: string; previewable?: boolean }>(), { mode: 'aspectFit', radius: '0' })
const emit = defineEmits<{ load: []; error: [] }>()
const local = ref(''), failed = ref(false)

watch(() => [props.src, props.width] as const, async ([src, width]) => {
  local.value = ''; failed.value = false
  if (!src) return
  try { local.value = await resolveMedia(src, width) }
  catch { failed.value = true; emit('error') }
}, { immediate: true })

async function preview() {
  if (!props.previewable || !props.src) return
  uni.previewImage({ urls: [await resolveMedia(props.src)] })
}
</script>

<template>
  <view class="auth-image" :style="{ borderRadius: radius }" @tap="preview">
    <image v-if="local" class="img" :src="local" :mode="mode" @load="emit('load')" @error="failed = true" />
    <view v-else-if="failed" class="placeholder"><wd-icon name="picture" size="40rpx" color="#c3c6cf" /></view>
    <view v-else class="placeholder"><wd-loading size="32rpx" /></view>
  </view>
</template>

<style lang="scss" scoped>
.auth-image { width: 100%; height: 100%; overflow: hidden; background: $surface-alt; }
.img { width: 100%; height: 100%; display: block; }
.placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
</style>
