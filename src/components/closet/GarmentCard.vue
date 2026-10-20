<script setup lang="ts">
import { computed } from 'vue'
import AuthImage from '../AuthImage.vue'
import type { Garment } from '../../services/api'
import { isProcessing,taskLabels } from '../../domain/workflow'
import { openGarment } from './navigation'
const props=defineProps<{garment:Garment;pending?:boolean;selectable?:boolean;selected?:boolean}>()
const emit=defineEmits<{(e:'toggle'):void}>()
const title=computed(()=>props.garment.name||(props.garment.category[0]&&props.garment.category[0]!=='未分类'?`${props.garment.primaryColor[0]==='未知颜色'?'':props.garment.primaryColor[0]||''}${props.garment.category[0]}`:'未分类衣物'))
const stickerPending=computed(()=>props.garment.imageProcessing?.stickerRequired&&!props.garment.imageProcessing.stickerReady&&!isProcessing(props.garment.taskStatus))
const queueLabel=computed(()=>props.garment.taskStatus==='QUEUED'?'排队中':props.garment.taskStatus==='RUNNING'?'处理中':props.garment.taskStatus==='CANCEL_REQUESTED'?'正在取消':'')
const ai=computed(()=>props.garment.images.some(i=>i.id===props.garment.displayAssetId&&i.aiGenerated))
function open(){if(props.selectable)emit('toggle');else openGarment(props.garment.id)}
</script>
<template><view class="garment-card" :class="{selected}" @tap="open">
 <view class="picture"><AuthImage :src="garment.displayUrl||garment.sourceUrl" :width="640"/><view class="badge"><wd-tag v-if="queueLabel">{{queueLabel}}</wd-tag><wd-tag v-if="garment.favorite" type="warning">已收藏</wd-tag></view><view v-if="selectable" class="check" @tap.stop="emit('toggle')"><wd-checkbox :model-value="!!selected" /></view></view>
 <view class="copy"><view class="title">{{title}}</view><text class="muted">{{garment.patterns[0]||'信息待补充'}}{{garment.seasons.length?' · '+garment.seasons.slice(0,2).join(' / '):''}}</text><view class="labels"><wd-tag v-if="pending" plain>{{stickerPending?'贴纸待继续':garment.taskStatus?taskLabels[garment.taskStatus]:'待核对'}} · 未入柜</wd-tag><wd-tag v-else-if="stickerPending" plain>已入柜 · 贴纸未完成</wd-tag><wd-tag v-if="ai" plain>AI 生成 · 可能含推测细节</wd-tag></view></view>
</view></template>
<style lang="scss" scoped>
.garment-card{overflow:hidden;border:2rpx solid $line;border-radius:$radius-lg;background:$surface}.selected{border-color:$accent;box-shadow:0 0 0 2rpx $accent}.picture{height:500rpx;position:relative;background:$surface-alt}.badge{position:absolute;bottom:20rpx;right:20rpx;display:flex;gap:12rpx}.check{position:absolute;top:20rpx;left:20rpx}.copy{padding:24rpx}.title{font-size:32rpx;font-weight:600;margin-bottom:12rpx}.labels{display:flex;flex-wrap:wrap;gap:12rpx;margin-top:16rpx}
</style>
