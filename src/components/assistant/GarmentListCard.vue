<script setup lang="ts">
import { computed, ref } from 'vue'
import { navigateOutfitLink } from '../../services/outfit'
import GarmentThumb from './GarmentThumb.vue'
/** 衣物清单卡: the exact matching set from the server (at most 60), each opens its garment page. */
type Item = { id: string; name?: string; category?: string[]; primaryColor?: string[]; displayUrl?: string | null }
const props = defineProps<{ payload: { items?: Item[]; total?: number; truncated?: boolean } }>()
const expanded = ref(false)
const items = computed(() => props.payload.items || []), shown = computed(() => expanded.value ? items.value : items.value.slice(0, 12))
const label = (g: Item) => g.name || `${g.primaryColor?.[0] || ''}${g.category?.[0] || '衣物'}`
</script>
<template><view class="choice">
  <text class="small">共 {{ payload.total ?? items.length }} 件{{ payload.truncated ? `，这里列出前 ${items.length} 件` : '' }}，点开查看：</text>
  <view class="options"><view v-for="g in shown" :key="g.id" class="option" @tap="navigateOutfitLink('/garment/' + g.id)"><GarmentThumb :garment-id="g.id" :display-url="g.displayUrl" :size="96" /><text class="name">{{ label(g) }}</text></view></view>
  <wd-button v-if="items.length > 12" type="text" size="small" @click="expanded = !expanded">{{ expanded ? '收起' : `展开全部 ${items.length} 件` }}</wd-button>
</view></template>
<style lang="scss" scoped>
.choice { display: flex; flex-direction: column; gap: 16rpx; margin-top: 16rpx; }.small { font-size: 24rpx; color: $muted; line-height: 1.6; }
.options { display: flex; gap: 14rpx; flex-wrap: wrap; }.option { width: 148rpx; display: flex; flex-direction: column; align-items: center; gap: 8rpx; padding: 12rpx; border: 1rpx solid $line; border-radius: $radius-sm; background: $surface; }
.name { font-size: 22rpx; text-align: center; line-height: 1.4; max-width: 100%; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
</style>
