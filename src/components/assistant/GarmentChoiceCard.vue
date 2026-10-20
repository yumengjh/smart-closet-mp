<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useToast } from 'wot-design-uni'
import { recommendApi } from '../../recommend/api'
import type { RecommendationView } from '../../recommend/types'
import GarmentThumb from './GarmentThumb.vue'
import RecommendationGroup from '../outfit/RecommendationGroup.vue'
/** 指代选择卡: the assistant's search matched several garments; tapping one recommends around it, no further model round. */
defineProps<{ payload: { query?: string; total?: number; candidates?: { name: string; garmentIds: string[]; reasons?: string[]; displayUrl?: string | null }[] } }>()
const selector = `choice-${Math.random().toString(36).slice(2)}`, toast = useToast(selector)
const picked = ref(''), loading = ref(false), view = ref<RecommendationView | null>(null)
let ticket = 0
onUnmounted(() => { ticket++ })
async function pick(id: string) {
  const current = ++ticket; picked.value = id; loading.value = true
  try { const next = await recommendApi.recommend({ requiredGarmentIds: [id], count: 3 }); if (current === ticket) view.value = next }
  catch (e) { if (current === ticket) toast.error(e instanceof Error ? e.message : '推荐暂时不可用。') }
  finally { if (current === ticket) loading.value = false }
}
</script>
<template><view class="choice">
  <text class="small">“{{ payload.query }}”找到 {{ payload.total }} 件，点一下用它搭一套（不再调用大模型）：</text>
  <view class="options"><view v-for="c in payload.candidates" :key="c.garmentIds[0]" class="option" :class="{ active: picked === c.garmentIds[0] }" @tap="pick(c.garmentIds[0])"><GarmentThumb :garment-id="c.garmentIds[0]" :display-url="c.displayUrl" :size="96" /><text class="name">{{ loading && picked === c.garmentIds[0] ? '推荐中…' : c.name }}</text></view></view>
  <RecommendationGroup v-if="view" :key="view.runId" :view="view" dense /><wd-toast :selector="selector" />
</view></template>
<style lang="scss" scoped>
.choice { display: flex; flex-direction: column; gap: 16rpx; margin-top: 16rpx; }.small { font-size: 24rpx; color: $muted; line-height: 1.6; }
.options { display: flex; gap: 14rpx; flex-wrap: wrap; }.option { width: 148rpx; display: flex; flex-direction: column; align-items: center; gap: 8rpx; padding: 12rpx; border: 1rpx solid $line; border-radius: $radius-sm; background: $surface; }
.option.active { border-color: $accent; background: $accent-soft; }.name { font-size: 22rpx; text-align: center; line-height: 1.4; max-width: 100%; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
</style>
