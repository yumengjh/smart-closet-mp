<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToast } from 'wot-design-uni'
import { FEEDBACK_REASONS, GARMENT_REASONS, type RecommendedGarment, type Verdict } from '../../recommend/types'
import { recommendApi } from '../../recommend/api'
import { navigateOutfitLink } from '../../services/outfit'
const props = defineProps<{ logId: string | null; garments: RecommendedGarment[] }>()
const selector = `feedback-${Math.random().toString(36).slice(2)}`
// Toast belongs to this component, including when it is displayed inside a detail popup.
const localToast = useToast(selector)
const verdict = ref<Verdict | null>(null), open = ref(false), reasons = ref<string[]>([]), garmentId = ref(''), busy = ref(false), doubted = ref<{ garmentId: string; name: string } | null>(null)
const needsGarment = computed(() => reasons.value.some(r => (GARMENT_REASONS as readonly string[]).includes(r)))
const options = computed(() => props.garments.map(g => ({ value: g.id, label: g.name })))
async function submit(value: Verdict) {
  if (!props.logId || busy.value) return
  busy.value = true
  try {
    const answer = await recommendApi.feedback(props.logId, value, value === 'DOWN' ? reasons.value : [], value === 'DOWN' && needsGarment.value ? garmentId.value : undefined)
    verdict.value = value; open.value = false; doubted.value = answer.doubted || null
    localToast.success(answer.doubted ? `已暂停推荐「${answer.doubted.name}」，修改或确认品类后恢复推荐。` : value === 'UP' ? '已记下，之后会多推荐类似的搭配。' : '已记下，之后会尽量避开。')
  } catch (e) { localToast.error(e instanceof Error ? e.message : '反馈没有提交成功。') }
  finally { busy.value = false }
}
</script>
<template><view><view class="actions"><wd-button size="small" :type="verdict === 'UP' ? 'primary' : 'text'" :disabled="!logId || busy" @click="submit('UP')">喜欢这套</wd-button><wd-button size="small" :type="verdict === 'DOWN' ? 'primary' : 'text'" :disabled="!logId || busy" @click="open = true">不合适</wd-button></view>
  <wd-button v-if="doubted" type="text" size="small" @click="navigateOutfitLink('/garment/' + doubted.garmentId)">去核对品类</wd-button>
  <wd-popup v-model="open" position="bottom" closable :z-index="45" safe-area-inset-bottom><view class="sheet"><view class="sheet-head">哪里不合适？</view><wd-checkbox-group v-model="reasons" shape="button"><wd-checkbox v-for="r in FEEDBACK_REASONS" :key="r.value" :model-value="r.value">{{ r.label }}</wd-checkbox></wd-checkbox-group><wd-picker v-if="needsGarment" v-model="garmentId" :columns="options" :z-index="50" :placeholder="reasons.includes('WRONG_CATEGORY') ? '选择品类识别错的那件' : '选择不喜欢的那件'" /><view class="section"><wd-button block :loading="busy" :disabled="!reasons.length || (needsGarment && !garmentId)" @click="submit('DOWN')">提交</wd-button></view></view></wd-popup><wd-toast :selector="selector" /></view></template>
<style lang="scss" scoped>@import './outfit.scss';</style>
