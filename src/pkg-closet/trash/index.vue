<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { closetApi, type Garment } from '../../services/api'
import { useClosetStore } from '../../stores/closet'
import AuthImage from '../../components/AuthImage.vue'
import { go, errorText } from '../../components/ops/utils'
import { useAppearance } from '../../composables/useAppearance'
const { pageStyle } = useAppearance()
const closet = useClosetStore(), items = ref<Garment[]>([]), busy = ref(''), error = ref(''), loading = ref(false), total = ref(0), page = ref(1)
async function load(append = false) {
  if (loading.value) return
  loading.value = true; error.value = ''
  const next = append ? page.value + 1 : 1
  try { const result = await closetApi.list({ status:'TRASHED', q:'', category:'', color:'', season:'', page:next, size:50 }); items.value = append ? [...items.value, ...result.items] : result.items; total.value = result.total; page.value = next }
  catch (e) { error.value = errorText(e, '回收站暂时无法加载。') } finally { loading.value = false }
}
async function restore(item: Garment) {
  if (busy.value) return
  busy.value = item.id; error.value = ''
  try { await closetApi.restore(item.id, 'ACTIVE', item.revision); items.value = items.value.filter(i => i.id !== item.id); total.value = Math.max(0, total.value - 1); await closet.refreshCounts() }
  catch (e) { error.value = errorText(e, '恢复失败。') } finally { busy.value = '' }
}
onLoad(() => { void load() }); onPullDownRefresh(async () => { try { await load() } finally { uni.stopPullDownRefresh() } }); onReachBottom(() => { if (items.value.length < total.value) void load(true) })
</script>
<template><page-meta :page-style="pageStyle" />
  <view class="page ops-page"><wd-button type="text" @click="go('/settings')">返回“我的”</wd-button><view class="ops-heading"><text class="ops-title">回收站</text><view class="ops-subtitle">删除的衣物保留图片与历史，恢复后回到删除前的状态。</view><view class="ops-meta">{{ total }} 件 · 衣物暂存</view></view>
    <view v-if="error" class="ops-alert ops-error">{{ error }}<wd-button type="text" size="small" @click="load()">重新加载</wd-button></view><wd-skeleton v-if="loading && !items.length" :row-col="[1,1,1,1]" animation="gradient" />
    <view v-for="item in items" :key="item.id" class="ops-section"><view class="ops-photo"><AuthImage v-if="item.displayUrl" :src="item.displayUrl" :width="480" previewable /><wd-status-tip v-else image="content" tip="暂无展示图片" /></view><wd-tag plain>回收站</wd-tag><view class="ops-between"><view><text class="ops-h3">{{ item.category[0] === '未分类' ? '未分类衣物' : `${item.primaryColor[0] || ''}${item.category[0] || '未分类衣物'}` }}</text><view class="ops-copy">{{ item.patterns[0] || '暂无补充信息' }}</view></view><wd-button plain :disabled="!!busy" :loading="busy === item.id" @click="restore(item)">恢复</wd-button></view></view>
    <view v-if="!loading && !error && !items.length" class="ops-section"><wd-status-tip image="content" tip="回收站是空的。" /><view class="ops-copy">暂时没有被移出的衣物。</view></view><view v-if="loading && items.length" class="ops-copy">正在加载…</view>
  </view>
</template>
<style scoped lang="scss">@import '../../components/ops/shared.scss';</style>
