<script setup lang="ts">
import {computed,nextTick,reactive,ref,watch} from 'vue'
import {onShow,onHide,onUnload,onPageScroll,onPullDownRefresh} from '@dcloudio/uni-app'
import {useMessage,useToast} from 'wot-design-uni'
import {closetApi,type Garment,type ListQuery,type SearchResult} from '../../services/api'
import {useClosetStore} from '../../stores/closet'
import {isProcessing} from '../../domain/workflow'
import GarmentCard from '../../components/closet/GarmentCard.vue'
import GarmentCardSkeleton from '../../components/closet/GarmentCardSkeleton.vue'
import FloatingPager from '../../components/closet/FloatingPager.vue'
import AuthImage from '../../components/AuthImage.vue'
import AssistantEntry from '../../components/assistant/AssistantEntry.vue'
import {buildTags,combineQuery,imageModelNotice,removeWords,IMAGE_STYLE_LABELS,SEARCH_EXAMPLES,type SearchTag} from '../../components/closet/search'
import {choosePhotos,errorText,openAdd,openTasks} from '../../components/closet/navigation'
import { useAppearance } from '../../composables/useAppearance'
const { pageStyle, minimal } = useAppearance()
const closet=useClosetStore(),message=useMessage(),toast=useToast()
const sortOptions=[{value:'updated',label:'最近更新'},{value:'created',label:'最近添加'},{value:'created_asc',label:'最早添加'},{value:'favorite',label:'收藏优先'},{value:'category',label:'按品类'},{value:'color',label:'按颜色'},{value:'name',label:'按名称'}]
const storedSize=Number(uni.getStorageSync('closet.wardrobe.size'))
const query=reactive<ListQuery>({status:'ACTIVE',q:'',category:'',color:'',season:'',page:1,size:[12,24,48,96].includes(storedSize)?storedSize:24,sort:uni.getStorageSync('closet.wardrobe.sort')||'updated'})
const items=ref<Garment[]>([]),total=ref(0),loading=ref(false),error=ref(''),options=ref<Record<string,string[]>>({}),filtersOpen=ref(false),helpOpen=ref(false),imageStyle=ref(''),queryImage=ref(''),searchResult=ref<SearchResult|null>(null)
const selecting=ref(false),selected=ref<string[]>([]),batchBusy=ref(''),progress=ref({done:0,total:0}),batchResult=ref('')
const searching=computed(()=>!!(query.q.trim()||imageStyle.value||queryImage.value)),hasFilters=computed(()=>!!(searching.value||query.category||query.color||query.season))
const pageSize=computed(()=>searching.value?20:query.size),pageCount=computed(()=>Math.max(1,Math.ceil(total.value/pageSize.value))),allSelected=computed(()=>items.value.length>0&&items.value.every(i=>selected.value.includes(i.id)))
const tags=computed(()=>searchResult.value?buildTags(searchResult.value.parsed,searchResult.value.imageStyle):[]),modelNotice=computed(()=>imageModelNotice(searchResult.value?.imageModel,!!queryImage.value))
const styles=[{value:'',label:'图片风格：默认'},...Object.entries(IMAGE_STYLE_LABELS).filter(([key])=>key!=='OTHER').map(([value,label])=>({value,label}))]
function columns(key:string,label:string){return [{value:'',label},...(options.value[key]||[]).map(value=>({value,label:value}))]}
let scrollY=0,requestId=0,timer:ReturnType<typeof setTimeout>|undefined,restoreScroll=0,visible=false
try{const old=uni.getStorageSync('closet.wardrobe.view');if(old&&Date.now()-old.savedAt<30*60*1000&&old.owner===closet.user?.username){Object.assign(query,old.query);imageStyle.value=old.imageStyle||'';restoreScroll=old.scrollY||0}}catch{}
function remember(){uni.setStorageSync('closet.wardrobe.view',{query:{...query},imageStyle:imageStyle.value,scrollY,ids:items.value.map(i=>i.id),savedAt:Date.now(),owner:closet.user?.username})}
onPageScroll(e=>{scrollY=e.scrollTop})
async function load(){const mine=++requestId;loading.value=true;error.value='';try{let response:SearchResult|Awaited<ReturnType<typeof closetApi.list>>;const q=combineQuery(query.q,query.category,query.color,query.season);if(queryImage.value)response=await closetApi.superSearch(queryImage.value,q,query.page);else if(searching.value)response=await closetApi.search(q,query.page,imageStyle.value||undefined);else response=await closetApi.list({...query});if(mine!==requestId)return;items.value=response.items;total.value=response.total;searchResult.value='parsed'in response?response:null;if(!items.value.length&&total.value&&query.page>pageCount.value){query.page=pageCount.value;await load()}}catch(e){if(mine===requestId)error.value=errorText(e,'衣柜暂时无法加载。')}finally{if(mine===requestId)loading.value=false}}
function debounce(){clearTimeout(timer);query.page=1;selected.value=[];timer=setTimeout(()=>void load(),220)}
watch(()=>[query.category,query.color,query.season,imageStyle.value],debounce)
function clearFilters(){query.q='';query.category='';query.color='';query.season='';imageStyle.value='';queryImage.value='';debounce()}
function closeTag(tag:SearchTag){if(tag.imageStyle){if(tag.words.some(w=>query.q.includes(w)))query.q=removeWords(query.q,tag.words);else imageStyle.value='ALL'}else{query.q=removeWords(query.q,tag.words);if(tag.words.includes(query.category))query.category='';if(tag.words.some(w=>w&&query.color.startsWith(w)))query.color='';if(tag.words.includes(query.season))query.season=''}debounce()}
async function attach(){try{const photos=await choosePhotos('album');const f=photos[0];if(!f)return;if(f.size>15*1024*1024)throw new Error('图片不能超过 15 MB。');const info=await uni.getImageInfo({src:f.tempFilePath}) as {type?:string};if(!['jpeg','jpg','png','webp'].includes(info.type||''))throw new Error('请选择 JPEG、PNG 或 WebP 图片。');queryImage.value=f.tempFilePath;debounce()}catch(e){toast.error(errorText(e))}}
function detach(){queryImage.value='';debounce()}
function example(value:string){query.q=value;helpOpen.value=false;debounce()}
function chooseSort(){uni.setStorageSync('closet.wardrobe.sort',query.sort);query.page=1;void load()}
function chooseSize(){uni.setStorageSync('closet.wardrobe.size',query.size);query.page=1;void load()}
async function turn(delta:number){if(loading.value||query.page+delta<1||query.page+delta>pageCount.value)return;selected.value=[];query.page+=delta;await load();uni.pageScrollTo({scrollTop:0,duration:0})}
function toggle(id:string){selected.value=selected.value.includes(id)?selected.value.filter(x=>x!==id):[...selected.value,id]}
function toggleAll(){selected.value=allSelected.value?[]:items.value.map(i=>i.id)}
function exit(){selecting.value=false;selected.value=[]}
async function batch(mode:'recognize'|'reprocess'){if(batchBusy.value)return;const targets=items.value.filter(i=>selected.value.includes(i.id)),runnable=targets.filter(i=>!isProcessing(i.taskStatus)),skipped=targets.length-runnable.length;const label=mode==='recognize'?'重新识别资料':'重新增强图片';if(!runnable.length){batchResult.value='没有可提交的衣物。所选衣物都在处理中，请等当前任务结束后再试。';return}let quota='';try{const q=await closetApi.quota();quota=`今日剩余 ${Math.max(0,q.limit-q.used)} 次。额度不够时，后面的衣物不会提交。`}catch{}try{await message.confirm({title:`${label}（${runnable.length} 件）？`,msg:`${mode==='recognize'?'每件调用一次识别模型，使用 1 次 AI 额度。':'每件分别调用识别和整理模型，使用 2 次 AI 额度。'}共需 ${runnable.length*(mode==='recognize'?1:2)} 次。${quota}${skipped?`另有 ${skipped} 件正在处理，将跳过。`:''}已有人工修改和图片会保留。`,confirmButtonText:'提交真实任务',cancelButtonText:'取消'})}catch{return}batchBusy.value=mode;progress.value={done:0,total:runnable.length};let submitted=0;const failures:string[]=[];for(const [i,g]of runnable.entries()){try{await closetApi[mode](g.id);submitted++}catch(e){const text=errorText(e);if(text.includes('额度')){failures.push(`额度不足，${runnable.length-i} 件未提交。`);break}failures.push(`${g.name||g.category[0]||'未命名衣物'}：${text}`)}finally{progress.value.done=i+1}}batchResult.value=`${label}：已提交 ${submitted} / ${targets.length} 件，可在任务页查看进度。${skipped?`${skipped} 件处理中已跳过。`:''}\n${failures.join('\n')}`;batchBusy.value='';if(submitted){exit();await Promise.all([load(),closet.refreshCounts()])}}
onShow(async()=>{visible=true;await Promise.all([load(),closet.refreshCounts(),closetApi.metadataOptions().then(v=>options.value=v).catch(e=>error.value=errorText(e))]);if(visible&&restoreScroll){await nextTick();uni.pageScrollTo({scrollTop:restoreScroll,duration:0});restoreScroll=0}})
onHide(()=>{visible=false;remember();clearTimeout(timer)})
onUnload(()=>{visible=false;remember();requestId++;clearTimeout(timer)})
onPullDownRefresh(async()=>{try{await load()}finally{uni.stopPullDownRefresh()}})
</script>
<template><page-meta :page-style="pageStyle" /><view class="page closet-page">
 <view class="heading"><text v-if="!minimal" class="muted">衣橱空间</text><text class="title">我的衣柜</text><text v-if="!minimal" class="subtitle">已经核对并确认入柜的衣物，{{searching?'搜索结果按相关度排序。':`按“${sortOptions.find(o=>o.value===query.sort)?.label||'最近更新'}”排序。`}}</text><view class="row"><text>{{total}} {{searching?'件符合':'件已入柜'}}</text><wd-button v-if="!selecting&&items.length" size="small" type="text" @click="selecting=true;batchResult=''">批量处理</wd-button><AssistantEntry from="wardrobe"/></view></view>
 <wd-search v-model="query.q" hide-cancel clearable :placeholder="queryImage?'可再加文字，例如：红色、上衣':'搜颜色、品类、描述，或用图片搜'" @change="debounce" @clear="debounce" @search="debounce" />
 <view class="actions"><wd-button size="small" plain @click="attach">用图片搜</wd-button><wd-button size="small" plain @click="filtersOpen=true">筛选{{hasFilters?' · 已筛选':''}}</wd-button><wd-button v-if="!minimal" size="small" type="text" @click="helpOpen=true">搜索说明</wd-button></view>
 <view v-if="queryImage" class="query-picture"><AuthImage :src="queryImage"/><wd-button size="small" @click="detach">去掉图片</wd-button></view>
 <view class="tags"><wd-tag v-for="tag in tags" :key="tag.key" closable @close="closeTag(tag)">{{tag.label}}</wd-tag></view>
 <wd-notice-bar v-if="searchResult?.notice" class="notice" :text="searchResult.notice" :scrollable="false" wrapable type="info"/><wd-notice-bar v-if="modelNotice&&modelNotice!==searchResult?.notice" class="notice" :text="modelNotice" :scrollable="false" wrapable/><text v-if="queryImage&&searchResult?.note" class="hint">{{searchResult.note}}</text>
 <view v-if="selecting" class="section"><view class="row"><wd-checkbox :model-value="allSelected" :disabled="!!batchBusy" @change="toggleAll">全选本页</wd-checkbox><text>已选 {{selected.length}} 件</text></view><text class="hint">AI 额度每天 0 点重置；处理中的衣物会自动跳过。识别约 {{selected.length}} 次 · 增强约 {{selected.length*2}} 次</text><text v-if="batchBusy" class="hint">正在提交 {{progress.done}} / {{progress.total}}</text><view class="actions"><wd-button size="small" :disabled="!selected.length||!!batchBusy" @click="batch('recognize')">重新识别资料</wd-button><wd-button size="small" :disabled="!selected.length||!!batchBusy" @click="batch('reprocess')">重新增强图片</wd-button><wd-button size="small" type="text" :disabled="!!batchBusy" @click="exit">完成</wd-button></view></view>
 <view v-if="batchResult" class="section"><text>{{batchResult}}</text><wd-button size="small" type="text" @click="openTasks">查看任务</wd-button></view>
 <wd-notice-bar v-if="error" class="notice" :text="error" type="danger" :scrollable="false" wrapable/><wd-button v-if="error" size="small" @click="load">重试</wd-button>
 <GarmentCardSkeleton v-if="loading&&!items.length" label="正在加载衣柜…"/>
 <view v-else-if="items.length" class="stack" :class="{dim:loading}"><view v-for="item in items" :key="item.id"><GarmentCard :garment="item" :selectable="selecting" :selected="selected.includes(item.id)" @toggle="toggle(item.id)"/><text v-if="searchResult?.reasons[item.id]?.length" class="hint">{{searchResult.reasons[item.id].join(' · ')}}</text></view><wd-button v-if="!selecting" plain @click="openAdd()">添加衣物 · 上传 → 处理 → 核对入柜</wd-button></view>
 <view v-else-if="!error" class="section"><wd-status-tip image="content" :tip="hasFilters?'没有找到这件衣物':'你的衣柜还没有衣物'"/><text class="subtitle">{{hasFilters?(searchResult?.emptyHint||'试试换一个关键词，或清除筛选条件。'):'上传单件衣物照片，处理后核对并确认，它就会出现在这里。'}}</text><view class="actions"><wd-button v-if="hasFilters" plain @click="clearFilters">清除筛选</wd-button><wd-button v-else @click="openAdd()">添加第一件衣物</wd-button></view></view>
 <FloatingPager v-if="items.length&&total>pageSize&&!selecting" :page="query.page" :pages="pageCount" :busy="loading" @change="turn"/>
 <view v-if="!selecting" class="floating-add"><wd-button icon="add" @click="openAdd()">添加</wd-button></view>
 <wd-popup v-model="filtersOpen" position="bottom" closable safe-area-inset-bottom><view class="sheet"><text class="sheet-title">筛选</text><wd-picker v-model="query.category" label="品类" :columns="columns('category','全部品类')"/><wd-picker v-model="query.color" label="颜色" :columns="columns('primaryColor','全部颜色')"/><wd-picker v-model="query.season" label="季节" :columns="columns('seasons','全部季节')"/><wd-picker v-model="imageStyle" label="图片风格" :columns="styles"/><wd-picker v-model="query.sort" label="排序方式" :disabled="searching" :columns="sortOptions" @confirm="chooseSort"/><wd-picker v-if="!searching" v-model="query.size" label="每页件数" :columns="[12,24,48,96].map(value=>({value,label:`${value} 件`}))" @confirm="chooseSize"/><view class="actions"><wd-button plain @click="clearFilters">清除筛选</wd-button><wd-button @click="filtersOpen=false">完成</wd-button></view></view></wd-popup>
 <wd-popup v-model="helpOpen" position="bottom" closable><view class="sheet"><text class="sheet-title">可以这样搜</text><text class="subtitle">颜色和品类会精确筛选（问红色不会给粉色），风格词会按衣柜的风格标签筛选（“可爱”≈甜美，聊天里学会的新词也能用），其余描述按本机语义理解，没有就直说没有。</text><text class="subtitle">默认只看衣柜里最多的图片风格，可在“图片风格”切换。全部在本机计算，不消耗额度。</text><text class="subtitle">用图片搜：从相册选择商品图、截图或别人的穿搭，找衣柜里像的；再加文字可以限定，例如“红色”“上衣”。装了本地图文模型时，文字描述也会直接和衣物图片比对（如“带小熊图案”）。</text><view class="tags"><wd-tag v-for="value in SEARCH_EXAMPLES" :key="value" @click="example(value)">{{value}}</wd-tag></view></view></wd-popup>
 <wd-message-box/><wd-toast/>
</view></template>
<style lang="scss" scoped>@import '../../components/closet/closet.scss';.query-picture{height:120rpx;width:120rpx;margin-bottom:70rpx}.floating-add{position:fixed;right:32rpx;bottom:130rpx;z-index:6}.dim{opacity:.5;pointer-events:none}</style>
