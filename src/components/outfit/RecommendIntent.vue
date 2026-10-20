<script setup lang="ts">
import { computed } from 'vue'
import { OCCASIONS, type IntentInput } from '../../recommend/types'
const props = withDefaults(defineProps<{ modelValue: IntentInput; loading?: boolean; submitLabel?: string; compact?: boolean }>(), { submitLabel: '推荐' })
const emit = defineEmits<{ (e: 'update:modelValue', value: IntentInput): void; (e: 'submit'): void }>()
const colors = ['亮色', '深色', '红色', '橙色', '黄色', '绿色', '蓝色', '紫色', '粉色', '黑色', '白色', '灰色', '米色', '棕色'].map(value => ({ value, label: value }))
const temperature = computed({ get: () => props.modelValue.temperatureC == null ? '' : String(props.modelValue.temperatureC), set: value => { const num = Number(value); patch({ temperatureC: value === '' ? null : Math.max(-40, Math.min(50, Number.isFinite(num) ? num : 0)) }) } })
const avoid = computed({ get: () => props.modelValue.avoidColors || [], set: value => patch({ avoidColors: value }) })
function patch(patch: Partial<IntentInput>) { emit('update:modelValue', { ...props.modelValue, ...patch }) }
</script>
<template><view class="intent">
  <text class="field-label">场景</text><view class="tags"><wd-tag v-for="o in (compact ? OCCASIONS.slice(0, 4) : OCCASIONS)" :key="o.value" :plain="modelValue.occasion !== o.value" :type="modelValue.occasion === o.value ? 'primary' : 'default'" @click="patch({ occasion: o.value })">{{ o.label }}</wd-tag></view>
  <wd-input v-model="temperature" label="温度 °C" type="digit" placeholder="可不填" clearable />
  <wd-select-picker v-if="!compact" v-model="avoid" label="避开" placeholder="不想要的颜色" title="避开的颜色" :columns="colors" />
  <view class="section"><wd-button block :loading="loading" @click="emit('submit')">{{ submitLabel }}</wd-button></view>
</view></template>
<style lang="scss" scoped>@import './outfit.scss';.intent { padding: 24rpx; background: $surface; border-radius: $radius-md; }</style>
