<script setup lang="ts">
import {computed} from 'vue'
import type {BatchTarget,BatchSource} from '../../services/batches'
import AuthImage from '../AuthImage.vue'
const props=defineProps<{target:BatchTarget;source?:BatchSource;processed?:boolean}>()
const crop=computed(()=>{const b=props.target.recognition?.target?.bounds;if(!b||b.width<=0||b.height<=0)return {};return{width:`${100/b.width}%`,height:`${100/b.height}%`,left:`${-100*b.x/b.width}%`,top:`${-100*b.y/b.height}%`}})
</script>
<template><view class="target-preview"><AuthImage v-if="processed&&target.outputUrl" :src="target.outputUrl" :width="320"/><view v-else-if="source" class="crop" :style="crop"><AuthImage :src="source.previewUrl" :width="640" mode="scaleToFill"/></view></view></template>
<style lang="scss" scoped>.target-preview{position:relative;width:144rpx;height:144rpx;overflow:hidden;background:$surface-alt;border-radius:$radius-sm;flex-shrink:0}.crop{position:absolute;width:100%;height:100%;left:0;top:0}</style>
