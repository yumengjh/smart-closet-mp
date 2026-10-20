<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { recommendApi } from '../../recommend/api'
import type { IntentInput, RecommendationView, InspirationView } from '../../recommend/types'
import RecommendIntent from './RecommendIntent.vue'
import RecommendationGroup from './RecommendationGroup.vue'
const props = defineProps<{ required?: string }>()
const emit = defineEmits<{ (e: 'clearRequired'): void }>()
const intent = ref<IntentInput>({ occasion: 'DAILY', temperatureC: null, avoidColors: [] }), view = ref<RecommendationView | null>(null), data = ref<InspirationView | null>(null), loading = ref(false), error = ref('')
const mode = ref(uni.getStorageSync('yixu.recommend.strip-mode.v1') === 'inspiration' ? '今日灵感' : '为我搭配')
let ticket = 0
async function run() {
  const current = ++ticket; loading.value = true; error.value = ''
  try { if (mode.value === '今日灵感') { const result = await recommendApi.inspiration(); if (current === ticket) data.value = result } else { const result = await recommendApi.recommend({ ...intent.value, temperatureC: intent.value.temperatureC ?? undefined, requiredGarmentIds: props.required ? [props.required] : [], count: 3 }); if (current === ticket) view.value = result } }
  catch (e) { if (current === ticket) error.value = e instanceof Error ? e.message : mode.value === '今日灵感' ? '今日灵感暂时不可用。' : '推荐暂时不可用。' } finally { if (current === ticket) loading.value = false }
}
watch(mode, m => { uni.setStorageSync('yixu.recommend.strip-mode.v1', m === '今日灵感' ? 'inspiration' : 'recommend'); void run() })
watch(() => props.required, () => { if (props.required && mode.value !== '为我搭配') mode.value = '为我搭配'; else void run() })
onMounted(() => { if (props.required) mode.value = '为我搭配'; recommendApi.profile().catch(() => {}); void run() })
defineExpose({ refresh: run })
</script>
<template><view class="stack section"><wd-segmented v-model:value="mode" :options="['为我搭配', '今日灵感']" /><text class="small">从你的衣柜按规则计算，不调用大模型；温度不填时按常住城市的天气</text><RecommendIntent v-if="mode === '为我搭配'" v-model="intent" :loading="loading" submit-label="重新推荐" @submit="run" /><view v-if="required && mode === '为我搭配'" class="notice">围绕你选的那件衣物搭配<wd-button type="text" size="small" @click="emit('clearRequired')">不指定</wd-button></view><view v-if="error" class="notice warning">{{ error }}<wd-button type="text" @click="run">重试</wd-button></view><wd-skeleton v-if="loading" :row-col="[{ height: '180rpx' }, { width: '80%' }, { height: '180rpx' }]" />
  <template v-if="mode === '今日灵感' && data"><text class="small">从 {{ data.approvedTemplates }} 个已审核搭法里挑出今天适用的 {{ data.applicableTemplates }} 个，用你衣柜里的衣服套进去{{ data.view.intent.description ? '；' + data.view.intent.description : '' }}</text><RecommendationGroup :key="data.view.runId" :view="data.view" @expired="run" /><view v-if="data.gaps.length" class="card"><view class="title">差一件就能穿</view><view v-for="g in data.gaps" :key="g.templateId" class="field"><wd-tag v-if="g.kind === 'TREND'" plain type="warning">流行</wd-tag><text class="line">{{ g.hint }}</text><text v-if="g.have.length" class="small">（已有：{{ g.have.join('、') }}）</text></view></view></template><RecommendationGroup v-if="mode === '为我搭配' && view" :key="view.runId" :view="view" @expired="run" />
</view></template>
<style lang="scss" scoped>@import './outfit.scss';</style>
