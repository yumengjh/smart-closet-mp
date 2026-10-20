<script setup lang="ts">
import {getCurrentInstance,ref,watch} from 'vue'
import AuthImage from '../AuthImage.vue'
import {resolveMedia} from '../../services/media'
import {imagePoint} from '../../domain/intake'
import type {Hint} from '../../services/quickIntake'
import {errorText} from './navigation'
const props=defineProps<{src:string}>(),emit=defineEmits<{(e:'finish',hint?:Hint):void;(e:'close'):void}>(),instance=getCurrentInstance()
const mode=ref('点选'),hint=ref<Hint>(),first=ref<{x:number;y:number}>(),width=ref(1),height=ref(1),error=ref('')
watch(()=>props.src,async src=>{hint.value=undefined;first.value=undefined;try{const local=await resolveMedia(src);const info=await uni.getImageInfo({src:local});width.value=info.width;height.value=info.height}catch(e){error.value=errorText(e)}},{immediate:true})
function tap(event:any){const touch=event.changedTouches?.[0]||event.touches?.[0];if(!touch)return;uni.createSelectorQuery().in(instance?.proxy).select('.marker-stage').boundingClientRect(rect=>{if(!rect||Array.isArray(rect))return;const p=imagePoint(touch.clientX??touch.pageX,touch.clientY??touch.pageY,{left:rect.left,top:rect.top,width:rect.width,height:rect.height},width.value,height.value);if(!p)return;if(mode.value==='点选'){hint.value={kind:'POINT',...p}}else if(!first.value){first.value=p;hint.value=undefined}else{const x=Math.min(first.value.x,p.x),y=Math.min(first.value.y,p.y);hint.value={kind:'BOX',x,y,width:Math.abs(first.value.x-p.x),height:Math.abs(first.value.y-p.y)};first.value=undefined}}).exec()}
const coordinate=(p:Hint)=>p.kind==='POINT'?`已选主角位置：${Math.round(p.x*100)}% / ${Math.round(p.y*100)}%`:'已框选主角区域'
</script>
<template><view class="sheet"><text class="sheet-title">选一下这张的主角</text><text class="subtitle">{{mode==='点选'?'点击想收的衣物。':'依次点击衣物区域的两个对角，框住想收的衣物。'}}</text><wd-segmented v-model:value="mode" :options="['点选','框选']" @change="hint=undefined;first=undefined"/><view class="marker-stage" @touchend="tap"><AuthImage :src="src" :width="960"/></view><text v-if="first" class="hint">已选第一个角，请点击另一个对角</text><text v-if="hint" class="hint">{{coordinate(hint)}}</text><wd-notice-bar v-if="error" :text="error" :scrollable="false" wrapable/><view class="actions"><wd-button :disabled="!hint" @click="emit('finish',hint)">指定主视衣物</wd-button><wd-button plain @click="emit('finish')">使用自动选择</wd-button><wd-button type="text" @click="emit('close')">稍后再选</wd-button></view></view></template>
<style lang="scss" scoped>@import './closet.scss';.marker-stage{height:650rpx;margin-top:24rpx}</style>
