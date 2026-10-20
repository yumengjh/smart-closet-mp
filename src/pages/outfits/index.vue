<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onLoad, onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { useMessage, useToast } from 'wot-design-uni'
import { closetApi } from '../../services/api'
import { useClosetStore } from '../../stores/closet'
import type { Outfit, OutfitScene } from '../../domain/outfit'
import { listWorkspaces, pruneAgentWorkspaces, setActiveWorkspace, workspaceSummary, type WorkspaceInfo } from '../../domain/workspace-registry'
import { recommendApi } from '../../recommend/api'
import type { RecommendedOutfit } from '../../recommend/types'
import { useTabQuery } from '../../services/tab-route'
import { candidateScene, navigateOutfitLink, openOutfitDraft } from '../../services/outfit'
import OutfitThumbnail from '../../components/outfit/OutfitThumbnail.vue'
import RecommendationStrip from '../../components/outfit/RecommendationStrip.vue'
import { useAppearance } from '../../composables/useAppearance'
const { pageStyle, minimal } = useAppearance()
const closet = useClosetStore(), toast = useToast(), message = useMessage()
const tab = ref(uni.getStorageSync('yixu.outfits.tab.v1') === 'today' ? '今天穿什么' : '我的搭配'), visited = ref(tab.value === '今天穿什么')
const saved = ref<Outfit[]>([]), loading = ref(false), error = ref(''), search = ref(''), wornDates = ref<Record<string, string>>({}), wearing = ref(false), required = ref('')
const displayed = computed(() => saved.value.filter(o => o.name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())))
const workspaces = ref<{ info: WorkspaceInfo; boards: number; unsaved: number }[]>([])
const stripVisible = computed(() => workspaces.value.length > 1 || workspaces.value.some(w => w.boards > 0))
const teaser = ref<RecommendedOutfit | null>(null), teaserScene = ref<OutfitScene | null>(null)
const actionOutfit = ref<Outfit | null>(null), actionsOpen = ref(false)
const strip = ref<InstanceType<typeof RecommendationStrip> | null>(null)
watch(tab, value => { if (value === '今天穿什么') visited.value = true; uni.setStorageSync('yixu.outfits.tab.v1', value === '今天穿什么' ? 'today' : 'mine') })
function openEditor(id = 'new') { uni.navigateTo({ url: `/pkg-outfit/workspace/index?id=${encodeURIComponent(id)}` }) }
function openWorkspace(info?: WorkspaceInfo) { if (info && closet.user) setActiveWorkspace(closet.user.username, info.id); uni.navigateTo({ url: '/pkg-outfit/workspace/index' + (info?.kind === 'agent' ? `?session=${encodeURIComponent(info.id.slice(6))}` : '') }) }
function assistant() { uni.navigateTo({ url: '/pkg-outfit/assistant/index?from=outfits' }) }
function wornLabel(id: string) { const day = wornDates.value[id]; if (!day) return ''; const today = new Date(); today.setHours(0, 0, 0, 0); const days = Math.round((today.getTime() - new Date(day + 'T00:00:00').getTime()) / 86400000); return days <= 0 ? '今天穿过' : `上次穿着：${days} 天前` }
let generation = 0
async function load() {
  const ticket = ++generation; loading.value = true; error.value = ''
  await closet.ensureUser()
  if (!closet.user) { loading.value = false; return }
  const owner = closet.user.username
  pruneAgentWorkspaces(owner); workspaces.value = listWorkspaces(owner).map(info => ({ info, ...workspaceSummary(owner, info.id) }))
  recommendApi.outfitWear().then(v => { if (ticket === generation) wornDates.value = v }).catch(() => {})
  try { const result = await closetApi.outfits(); if (ticket !== generation) return; saved.value = result; if (result.length && !teaser.value) void loadTeaser(ticket) }
  catch (e) { if (ticket === generation) error.value = e instanceof Error ? e.message : '搭配列表暂时无法加载。' } finally { if (ticket === generation) loading.value = false }
}
async function loadTeaser(ticket: number) { try { const view = await recommendApi.recommend({ occasion: 'DAILY', requiredGarmentIds: [], count: 1 }); if (ticket !== generation || !view.outfits[0]) return; const o = view.outfits[0]; const scene = await candidateScene({ name: o.name, reason: '', garmentIds: o.garments.map(g => g.id) }); if (ticket === generation) { teaser.value = o; teaserScene.value = scene } } catch { /* Web teaser is silent if unavailable. */ } }
function more(outfit: Outfit) { actionOutfit.value = outfit; actionsOpen.value = true }
async function action(event: { index: number }) {
  const o = actionOutfit.value; actionsOpen.value = false; if (!o) return
  if (event.index === 0) openEditor(o.id)
  else if (event.index === 1) { try { await openOutfitDraft(closet.user!.username, o.scene, `${o.name} 副本`.slice(0, 100)) } catch (e) { toast.error(e instanceof Error ? e.message : '复制搭配失败。') } }
  else if (event.index === 2) {
    if (wearing.value) return; wearing.value = true
    try { const r = await recommendApi.wear({ outfitId: o.id }); wornDates.value[o.id] = r.wornOn; toast.success('已记下今天穿了这套。') } catch (e) { toast.error(e instanceof Error ? e.message : '没有记录成功。') } finally { wearing.value = false }
  } else if (event.index === 3) {
    try { await message.confirm({ title: '删除这套搭配？', msg: '只删除搭配，不会删除衣柜里的衣物。', confirmButtonText: '删除搭配', cancelButtonText: '取消' }) } catch { return }
    try { await closetApi.deleteOutfit(o.id, o.revision); saved.value = saved.value.filter(item => item.id !== o.id); toast.success('搭配已删除。') } catch (e) { toast.error(e instanceof Error ? e.message : '删除失败，请重新加载后再试。') }
  }
}
function readRequired(query: Record<string, string | undefined>) { if (query.with) { required.value = query.with; tab.value = '今天穿什么' } }
onLoad(query => readRequired(query || {}))
useTabQuery('outfits', query => readRequired(query))
onShow(() => { void load() })
onPullDownRefresh(async () => { try { if (tab.value === '今天穿什么') await strip.value?.refresh(); else await load() } finally { uni.stopPullDownRefresh() } })
</script>
<template><page-meta :page-style="pageStyle" /><view class="page">
  <view class="heading">穿搭组合台</view><text v-if="!minimal" class="subtitle">从自己的衣柜选单品，保存一套随时可以穿的搭配。</text><view class="actions"><wd-button size="small" plain @click="navigateOutfitLink('/ootd')">OOTD 试穿</wd-button><wd-button size="small" plain @click="openWorkspace()">穿搭工作区</wd-button><wd-button size="small" @click="openEditor()">新建搭配</wd-button><wd-button size="small" type="text" @click="assistant">鱼搭助手</wd-button></view>
  <view v-if="stripVisible" class="section"><text class="field-label">画板</text><view class="stack"><wd-button v-for="w in workspaces" :key="w.info.id" plain size="small" @click="openWorkspace(w.info)">{{ w.info.name }}{{ w.info.kind === 'agent' ? '（临时）' : '' }} · {{ w.boards ? `${w.boards} 个组合台${w.unsaved ? `，${w.unsaved} 个未保存` : ''}` : '空' }}</wd-button></view></view>
  <view class="section"><wd-segmented v-model:value="tab" :options="['我的搭配', '今天穿什么']" /><text v-if="tab === '我的搭配' && saved.length" class="small">我的搭配 · {{ saved.length }}</text></view>
  <RecommendationStrip v-if="visited" v-show="tab === '今天穿什么'" ref="strip" :required="required" @clear-required="required = ''" />
  <view v-show="tab === '我的搭配'" class="section stack">
    <view v-if="teaser && saved.length" class="teaser" @tap="tab = '今天穿什么'"><view class="teaser-thumb"><OutfitThumbnail v-if="teaserScene" :scene="teaserScene" /></view><view class="row-body"><text class="small">今天穿什么 · 为你挑的一套</text><view class="title">{{ teaser.name }}</view><text class="small">{{ teaser.highlights[0] || '按今天的场景和天气算出' }}</text></view><text class="small">看更多 ›</text></view>
    <view v-if="error" class="notice error">{{ error }}<wd-button type="text" @click="load">重新加载</wd-button></view><wd-skeleton v-if="loading" :row-col="[{ height: '320rpx' }, { width: '80%' }, { height: '320rpx' }]" />
    <template v-else-if="saved.length"><wd-search v-model="search" placeholder="搜索搭配名称" hide-cancel /><text class="small">{{ displayed.length }} 套搭配 · 最近更新</text><view v-for="o in displayed" :key="o.id" class="outfit-card"><view class="outfit-preview" @tap="openEditor(o.id)"><OutfitThumbnail :scene="o.scene" :title="o.name" /><view class="count"><wd-tag>{{ o.scene.elements.length }} 张贴纸</wd-tag><wd-tag v-if="o.scene.elements.some(item => item.garmentChanged || item.garmentStatus === 'TRASHED')" type="warning">衣物有更新</wd-tag></view></view><view class="outfit-details"><view class="row-body" @tap="openEditor(o.id)"><view class="title">{{ o.name }}</view><text class="small">{{ new Date(o.updatedAtMs).toLocaleDateString() }} 更新{{ wornLabel(o.id) ? ' · ' + wornLabel(o.id) : '' }}</text></view><wd-button type="text" icon="more" @click="more(o)" /></view></view><template v-if="!displayed.length"><wd-status-tip image="search" tip="没有找到这套搭配" /><wd-button plain @click="search = ''">清除搜索</wd-button></template></template>
    <view v-else-if="!error" class="empty"><wd-status-tip image="content" tip="把第一套穿搭放上画板" /><text class="subtitle">选一件上衣、一条裤子，再加上喜欢的配饰。</text><wd-button @click="openEditor()">开始搭配</wd-button></view>
  </view><wd-action-sheet v-model="actionsOpen" :actions="[{ name: '编辑搭配' }, { name: '复制搭配' }, { name: '今天穿了这套', disabled: wearing }, { name: '删除搭配', color: '#bd4b4b' }]" cancel-text="取消" @select="action" /><wd-toast /><wd-message-box />
</view></template>
<style lang="scss" scoped>@import '../../components/outfit/outfit.scss';.outfit-card{background:$surface;border:1rpx solid $line;border-radius:$radius-lg;overflow:hidden}.outfit-preview{position:relative;width:100%}.count{position:absolute;left:20rpx;bottom:20rpx;z-index:70;display:flex;gap:12rpx;pointer-events:none}.outfit-details{display:flex;align-items:center;gap:16rpx;padding:24rpx}.empty{text-align:center;padding:40rpx 0}.teaser{display:flex;gap:20rpx;align-items:center;background:$surface;border:1rpx solid $line;border-radius:$radius-md;padding:20rpx}.teaser-thumb{width:100rpx;flex-shrink:0}</style>
