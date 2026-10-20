<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useToast, useMessage } from 'wot-design-uni'
import { recommendApi, type Statement, type StyleProfileView, type RecommendationStats } from '../../services/me'
import { STRICTNESS_NOTES, strictnessNote } from './strictness'
const toast = useToast(), message = useMessage()
const profile = ref<StyleProfileView | null>(null), loading = ref(true), error = ref(''), saving = ref(''), city = ref(''), strictness = ref(50)
const groups = computed(() => {
  const list = profile.value?.statements || [], pick = (k: string[]) => list.filter(s => k.includes(s.kind))
  return [{ title: '冷却中的单品', items: pick(['COOLDOWN']) }, { title: '你对搭配的反馈', items: pick(['COMBO', 'ITEM', 'MIX', 'FEEDBACK']).concat(list.filter(s => s.kind === 'PAIR' && s.weight < 0)) }, { title: '颜色、风格与常穿组合', items: pick(['COLOR', 'STYLE', 'MEMORY']).concat(list.filter(s => s.kind === 'PAIR' && s.weight > 0)) }, { title: '很久没穿的衣物', items: pick(['IDLE']) }].filter(g => g.items.length)
})
async function load() {
  loading.value = true; error.value = ''
  try { profile.value = await recommendApi.profile(); city.value = profile.value.settings.city || ''; strictness.value = profile.value.strictness.level }
  catch (e) { error.value = e instanceof Error ? e.message : '穿搭画像暂时无法加载。' } finally { loading.value = false }
}
async function patch(body: Record<string, unknown>, key: string, done = '已保存。') {
  saving.value = key
  try { await recommendApi.updateProfile(body); await load(); toast.success(done) }
  catch (e) { toast.error(e instanceof Error ? e.message : '没有保存成功。') } finally { saving.value = '' }
}
async function confirmPatch(title: string, body: Record<string, unknown>, key: string, done: string) {
  try { await message.confirm({ title, confirmButtonText: '确定', cancelButtonText: '取消' }) } catch { return }
  await patch(body, key, done)
}
function block(s: Statement) { return s.kind === 'COOLDOWN' ? confirmPatch('立即恢复推荐这件？', { unblock: s.key }, s.key, '已恢复推荐。') : confirmPatch('这条不准确，屏蔽它？', { block: s.key }, s.key, '已屏蔽这一条，不再影响推荐。') }
const days = ref(30), stats = ref<RecommendationStats | null>(null), statsError = ref(''), statsLoading = ref(false)
const sources: Record<string, string> = { PAGE: '推荐区', AGENT: '助手', INSPIRATION: '今日灵感', SWAP: '换一件', MORE: '换一批' }
async function loadStats() { statsLoading.value = true; try { stats.value = await recommendApi.stats(days.value); statsError.value = '' } catch (e) { statsError.value = String(e) } finally { statsLoading.value = false } }
function pct(v: number | null) { return v === null ? '—' : `${Math.round(v * 100)}%` }
onMounted(() => { void load(); void loadStats() })
</script>
<template>
  <view class="stack">
    <wd-skeleton v-if="loading && !profile" :row-col="[1, 1, 1]" />
    <view v-else-if="error" class="error">{{ error }}<wd-button type="text" @click="load">重试</wd-button></view>
    <template v-else-if="profile">
      <view class="section"><view class="title">我的穿搭画像</view><view class="note">全部来自你的反馈、保存与穿着记录，按规则统计，不调用大模型。“不喜欢”的影响 {{ profile.feedbackHalfLifeDays.negative }} 天减半，喜欢与常穿 {{ profile.feedbackHalfLifeDays.positive }} 天减半；之后喜欢了会自然回正。</view>
        <wd-status-tip v-if="!groups.length" image="content" tip="还没有足够的依据。多用几次推荐、保存或记录“今天穿了”，这里会慢慢丰富。" />
        <view v-for="g in groups" :key="g.title" class="item"><view class="title">{{ g.title }}</view><view v-for="s in g.items" :key="s.key" class="item row"><text>{{ s.text }}</text><wd-button size="small" :loading="saving === s.key" @click="block(s)">{{ s.kind === 'COOLDOWN' ? '立即恢复' : '不准确' }}</wd-button></view></view>
      </view>
      <view class="section"><view class="title">个人冷暖与正式程度</view><view class="note">来自“太热 / 太冷 / 太正式 / 太随意”的反馈，有上限并随时间减弱。</view>
        <view class="note">冷暖：{{ Math.abs(profile.offsets.warmth) < 0.1 ? '没有偏移' : `${profile.offsets.warmth > 0 ? '更保暖' : '更清凉'} ${Math.abs(profile.offsets.warmth)}（上限 ${profile.offsetCaps.warmth}）` }}<view>正式程度：{{ Math.abs(profile.offsets.formality) < 0.05 ? '没有偏移' : `${profile.offsets.formality > 0 ? '更正式' : '更随意'} ${Math.abs(profile.offsets.formality)}（上限 ${profile.offsetCaps.formality}）` }}</view></view>
        <wd-button :disabled="Math.abs(profile.offsets.warmth) < 0.1 && Math.abs(profile.offsets.formality) < 0.05" :loading="saving === 'offsets'" @click="confirmPatch('清空后从现在起重新统计，之前的反馈不再影响冷暖与正式程度。', { clearOffsets: true }, 'offsets', '已清空个人偏移。')">清空偏移</wd-button>
      </view>
      <view class="section stack"><view class="title">推荐偏好</view>
        <view class="item row"><view>根据我的行为调整推荐<view class="note">关闭后不再参考反馈和行为，也不再上报行为事件</view></view><wd-switch :model-value="profile.settings.profileEnabled" :disabled="!!saving" @change="patch({ profileEnabled: $event.value }, 'enabled')" /></view>
        <view class="item row"><view>保留一套“新尝试”<view class="note">3 套里留 1 套平时少穿但合规的组合</view></view><wd-switch :model-value="profile.settings.exploration" :disabled="!!saving" @change="patch({ exploration: $event.value }, 'exploration')" /></view>
        <wd-picker :model-value="profile.settings.boldness" label="配色胆量" :columns="[{ value: 'CONSERVATIVE', label: '保守' }, { value: 'BALANCED', label: '适中' }, { value: 'BOLD', label: '大胆' }]" @confirm="patch({ boldness: $event.value }, 'boldness')" />
        <wd-picker :model-value="profile.settings.styleMixing" label="图片画风混搭" :columns="[{ value: 'AUTO', label: '自动学习' }, { value: 'ALLOW', label: '总是允许' }, { value: 'FORBID', label: '总是不混' }]" @confirm="patch({ styleMixing: $event.value }, 'mixing')" /><view class="note">写实照片和卡通插画能否放在同一套</view>
        <wd-input v-model="city" label="常住城市" :maxlength="40" placeholder="例如 杭州" @blur="city !== (profile.settings.city || '') && patch({ city }, 'city')" /><view class="note">可不填，用于季节判断</view>
      </view>
      <view class="section stack"><view class="title">语义搜索严格度</view><view class="note">影响衣柜搜索、助手查衣柜和推荐里的描述匹配（例如“适合海边的”）。越严格越不容易给出不相关的结果，但可能漏掉一些。</view>
        <wd-slider v-model="strictness" :min="0" :max="100" :step="5" @dragend="patch({ semanticStrictness: $event.value }, 'strictness')" /><view class="row note"><text>宽松</text><text>推荐</text><text>严格</text></view><view class="note">{{ strictness }} · {{ strictnessNote(strictness) }}</view>
        <wd-button v-if="profile.settings.semanticStrictness !== null" type="text" @click="patch({ semanticStrictness: null }, 'strictness-reset', '已恢复推荐档。')">恢复推荐档</wd-button>
        <view v-for="l in profile.strictness.levels" :key="l.level" class="note">{{ l.level }}：{{ STRICTNESS_NOTES[l.level] }}（相似度门槛 {{ l.threshold }}）</view>
      </view>
      <view class="section stack"><view class="title">推荐效果与成本</view>
        <wd-picker v-model="days" label="统计范围" :columns="[{ value: 7, label: '近 7 天' }, { value: 30, label: '近 30 天' }, { value: 90, label: '近 90 天' }]" @confirm="loadStats" />
        <view v-if="statsError" class="error">{{ statsError }}<wd-button type="text" @click="loadStats">重试</wd-button></view><wd-loading v-if="statsLoading" />
        <template v-if="stats"><view class="title">效果</view><view>推荐出的搭配 {{ stats.effect.shown }} 套</view><view>采用 {{ stats.effect.adopted }} 套（{{ pct(stats.effect.adoptionRate) }}）</view><view>点赞 / 点踩 {{ stats.effect.liked }} / {{ stats.effect.disliked }}（好评 {{ pct(stats.effect.likeRate) }}）</view><view>在搭台打开 {{ stats.effect.openedInWorkspace }} 套</view><view>3 天内穿了 {{ stats.effect.wornWithin3Days }} 套</view><view>换一件 {{ stats.effect.swaps }} 次</view><view v-for="(row, source) in stats.effect.bySource" :key="source" class="note">{{ sources[source] || source }}：{{ row.adopted }}/{{ row.shown }}</view>
          <view class="title">成本</view><view>本地计算的推荐 {{ stats.cost.zeroModelRecommendations }} 套，不花模型费</view><view>助手消息 {{ stats.cost.agentMessages }} 条</view><view>识图/生图额度 {{ stats.cost.imageCredits }} 次</view><view>助手 token 输入 {{ stats.cost.inputTokens }} · 输出 {{ stats.cost.outputTokens }}<text v-if="stats.cost.unknownUsage">（{{ stats.cost.unknownUsage }} 次未上报）</text></view><view class="note">{{ stats.effect.definition }}。{{ stats.cost.note }}。</view></template>
      </view>
      <view class="section"><view class="title">清空画像</view><view class="note">清空后画像从头统计，屏蔽项一并清除；推荐、反馈和穿着记录本身保留。</view><wd-button type="error" plain :loading="saving === 'reset'" @click="confirmPatch('确定清空穿搭画像？', { reset: true }, 'reset', '已清空，之后重新统计。')">清空画像</wd-button></view>
    </template><wd-toast /><wd-message-box />
  </view>
</template>
<style lang="scss" scoped>@import './me.scss';</style>
