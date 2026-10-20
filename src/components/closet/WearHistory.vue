<script setup lang="ts">
import {ref,onMounted} from 'vue'
import {closetTools} from '../../services/closet'
import {errorText} from './navigation'
const props=defineProps<{garmentId:string}>(),wear=ref<Awaited<ReturnType<typeof closetTools.wear>>>(),open=ref(false),loading=ref(false),error=ref(''),data=ref<Awaited<ReturnType<typeof closetTools.explain>>>()
onMounted(()=>closetTools.wear(props.garmentId).then(v=>wear.value=v).catch(()=>{}))
async function explain(){open.value=true;loading.value=true;error.value='';try{let run=uni.getStorageSync('yixu.recommend.last-run.v1');if(!run){run=(await closetTools.recommend()).runId;uni.setStorageSync('yixu.recommend.last-run.v1',run)}data.value=await closetTools.explain(run,props.garmentId)}catch(e){error.value=errorText(e,'暂时无法解释。')}finally{loading.value=false}}
</script>
<template><view class="section"><text class="section-title">穿着记录</text><text v-if="wear?.count" class="subtitle">上次穿着：{{wear.lastWornOn}}（{{wear.daysSince===0?'今天':`${wear.daysSince} 天前`}}）· 共穿过 {{wear.count}} 次</text><text v-else class="subtitle">还没有“今天穿了”的记录。在推荐详情或已保存搭配里点“今天穿了这套”即可记录。</text><wd-button type="text" @click="explain">为什么没推荐它</wd-button></view><wd-popup v-model="open" position="bottom" closable><view class="sheet"><text class="sheet-title">推荐依据</text><wd-loading v-if="loading"/><wd-notice-bar v-else-if="error" :text="error" :scrollable="false" wrapable/><template v-else><text v-for="(line,i) in data?.summary||[]" :key="i" class="subtitle">{{line}}</text><view v-for="rule in (data?.outfit||data?.bestOutfit)?.rules.filter(r=>r.hit)||[]" :key="rule.id" class="field-row"><view class="row"><text>{{rule.label}}</text><text>{{rule.delta>0?'+':''}}{{rule.delta}}</text></view><text v-if="rule.evidence" class="hint">{{rule.evidence}}</text></view></template></view></wd-popup></template>
<style lang="scss" scoped>@import './closet.scss';</style>
