<script setup lang="ts">
import { computed } from 'vue'
import AuthImage from '../AuthImage.vue'
import type { OutfitScene } from '../../domain/outfit'
import { frameStyle, imageCropStyle } from './board-geometry'
const props = defineProps<{ scene: OutfitScene; title?: string }>()
const elements = computed(() => [...props.scene.elements].sort((a, b) => a.zIndex - b.zIndex))
</script>
<template>
  <view class="outfit-thumbnail" :aria-label="title || '搭配预览'">
    <view v-for="(item, i) in elements" :key="item.elementId || i" class="sticker" :style="frameStyle(item)">
      <view class="artwork" :style="{ transform: item.flipX ? 'scaleX(-1)' : '' }"><AuthImage :src="item.assetUrl" :width="640" mode="scaleToFill" :style="imageCropStyle(item)" /></view>
    </view>
    <view v-if="!elements.length" class="empty"><wd-icon name="picture" size="48rpx" /><text>搭配预览</text></view>
  </view>
</template>
<style lang="scss" scoped>
.outfit-thumbnail { width: 100%; padding-top: 125%; position: relative; background: $surface; overflow: hidden; }
.sticker { position: absolute; pointer-events: none; }.artwork { position: relative; height: 100%; width: 100%; overflow: hidden; }
.outfit-thumbnail :deep(.auth-image) { background: transparent; }.empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 16rpx; color: $muted; }
</style>
