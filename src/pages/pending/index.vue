<script setup lang="ts">
import {computed,ref} from 'vue'
import {onShow,onHide,onUnload,onPullDownRefresh,onReachBottom} from '@dcloudio/uni-app'
import {closetApi,type Garment} from '../../services/api'
import {closetTools,type SimilarItem} from '../../services/closet'
import {useClosetStore} from '../../stores/closet'
import {isProcessing} from '../../domain/workflow'
import GarmentCard from '../../components/closet/GarmentCard.vue'
import GarmentCardSkeleton from '../../components/closet/GarmentCardSkeleton.vue'
import FloatingPager from '../../components/closet/FloatingPager.vue'
import {openAdd,openGarment,errorText} from '../../components/closet/navigation'
const closet=useClosetStore(),items=ref<Garment[]>([]),loading=ref(true),error=ref(''),filter=ref('全部'),duplicates=ref<Record<string,SimilarItem>>({}),page=ref(1),total=ref(0)
let timer:ReturnType<typeof setTimeout>|undefined,alive=false,delay=2000,epoch=0
const needsAction=(g:Garment)=>!isProcessing(g.taskStatus)&&(!!(g.imageProcessing?.stickerRequired&&!g.imageProcessing.stickerReady)||['FAILED','UNKNOWN','CANCELLED','NEEDS_REVIEW'].includes(g.taskStatus||''))
const filtered=computed(()=>items.value.filter(g=>filter.value==='全部'||(filter.value==='处理中'?isProcessing(g.taskStatus):filter.value==='需处理'?needsAction(g):!isProcessing(g.taskStatus)&&!needsAction(g))))
async function load(){const mine=++epoch;try{const response=await closetApi.list({status:'DRAFT',q:'',category:'',color:'',season:'',page:page.value,size:24});if(!alive||mine!==epoch)return;items.value=response.items;total.value=response.total;error.value='';delay=2000;closetTools.flags(items.value.filter(i=>!isProcessing(i.taskStatus)).map(i=>i.id)).then(r=>{if(alive&&mine===epoch)duplicates.value=r.flags}).catch(()=>{})}catch(e){if(alive){error.value=errorText(e,'未入柜衣物暂时无法加载。');delay=Math.min(30000,delay*2)}}finally{if(mine===epoch)loading.value=false}}
function poll(){clearTimeout(timer);if(alive&&(error.value||items.value.some(i=>isProcessing(i.taskStatus))))timer=setTimeout(async()=>{await load();poll()},delay)}
async function refresh(){await load();poll()}
async function turn(delta:number){if(loading.value||page.value+delta<1||(page.value+delta-1)*24>=total.value)return;page.value+=delta;loading.value=true;await refresh();uni.pageScrollTo({scrollTop:0,duration:0})}
onShow(async()=>{alive=true;await refresh();await closet.refreshCounts()});onHide(()=>{alive=false;clearTimeout(timer)});onUnload(()=>{alive=false;epoch++;clearTimeout(timer)})
onPullDownRefresh(async()=>{try{await refresh()}finally{uni.stopPullDownRefresh()}});onReachBottom(()=>void turn(1))
</script>
<template><view class="page closet-page"><view class="heading"><text class="title">未入柜</text><text class="subtitle">处理中的照片和待核对结果都在这里。确认入柜后，它们会移到“我的衣柜”。</text><text class="hint">{{total}} 件</text></view><wd-segmented v-model:value="filter" :options="['全部','处理中','待核对','需处理']"/><text class="hint">状态筛选当前页</text><wd-notice-bar v-if="error" class="notice" :text="error" type="danger" :scrollable="false" wrapable/><wd-button v-if="error" size="small" @click="refresh">重试</wd-button><GarmentCardSkeleton v-if="loading" label="正在加载未入柜衣物…"/><view v-else-if="filtered.length" class="stack"><view v-for="item in filtered" :key="item.id"><GarmentCard :garment="item" pending/><view v-if="duplicates[item.id]" class="tags" @tap="openGarment(item.id)"><wd-tag type="warning">可能重复：{{duplicates[item.id].name}}</wd-tag></view></view></view><view v-else-if="!error" class="section"><wd-status-tip image="content" :tip="total?'当前页没有此状态的衣物':'没有未入柜的衣物'"/><text class="subtitle">上传后可查看处理进度，处理结束后在工作台核对结果。</text><view class="actions"><wd-button @click="openAdd()">添加衣物</wd-button></view></view><FloatingPager v-if="total>24" :page="page" :pages="Math.ceil(total/24)" :busy="loading" @change="turn"/></view></template>
<style lang="scss" scoped>@import '../../components/closet/closet.scss';.stack{margin-top:28rpx}</style>
