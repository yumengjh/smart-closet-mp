<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onLoad, onShow, onHide, onUnload, onPullDownRefresh } from '@dcloudio/uni-app'
import { useToast, useMessage } from 'wot-design-uni'
import { closetApi } from '../../services/api'
import { platformRequest, PlatformRequestError, type Baseline, type Capability, type RenderJob, type Review, type PoseCatalog, type PoseChoice, type RenderSubmission } from '../../services/platform'
import { createUuid } from '../../domain/id'
import type { Outfit } from '../../domain/outfit'
import { useClosetStore } from '../../stores/closet'
import { usePreferencesStore } from '../../stores/preferences'
import { useProcessingStore } from '../../stores/processing'
import { useSendOffStore } from '../../stores/sendOff'
import { appVisible } from '../../services/lifecycle'
import AuthImage from '../../components/AuthImage.vue'
import PosePicker from '../../components/me/PosePicker.vue'
import ResultViewer from '../../components/me/ResultViewer.vue'
import OutfitPreview from '../../components/me/OutfitPreview.vue'
import RenderSupport from '../../components/me/RenderSupport.vue'
import { modelLabel } from '../../components/me/labels'
import { describeAdjustments } from '../../components/me/body-adjust'
import { adviceFor } from '../../components/me/jobStatus'
const toast = useToast(), message = useMessage(), closet = useClosetStore(), preferences = usePreferencesStore(), processing = useProcessingStore(), sendOff = useSendOffStore()
const outfits = ref<Outfit[]>([]), baselines = ref<Baseline[]>([]), capabilities = ref<Capability[]>([]), jobs = ref<RenderJob[]>([]), poseCatalog = ref<PoseCatalog | null>(null)
const outfitId = ref(''), baselineId = ref(''), model = ref(''), selected = ref<string[]>([]), pose = ref<PoseChoice>({ mode: 'AUTO' })
const multiLayer = ref(false), wearRoles = ref<Record<string, string>>({}), showItems = ref(false), loading = ref(true), error = ref(''), busy = ref(false), review = ref<Review | null>(null)
type Preparation = { id: string; review: Review; expiresAt: number; quotaUnits: number; pose: { mode: string; name: string } | null }
const preparation = ref<Preparation | null>(null), confirmOpen = ref(false), key = ref(createUuid()), viewing = ref<RenderJob | null>(null), statusId = ref(''), retrying = ref(''), pending = ref(false), routeJob = ref('')
let timer: ReturnType<typeof setInterval> | undefined, active = false
const retryKeys = new Map<string, string>()
const accessoryOptions = [{ value: 'ACCESSORY:EAR', label: '耳部' }, { value: 'ACCESSORY:NECK', label: '颈部' }, { value: 'ACCESSORY:WRIST', label: '手腕' }, { value: 'ACCESSORY:HAND_LEFT', label: '左手' }, { value: 'ACCESSORY:HAND_RIGHT', label: '右手' }, { value: 'ACCESSORY:TIE', label: '领带' }]
const current = computed(() => outfits.value.find(o => o.id === outfitId.value)), person = computed(() => baselines.value.find(b => b.id === baselineId.value))
const available = computed(() => capabilities.value.filter(c => c.verified && c.purpose === 'OOTD'))
const capability = computed(() => available.value.find(c => c.provider + ':' + c.model === model.value))
const garments = computed(() => [...new Map((current.value?.scene.elements || []).filter(e => e.kind !== 'PERSON_PART').map(e => [e.garmentId, e])).values()])
const filledSlots = computed(() => review.value?.slots.filter(s => s.items.length || s.state === 'CONFLICT' || s.state === 'UNKNOWN') || [])
const hint = computed(() => !current.value ? '先选一套已保存的搭配' : !person.value ? '先选一位模特' : !capability.value ? '暂无可用的生成模型' : '')
const viewingJob = computed(() => viewing.value && (jobs.value.find(j => j.id === viewing.value!.id) || viewing.value))
const statusJob = computed(() => jobs.value.find(j => j.id === statusId.value) || null), advice = computed(() => statusJob.value ? adviceFor(statusJob.value) : null)
watch(current, () => { selected.value = garments.value.map(g => g.garmentId); review.value = null; wearRoles.value = {} })
watch([selected, multiLayer, wearRoles, model, baselineId, pose], () => { if (!pending.value) { preparation.value = null; confirmOpen.value = false } }, { deep: true })
async function load() {
  try {
    const [o, b, c, j, p] = await Promise.all([closetApi.outfits(), platformRequest<Baseline[]>('/api/me/person-baselines'), platformRequest<Capability[]>('/api/render-capabilities'), platformRequest<RenderJob[]>('/api/ootd/jobs'), platformRequest<PoseCatalog>('/api/ootd/poses')])
    outfits.value = o; baselines.value = b.filter(p => p.status === 'CONFIRMED'); capabilities.value = c; jobs.value = j; poseCatalog.value = p
    if (!capability.value) model.value = available.value[0] ? available.value[0].provider + ':' + available.value[0].model : ''
    if (!person.value) baselineId.value = baselines.value.find(b => b.currentDefault)?.id || baselines.value[0]?.id || ''
    error.value = ''
  } catch (e) { error.value = e instanceof Error ? e.message : String(e) } finally { loading.value = false }
  openFromRoute()
}
async function loadPoses() { try { poseCatalog.value = await platformRequest('/api/ootd/poses') } catch (e) { toast.error(String(e)) } }
async function refresh() {
  if (!active || !appVisible()) return
  try { jobs.value = await platformRequest('/api/ootd/jobs'); openFromRoute() } catch (e) { toast.error(e instanceof Error ? e.message : String(e)) }
}
function body(useOlderBaseline: boolean) { return { outfitId: current.value!.id, revision: current.value!.revision, baselineId: person.value!.id, baselineRevision: person.value!.revision, selectedGarmentIds: selected.value, multiLayer: multiLayer.value, wearRoles: wearRoles.value, provider: capability.value!.provider, model: capability.value!.model, useOlderBaseline, pose: pose.value } }
async function check(nested = false) {
  if (!current.value || (busy.value && !nested)) return
  busy.value = true; review.value = null
  try { review.value = await platformRequest('/api/outfit-reviews', 'POST', { outfitId: current.value.id, revision: current.value.revision, selectedGarmentIds: selected.value, multiLayer: multiLayer.value, wearRoles: wearRoles.value }); error.value = '' }
  catch (e) { error.value = e instanceof Error ? e.message : String(e) } finally { if (!nested) busy.value = false }
}
async function prepare(useOlderBaseline = false) {
  if (!current.value || !person.value || !capability.value || busy.value) return
  if (pending.value) { confirmOpen.value = true; return }
  busy.value = true
  try { await check(true); if (!review.value || review.value.blockers.length) return; preparation.value = await platformRequest('/api/ootd/preparations', 'POST', body(useOlderBaseline)); key.value = createUuid(); confirmOpen.value = true }
  catch (e) {
    if (e instanceof PlatformRequestError && e.code === 'BASELINE_PROFILE_STALE') {
      busy.value = false
      try { await message.confirm({ title: '这位模特是按旧资料生成的', msg: '个人资料改过之后，模特不会自动更新。仍用这位模特生成吗？', confirmButtonText: '仍然使用', cancelButtonText: '换一位' }) } catch { return }
      await prepare(true)
    } else error.value = e instanceof Error ? e.message : String(e)
  } finally { busy.value = false }
}
function handOff(job: RenderJob) {
  const chosen = garments.value.filter(g => selected.value.includes(g.garmentId)), poseId = pose.value.mode === 'AUTO' ? '' : pose.value.id
  const poseCard = [...(poseCatalog.value?.presets || []), ...(poseCatalog.value?.mine || [])].find(p => p.id === poseId) || null
  sendOff.launch({ title: `${chosen.length} 件衣物 · ${preparation.value?.pose?.name || '自动动作'}`, cards: chosen.map(g => ({ image: g.assetUrl, label: g.garmentLabel })), person: person.value?.mediaUrl || undefined, pose: poseCard }); processing.trackRender(job, true)
}
function rehearse() {
  const chosen = garments.value.filter(g => selected.value.includes(g.garmentId)), cards = chosen.length ? chosen.map(g => ({ image: g.assetUrl, label: g.garmentLabel })) : ['上衣', '下装', '鞋子'].map(label => ({ label }))
  sendOff.launch({ title: `模拟演示 · ${cards.length} 件衣物 · 自动动作`, cards, person: person.value?.mediaUrl || undefined }); processing.simulateRender(jobs.value.find(j => j.mediaUrl)?.mediaUrl || person.value?.mediaUrl || undefined)
}
async function accepted(job: RenderJob) { handOff(job); confirmOpen.value = false; preparation.value = null; pending.value = false; error.value = ''; jobs.value = [job, ...jobs.value.filter(j => j.id !== job.id)]; await refresh() }
async function reconcile() { const r = await platformRequest<RenderSubmission>(`/api/me/image-render-submissions/${encodeURIComponent(key.value)}`, 'GET', undefined, undefined, { timeoutMs: 10000 }); if (r.found && r.job) { await accepted(r.job); return true }; return false }
async function generate() {
  if (!preparation.value || busy.value) return
  busy.value = true; error.value = ''
  try { if (pending.value && await reconcile()) return; await accepted(await platformRequest<RenderJob>('/api/ootd/jobs', 'POST', { preparationId: preparation.value.id }, key.value)) }
  catch (e) {
    if (e instanceof PlatformRequestError && e.uncertain) { pending.value = true; try { if (await reconcile()) return; error.value = '暂未查到这次任务。再点一次会复用原提交编号，不会重复生成。' } catch { error.value = '连接仍未恢复，暂时无法确认是否已提交。请先看看下方生成记录，不要关闭这个窗口重新准备。' } }
    else error.value = e instanceof Error ? e.message : String(e)
  } finally { busy.value = false }
}
async function cancel(job: RenderJob) { try { await platformRequest(`/api/ootd/jobs/${job.id}/cancel`, 'POST', {}); await refresh(); toast.show('已请求停止；无法保证上游停止或退还额度。') } catch (e) { toast.error(String(e)) } }
async function remove(job: RenderJob) {
  try { await message.confirm({ title: '永久删除这张图？', msg: '删除后无法恢复；搭配、模特和其他图片不受影响。', confirmButtonText: '删除', cancelButtonText: '取消' }) } catch { return }
  try { await platformRequest(`/api/ootd/jobs/${job.id}`, 'DELETE'); viewing.value = null; statusId.value = ''; await refresh() } catch (e) { toast.error(String(e)) }
}
async function retry(job: RenderJob) {
  if (retrying.value) return
  try { await message.confirm({ title: '重新生成这张图？', msg: job.status === 'UNKNOWN' ? '上一次请求可能已经在服务商那边出图并扣了额度，重新生成会再用 1 个图像额度。' : '会按原来的搭配、模特和动作再生成一张，再用 1 个图像额度。', confirmButtonText: '重新生成（1 个额度）', cancelButtonText: '先不了' }) } catch { return }
  const retryKey = retryKeys.get(job.id) || createUuid(); retryKeys.set(job.id, retryKey); retrying.value = job.id
  try { const created = await platformRequest<RenderJob>(`/api/ootd/jobs/${job.id}/retry`, 'POST', {}, retryKey); retryKeys.delete(job.id); statusId.value = ''; await accepted(created) }
  catch (e) { toast.error(e instanceof Error ? e.message : String(e)) } finally { retrying.value = '' }
}
async function adjusted(job: RenderJob) { const source = viewingJob.value; sendOff.launch({ title: `身材调整 · ${describeAdjustments(job.summary?.adjustments)}（原图保留）`, cards: source?.mediaUrl ? [{ image: source.mediaUrl, label: '原图' }] : [] }); processing.trackRender(job, true); viewing.value = null; jobs.value = [job, ...jobs.value.filter(j => j.id !== job.id)]; await refresh() }
function openJob(job: RenderJob) { if (job.mediaUrl) viewing.value = job; else statusId.value = job.id }
function openFromRoute() { if (!routeJob.value || loading.value) return; const job = jobs.value.find(j => j.id === routeJob.value); if (job) openJob(job); else toast.show('这条生成记录已经不存在，可能已被删除。'); routeJob.value = '' }
function manageModels() { uni.setStorageSync('me.settings.section', 'personal'); uni.switchTab({ url: '/pages/settings/index' }) }
onLoad(query => { outfitId.value = String(query?.outfit || ''); routeJob.value = String(query?.job || '') })
onShow(async () => {
  active = true; await closet.ensureUser(); if (!closet.user) { uni.reLaunch({ url: '/pages/login/index' }); return }; if (closet.user.mustChangePassword) { uni.reLaunch({ url: '/pages/settings/index?firstLogin=1' }); return }
  const target = uni.getStorageSync('me.ootd.job'); if (target) { routeJob.value = String(target); uni.removeStorageSync('me.ootd.job') }
  await load(); clearInterval(timer); timer = setInterval(refresh, 5000)
})
onHide(() => { active = false; clearInterval(timer) }); onUnload(() => clearInterval(timer))
onPullDownRefresh(async () => { try { await load() } finally { uni.stopPullDownRefresh() } })
</script>
<template>
  <view class="page stack">
    <view><view class="heading">OOTD 试穿</view><view v-if="!preferences.minimal" class="note">选搭配、模特和动作，生成一张上身效果图。</view><wd-button plain size="small" @click="manageModels">管理模特</wd-button></view>
    <view v-if="error && !confirmOpen" class="error">{{ error }}<wd-button type="text" @click="load">重新加载</wd-button></view><wd-skeleton v-if="loading" :row-col="[1, 1, 1, 1]" />
    <template v-else>
      <view class="section stack"><view class="title">1 搭配</view><wd-picker v-model="outfitId" label="已保存搭配" :disabled="pending" :columns="outfits.map(o => ({ value: o.id, label: o.name }))" placeholder="选择组合台里保存的搭配" />
        <template v-if="current"><wd-button type="text" :disabled="pending" @click="showItems = !showItems">{{ showItems ? '收起' : '调整本次穿哪些' }}（{{ selected.length }}/{{ garments.length }} 件）</wd-button>
          <view v-if="showItems" class="stack"><wd-checkbox-group v-model="selected" :disabled="pending"><wd-checkbox v-for="g in garments" :key="g.garmentId" :model-value="g.garmentId">{{ g.garmentLabel }}</wd-checkbox></wd-checkbox-group><wd-checkbox v-model="multiLayer" :disabled="pending">多层穿法（打底 + 主体 + 外搭）</wd-checkbox><template v-if="multiLayer"><wd-picker v-for="g in garments.filter(g => selected.includes(g.garmentId))" :key="g.garmentId" v-model="wearRoles[g.garmentId]" :label="g.garmentLabel" :disabled="pending" :columns="[{ value: '', label: '按品类判断' }, { value: 'INNER', label: '打底内层' }]" placeholder="按品类判断" /></template></view>
        </template>
      </view>
      <view class="section stack"><view class="title">2 模特</view><view v-if="baselines.length" class="models"><view v-for="b in baselines" :key="b.id" class="model"><view class="model-image"><AuthImage v-if="b.mediaUrl" :src="b.mediaUrl" :width="320" /></view><wd-button size="small" :disabled="pending" :plain="baselineId !== b.id" @click="baselineId = b.id">{{ modelLabel(b) }}{{ b.currentDefault ? ' · 默认' : '' }}</wd-button></view></view><template v-else><wd-status-tip image="content" tip="还没有模特" /><wd-button @click="manageModels">去生成模特</wd-button></template></view>
      <view class="section"><view class="title">3 动作</view><PosePicker v-if="!pending" v-model="pose" :catalog="poseCatalog" :compact="preferences.minimal" @changed="loadPoses" /><view v-else class="note">请先核对上一次提交结果。</view></view>
      <view class="section stack"><wd-picker v-if="available.length > 1" v-model="model" label="生成模型" :disabled="pending" :columns="available.map(c => ({ value: c.provider + ':' + c.model, label: c.model }))" /><view class="note">{{ hint || '每张用 1 个图像额度' }}</view><view class="actions"><wd-button v-if="!preferences.minimal" plain :loading="busy" :disabled="!current || pending" @click="check()">只检查搭配</wd-button><wd-button plain @click="rehearse">模拟生成</wd-button><wd-button :loading="busy" :disabled="!current || !person || !capability" @click="prepare()">{{ pending ? '核对上次提交' : '生成 OOTD' }}</wd-button></view><view class="note">模拟生成只播放动画和完成提醒，不调用模型、不消耗额度。</view></view>
      <view class="section stack"><view class="title">{{ current ? current.name : '预览' }}</view><OutfitPreview v-if="current" :scene="current.scene" /><wd-status-tip v-else image="content" tip="选择搭配后在这里预览" />
        <template v-if="review"><view v-for="issue in review.blockers" :key="issue.message" class="error">{{ issue.message }}<view>{{ issue.action }}</view></view><view v-for="issue in review.warnings" :key="issue.code" class="note">{{ issue.message }}</view><template v-if="!preferences.minimal || review.blockers.length"><view v-for="slot in filledSlots" :key="slot.role" class="item"><view>{{ slot.label }}：{{ slot.items.map(i => i.label).join('、') || '未选择' }} <wd-tag v-if="['CONFLICT', 'UNKNOWN'].includes(slot.state)" type="danger">{{ slot.state === 'UNKNOWN' ? '资料未确认' : '冲突' }}</wd-tag></view><wd-picker v-for="i in slot.items.filter(i => i.role === 'ACCESSORY')" :key="i.garmentId" v-model="wearRoles[i.garmentId]" :label="i.label" :columns="accessoryOptions" placeholder="选择佩戴位置" /></view></template></template>
      </view>
    </template>
    <view class="row"><view class="heading">我的 OOTD {{ jobs.length || '' }}</view><wd-button type="text" @click="refresh">刷新</wd-button></view>
    <wd-status-tip v-if="!jobs.length && !loading" image="content" tip="生成的图片会保存在这里" />
    <view v-for="job in jobs" :key="job.id" class="section"><view v-if="job.mediaUrl" class="media" @tap="openJob(job)"><AuthImage :src="job.mediaUrl" :width="720" /></view><wd-button v-else block plain @click="openJob(job)">{{ adviceFor(job).label }}{{ adviceFor(job).canRetry ? ' · 点开查看' : '' }}</wd-button><wd-tag v-if="job.summary?.kind === 'ADJUST'">身材调整</wd-tag><view class="note">{{ job.summary?.kind === 'ADJUST' ? describeAdjustments(job.summary.adjustments) : [job.summary?.model, job.summary?.pose].filter(Boolean).join(' · ') || new Date(job.createdAt).toLocaleDateString() }}</view><view v-if="job.error" class="error">{{ job.error }}</view><view v-if="!job.mediaUrl" class="actions"><wd-button v-if="adviceFor(job).canCancel" size="small" plain @click="cancel(job)">取消</wd-button><wd-button v-if="adviceFor(job).canRetry" size="small" :loading="retrying === job.id" @click="retry(job)">重新生成</wd-button><wd-button v-if="adviceFor(job).canDelete" size="small" type="error" plain @click="remove(job)">删除</wd-button></view></view>
    <RenderSupport />
    <wd-popup :model-value="!!statusJob" position="bottom" closable @close="statusId = ''"><view v-if="statusJob && advice" class="sheet stack"><view class="title">{{ advice.title }}</view><wd-tag>{{ advice.label }}</wd-tag><view class="note">{{ advice.body }}</view><view>开始于 {{ new Date(statusJob.createdAt).toLocaleString('zh-CN') }}</view><view v-if="statusJob.summary?.model">模特 {{ statusJob.summary.model }}</view><view v-if="statusJob.summary?.pose">动作 {{ statusJob.summary.pose }}</view><wd-button v-if="advice.canRetry" :loading="retrying === statusJob.id" @click="retry(statusJob)">重新生成</wd-button><wd-button v-if="advice.canCancel" plain @click="cancel(statusJob)">取消生成</wd-button><wd-button v-if="advice.canDelete" type="error" plain @click="remove(statusJob)">删除这条记录</wd-button><wd-button type="text" @click="statusId = ''">关闭</wd-button></view></wd-popup>
    <wd-popup v-model="confirmOpen" position="bottom" :closable="!busy" :close-on-click-modal="!busy && !pending"><view v-if="preparation" class="sheet stack"><view class="title">确认生成</view><view v-if="error" class="error">{{ error }}</view><view class="thumb"><AuthImage v-if="person?.mediaUrl" :src="person.mediaUrl" /></view><view>模特 {{ person ? modelLabel(person) : '' }}</view><view>动作 {{ preparation.pose?.name || '自动' }}</view><view>衣物 {{ preparation.review.items.map(i => i.label).join('、') }}</view><view>额度 {{ preparation.quotaUnits }} 个图像额度</view><view v-for="issue in preparation.review.warnings" :key="issue.code" class="note">{{ issue.message }}</view><view class="note">生成图是视觉预览，不代表真实尺码是否合身。</view><wd-button :loading="busy" @click="generate">{{ pending ? '核对并重试原提交' : '生成' }}</wd-button><wd-button plain :disabled="busy" @click="confirmOpen = false">取消</wd-button></view></wd-popup>
    <ResultViewer :job="viewingJob" :can-adjust="!!available.length" @close="viewing = null" @changed="refresh" @submitted="adjusted" @remove="remove" /><wd-toast /><wd-message-box />
  </view>
</template>
<style lang="scss" scoped>@import '../../components/me/me.scss';.models { display: flex; flex-direction: column; gap: 28rpx; }.model { display: flex; flex-direction: column; gap: 16rpx; }.model-image { height: 400rpx; }.note { white-space: pre-wrap; }</style>
