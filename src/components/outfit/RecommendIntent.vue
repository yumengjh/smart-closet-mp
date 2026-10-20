<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { OCCASIONS, type IntentInput } from '../../recommend/types'
const props = withDefaults(defineProps<{ modelValue: IntentInput; loading?: boolean; submitLabel?: string; compact?: boolean }>(), { submitLabel: '推荐' })
const emit = defineEmits<{ (e: 'update:modelValue', value: IntentInput): void; (e: 'submit'): void }>()
const colors = ['亮色', '深色', '红色', '橙色', '黄色', '绿色', '蓝色', '紫色', '粉色', '黑色', '白色', '灰色', '米色', '棕色'].map(value => ({ value, label: value }))
// The digit keypad has no minus key, so the field is plain text: keep what is being typed (a lone "-" included) and only commit complete numbers.
const temperature = ref(props.modelValue.temperatureC == null ? '' : String(props.modelValue.temperatureC))
const typed = () => { const num = Number(temperature.value); return temperature.value.replace(/[-.]/g, '') === '' || !Number.isFinite(num) ? null : num }
watch(() => props.modelValue.temperatureC, value => { if (value !== typed() && value !== (typed() == null ? null : Math.max(-40, Math.min(50, typed()!)))) temperature.value = value == null ? '' : String(value) })
function typeTemperature(raw: string | number) {
  const text = String(raw).replace(/[^0-9.-]/g, '')
  const negative = text.startsWith('-')
  const [whole, ...rest] = text.replace(/-/g, '').split('.')
  const cleaned = (negative ? '-' : '') + whole.slice(0, 2) + (rest.length ? '.' + rest.join('').slice(0, 1) : '')
  temperature.value = cleaned
  if (cleaned === '' || cleaned === '-' || cleaned === '.' || cleaned === '-.') { patch({ temperatureC: null }); return }
  const num = Number(cleaned)
  if (Number.isFinite(num)) patch({ temperatureC: Math.max(-40, Math.min(50, num)) })
}
function settleTemperature() { const value = props.modelValue.temperatureC; temperature.value = value == null ? '' : String(value) }
const avoid = computed({ get: () => props.modelValue.avoidColors || [], set: value => patch({ avoidColors: value }) })
function patch(patch: Partial<IntentInput>) { emit('update:modelValue', { ...props.modelValue, ...patch }) }
</script>
<template><view class="intent">
  <text class="field-label">场景</text><view class="tags"><wd-tag v-for="o in (compact ? OCCASIONS.slice(0, 4) : OCCASIONS)" :key="o.value" :plain="modelValue.occasion !== o.value" :type="modelValue.occasion === o.value ? 'primary' : 'default'" @click="patch({ occasion: o.value })">{{ o.label }}</wd-tag></view>
  <wd-input :model-value="temperature" label="温度 °C" type="text" placeholder="可不填，冬天可填负数，如 -5" clearable @update:model-value="typeTemperature" @blur="settleTemperature" @clear="typeTemperature('')" />
  <wd-select-picker v-if="!compact" v-model="avoid" label="避开" placeholder="不想要的颜色" title="避开的颜色" :columns="colors" />
  <view class="section"><wd-button block :loading="loading" @click="emit('submit')">{{ submitLabel }}</wd-button></view>
</view></template>
<style lang="scss" scoped>@import './outfit.scss';.intent { padding: 24rpx; background: $surface; border-radius: $radius-md; }</style>
