<script setup lang="ts">
import { computed } from 'vue'
import type { Pose } from '../../services/platform'
import { figure, palette } from './pose-figure'
const props = defineProps<{ pose: Pose }>()
const art = computed(() => figure(props.pose))
const bones = computed(() => art.value?.segments.map(s => ({ key: s.key, style: { left: s.x1 * 1.5 + 'rpx', top: s.y1 * 1.5 + 'rpx', width: Math.hypot(s.x2 - s.x1, s.y2 - s.y1) * 1.5 + 'rpx', transform: `rotate(${Math.atan2(s.y2 - s.y1, s.x2 - s.x1)}rad)` } })) || [])
</script>
<template><view class="figure" :style="{ background: palette(pose.id)?.[0] }"><template v-if="art"><view v-for="b in bones" :key="b.key" class="bone" :style="b.style" /><view v-if="art.head" class="head" :style="{ left: (art.head.x - art.head.r) * 1.5 + 'rpx', top: (art.head.y - art.head.r) * 1.5 + 'rpx', width: art.head.r * 3 + 'rpx', height: art.head.r * 3 + 'rpx' }" /></template><view v-else class="text-pose">{{ pose.name }}</view></view></template>
<style lang="scss" scoped>.figure { position: relative; width: 180rpx; height: 240rpx; border-radius: 20rpx; overflow: hidden; }.bone { position: absolute; height: 6rpx; background: $accent; border-radius: 6rpx; transform-origin: left center; }.head { position: absolute; background: $accent; border-radius: 50%; }.text-pose { padding: 80rpx 20rpx; text-align: center; color: $accent; }</style>
