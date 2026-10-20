<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { agentRequest } from '../../agent/api'
import { mergeTrace, type TracePage, type TraceSummary } from '../../agent/trace-data'
import { flushBoardTrace, traceUpload } from '../../agent/trace-client'
const props = defineProps<{ modelValue: boolean; sessionId: string; requestId?: string | null; updates: number }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()
const loading = ref(false), error = ref(''), available = ref(true), runStatus = ref(''), items = ref<TraceSummary[]>([]), tab = ref('validation')
const selected = ref<TraceSummary>(), detail = ref<any>(), detailLoading = ref(false), detailOpen = ref(false), raw = ref(false)
let revision = 0, detailRevision = 0
const phases = [{ key: 'input', label: '输入与上下文' }, { key: 'validation', label: '选衣与校验' }, { key: 'tool', label: '工具调用' }, { key: 'canvas', label: '画布变化' }]
const visible = computed(() => items.value.filter(e => tab.value === 'validation' ? ['validation', 'model_output'].includes(e.phase) : tab.value === 'input' ? ['input', 'end', 'runtime_error'].includes(e.phase) : e.phase === tab.value))
const statuses: Record<string, string> = { RUNNING: '进行中', INTERRUPTED: '服务重启中断', SKIPPED: '未执行', COMPLETE: '完成', FAILED: '失败', PASSED: '通过', REJECTED: '拒绝', CAPTURED: '已记录', STARTED: '开始', REPORTED: '客户端报告', RESTORED: '本机恢复' }
const phaseName = (phase: string) => phases.find(p => p.key === phase)?.label || (phase === 'model_output' ? '模型返回' : '运行结束')
const pretty = (value: unknown) => JSON.stringify(value, null, 2)
const time = (at: number) => { const d = new Date(at), p = (n: number) => String(n).padStart(2, '0'); return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` }
const fieldNames: Record<string, string> = { fit: '版型建议', thickness: '厚薄线索', wearingModes: '穿着用途', category: '品类', primaryColor: '主色', secondaryColors: '辅色', styles: '风格', seasons: '季节', patterns: '图案', neckline: '领型', sleeveLength: '袖长', garmentLength: '衣长', texture: '质感', closure: '门襟' }
const garments = computed<any[]>(() => detail.value?.garments || detail.value?.result?.garments || detail.value?.result?.items || (detail.value?.result?.wearing ? [detail.value.result] : []))
const unknownFields = (g: any) => Object.entries(g.fields || {}).filter(([key, values]) => !(values as any)?.length || ['UNKNOWN', 'CONFLICT'].includes(g.quality?.[key]?.status)).map(([key]) => fieldNames[key] || key).join('、')
const garmentTitle = (g: any) => [...(g.fields?.primaryColor || []), ...(g.fields?.category || [])].join(' ') || '未命名衣物'
const scenes = computed(() => (['before', 'after', 'scene'] as const).filter(key => detail.value?.[key]?.elements).map(key => ({ key, title: key === 'before' ? '执行前' : key === 'after' ? '执行后（客户端报告）' : '服务器接受的画布回执', elements: detail.value[key].elements as any[] })))
const evidence = computed(() => selected.value ? selected.value.phase === 'model_output' ? '模型声明与返回' : detail.value?.evidenceSource === 'CLIENT_REPORTED' ? '客户端报告' : selected.value.phase === 'validation' ? '服务器校验' : '实际执行记录' : '')
async function load(reset = false) {
  if (!props.modelValue) return
  const current = ++revision, request = props.requestId, session = props.sessionId
  if (reset) { items.value = []; selected.value = undefined; detail.value = undefined; detailRevision++ }
  if (!request) { available.value = false; return }
  loading.value = true; error.value = ''
  try {
    let after = reset ? 0 : items.value[items.value.length - 1]?.seq || 0, more = true
    while (more) {
      const page = await agentRequest<TracePage>(`/sessions/${session}/runs/${request}/trace?afterSeq=${after}&limit=100`)
      if (current !== revision) return
      available.value = page.available; runStatus.value = page.status || ''
      items.value = mergeTrace(items.value, page.items); more = page.hasMore
      if (more && !page.items.length) throw new Error('追踪分页未返回下一页。')
      after = items.value[items.value.length - 1]?.seq || 0
    }
  } catch (e) { if (current === revision) error.value = e instanceof Error ? e.message : '记录读取失败' }
  finally { if (current === revision) loading.value = false }
}
async function inspect(item: TraceSummary) {
  const current = ++detailRevision; selected.value = item; detail.value = undefined; detailLoading.value = true; detailOpen.value = true; raw.value = false
  try { const result = await agentRequest(`/sessions/${props.sessionId}/runs/${props.requestId}/trace/${item.seq}`); if (current === detailRevision) detail.value = result }
  catch (e) { if (current === detailRevision) error.value = e instanceof Error ? e.message : '详情读取失败' }
  finally { if (current === detailRevision) detailLoading.value = false }
}
watch(() => [props.modelValue, props.sessionId, props.requestId], () => { if (props.modelValue) { void flushBoardTrace(); void load(true) } else { revision++; detailRevision++; detailOpen.value = false } })
watch(() => props.updates, () => { if (props.modelValue) void load() })
</script>
<template>
  <wd-popup :model-value="modelValue" position="bottom" closable :z-index="60" @update:model-value="emit('update:modelValue', $event)"><view class="sheet">
    <view class="sheet-head">决策与执行记录</view>
    <view class="notice">这里展示实际输入、模型返回与执行证据，不包含隐藏思维链。结构校验通过不代表具体叠穿或审美适配已验证。</view>
    <view class="spread"><wd-tag>{{ statuses[runStatus] || runStatus || '历史记录' }}</wd-tag><text class="small">{{ items.length }} 条记录</text><wd-button size="small" plain :loading="loading" @click="load()">刷新记录</wd-button></view>
    <view v-if="error" class="notice error section">{{ error }}</view>
    <view v-if="traceUpload.pending || traceUpload.error" class="notice warning section">本机还有 {{ traceUpload.pending }} 条记录待上传{{ traceUpload.error ? ' · ' + traceUpload.error : '' }}<wd-button type="text" size="small" @click="flushBoardTrace().then(() => load())">重试上传</wd-button></view>
    <wd-status-tip v-if="!available" image="content" tip="当时未记录详细调试信息，无法还原缺失的输入和指令。" />
    <template v-else>
      <wd-tabs v-model="tab"><wd-tab v-for="phase in phases" :key="phase.key" :name="phase.key" :title="phase.label" /></wd-tabs>
      <wd-status-tip v-if="!visible.length && !loading" image="content" tip="这个阶段尚无记录" />
      <view v-for="item in visible" :key="item.seq" class="event" :class="{ active: selected?.seq === item.seq }" @tap="inspect(item)"><text class="small">#{{ item.seq }} · {{ statuses[item.status] || item.status }}</text><text class="strong">{{ item.label }}</text><text class="small">{{ time(item.createdAt) }} · {{ phaseName(item.phase) }}</text></view>
    </template>
  </view></wd-popup>
  <wd-popup v-model="detailOpen" position="bottom" closable :z-index="65"><view class="sheet">
    <view class="sheet-head">{{ selected?.label || '记录详情' }}</view>
    <wd-loading v-if="detailLoading" />
    <template v-else-if="selected">
      <wd-tag>{{ evidence }}</wd-tag>
      <view v-if="detail?.message" class="notice section" :class="['FAILED', 'REJECTED'].includes(selected.status) ? 'error' : ''">{{ detail.message }}</view>
      <template v-if="detail">
        <view v-if="detail.callId" class="field"><text class="small">工具调用 ID</text><text class="line">{{ detail.callId }}</text></view>
        <view v-if="detail.name" class="field"><text class="small">工具</text><text class="line">{{ detail.name }}</text></view>
        <view v-if="detail.model" class="field"><text class="small">模型</text><text class="line">{{ detail.model }} · {{ detail.reasoningEffort || '' }}</text></view>
        <view v-if="detail.ruleVersion" class="field"><text class="small">规则版本</text><text class="line">{{ detail.ruleVersion }}</text></view>
        <view v-if="detail.roleCounts" class="field"><text class="small">角色数量</text><text class="line">{{ pretty(detail.roleCounts) }}</text></view>
        <view v-if="detail.notValidated" class="field"><text class="small">未验证</text><text class="line">{{ detail.notValidated.join('、') }}</text></view>
        <view v-if="detail.candidate?.reason" class="field"><text class="small">模型给出的搭配理由</text><text class="line">{{ detail.candidate.reason }}</text></view>
        <view v-if="detail.source" class="field"><text class="small">变化来源</text><text class="line">{{ detail.source }}</text></view>
        <view v-if="detail.ackStatus" class="field"><text class="small">回执状态</text><text class="line">{{ detail.ackStatus }}</text></view>
      </template>
      <view v-if="garments.length" class="title section">衣物 / 版本</view>
      <view v-for="g in garments" :key="g.id" class="field"><text class="strong">{{ garmentTitle(g) }}</text><text class="small">{{ g.id }} · 版本 {{ g.revision }}</text><text class="line">{{ g.fields?.category?.join('、') || '未知品类' }} → {{ g.wearing?.role }}</text><text v-if="g.wearing?.basis" class="small">{{ g.wearing.basis }}</text><text class="small">资料缺失：{{ unknownFields(g) || '现有字段均有值；不包含未建模的版型、厚度等' }}</text>
        <text v-for="[key, values] in Object.entries(g.fields || {})" :key="key" class="small">{{ fieldNames[key] || key }}：{{ pretty(values) }} · {{ g.quality?.[key]?.source }} / {{ g.quality?.[key]?.status }}{{ g.quality?.[key]?.evidence ? '（' + g.quality[key].evidence + '）' : '' }}</text></view>
      <template v-for="scene in scenes" :key="scene.key"><view class="title section">{{ scene.title }}</view><text v-for="row in scene.elements" :key="row.elementId || row.garmentId" class="small mono">{{ [row.elementId, row.role, 'x' + row.x, 'y' + row.y, row.width + '×' + row.height, 'z' + row.zIndex].join(' · ') }}</text></template>
      <wd-button v-if="detail" type="text" @click="raw = !raw">{{ raw ? '收起' : '查看完整脱敏数据（输入 / 参数 / 结果）' }}</wd-button><text v-if="raw" class="line small mono">{{ pretty(detail) }}</text>
    </template>
  </view></wd-popup>
</template>
<style lang="scss" scoped>@import '../outfit/outfit.scss';
.event { display: flex; flex-direction: column; gap: 4rpx; padding: 20rpx; margin-top: 14rpx; border: 1rpx solid $line; border-radius: $radius-sm; }.event.active { border-color: $accent; background: $accent-soft; }
.strong { font-weight: 600; font-size: 28rpx; overflow-wrap: anywhere; }.mono { font-family: monospace; overflow-wrap: anywhere; }
</style>
