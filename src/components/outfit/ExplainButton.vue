<script setup lang="ts">
import { computed, ref } from 'vue'
import { recommendApi } from '../../recommend/api'
import type { Explanation } from '../../recommend/types'
const props = withDefaults(defineProps<{ runId: string; garmentId?: string; outfitKey?: string; label?: string }>(), { label: '为什么' })
const open = ref(false), loading = ref(false), error = ref(''), data = ref<Explanation | null>(null)
const rules = computed(() => (data.value?.outfit || data.value?.bestOutfit)?.rules.filter(r => r.hit) || [])
async function show() { open.value = true; if (data.value || loading.value) return; loading.value = true; error.value = ''; try { data.value = await recommendApi.explain(props.runId, { garmentId: props.garmentId, outfitKey: props.outfitKey }) } catch (e) { error.value = e instanceof Error ? e.message : '暂时无法解释。' } finally { loading.value = false } }
</script>
<template><view><wd-button type="text" size="small" @click="show">{{ label }}</wd-button><wd-popup v-model="open" position="bottom" closable :z-index="55"><view class="sheet"><view class="sheet-head">推荐依据</view><wd-skeleton v-if="loading" :row-col="[{ width: '100%' }, { width: '80%' }]" /><view v-else-if="error" class="notice warning">{{ error }}<wd-button type="text" @click="show">重试</wd-button></view><template v-else-if="data"><text v-for="(line, i) in data.summary" :key="i" class="line">{{ line }}</text><view v-for="r in rules" :key="r.id" class="field"><view class="spread"><text>{{ r.label }}</text><text :class="r.delta < 0 ? 'negative' : 'positive'">{{ r.delta > 0 ? '+' : '' }}{{ r.delta }}</text></view><text v-if="r.evidence" class="small">{{ r.evidence }}</text></view></template></view></wd-popup></view></template>
<style lang="scss" scoped>@import './outfit.scss';.positive{color:$success}.negative{color:$danger}</style>
