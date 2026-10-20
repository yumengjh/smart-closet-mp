<script setup lang="ts">
import { computed } from 'vue'
import type { OutfitScene } from '../../domain/outfit'
import AuthImage from '../AuthImage.vue'
const props = defineProps<{ scene: OutfitScene }>()
const elements = computed(() => [...props.scene.elements].sort((a, b) => a.zIndex - b.zIndex).map(e => ({ ...e, style: { left: e.x / 1080 * 100 + '%', top: e.y / 1350 * 100 + '%', width: e.width / 1080 * 100 + '%', height: e.height / 1350 * 100 + '%', transform: `translate(-50%, -50%) rotate(${e.rotation}deg) scaleX(${e.flipX ? -1 : 1})` } })))
</script>
<template><view class="scene"><view v-for="e in elements" :key="e.elementId || e.garmentId" class="element" :style="e.style"><AuthImage :src="e.assetUrl" /></view></view></template>
<style lang="scss" scoped>.scene { position: relative; width: 100%; height: 740rpx; background: $surface-alt; border-radius: $radius-md; overflow: hidden; }.element { position: absolute; }</style>
