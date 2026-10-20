<script setup lang="ts">
import {ref,watch} from 'vue'
import {closetTools,type ProcessingStep} from '../../services/closet'
import {errorText} from './navigation'
const props=defineProps<{garmentId:string;revision?:number}>()
const steps=ref<ProcessingStep[]>([]),error=ref(''),loading=ref(false)
const states:Record<string,string>={DONE:'已完成',PENDING:'未完成',OUTDATED:'需更新',UNAVAILABLE:'不可用',NOT_APPLICABLE:'不适用'}
async function load(){loading.value=true;error.value='';try{steps.value=(await closetTools.processing(props.garmentId)).steps}catch(e){error.value=errorText(e,'处理状态暂时无法读取。')}finally{loading.value=false}}
watch(()=>[props.garmentId,props.revision],load,{immediate:true})
</script>
<template><view class="section"><view class="row"><text class="section-title">后台处理状态</text><wd-button size="small" type="text" :loading="loading" @click="load">刷新</wd-button></view><wd-notice-bar v-if="error" :text="error" :scrollable="false" wrapable/><view v-for="step in steps" :key="step.key" class="field-row"><view class="row"><text>{{step.label}}</text><wd-tag plain>{{states[step.state]||step.state}}</wd-tag></view><text class="hint">{{step.detail}}{{step.atMs?' · '+new Date(step.atMs).toLocaleString('zh-CN'):''}}</text></view></view></template>
<style lang="scss" scoped>@import './closet.scss';</style>
