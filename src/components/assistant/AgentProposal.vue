<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useMessage, useToast } from 'wot-design-uni'
import OutfitThumbnail from '../outfit/OutfitThumbnail.vue'
import RecommendationFeedback from '../outfit/RecommendationFeedback.vue'
import RecommendationGroup from '../outfit/RecommendationGroup.vue'
import RecommendIntent from '../outfit/RecommendIntent.vue'
import ExplainButton from '../outfit/ExplainButton.vue'
import GarmentChoiceCard from './GarmentChoiceCard.vue'
import GarmentListCard from './GarmentListCard.vue'
import { useClosetStore } from '../../stores/closet'
import { agentRequest, type Proposal } from '../../agent/api'
import { canvasBridge, candidateScene, editedScene, pageContext } from '../../services/outfit'
import { playSound } from '../../services/sound'
import { recommendApi } from '../../recommend/api'
import type { IntentInput, RecommendationView, RecommendedOutfit } from '../../recommend/types'
import type { OutfitScene } from '../../domain/outfit'
const props = defineProps<{ proposal: Proposal; route: string }>()
const emit = defineEmits<{ (e: 'applied'): void }>()
const selector = `proposal-${Math.random().toString(36).slice(2)}`, toast = useToast(selector), message = useMessage(selector), closet = useClosetStore()
const expanded = ref(false), scenes = ref<OutfitScene[]>([]), error = ref(''), busy = ref(false), used = ref(props.proposal.consumed)
const current = computed(() => Boolean(canvasBridge.value && props.route.startsWith('/outfits/')))
const isOutfits = computed(() => props.proposal.kind === 'OUTFITS' || props.proposal.kind === 'RECOMMENDATION')
const isRecommendation = computed(() => props.proposal.kind === 'RECOMMENDATION')
// Server-written limits (e.g. paused garments) and user-only notes; shown as-is, never rephrased here.
const notices = computed(() => isRecommendation.value ? [...(props.proposal.payload.limits ?? []), ...(props.proposal.payload.notes ?? [])] : [])
const count = computed(() => props.proposal.payload.candidates?.length || 0)
const cardTitle = computed(() => isRecommendation.value ? `为你推荐了 ${count.value} 套搭配` : isOutfits.value ? '为你挑了三套搭配' : '画布修改预览')
const explained = ref<string[]>([])
function viewDetail(key: string | undefined) {
  if (!key || explained.value.includes(key)) return
  explained.value.push(key)
  const logId = props.proposal.payload.candidates?.find(c => c.recommendation?.key === key)?.recommendation?.logId
  if (logId) recommendApi.signal({ kind: 'VIEW_DETAIL', logId })
}
async function preview() {
  error.value = ''
  try { scenes.value = isOutfits.value ? await Promise.all(props.proposal.payload.candidates!.map(c => candidateScene(c))) : props.proposal.kind === 'EDIT' ? [await editedScene(props.proposal)] : [] }
  catch (e) { error.value = e instanceof Error ? e.message : '预览无法加载。' }
}
onMounted(preview)
// Swap / explain reuse the shared recommendation group on a one-outfit view of the same run.
const swapOpen = ref(false), swapView = ref<RecommendationView | null>(null)
function openSwap(outfit: RecommendedOutfit) {
  swapView.value = { runId: props.proposal.payload.runId!, intent: { description: props.proposal.payload.intent || '' }, outfits: [outfit], limits: [], notes: [], emptyReason: '', hasMore: false }
  swapOpen.value = true
}
const editing = ref(false), rerunning = ref(false), rerun = ref<RecommendationView | null>(null)
const editIntent = ref<IntentInput>({ ...(props.proposal.payload.intentInput || {}) })
async function recompute() {
  rerunning.value = true
  try { rerun.value = await recommendApi.recommend({ ...editIntent.value, temperatureC: editIntent.value.temperatureC ?? undefined }) }
  catch (e) { toast.error(e instanceof Error ? e.message : '重新计算失败。') } finally { rerunning.value = false }
}
async function confirmApply(index: number, intoCurrent: boolean) {
  const proposal = props.proposal, save = proposal.kind === 'SAVE'
  try {
    await message.confirm({ title: save ? '确认保存当前搭配？' : intoCurrent ? '确认将预览应用到当前画布？' : '新建一份独立搭配草稿？', msg: save ? '保存到账号后可在其他设备继续编辑，版本冲突时不会覆盖。' : '应用后仍是未保存草稿；保存到账号需要你再次确认。', confirmButtonText: save ? '确认保存' : '确认应用', cancelButtonText: '取消' })
  } catch { return }
  busy.value = true
  try {
    if (save && !canvasBridge.value) throw new Error('请先打开生成建议时的组合台。')
    let scene = scenes.value[index]
    if (isOutfits.value && intoCurrent) scene = await candidateScene(proposal.payload.candidates![index], proposal.context.scene?.elements.filter(e => e.kind === 'PERSON_PART') || [])
    // All preview work succeeds before the one-time confirmation token is consumed.
    await agentRequest(`/proposals/${proposal.id}/accept`, 'POST', { context: pageContext(props.route), current: intoCurrent })
    used.value = true
    if (save) await canvasBridge.value!.save()
    else if (intoCurrent) canvasBridge.value!.apply(scene, isOutfits.value ? proposal.payload.candidates![index].name : undefined)
    else {
      await closet.ensureUser()
      const name = proposal.payload.candidates![index].name
      uni.setStorageSync(`yixu.outfit-draft.v1:${closet.user!.username}:new:${proposal.id}`, JSON.stringify({ name, revision: null, scene, savedAt: Date.now() }))
      await new Promise<void>((resolve, reject) => uni.navigateTo({ url: `/pkg-outfit/workspace/index?id=new&draft=${encodeURIComponent(proposal.id)}`, success: () => resolve(), fail: reject }))
    }
    const logId = proposal.payload.candidates?.[index]?.recommendation?.logId
    if (logId) recommendApi.signal({ kind: 'OPEN_WORKSPACE', logId })
    expanded.value = false; playSound('success'); toast.success(save ? '保存请求已完成。' : '已应用为草稿，请检查后再保存。'); emit('applied')
  } catch (e) { playSound('error'); toast.error(e instanceof Error ? e.message : '应用失败。') } finally { busy.value = false }
}
</script>
<template><view class="proposal">
  <GarmentChoiceCard v-if="proposal.kind === 'GARMENT_CHOICE'" :payload="proposal.payload" />
  <GarmentListCard v-else-if="proposal.kind === 'GARMENT_LIST'" :payload="proposal.payload" />
  <template v-else-if="proposal.kind !== 'SAVE'">
    <view class="card" @tap="expanded = true">
      <view class="minis"><view v-for="(scene, index) in scenes" :key="index" class="mini"><OutfitThumbnail :scene="scene" :title="isOutfits ? proposal.payload.candidates![index].name : '修改后画布'" /></view><wd-icon v-if="!scenes.length" name="fullscreen" size="40rpx" /></view>
      <view class="copy"><text class="strong">{{ cardTitle }}</text><text v-if="isRecommendation && proposal.payload.intent" class="small">{{ proposal.payload.intent }}</text><text class="small">{{ used ? '已处理 · 点击查看' : isRecommendation ? '点开查看搭配和打分依据' : '点开大图，再选择怎么应用' }}</text></view><wd-icon name="arrow-right" size="32rpx" />
    </view>
    <wd-popup v-model="expanded" position="bottom" closable :z-index="40"><view class="sheet">
      <view class="sheet-head">{{ isOutfits ? '从你的衣柜，为你组合' : '确认画布修改' }}</view>
      <view v-if="isRecommendation && proposal.payload.intent" class="notice">按“{{ proposal.payload.intent }}”推荐 · 分数与理由由系统按规则计算，可展开查看<wd-button v-if="proposal.payload.intentInput" type="text" size="small" @click="editing = !editing">{{ editing ? '收起' : '理解错了？修改条件' }}</wd-button></view>
      <view v-if="isRecommendation && editing" class="stack"><RecommendIntent v-model="editIntent" :loading="rerunning" submit-label="按新条件重算" @submit="recompute" /><text class="small">直接重新计算，不调用大模型。</text><RecommendationGroup v-if="rerun" :key="rerun.runId" :view="rerun" /></view>
      <view v-if="notices.length" class="notice"><text class="title">本次推荐的限制与说明</text><text v-for="n in notices" :key="n" class="line">· {{ n }}</text></view>
      <text class="small">{{ used ? '这份建议已经处理，仍可查看预览。' : '先看看整体效果。应用后仍是草稿，保存时会再次请你确认。' }}</text>
      <view v-if="error" class="notice warning">{{ error }}<wd-button type="text" @click="preview">重新加载预览</wd-button></view>
      <view v-if="isOutfits" class="stack">
        <view v-for="(candidate, index) in proposal.payload.candidates" :key="index" class="candidate">
          <text class="small">0{{ index + 1 }}</text>
          <view class="preview"><OutfitThumbnail v-if="scenes[index]" :scene="scenes[index]" :title="candidate.name" /><wd-skeleton v-else :row-col="[{ height: '360rpx' }]" /></view>
          <view class="spread"><text class="title">{{ candidate.name }}</text><text v-if="candidate.recommendation" class="score">{{ Math.round(candidate.recommendation.score) }}<text class="small">分</text></text></view>
          <template v-if="candidate.recommendation">
            <view v-if="candidate.recommendation.tags.length" class="tags"><wd-tag v-for="tag in candidate.recommendation.tags" :key="tag" plain :type="tag === '新尝试' ? 'primary' : 'success'">{{ tag }}</wd-tag></view>
            <text v-for="h in candidate.recommendation.highlights" :key="h" class="line">· {{ h }}</text>
            <text v-if="candidate.reason && !candidate.recommendation.highlights.some(h => candidate.reason.includes(h))" class="line small">{{ candidate.reason }}</text>
            <text v-for="w in candidate.recommendation.warnings" :key="w" class="line warning-text">! {{ w }}</text>
            <view v-if="proposal.payload.runId" @tap="viewDetail(candidate.recommendation.key)"><ExplainButton :run-id="proposal.payload.runId" :outfit-key="candidate.recommendation.key" label="为什么这样搭" /></view>
            <RecommendationFeedback :log-id="candidate.recommendation.logId" :garments="candidate.recommendation.garments" />
            <wd-button v-if="proposal.payload.runId" size="small" type="text" @click="openSwap(candidate.recommendation)">换一件 · 为什么这样排</wd-button>
          </template>
          <text v-else class="line">{{ candidate.reason }}</text>
          <view class="actions"><wd-button size="small" plain :disabled="used || !scenes[index] || busy" @click="confirmApply(index, false)">新建草稿</wd-button><wd-button v-if="current" size="small" :disabled="used || !scenes[index] || busy" @click="confirmApply(index, true)">应用当前</wd-button></view>
        </view>
      </view>
      <view v-else class="stack"><view class="preview"><OutfitThumbnail v-if="scenes[0]" :scene="scenes[0]" title="修改后画布" /></view><text class="title">调整后的效果</text><text class="line">{{ proposal.payload.summary }}</text><wd-button :disabled="used || !current || !scenes[0] || busy" @click="confirmApply(0, true)">确认应用修改</wd-button><text v-if="!current" class="small">请先回到生成建议时的组合台。</text></view>
    </view></wd-popup>
    <wd-popup v-model="swapOpen" position="bottom" closable :z-index="45"><view class="sheet"><view class="sheet-head">换一件 · 为什么这样排</view><RecommendationGroup v-if="swapView && swapOpen" :key="swapView.outfits[0].key" :view="swapView" dense /></view></wd-popup>
  </template>
  <view v-else class="card save"><view class="copy"><text class="strong">准备保存这份搭配？</text><text class="small">{{ used ? '已处理' : '确认后保存到你的账号' }}</text></view><wd-button size="small" :disabled="used || !current || busy" @click="confirmApply(0, true)">确认保存</wd-button></view>
  <wd-toast :selector="selector" /><wd-message-box :selector="selector" />
</view></template>
<style lang="scss" scoped>@import '../outfit/outfit.scss';
.proposal { margin-top: 16rpx; }.card { display: flex; align-items: center; gap: 20rpx; padding: 20rpx; background: $surface; border: 1rpx solid $line; border-radius: $radius-md; }
.minis { display: flex; gap: 8rpx; width: 270rpx; flex-shrink: 0; overflow: hidden; align-items: center; justify-content: center; }.mini { width: 84rpx; flex-shrink: 0; }.copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4rpx; }
.strong { font-weight: 600; font-size: 28rpx; }.candidate { padding: 20rpx; border: 1rpx solid $line; border-radius: $radius-lg; display: flex; flex-direction: column; gap: 10rpx; }
.preview { width: 60%; margin: 0 auto; border: 1rpx solid $line; border-radius: $radius-md; overflow: hidden; }.score { color: $accent; font-size: 36rpx; font-weight: 650; }.warning-text { color: $warning; }.save { justify-content: space-between; }
</style>
