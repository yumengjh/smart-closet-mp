<script setup lang="ts">
import { computed } from 'vue'
import { useClosetStore } from '../../stores/closet'
import { workspace } from '../../domain/outfit-workspace'
import OutfitThumbnail from '../outfit/OutfitThumbnail.vue'
import { navigateOutfitLink } from '../../services/outfit'
const props = defineProps<{ result: { workspaceId: string; sessionId: string; boardIds: string[]; status: string; message?: string } }>()
const emit = defineEmits<{ (e: 'open'): void }>()
const closet = useClosetStore()
const boards = computed(() => closet.user ? workspace(closet.user.username, props.result.workspaceId).boards.filter(b => props.result.boardIds.includes(b.id)) : [])
function open() { emit('open'); navigateOutfitLink(`/outfits/workspace?session=${encodeURIComponent(props.result.sessionId)}${props.result.boardIds[0] ? '&board=' + encodeURIComponent(props.result.boardIds[0]) : ''}`) }
</script>
<template><view class="result">
  <view class="minis"><view v-for="board in boards.slice(0, 5)" :key="board.id" class="mini"><OutfitThumbnail :scene="board.scene" :title="board.name" /></view></view>
  <text class="strong">{{ result.status === 'COMPLETE' ? '搭配已放上临时搭台' : '搭台操作已中断' }}</text>
  <text class="small">{{ result.message || (boards.length ? `${boards.length} 套本机草稿 · 满意后再保存` : '临时组合台仅保留在创建它的设备') }}</text>
  <wd-button block size="small" plain @click="open">打开临时搭台 ↗</wd-button>
</view></template>
<style lang="scss" scoped>
.result { border: 1rpx solid $line; background: $accent-soft; padding: 24rpx; border-radius: $radius-lg; display: flex; flex-direction: column; gap: 14rpx; margin-top: 16rpx; }
.minis { display: flex; gap: 12rpx; overflow: hidden; }.mini { width: 100rpx; flex-shrink: 0; }.strong { font-weight: 600; font-size: 28rpx; }.small { font-size: 24rpx; color: $muted; line-height: 1.6; }
</style>
