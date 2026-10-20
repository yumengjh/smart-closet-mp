<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import { useToast, useMessage } from 'wot-design-uni'
import { processingApi, poolLabels, type ExecutionTask } from '../../services/processing'
import type { ClosetTask } from '../../services/api'
import { quickApi } from '../../services/quickIntake'
import { createUuid } from '../../domain/id'
import { useClosetStore } from '../../stores/closet'
import AuthImage from '../AuthImage.vue'
import { go, when, errorText } from './utils'
import { useOpsPolling } from './polling'
const props = defineProps<{ tasks: ClosetTask[]; active: boolean }>()
const toast = useToast('execution'), message = useMessage('execution'), closet = useClosetStore()
const items = ref<ExecutionTask[]>([]), error = ref(''), busy = ref(''), expanded = ref(false)
const ignoredKey = () => `yuda.queue.ignored.v1:${closet.user?.username || ''}`
const ignored = ref<string[]>(readIgnored())
function readIgnored(): string[] { try { const list = JSON.parse(uni.getStorageSync(ignoredKey()) || '[]'); return Array.isArray(list) ? list.filter((id: unknown) => typeof id === 'string') : [] } catch { return [] } }
function ignore(task: ExecutionTask) { ignored.value = [...ignored.value, task.id].slice(-200); try { uni.setStorageSync(ignoredKey(), JSON.stringify(ignored.value)) } catch { /* Optional convenience. */ } }
const failed = (task: ExecutionTask) => ['FAILED', 'UNKNOWN'].includes(task.status)
const userKinds = new Set(['WORKFLOW', 'QUICK', 'BATCH'])
const visible = computed(() => items.value.filter(task => userKinds.has(task.kind) && ['QUEUED', 'WAITING_QUOTA', 'RUNNING', 'CANCEL_REQUESTED', 'FAILED', 'UNKNOWN'].includes(task.status) && !(failed(task) && (task.superseded || ignored.value.includes(task.id)))))
const shown = computed(() => expanded.value ? visible.value : visible.value.slice(0, 5))
const upkeep = computed(() => items.value.filter(task => !userKinds.has(task.kind) && task.kind !== 'RENDER' && ['QUEUED', 'RUNNING'].includes(task.status)).length)
const summary = computed(() => {
  const running = visible.value.filter(t => ['RUNNING', 'CANCEL_REQUESTED'].includes(t.status)).length, waiting = visible.value.filter(t => ['QUEUED', 'WAITING_QUOTA'].includes(t.status)).length, attention = visible.value.filter(failed).length
  return [running && `${running} 步处理中`, waiting && `${waiting} 步在排队`, attention && `${attention} 步需要你看看`].filter(Boolean).join(' · ')
})
const owner = (task: ExecutionTask) => props.tasks.find(t => t.id === task.businessId)
const thumb = (task: ExecutionTask) => owner(task)?.outputUrl || owner(task)?.inputUrl || ''
const kindLabel = (task: ExecutionTask) => task.kind === 'BATCH' ? '多件整理' : task.kind === 'QUICK' ? '快速入柜' : '单件处理'
const states: Record<string, string> = { QUEUED: '排队中', WAITING_QUOTA: '等额度', RUNNING: '处理中', CANCEL_REQUESTED: '正在取消', FAILED: '未完成', UNKNOWN: '结果待核实' }
function explain(task: ExecutionTask) {
  if (task.status === 'WAITING_QUOTA') return '今天的 AI 额度用完了，明天会自动继续；额度调整后也可以立即重试。'
  if (task.status === 'QUEUED') return task.waitReason?.includes('暂停') ? '管理员暂停了这类处理，恢复后自动继续。' : task.waitReason?.includes('容量') ? '前面还有别的衣物在处理，轮到后自动开始。' : '轮到后自动开始，不用一直开着页面。'
  if (task.status === 'RUNNING') return '正在处理，完成后右上角会提醒你。'
  if (task.status === 'CANCEL_REQUESTED') return '正在停止，已完成的步骤会保留。'
  if (task.status === 'UNKNOWN') return '已经发给模型，但没收到明确结果；为免重复扣额度，不会自动重发。'
  return `${task.error || task.waitReason || '这一步没有完成。'}${task.reconcilable ? '' : task.garmentId ? ' 已保存的照片不受影响，可以重新发起或进衣物详情处理。' : ''}`
}
const canRetry = (task: ExecutionTask) => failed(task) && Boolean(task.reconcilable)
const canEnhance = (task: ExecutionTask) => failed(task) && !task.reconcilable && task.kind === 'QUICK' && task.pool === 'GENERATION'
function visit(task: ExecutionTask) { if (task.garmentId) go(`/garment/${task.garmentId}?task=${task.businessId}`) }
async function load() { try { items.value = (await processingApi.list()).items; error.value = '' } catch (e) { error.value = errorText(e, '排队状态暂时无法更新') } }
async function act(task: ExecutionTask, action: 'resume' | 'retry' | 'cancel' | 'enhance') {
  if (busy.value) return
  if (action === 'cancel' || action === 'enhance') {
    const hint = action === 'cancel' ? '取消这件衣物后面的处理？已完成的步骤会保留。' : `使用 1 次 AI 额度重新增强这件衣物；原图和基础图保留。${/HTTP 4\d\d/.test(task.error || '') ? '上次被服务商拒绝，原样重试可能仍失败，也可以进详情描述问题后再增强。' : ''}`
    try { await message.confirm({ title: action === 'cancel' ? '取消处理' : '重新增强', msg: hint, confirmButtonText: action === 'cancel' ? '取消处理' : '重新增强', cancelButtonText: action === 'cancel' ? '继续等待' : '先不' }) } catch { return }
  }
  busy.value = task.id
  try { if (action === 'enhance') { await quickApi.enhance(task.businessId, createUuid(), ''); toast.success('已重新发起增强，完成后右上角会提醒你') } else await processingApi[action](task.id); await load() }
  catch (e) { toast.error(errorText(e, '操作失败。')) } finally { busy.value = '' }
}
async function help() { await message.alert({ title: '这里显示什么', msg: '每件衣物按步骤依次处理：本地去背景、识别资料、整理图片。这里只列出还在排队、在等额度或需要你决定的步骤；完成的步骤直接看下方任务记录。' }) }
useOpsPolling(toRef(props, 'active'), load, () => visible.value.length ? 3000 : 15000)
</script>
<template>
  <view v-if="visible.length || error" class="ops-section">
    <view class="ops-between"><text class="ops-h2">排队与等待</text><wd-button type="text" size="small" @click="help">说明</wd-button></view>
    <view class="ops-copy">{{ summary || '暂时无法读取后台排队' }}<text v-if="upkeep"> · 另有 {{ upkeep }} 项衣柜索引在后台更新，无需操作</text></view>
    <view v-if="error" class="ops-alert ops-warning">排队状态暂时无法更新：{{ error }}</view>
    <view v-for="task in shown" :key="task.id" class="ops-row">
      <view class="ops-media-row" @tap="visit(task)"><view class="ops-thumb"><AuthImage v-if="thumb(task)" :src="thumb(task)" :width="320" /><wd-icon v-else name="picture" size="48rpx" /></view><view class="ops-grow"><view class="ops-tags"><text>{{ owner(task)?.title || (task.garmentId ? '这件衣物' : kindLabel(task)) }}</text><wd-tag plain>{{ states[task.status] || task.status }}</wd-tag></view><view class="ops-meta">{{ poolLabels[task.pool] || '处理' }}</view><view class="ops-copy">{{ explain(task) }}</view><view class="ops-meta">{{ kindLabel(task) }} · 加入于 {{ when(task.createdAt) }}</view></view></view>
      <view class="ops-actions">
        <wd-button v-if="task.status === 'WAITING_QUOTA'" size="small" :disabled="!!busy" @click="act(task, 'resume')">立即重试</wd-button>
        <wd-button v-if="canRetry(task)" size="small" :loading="busy === task.id" :disabled="!!busy" @click="act(task, 'retry')">{{ task.pool === 'CPU' ? '恢复本地处理' : '采用已返回结果' }}</wd-button>
        <wd-button v-if="canEnhance(task)" size="small" :loading="busy === task.id" :disabled="!!busy" @click="act(task, 'enhance')">重新增强</wd-button>
        <wd-button v-if="failed(task) && task.garmentId" size="small" plain @click="visit(task)">{{ canRetry(task) || canEnhance(task) ? '查看衣物' : '去详情重做' }}</wd-button>
        <wd-button v-if="failed(task)" type="text" size="small" @click="ignore(task)">忽略</wd-button>
        <wd-button v-if="['RUNNING','QUEUED','WAITING_QUOTA'].includes(task.status)" size="small" plain :disabled="!!busy" @click="act(task, 'cancel')">取消处理</wd-button>
      </view>
    </view>
    <wd-button v-if="visible.length > 5" type="text" @click="expanded = !expanded">{{ expanded ? '收起' : `展开其余 ${visible.length - 5} 步` }}</wd-button>
  </view>
  <wd-toast selector="execution" /><wd-message-box selector="execution" />
</template>
<style scoped lang="scss">@import './shared.scss';</style>
