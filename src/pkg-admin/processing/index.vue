<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow, onHide, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { useToast } from 'wot-design-uni'
import { processingApi, poolLabels, executionLabels, type AdminProcessing, type Limits, type ExecutionTask } from '../../services/processing'
import { requireAdmin, errorText } from '../../components/ops/utils'
import { useOpsPolling } from '../../components/ops/polling'
import { useAppearance } from '../../composables/useAppearance'
const { pageStyle } = useAppearance()
const toast = useToast(), allowed = ref(false), active = ref(false), state = ref<AdminProcessing>(), draft = ref<Limits>(), error = ref(''), saving = ref(false), page = ref(1), loading = ref(false), tasks = ref<ExecutionTask[]>([]), rpm = ref('')
let draftRevision = 0
async function load(reset = false, append = false) {
  if (!allowed.value || loading.value) return
  loading.value = true
  try { const result = await processingApi.admin(page.value); state.value = result; tasks.value = append ? [...tasks.value, ...result.items] : result.items; if (!draft.value || reset) { draft.value = { ...result.resources.config.limits, paused:[...result.resources.config.limits.paused] }; rpm.value = draft.value.rpm == null ? '' : String(draft.value.rpm); draftRevision = result.resources.config.revision }; error.value = '' } catch(e) { error.value = errorText(e, '处理状态暂时无法加载。') } finally { loading.value = false }
}
async function save() {
  if (!draft.value || !state.value || saving.value) return
  if (rpm.value !== '' && (!/^\d+$/.test(rpm.value) || Number(rpm.value) < 1)) { error.value = '每分钟请求数需为正整数，未知时留空。'; return }
  if (draft.value.assistantReserved > draft.value.accountConcurrency) { error.value = '助手预留并发不能超过上游凭据账户总并发。'; return }
  saving.value = true
  try { await processingApi.config({ ...draft.value, rpm:rpm.value === '' ? null : Number(rpm.value) }, draftRevision); await load(true); toast.success('调度配置已保存，新任务按新容量排队；正在运行的任务不受影响。') }
  catch(e) { const text = errorText(e, '保存失败。'); if (/CONFIG_CONFLICT|配置已变化|conflict/i.test(text)) { await load(true); toast.warning('配置刚被其他人或其他页面修改过，已重新读取最新配置，请确认后再保存。') } else error.value = text } finally { saving.value = false }
}
async function reload() { await load(true); if (!error.value) toast.show('已重新读取配置，未保存的修改已放弃。') }
async function changePage(delta: number) { if (loading.value) return; page.value += delta; await load() }
onLoad(async () => { allowed.value = await requireAdmin(); active.value = allowed.value })
onShow(() => { if (allowed.value) active.value = true }); onHide(() => { active.value = false })
onPullDownRefresh(async () => { try { await load() } finally { uni.stopPullDownRefresh() } })
onReachBottom(async () => { if (state.value?.items.length === 100 && !loading.value) { page.value++; await load(false, true) } })
useOpsPolling(active, () => load(), () => 3000)
</script>
<template><page-meta :page-style="pageStyle" />
  <view v-if="allowed" class="page ops-page"><view class="ops-heading"><text class="ops-title">任务与资源管理</text><view class="ops-subtitle">查看全局积压与账户瓶颈。降低容量不会中止正在运行的任务。</view></view><view v-if="error" class="ops-alert ops-error">{{ error }}<wd-button type="text" size="small" @click="load()">重试</wd-button></view><wd-skeleton v-if="!state || !draft" :row-col="[1,1,1,1,1]" animation="gradient" />
    <template v-else><view class="ops-section"><text class="ops-h2">正在运行</text><view class="ops-copy">降低容量不会中止正在运行的任务。</view><view class="ops-actions"><view v-for="pool in ['CPU','RECOGNITION','GENERATION']" :key="pool" class="ops-stat">{{ poolLabels[pool] }}<text class="ops-stat-number">{{ state.resources.running[pool] || 0 }}</text></view></view></view>
      <view class="ops-section"><text class="ops-h2">调度配置</text><view class="ops-copy">各资源池容量与上游账户并发。</view><view class="ops-field"><text class="ops-label">本地处理容量</text><wd-input-number v-model="draft.cpu" :min="1" :max="16" /></view><view class="ops-field"><text class="ops-label">识别容量</text><wd-input-number v-model="draft.recognition" :min="1" :max="32" /></view><view class="ops-field"><text class="ops-label">增强容量</text><wd-input-number v-model="draft.generation" :min="1" :max="16" /></view><view class="ops-field"><text class="ops-label">每个上游凭据账户总并发</text><wd-input-number v-model="draft.accountConcurrency" :min="1" :max="64" /></view><view class="ops-field"><text class="ops-label">助手预留并发</text><wd-input-number v-model="draft.assistantReserved" :min="0" :max="draft.accountConcurrency" /></view><wd-input v-model="rpm" label="每分钟请求数 RPM" type="number" placeholder="未知时留空" /><view class="ops-field"><text class="ops-label">暂停资源池</text><wd-checkbox-group v-model="draft.paused"><view v-for="(label,key) in poolLabels" :key="key" class="ops-field"><wd-checkbox :model-value="key">{{ label }}</wd-checkbox></view></wd-checkbox-group></view><view class="ops-actions"><wd-button :loading="saving" @click="save">保存调度配置</wd-button><wd-button plain :disabled="saving" @click="reload">放弃修改并重新读取</wd-button></view></view>
      <view class="ops-section"><text class="ops-h2">全局积压</text><view v-if="!state.resources.counts.length" class="ops-copy">当前没有积压。</view><view v-for="(count,i) in state.resources.counts" :key="i" class="ops-row ops-between"><text>{{ poolLabels[String(count.POOL || count.pool)] }} · {{ executionLabels[String(count.STATUS || count.status)] }}</text><text>{{ count.TOTAL ?? count.total }}</text></view></view>
      <view class="ops-section"><text class="ops-h2">账户占用</text><view v-if="!state.resources.accounts.length" class="ops-copy">当前没有上游请求占用。</view><view v-for="(account,i) in state.resources.accounts" :key="i" class="ops-row ops-between"><text class="ops-copy">{{ account.ACCOUNT_ID || account.account_id }} · {{ account.PURPOSE || account.purpose }} · {{ account.STATUS || account.status }}</text><text>{{ account.TOTAL ?? account.total }}</text></view></view>
      <view class="ops-section"><text class="ops-h2">最近任务</text><view class="ops-copy">每页最多 100 条，每 3 秒自动刷新。</view><view class="ops-actions"><wd-button size="small" plain :disabled="page === 1 || loading" @click="changePage(-1)">上一页</wd-button><text class="ops-meta">第 {{ page }} 页</text><wd-button size="small" plain :disabled="state.items.length < 100 || loading" @click="changePage(1)">下一页</wd-button></view><view v-for="task in tasks" :key="task.id" class="ops-row"><text>{{ task.owner || '旧任务' }} · {{ poolLabels[task.pool] }} · {{ executionLabels[task.status] }}</text><view class="ops-copy">{{ task.waitReason || task.error || task.businessId }}</view></view><wd-status-tip v-if="!tasks.length" image="content" tip="暂无任务" /></view>
    </template>
  </view><wd-toast />
</template>
<style scoped lang="scss">@import '../../components/ops/shared.scss';</style>
