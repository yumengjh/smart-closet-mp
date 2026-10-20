<script setup lang="ts">
import {ref,watch} from 'vue'
import {useToast} from 'wot-design-uni'
import AuthImage from '../AuthImage.vue'
import {closetTools,type SimilarView} from '../../services/closet'
import {errorText,openGarment} from './navigation'
const props=defineProps<{garmentId:string;draft?:boolean}>(),view=ref<SimilarView>(),error=ref(''),loading=ref(false),busy=ref(''),toast=useToast()
const levels:Record<string,string>={DUPLICATE:'可能重复',VERY_SIMILAR:'非常像',SIMILAR:'相似'}
async function load(){loading.value=true;error.value='';try{view.value=await closetTools.similar(props.garmentId)}catch(e){error.value=errorText(e,'相似衣物暂时无法加载。')}finally{loading.value=false}}
async function dismiss(id:string){busy.value=id;try{await closetTools.dismiss(props.garmentId,id);toast.success('已记住：这两件不是重复。');await load()}catch(e){toast.error(errorText(e))}finally{busy.value=''}}
watch(()=>props.garmentId,load,{immediate:true})
</script>
<template><view v-if="view?.items.length||error" class="section"><text class="section-title">相似的衣物</text><text class="hint">按颜色、轮廓、外观与描述比对，本地计算</text><wd-notice-bar v-if="error" :text="error" :scrollable="false" wrapable/><wd-button v-if="error" size="small" type="text" @click="load">重试</wd-button><view v-for="item in view?.items" :key="item.id" class="similar"><wd-notice-bar v-if="item.level==='DUPLICATE'" :text="draft?'衣柜里已有一件几乎一样的，确认不是重复再入柜':'衣柜里有一件几乎一样的，可能重复录入了'" :scrollable="false" wrapable/><view class="entry" @tap="openGarment(item.id)"><view class="thumb"><AuthImage :src="item.displayUrl" :width="160"/></view><view><text>{{item.name}}</text><view class="tags"><wd-tag v-if="item.level" plain>{{levels[item.level]}}</wd-tag></view><text class="hint">{{(item.reasons.length?item.reasons:['整体相近']).slice(0,3).join(' · ')}}</text></view></view><wd-button v-if="item.level==='DUPLICATE'" size="small" type="text" :loading="busy===item.id" @click="dismiss(item.id)">不是重复</wd-button></view><text v-if="view&&!view.ready.image" class="hint">这件的图片指纹还在后台计算，稍后刷新会更准。</text><text v-if="view?.imageModel&&['LOW_MEMORY','FAILED','INDEXING'].includes(view.imageModel.state)" class="hint">{{view.imageModel.message}}</text><wd-toast/></view></template>
<style lang="scss" scoped>@import './closet.scss';.entry{display:flex;gap:24rpx;align-items:center;padding:24rpx 0}.thumb{width:120rpx;height:120rpx;flex-shrink:0}.similar{border-bottom:2rpx solid $line;margin-top:20rpx}</style>
