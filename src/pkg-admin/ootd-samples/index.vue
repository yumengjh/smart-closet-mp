<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { useToast, useMessage } from 'wot-design-uni'
import { adminSampleApi, type OotdSample, type SampleResult, type SampleStats, type SampleCount } from '../../services/admin'
import { playSound } from '../../services/sound'
import { ROLE_LABELS } from '../../recommend/types'
import { STATUS, LICENSE, REJECT, PRESENTATION, word } from '../../components/ops/sampleLabels'
import { requireAdmin, errorText, options, copy } from '../../components/ops/utils'
import OpsSheet from '../../components/ops/OpsSheet.vue'
import AuthImage from '../../components/AuthImage.vue'
import { useAppearance } from '../../composables/useAppearance'
const { pageStyle } = useAppearance()
const toast = useToast(), message = useMessage(), allowed = ref(false)
const items = ref<OotdSample[]>([]), loading = ref(true), error = ref(''), busy = ref(''), tab = ref('samples'), filter = ref('EXTRACTED'), count = ref(20)
const file = ref<{ path:string; name:string }>(), sourceUrl = ref(''), license = ref('OWN'), note = ref('')
const current = ref<OotdSample>(), draft = ref<SampleResult>(), dirty = ref(false), draftKind = ref('CLASSIC'), stats = ref<SampleStats>(), statsPresentation = ref(''), statsLoading = ref(false), statsError = ref('')
const shown = computed(() => items.value.filter(i => filter.value === 'ALL' || i.status === filter.value))
const result = (s: OotdSample) => s.reviewed || s.extraction
const editable = computed(() => current.value?.status === 'EXTRACTED')
watch(filter, () => { count.value = 20 })
watch(tab, value => { if (value === 'stats') void loadStats() })
watch(statsPresentation, () => { void loadStats() })
let statsSerial = 0
async function load() { if (!allowed.value) return; loading.value = true; error.value = ''; try { items.value = (await adminSampleApi.list()).items } catch(e) { error.value = errorText(e, '样本列表暂时无法加载。') } finally { loading.value = false } }
async function loadStats() { if (!allowed.value) return; const serial = ++statsSerial; statsLoading.value = true; statsError.value = ''; try { const value = await adminSampleApi.stats(statsPresentation.value); if (serial === statsSerial) stats.value = value } catch(e) { if (serial === statsSerial) statsError.value = errorText(e, '统计暂时无法加载。') } finally { if (serial === statsSerial) statsLoading.value = false } }
onLoad(async () => { allowed.value = await requireAdmin(); await load() })
onPullDownRefresh(async () => { try { await (tab.value === 'stats' ? loadStats() : load()) } finally { uni.stopPullDownRefresh() } }); onReachBottom(() => { count.value += 20 })
async function pick() {
  if (busy.value) return
  try {
    const media = await new Promise<UniApp.ChooseMediaSuccessCallbackResult>((resolve,reject) => uni.chooseMedia({ count:1, mediaType:['image'], sizeType:['original'], success:resolve, fail:reject }))
    const picked = media.tempFiles[0]; if (!picked) return
    const info = await new Promise<UniApp.GetImageInfoSuccessData>((resolve,reject) => uni.getImageInfo({ src:picked.tempFilePath, success:resolve, fail:reject }))
    if (!['jpeg','jpg','png'].includes((info.type || '').toLowerCase())) { toast.error('请选择 JPEG 或 PNG 图片。'); return }
    if (picked.size > 10 * 1024 * 1024) { toast.error('图片不能超过 10 MB。'); return }
    file.value = { path:picked.tempFilePath, name:picked.tempFilePath.split('/').pop() || '照片' }
  } catch(e) { if (!/cancel/i.test(String((e as { errMsg?:string })?.errMsg || ''))) toast.error('无法读取照片，请重新选择。') }
}
async function upload() {
  if (!file.value || busy.value) return; busy.value = 'upload'
  try {
    const sample = await adminSampleApi.upload(file.value.path, license.value, sourceUrl.value.trim(), note.value.trim())
    items.value = [sample,...items.value]; file.value = undefined; sourceUrl.value = ''; note.value = ''
    if (sample.status === 'REJECTED') toast.warning(`已自动拒收：${REJECT[sample.rejectReason || 'OTHER'] || sample.rejectReason}，原图已删除。`)
    else if (sample.status === 'FAILED') toast.error(sample.error || '提取失败，原图已保留，可重新提取。')
    else { toast.success('提取完成，请核对。'); open(sample) }
    playSound(sample.status === 'EXTRACTED' ? 'success' : 'error')
  } catch(e) { playSound('error'); toast.error(errorText(e, '上传失败。')) } finally { busy.value = '' }
}
function open(sample: OotdSample) { current.value = sample; draft.value = result(sample) ? JSON.parse(JSON.stringify(result(sample))) as SampleResult : undefined; dirty.value = false }
function replace(sample: OotdSample) { items.value = items.value.map(i => i.id === sample.id ? sample : i); if (current.value?.id === sample.id) open(sample) }
async function save() {
  if (!current.value || !draft.value || busy.value) return false
  busy.value = 'save'
  try { replace(await adminSampleApi.save(current.value.id, draft.value)); toast.success('已保存修改。'); playSound('tap'); return true } catch(e) { toast.error(errorText(e, '操作失败。')); playSound('error'); return false } finally { busy.value = '' }
}
async function review(decision: 'APPROVED' | 'REJECTED') {
  if (!current.value || busy.value) return
  // Never approve stale extraction when saving the reviewer edits failed.
  if (dirty.value && !(await save())) return
  busy.value = decision
  try { replace(await adminSampleApi.review(current.value.id, decision)); toast.success(decision === 'APPROVED' ? '已通过，原图已删除。' : '已拒绝，原图已删除。'); playSound('tap') } catch(e) { toast.error(errorText(e, '操作失败。')); playSound('error') } finally { busy.value = '' }
}
async function retry() { if (!current.value || busy.value) return; busy.value = 'extract'; try { replace(await adminSampleApi.extract(current.value.id)); playSound('tap') } catch(e) { toast.error(errorText(e, '操作失败。')); playSound('error') } finally { busy.value = '' } }
async function makeDraft() {
  if (!current.value || busy.value || current.value.license === 'UNKNOWN') return
  const id = current.value.id; busy.value = 'draft'
  try { const r = await adminSampleApi.template(id, draftKind.value); toast.success(`已生成模板草稿 ${r.templateId}，请到“搭配模板审核”通过。`); replace(await adminSampleApi.get(id)) } catch(e) { playSound('error'); toast.error(errorText(e, '生成失败。')) } finally { busy.value = '' }
}
async function remove() {
  if (!current.value || busy.value) return
  const id = current.value.id
  try { await message.confirm({ title:'删除这个样本？', msg:'结构化结果和原图（如果还在）都会删除，不能恢复。', confirmButtonText:'删除', cancelButtonText:'取消' }) } catch { return }
  busy.value = 'remove'
  try { await adminSampleApi.remove(id); items.value = items.value.filter(i => i.id !== id); current.value = undefined; draft.value = undefined } catch(e) { toast.error(errorText(e, '删除失败。')) } finally { busy.value = '' }
}
function addItem() { draft.value?.items.push({ role:'OTHER', engineRole:'OTHER', category:'', primaryColor:'', secondaryColors:[], patterns:[], fit:'', length:'', wear:'NA', visibility:'FULL', confidence:'HIGH', description:'' }); dirty.value = true }
function removeItem(index: number) { draft.value?.items.splice(index,1); dirty.value = true }
async function source(value: string) { try { await copy(value); toast.success('已复制。') } catch { toast.warning('无法访问剪贴板，请选中内容手动复制。') } }
const top = (c: SampleCount, labels?: Record<string,string>) => Object.entries(c).sort((a,b) => b[1]-a[1]).map(([k,v]) => `${labels?.[k] || word(k)} ${v}`).join(' · ') || '—'
const statsRows = computed(() => {
  const s = stats.value; if (!s) return []
  const list = (v: { key:string; count:number }[], separator = '；') => v.map(b => `${b.key}（${b.count}）`).join(separator) || '—'
  return [
    { label:'已通过样本', value:`${s.approved}（全部状态：${Object.entries(s.byStatus).map(([k,v]) => `${STATUS[k]?.label || k} ${v}`).join(' · ')}）` },
    { label:'穿搭呈现', value:top(s.presentation,PRESENTATION) }, { label:'各位置出现（样本数）', value:top(s.roles,ROLE_LABELS) },
    { label:'主体组合 Top', value:list(s.bodies) }, { label:'上下配色 Top', value:list(s.colorPairs) }, { label:'风格', value:s.styles.map(b => `${b.key} ${b.count}`).join(' · ') || '—' },
    { label:'季节 / 场合', value:`${top(s.seasons)}；${top(s.occasions)}` }, { label:'姿态 / 朝向 / 视线', value:`${top(s.stance)}；${top(s.bodyAngle)}；${top(s.gaze)}` },
    { label:'景别 / 场景', value:`${top(s.shot)}；${top(s.setting)}` }, { label:'发型 / 表情', value:`${top(s.hair)}；${top(s.expression)}` }, { label:'位置与引擎判断不一致', value:`${s.roleMismatches} 件（多的话说明分类规则需要补词）` },
  ]
})
</script>
<template><page-meta :page-style="pageStyle" />
  <view v-if="allowed" class="page ops-page"><view class="ops-heading"><text class="ops-title">整套穿搭样本</text><view class="ops-subtitle">上传整套穿搭照片，模型提取物品、姿势与场景，审核后用于统计和生成搭配模板。原图审核完成即删除。</view></view>
    <view class="ops-alert">收图前请看采集规范：一张图一个人一整套、日常可穿、不收未成年人；每张图调用一次识图模型。<view class="ops-meta">规范见文档 docs/OOTD_SAMPLE_COLLECTION.md。许可“未知”的样本只参与统计，不能生成模板。</view></view>
    <view class="ops-section"><wd-button plain :disabled="!!busy" @click="pick">{{ file ? file.name : '选择照片' }}</wd-button><wd-input v-model="sourceUrl" clearable placeholder="来源链接（可选）" :disabled="!!busy" /><wd-picker v-model="license" label="许可" :columns="options(LICENSE)" :disabled="!!busy" /><wd-input v-model="note" clearable placeholder="备注（可选）" :disabled="!!busy" /><view class="ops-actions"><wd-button :disabled="!file || !!busy" :loading="busy === 'upload'" @click="upload">上传并提取</wd-button></view></view>
    <wd-tabs v-model="tab"><wd-tab name="samples" title="样本" /><wd-tab name="stats" title="统计" /></wd-tabs>
    <view v-if="tab === 'samples'"><view v-if="error" class="ops-alert ops-error">{{ error }}<wd-button type="text" size="small" @click="load">重试</wd-button></view><wd-picker v-model="filter" label="样本状态" :columns="[{ value:'EXTRACTED',label:'待审核' },{ value:'FAILED',label:'失败' },{ value:'APPROVED',label:'已通过' },{ value:'REJECTED',label:'已拒绝' },{ value:'ALL',label:'全部' }]" /><wd-skeleton v-if="loading" :row-col="[1,1,1,1]" animation="gradient" />
      <view v-for="record in shown.slice(0,count)" :key="record.id" class="ops-section"><view class="ops-between"><wd-tag :type="record.status === 'APPROVED' ? 'success' : record.status === 'FAILED' ? 'danger' : 'default'" plain>{{ STATUS[record.status]?.label || record.status }}</wd-tag><text class="ops-meta">{{ new Date(record.createdAtMs).toLocaleString() }}</text></view><view class="ops-copy">{{ result(record) ? result(record)!.items.map(i => i.category || ROLE_LABELS[i.role]).join('、') || '—' : record.rejectReason ? REJECT[record.rejectReason] || record.rejectReason : record.error || '—' }}</view><view class="ops-meta">{{ record.sourceUrl ? '来源链接' : '无链接' }} · {{ LICENSE[record.license] || record.license }}<text v-if="record.templateId"> · 已生成模板</text></view><view class="ops-actions"><wd-button size="small" plain @click="open(record)">查看</wd-button><wd-button v-if="record.sourceUrl" size="small" type="text" @click="source(record.sourceUrl)">复制来源链接</wd-button></view></view><wd-status-tip v-if="!loading && !shown.length && !error" image="content" tip="暂无样本" /><wd-button v-if="count < shown.length" type="text" @click="count += 20">加载更多</wd-button>
    </view>
    <view v-else class="ops-section"><wd-picker v-model="statsPresentation" label="穿搭呈现" :columns="[{ value:'',label:'全部' },{ value:'FEMININE',label:'女性化' },{ value:'MASCULINE',label:'男性化' },{ value:'NEUTRAL',label:'中性' }]" /><wd-button type="text" size="small" @click="loadStats">刷新</wd-button><view v-if="statsError" class="ops-alert ops-error">{{ statsError }}</view><wd-skeleton v-if="statsLoading" :row-col="[1,1,1,1]" animation="gradient" /><wd-status-tip v-else-if="stats && !stats.approved" image="content" tip="还没有已通过的样本。" /><template v-else-if="stats"><view v-for="row in statsRows" :key="row.label" class="ops-row"><text class="ops-label">{{ row.label }}</text><view class="ops-copy">{{ row.value }}</view></view><view class="ops-row"><text class="ops-label">引擎还认不出的物品（词表候选）</text><text v-if="!stats.unknownItems.length">—</text><view v-for="u in stats.unknownItems" :key="u.category" class="ops-copy">{{ u.category }}（{{ u.count }}）<text class="ops-meta"> {{ u.description }}</text></view></view></template></view>
    <OpsSheet :model-value="!!current" :title="current ? `样本 ${current.id.slice(0,8)} · ${STATUS[current.status]?.label}` : ''" :busy="!!busy" @update:model-value="current = undefined; draft = undefined">
      <template v-if="current"><view v-if="current.hasImage" class="ops-photo"><AuthImage :src="`/api/admin/ootd-samples/${current.id}/image`" previewable /></view><wd-status-tip v-else image="content" tip="原图已删除" /><view class="ops-copy">{{ LICENSE[current.license] }}<text v-if="current.note"> · {{ current.note }}</text></view><wd-button v-if="current.sourceUrl" type="text" size="small" @click="source(current.sourceUrl)">复制来源链接</wd-button><view v-if="current.model" class="ops-meta">提取模型：{{ current.model }}</view>
        <view v-if="current.status === 'FAILED'" class="ops-alert ops-error">{{ current.error || '提取失败' }}</view><view v-if="current.status === 'REJECTED' && !draft" class="ops-alert ops-warning">已拒收：{{ REJECT[current.rejectReason || 'OTHER'] || current.rejectReason }}</view>
        <template v-if="draft"><view class="ops-between ops-field"><text>可用</text><wd-switch v-model="draft.usable" :disabled="!editable || !!busy" @change="dirty = true" /></view><wd-picker v-model="draft.rejectReason" label="可用判断" :columns="options(REJECT)" :disabled="!editable || !!busy" :z-index="40" @confirm="dirty = true" /><wd-picker v-model="draft.presentation" label="呈现" :columns="options(PRESENTATION)" :disabled="!editable || !!busy" :z-index="40" @confirm="dirty = true" /><view class="ops-copy">季节 {{ draft.seasons.join('/') || '—' }} · 场合 {{ draft.occasions.join('/') || '—' }} · 风格 {{ draft.styles.join('/') || '—' }}</view><view class="ops-h3">物品（{{ draft.items.length }}）</view>
          <view v-for="(item,i) in draft.items" :key="i" class="ops-row"><wd-picker v-model="item.role" label="位置" :columns="options(ROLE_LABELS)" :disabled="!editable || !!busy" :z-index="40" @confirm="dirty = true" /><wd-input v-model="item.category" label="品类" placeholder="品类" :disabled="!editable || !!busy" @input="dirty = true" /><wd-input v-model="item.primaryColor" label="主色" placeholder="主色" :disabled="!editable || !!busy" @input="dirty = true" /><view class="ops-tags"><wd-tag v-if="item.visibility === 'PARTIAL'" plain>部分可见</wd-tag><wd-tag v-if="item.confidence === 'LOW'" type="warning" plain>把握低</wd-tag><wd-tag v-if="item.wear !== 'NA'" plain>{{ word(item.wear) }}</wd-tag></view><view v-if="item.engineRole !== item.role && !(item.role === 'INNER' && item.engineRole === 'TOP')" class="ops-alert ops-warning">分类不一致：推荐引擎按品类名会读成「{{ ROLE_LABELS[item.engineRole] || item.engineRole }}」</view><view v-if="item.description" class="ops-meta">{{ item.description }}</view><wd-button v-if="editable" type="text" size="small" :disabled="!!busy" @click="removeItem(i)">删除这一项</wd-button></view>
          <wd-button v-if="editable" plain size="small" :disabled="!!busy" @click="addItem">添加一项（模型漏掉的）</wd-button><view class="ops-h3">呈现（本期只采集）</view><view class="ops-copy">姿势：{{ word(draft.pose.stance) }}、{{ word(draft.pose.bodyAngle) }}、{{ word(draft.pose.gaze) }}<text v-if="draft.pose.hands">；{{ draft.pose.hands }}</text><text v-if="draft.pose.description">；{{ draft.pose.description }}</text>（常见于{{ PRESENTATION[draft.pose.tendency] }}）</view><view class="ops-copy">构图：{{ word(draft.framing.shot) }}、{{ word(draft.framing.cameraAngle) }}{{ draft.framing.mirrorSelfie ? '、对镜自拍' : '' }} · 场景：{{ word(draft.scene.setting) }} {{ draft.scene.description }}</view><view class="ops-copy">发型：{{ word(draft.hair.length) }} {{ draft.hair.description }} · 表情：{{ word(draft.expression) }}</view><wd-input v-model="draft.highlights" label="亮点" :disabled="!editable || !!busy" @input="dirty = true" /></template>
        <view class="ops-actions"><template v-if="editable"><wd-button plain :disabled="!dirty || !!busy" :loading="busy === 'save'" @click="save">保存修改</wd-button><wd-button :disabled="!!busy" :loading="busy === 'APPROVED'" @click="review('APPROVED')">通过</wd-button><wd-button type="error" :disabled="!!busy" :loading="busy === 'REJECTED'" @click="review('REJECTED')">拒绝</wd-button></template><template v-if="current.status === 'FAILED'"><wd-button :disabled="!!busy" :loading="busy === 'extract'" @click="retry">重新提取</wd-button><wd-button type="error" :disabled="!!busy" :loading="busy === 'REJECTED'" @click="review('REJECTED')">拒绝</wd-button></template></view>
        <template v-if="current.status === 'APPROVED' && !current.templateId"><wd-picker v-model="draftKind" label="模板类型" :columns="[{ value:'CLASSIC',label:'经典' },{ value:'TREND',label:'流行（6 个月）' }]" :z-index="40" :disabled="!!busy" /><view class="ops-actions"><wd-button :disabled="current.license === 'UNKNOWN' || !!busy" :loading="busy === 'draft'" @click="makeDraft">生成模板草稿</wd-button></view></template><view v-if="current.templateId" class="ops-copy">已生成模板 {{ current.templateId }}（到“搭配模板审核”通过后生效）</view><view class="ops-actions"><wd-button type="text" :disabled="!!busy" @click="remove">删除样本</wd-button></view>
      </template>
    </OpsSheet>
  </view><wd-toast /><wd-message-box />
</template>
<style scoped lang="scss">@import '../../components/ops/shared.scss';</style>
