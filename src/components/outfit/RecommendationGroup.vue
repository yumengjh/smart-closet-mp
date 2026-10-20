<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useToast } from 'wot-design-uni'
import { useClosetStore } from '../../stores/closet'
import { recommendApi } from '../../recommend/api'
import type { RecommendationView, RecommendedOutfit, SwapView } from '../../recommend/types'
import { ROLE_LABELS } from '../../recommend/types'
import type { OutfitScene } from '../../domain/outfit'
import { candidateScene, navigateOutfitLink, openRecommendedOutfit } from '../../services/outfit'
import OutfitThumbnail from './OutfitThumbnail.vue'
import AuthImage from '../AuthImage.vue'
import RecommendationFeedback from './RecommendationFeedback.vue'
import ExplainButton from './ExplainButton.vue'
const props = defineProps<{ view: RecommendationView; dense?: boolean }>()
const emit = defineEmits<{ (e: 'expired'): void }>()
const selector = `recommend-${Math.random().toString(36).slice(2)}`, toast = useToast(selector), closet = useClosetStore()
const outfits = ref<RecommendedOutfit[]>([]), hasMore = ref(false), loadingMore = ref(false), scenes = ref<Record<string, OutfitScene>>({}), sceneErrors = ref<Record<string, string>>({})
const detailOpen = ref(false), detailIndex = ref(0), detail = computed(() => outfits.value[detailIndex.value])
const wearing = ref(false), worn = ref<string[]>([]), opening = ref(false), why = ref(false)
const swapOpen = ref(false), swapLoading = ref(false), swapError = ref(''), swapData = ref<SwapView | null>(null), swapTarget = ref(''), adopting = ref('')
let generation = 0
watch(() => props.view, v => { outfits.value = [...v.outfits]; hasMore.value = v.hasMore; detailOpen.value = false }, { immediate: true })
watch(() => outfits.value.map(o => o.key).join('|'), async () => {
  const ticket = ++generation
  await Promise.all(outfits.value.map(async o => {
    if (scenes.value[o.key]) return
    try { const scene = await candidateScene({ name: o.name, reason: '', garmentIds: o.garments.map(g => g.id) }); if (ticket === generation) scenes.value[o.key] = scene }
    catch (e) { if (ticket === generation) sceneErrors.value[o.key] = e instanceof Error ? e.message : '预览无法加载' }
  }))
}, { immediate: true })
function openDetail(index: number) { detailIndex.value = index; detailOpen.value = true; why.value = false; const o = outfits.value[index]; recommendApi.signal({ kind: 'VIEW_DETAIL', logId: o.logId || undefined }) }
async function more() {
  if (loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  try { const next = await recommendApi.more(props.view.runId, 3); if (!next.outfits.length) { hasMore.value = false; toast.info('没有更多不同的搭配了。'); return } outfits.value = next.outfits; hasMore.value = next.hasMore }
  catch (e) { const text = e instanceof Error ? e.message : '换一批失败。'; toast.warning(text); if (/过期|更新/.test(text)) emit('expired') }
  finally { loadingMore.value = false }
}
async function workspace(o: RecommendedOutfit) {
  if (opening.value) return
  opening.value = true
  try { await closet.ensureUser(); if (!closet.user) throw new Error('登录已失效。'); await openRecommendedOutfit(closet.user.username, o, props.view.runId); detailOpen.value = false }
  catch (e) { toast.error(e instanceof Error ? e.message : '没能打开到搭台。') }
  finally { opening.value = false }
}
async function wear() {
  const o = detail.value; if (!o) return; wearing.value = true
  try { await recommendApi.wear({ garmentIds: o.garments.map(g => g.id) }); worn.value.push(o.key); toast.success('已记下今天穿了这套，之后推荐会参考。') }
  catch (e) { toast.error(e instanceof Error ? e.message : '没有记录成功。') } finally { wearing.value = false }
}
async function swap(id: string) {
  if (!detail.value) return
  const key = detail.value.key
  swapTarget.value = id; swapOpen.value = true; swapData.value = null; swapLoading.value = true; swapError.value = ''
  try { const next = await recommendApi.swap(props.view.runId, key, id); if (swapTarget.value === id && detail.value?.key === key) swapData.value = next }
  catch (e) { swapError.value = e instanceof Error ? e.message : '暂时找不到替代品。' } finally { swapLoading.value = false }
}
async function adopt(o: RecommendedOutfit, id: string) {
  adopting.value = id
  try { const next = await recommendApi.adopt(props.view.runId, o.garments.map(g => g.id)); recommendApi.signal({ kind: 'SWAP_OUT', logId: detail.value.logId || undefined, garmentId: swapTarget.value }); outfits.value.splice(detailIndex.value, 1, next); swapOpen.value = false; toast.success('已换好，整套重新打了分。') }
  catch (e) { toast.error(e instanceof Error ? e.message : '没能换成这件。') } finally { adopting.value = '' }
}
defineExpose({ more })
</script>
<template><view class="stack">
  <view v-if="view.limits.length || view.notes.length" class="notice"><text class="title">本次推荐的限制与说明</text><text v-for="(n, i) in [...view.limits, ...view.notes]" :key="i" class="line">{{ n }}</text></view>
  <view v-if="!outfits.length"><wd-status-tip image="content" :tip="view.emptyReason || '当前条件下没有可靠组合。'" /><wd-button plain block @click="navigateOutfitLink('/add')">去添加衣物</wd-button></view>
  <view v-for="(o, i) in outfits" :key="o.key" class="recommend-card">
    <view class="card-visual" @tap="openDetail(i)"><view class="preview"><OutfitThumbnail v-if="scenes[o.key]" :scene="scenes[o.key]" :title="o.name" /><view v-else class="preview-placeholder"><wd-loading v-if="!sceneErrors[o.key]" /><text v-else class="small">{{ sceneErrors[o.key] }}</text></view></view><view class="card-copy"><view class="spread"><text class="title">{{ o.name }}</text><text class="score">{{ Math.round(o.score) }}<text class="small">分</text></text></view><view class="tags"><wd-tag v-for="tag in o.tags" :key="tag" plain type="primary">{{ tag }}</wd-tag></view><text v-for="h in o.highlights.slice(0, 3)" :key="h" class="line">{{ h }}</text><text v-if="o.warnings.length" class="line warning-text">{{ o.warnings[0] }}{{ o.warnings.length > 1 ? ` 等 ${o.warnings.length} 条` : '' }}</text></view></view>
    <text v-if="o.accessories?.length" class="small">可以搭配：{{ o.accessories.map(a => a.name).join('、') }}</text><text v-else-if="o.tips?.length" class="small">{{ o.tips[0] }}</text>
    <RecommendationFeedback :log-id="o.logId" :garments="o.garments" /><view class="actions"><wd-button size="small" plain @click="openDetail(i)">详情</wd-button><wd-button size="small" :loading="opening" @click="workspace(o)">在搭台打开</wd-button></view>
  </view>
  <view v-if="outfits.length" class="stack"><text class="small">按“{{ view.intent.description }}”计算 · 分数与依据由规则得出</text><wd-button plain :loading="loadingMore" :disabled="!hasMore" @click="more">换一批</wd-button></view>
  <wd-popup v-model="detailOpen" position="bottom" closable :z-index="25"><view v-if="detail" class="sheet"><view class="sheet-head">{{ view.intent.description ? `按“${view.intent.description}”推荐` : '推荐详情' }}</view><view class="detail-preview"><OutfitThumbnail v-if="scenes[detail.key]" :scene="scenes[detail.key]" :title="detail.name" /><view v-else-if="sceneErrors[detail.key]" class="notice warning">{{ sceneErrors[detail.key] }}</view><wd-loading v-else /></view><view v-if="outfits.length > 1" class="spread section"><wd-button size="small" plain :disabled="detailIndex <= 0" @click="openDetail(detailIndex - 1)">上一套</wd-button><text>{{ detailIndex + 1 }} / {{ outfits.length }}</text><wd-button size="small" plain :disabled="detailIndex >= outfits.length - 1" @click="openDetail(detailIndex + 1)">下一套</wd-button></view>
    <view class="spread section"><text class="title">{{ detail.name }}</text><text class="score">{{ Math.round(detail.score) }} 分</text></view><ExplainButton :key="detail.key" :run-id="view.runId" :outfit-key="detail.key" label="为什么排这里" /><view class="tags"><wd-tag v-for="tag in detail.tags" :key="tag" plain>{{ tag }}</wd-tag></view><text v-for="h in detail.highlights" :key="h" class="line">{{ h }}</text><view v-for="w in detail.warnings" :key="w" class="notice warning">{{ w }}</view>
    <view class="title section">单品</view><view v-for="g in detail.garments" :key="g.id" class="row"><view class="thumb" @tap="navigateOutfitLink('/garment/' + g.id)"><AuthImage :src="g.displayUrl" :width="320" /></view><view class="row-body"><text>{{ g.name }}</text><view class="tags"><wd-tag plain>{{ ROLE_LABELS[g.role] || g.role }}</wd-tag><text class="small">{{ g.color }}</text></view><text class="small">{{ g.reasons.join(' · ') }}</text><view class="actions"><wd-button type="text" size="small" @click="swap(g.id)">换一件</wd-button><ExplainButton :key="detail.key + g.id" :run-id="view.runId" :garment-id="g.id" /></view></view></view>
    <wd-button type="text" @click="why = !why">{{ why ? '收起' : '各项得分与依据' }}</wd-button><view v-if="why"><view class="title">各项得分</view><view v-for="d in detail.dimensions" :key="d.key" class="field"><view class="spread"><text>{{ d.label }}</text><text class="small">权重 {{ d.weight }}</text><text>{{ d.score }}</text></view><wd-progress :percentage="d.score" :hide-text="true" /><text v-for="(line, i) in d.evidence" :key="i" class="line" :class="line.positive ? 'positive' : 'warning-text'">{{ line.positive ? '✓' : '!' }} {{ line.text }}</text></view><view class="title section">每件为什么入选</view><text v-for="g in detail.garments" :key="g.id" class="line">{{ g.name }} · {{ ROLE_LABELS[g.role] || g.role }} · {{ g.color }}：{{ g.reasons.join(' · ') }}</text><template v-if="detail.accessories?.length || detail.tips?.length"><view class="title section">可以搭配的配件</view><text v-for="t in detail.tips" :key="t" class="line">{{ t }}</text><text v-for="a in detail.accessories" :key="a.id" class="line">{{ a.name }} · {{ ROLE_LABELS[a.role] || a.role }} · {{ a.reasons.join(' · ') }}</text></template><template v-if="detail.outers.length"><view class="title section">建议外层</view><view class="notice">天气偏凉，可以自行加一件外套。叠穿资料未核对，请自行确认，它不会放进这套搭配。</view><text v-for="o in detail.outers" :key="o.id" class="line">{{ o.name }} · {{ o.reasons.join(' · ') }}</text></template></view>
    <RecommendationFeedback :key="detail.key + 'feedback'" :log-id="detail.logId" :garments="detail.garments" /><view class="stack section"><wd-button plain :loading="wearing" :disabled="worn.includes(detail.key)" @click="wear">{{ worn.includes(detail.key) ? '已记录今天穿了' : '今天穿了这套' }}</wd-button><wd-button :loading="opening" @click="workspace(detail)">在搭台打开</wd-button></view>
  </view></wd-popup>
  <wd-popup v-model="swapOpen" position="bottom" closable :z-index="40"><view class="sheet"><view class="sheet-head">换掉「{{ detail?.garments.find(g => g.id === swapTarget)?.name }}」</view><wd-loading v-if="swapLoading" /><view v-else-if="swapError" class="notice warning">{{ swapError }}<wd-button type="text" @click="swap(swapTarget)">重试</wd-button></view><wd-status-tip v-else-if="swapData && !swapData.alternatives.length" image="content" tip="同一位置没有其他合适的衣物" /><view v-for="alt in swapData?.alternatives || []" :key="alt.garment.id" class="row"><view class="thumb"><AuthImage :src="alt.garment.displayUrl" :width="320" /></view><view class="row-body"><text>{{ alt.garment.name }}</text><text class="line">换后 {{ Math.round(alt.outfit.score) }} 分</text><wd-tag plain :type="alt.delta >= 0 ? 'success' : 'warning'">{{ alt.delta > 0 ? '+' : '' }}{{ alt.delta }}</wd-tag></view><wd-button size="small" :loading="adopting === alt.garment.id" :disabled="!!adopting" @click="adopt(alt.outfit, alt.garment.id)">采用</wd-button></view></view></wd-popup>
  <wd-toast :selector="selector" />
</view></template>
<style lang="scss" scoped>@import './outfit.scss';.recommend-card { padding: 24rpx; background: $surface; border: 1rpx solid $line; border-radius: $radius-lg; }.card-visual { display: flex; gap: 24rpx; margin-bottom: 16rpx; }.preview { width: 210rpx; flex-shrink: 0; overflow: hidden; border-radius: $radius-sm; }.preview-placeholder { height: 262rpx; display: flex; align-items: center; justify-content: center; background: $surface-alt; padding: 12rpx; box-sizing: border-box; }.card-copy{flex:1;min-width:0}.score{color:$accent;font-size:36rpx;font-weight:650;white-space:nowrap}.warning-text{color:$warning}.positive{color:$success}.detail-preview { width: 68%; margin: auto; border: 1rpx solid $line; border-radius: $radius-md; overflow: hidden; }</style>
