<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useToast, useMessage } from 'wot-design-uni'
import AuthImage from '../AuthImage.vue'
import { platformRequest, PlatformRequestError, type Profile, type ProfileSnapshot, type Baseline, type Capability, type RenderJob, type RenderSubmission } from '../../services/platform'
import { upload, HttpError } from '../../services/http'
import { appVisible } from '../../services/lifecycle'
import { createUuid } from '../../domain/id'
import { modelLabel } from './labels'
import { useProcessingStore } from '../../stores/processing'
import { useSendOffStore } from '../../stores/sendOff'
const toast = useToast(), message = useMessage(), processing = useProcessingStore(), sendOff = useSendOffStore()
const profile = ref<Profile>({ revision: 0, sex: null, heightCm: null, weightKg: null, bodyShape: null, measurements: {}, preferences: {}, defaultBaselineId: null })
const savedProfile = ref(''), dirty = computed(() => JSON.stringify(profile.value) !== savedProfile.value)
const baselines = ref<Baseline[]>([]), photos = ref<{ id: string; url: string }[]>([]), capabilities = ref<Capability[]>([]), renderJobs = ref<RenderJob[]>([])
const loading = ref(true), saving = ref(false), generating = ref(false), generateOpen = ref(false), error = ref(''), notice = ref('')
const pending = ref(false), lookupUncertain = ref(false), key = ref(createUuid()), preview = ref<ProfileSnapshot | null>(null)
const selectedModel = ref(''), photo = ref(''), selectedPhoto = ref(''), newName = ref(''), renaming = ref<Baseline | null>(null), renameValue = ref('')
const attempt = ref<{ request: { profileRevision: number; provider: string; model: string; photoId?: string; name?: string }; file: string } | null>(null)
const choices = computed(() => capabilities.value.filter(c => c.verified && c.purpose === 'BASELINE'))
const capability = computed(() => choices.value.find(c => c.provider + ':' + c.model === selectedModel.value))
const measurements = [{ key: 'chest', label: '胸围' }, { key: 'waist', label: '腰围' }, { key: 'hips', label: '臀围' }]
const preferences = [{ key: 'fit', label: '合身偏好' }, { key: 'style', label: '穿搭风格' }, { key: 'thermal', label: '冷暖偏好' }, { key: 'dislikes', label: '不喜欢的元素' }]
const states: Record<string, string> = { QUEUED: '排队中', WAITING_RESOURCE: '等待资源', RUNNING: '生成中', SUCCEEDED: '待确认', FAILED: '生成失败', UNKNOWN: '生成结果待核对', CANCEL_REQUESTED: '正在取消', CANCELLED: '已取消' }
let timer: ReturnType<typeof setInterval> | undefined
async function load() {
  try {
    const [p, b, c, ps, j] = await Promise.all([platformRequest<Profile>('/api/me/wearer-profile'), platformRequest<Baseline[]>('/api/me/person-baselines'), platformRequest<Capability[]>('/api/render-capabilities'), platformRequest<{ id: string; url: string }[]>('/api/me/reference-photos'), platformRequest<RenderJob[]>('/api/me/image-render-jobs')])
    profile.value = p; savedProfile.value = JSON.stringify(p); baselines.value = b; capabilities.value = c; photos.value = ps; renderJobs.value = j
    if (!capability.value) selectedModel.value = choices.value[0] ? choices.value[0].provider + ':' + choices.value[0].model : ''
    error.value = ''
  } catch (e) { error.value = e instanceof Error ? e.message : String(e) }
  finally { loading.value = false }
}
async function refreshResults() {
  if (!appVisible()) return
  try { const [b, j] = await Promise.all([platformRequest<Baseline[]>('/api/me/person-baselines'), platformRequest<RenderJob[]>('/api/me/image-render-jobs')]); baselines.value = b; renderJobs.value = j }
  catch (e) { error.value = e instanceof Error ? e.message : String(e) }
}
async function save() {
  if (saving.value) return
  saving.value = true
  try {
    const p = { ...profile.value, heightCm: profile.value.heightCm ? Number(profile.value.heightCm) : null, weightKg: profile.value.weightKg ? Number(profile.value.weightKg) : null, measurements: Object.fromEntries(Object.entries(profile.value.measurements).filter(([, v]) => v != null && String(v) !== '').map(([k, v]) => [k, Number(v)])) }
    profile.value = await platformRequest('/api/me/wearer-profile', 'PUT', p); savedProfile.value = JSON.stringify(profile.value); toast.success('个人资料已保存，人物不会自动重新生成。'); error.value = ''
  } catch (e) { error.value = e instanceof Error ? e.message : String(e) }
  finally { saving.value = false }
}
function choosePhoto() {
  uni.chooseMedia({ count: 1, mediaType: ['image'], success: r => {
    const f = r.tempFiles[0]; if (!f) return
    if (f.size > 20 * 1024 * 1024 || !/\.(png|jpe?g)$/i.test(f.tempFilePath)) { toast.error('请选择20MB以内的JPG或PNG照片。'); return }
    photo.value = f.tempFilePath; selectedPhoto.value = ''
  } })
}
async function prepare() {
  if (pending.value) { generateOpen.value = true; return }
  if (dirty.value) { toast.show('请先保存当前个人资料，再核对生成输入。'); return }
  notice.value = ''; attempt.value = null
  try { preview.value = await platformRequest('/api/me/wearer-profile/render-preview'); key.value = createUuid(); generateOpen.value = true }
  catch (e) { toast.error(e instanceof Error ? e.message : String(e)) }
}
async function accepted(job: RenderJob) {
  sendOff.launch({ title: '正在画你的专属模特', cards: [{ image: attempt.value?.file || photos.value.find(p => p.id === attempt.value?.request.photoId)?.url, label: '参考照片' }] })
  processing.trackRender(job, true); pending.value = false; lookupUncertain.value = false; attempt.value = null; notice.value = ''; generateOpen.value = false; photo.value = ''; newName.value = ''; await load()
}
async function reconcile() {
  notice.value = '正在核对这次提交是否已创建任务，不会重复生图。'
  try {
    const r = await platformRequest<RenderSubmission>(`/api/me/image-render-submissions/${encodeURIComponent(key.value)}`, 'GET', undefined, undefined, { timeoutMs: 10000 })
    if (r.found && r.job) { await accepted(r.job); return }
    lookupUncertain.value = false; notice.value = '暂未查到这次任务。可再次核对，或重新提交同一任务；会保留原提交编号，避免重复生成。'
  } catch { lookupUncertain.value = true; notice.value = '连接仍未恢复，尚无法确认任务是否创建。请点击“核对提交结果”，暂不重复上传或生图。' }
}
async function checkSubmission() { if (generating.value) return; generating.value = true; try { await reconcile() } finally { generating.value = false } }
async function generate() {
  if (generating.value || !preview.value || !capability.value) return
  if (pending.value && lookupUncertain.value) { await checkSubmission(); return }
  generating.value = true; notice.value = photo.value ? '正在上传照片并提交人物任务，请勿重复点击。提交成功后会自动关闭此窗口。' : '正在提交人物任务，请勿重复点击。提交成功后会自动关闭此窗口。'
  attempt.value ||= { request: { profileRevision: preview.value.profileRevision, provider: capability.value.provider, model: capability.value.model, photoId: selectedPhoto.value || undefined, name: newName.value.trim() || undefined }, file: photo.value }
  try {
    const a = attempt.value
    const job = a.file ? await upload<RenderJob>('/api/me/person-baselines/upload-and-generate', a.file, { formData: { request: JSON.stringify(a.request) }, jsonFields: ['request'], idempotencyKey: key.value, timeoutMs: 60000 }) : await platformRequest<RenderJob>('/api/me/person-baselines', 'POST', a.request, key.value, { timeoutMs: 60000 })
    await accepted(job)
  } catch (e) {
    if ((e instanceof PlatformRequestError || e instanceof HttpError) && e.uncertain) { pending.value = true; lookupUncertain.value = true; await reconcile() }
    else { pending.value = false; attempt.value = null; notice.value = e instanceof Error ? e.message : String(e) }
  } finally { generating.value = false }
}
async function confirm(b: Baseline, makeDefault: boolean) {
  try { await platformRequest(`/api/me/person-baselines/${b.id}/confirm`, 'POST', { revision: b.revision, makeDefault }); await refreshResults(); if (makeDefault) { const changed = dirty.value; profile.value.defaultBaselineId = b.id; if (!changed) savedProfile.value = JSON.stringify(profile.value) }; toast.success(makeDefault ? '已设为默认模特。' : '模特已确认，可在 OOTD 中使用。') }
  catch (e) { toast.error(e instanceof Error ? e.message : String(e)) }
}
function startRename(b: Baseline) { renaming.value = b; renameValue.value = b.name || '' }
async function rename() { if (!renaming.value) return; try { await platformRequest(`/api/me/person-baselines/${renaming.value.id}`, 'PATCH', { name: renameValue.value }); renaming.value = null; await refreshResults() } catch (e) { toast.error(String(e)) } }
function isStale(b: Baseline) { const p = profile.value, h = p.heightCm || (p.sex === 'MALE' ? 170 : 160), w = p.weightKg || Math.round(22 * (h / 100) ** 2 * 10) / 10; return p.sex !== b.profile.sex || Number(h) !== b.profile.heightCm || Number(w) !== b.profile.weightKg || (p.bodyShape?.trim() || '标准身材') !== b.profile.bodyShape }
function jobFor(b: Baseline) { return renderJobs.value.find(j => j.baselineId === b.id && j.purpose === 'BASELINE') }
async function remove(b: Baseline) {
  try { await message.confirm({ title: `删除模特「${modelLabel(b)}」？`, msg: '已生成的 OOTD 和参考照片会保留；正在用这位模特生成的任务会停止。', confirmButtonText: '删除', cancelButtonText: '取消' }) } catch { return }
  try { await platformRequest(`/api/me/person-baselines/${b.id}`, 'DELETE', { revision: b.revision }); await load() } catch (e) { toast.error(String(e)) }
}
async function deletePhoto(id: string) {
  try { await message.confirm({ title: '仅删除这张原始参考照片？', msg: '这张上传照片会永久清理，已经生成的基准人物和 OOTD 保留。正在直接使用此照片生成人物的任务会停止发布。', confirmButtonText: '删除原照', cancelButtonText: '取消' }) } catch { return }
  try { await platformRequest(`/api/me/reference-photos/${id}`, 'DELETE'); await load() } catch (e) { toast.error(String(e)) }
}
function goOotd() { uni.switchTab({ url: '/pages/ootd/index' }) }
onMounted(() => { void load(); timer = setInterval(refreshResults, 5000) })
onUnmounted(() => clearInterval(timer))
</script>
<template>
  <view class="stack">
    <view v-if="error" class="error">{{ error }}<wd-button type="text" @click="load">重新加载</wd-button></view>
    <wd-skeleton v-if="loading" :row-col="[1, 1, 1, 1]" />
    <view v-else class="section stack">
      <view><view class="title">个人资料</view><view class="note">除性别外都可以不填，生成模特时会用示意默认值。</view></view>
      <wd-radio-group v-model="profile.sex" shape="button" inline><wd-radio value="MALE">男</wd-radio><wd-radio value="FEMALE">女</wd-radio></wd-radio-group>
      <wd-input v-model="profile.heightCm" label="身高（cm）" type="digit" placeholder="未填写" />
      <wd-input v-model="profile.weightKg" label="体重（kg）" type="digit" placeholder="未填写" />
      <wd-input v-model="profile.bodyShape" label="身材特点" :maxlength="500" placeholder="例如：肩较宽、梨形身材" />
      <wd-input v-for="m in measurements" :key="m.key" v-model="profile.measurements[m.key]" :label="m.label + '（cm）'" type="digit" placeholder="可选" />
      <view class="title">穿搭偏好</view>
      <wd-input v-for="p in preferences" :key="p.key" v-model="profile.preferences[p.key]" :label="p.label" :maxlength="500" placeholder="可选" />
      <view v-if="dirty" class="note">有未保存的修改</view><wd-button :loading="saving" @click="save">保存资料</wd-button>
    </view>
    <view class="section stack">
      <view><view class="title">参考照片（可选）</view><view class="note">上传一张全身照或半身照，模特会更像你；不传也能生成。照片只用于生成模特，不会直接用于 OOTD。</view></view>
      <wd-button :disabled="pending || generating" @click="choosePhoto">选择全身照或半身照</wd-button>
      <wd-picker v-if="photos.length" v-model="selectedPhoto" label="复用参考照片" :disabled="!!photo || pending || generating" :columns="[{ value: '', label: '不使用' }, ...photos.map((p, i) => ({ value: p.id, label: '参考照片 ' + (i + 1) }))]" placeholder="可选：复用已上传照片" />
      <view v-if="photo"><view class="thumb"><AuthImage :src="photo" previewable /></view><view class="note">尚未上传，确认生成人物时一起提交</view><wd-button :disabled="pending || generating" @click="photo = ''">移除本次照片</wd-button></view>
      <view v-if="photos.length" class="title">原始参考照片</view>
      <view v-for="p in photos" :key="p.id"><view class="media"><AuthImage :src="p.url" :width="720" previewable /></view><wd-button type="error" plain @click="deletePhoto(p.id)">仅删除原照</wd-button></view>
    </view>
    <view class="section stack">
      <view><view class="title">我的模特</view><view class="note">可以保留多位模特（例如不同发型、不同照片），OOTD 时任选一位。未填的资料按示意默认值生成（男 170 cm、女 160 cm、BMI 22），不写回资料。</view><wd-button type="text" @click="goOotd">去 OOTD 试穿 ↗</wd-button></view>
      <view v-if="pending" class="note">上一次提交结果尚未核对，请继续核对原任务，避免重复生成。</view>
      <view v-if="!choices.length" class="note">暂时没有可用的生成模型，资料可以先保存。</view><view v-if="!profile.sex" class="note">先在上方选择性别并保存，才能生成模特。</view>
      <view class="actions"><wd-button :disabled="!profile.sex" @click="prepare">{{ pending ? '核对上次提交' : photo ? '用照片生成新模特' : '生成新模特' }}</wd-button><wd-button plain @click="refreshResults">刷新</wd-button></view>
      <wd-status-tip v-if="!baselines.length" image="content" tip="还没有模特，生成后在这里确认" />
      <view v-for="b in baselines" :key="b.id" class="item">
        <view v-if="b.mediaUrl" class="media"><AuthImage :src="b.mediaUrl" :width="720" previewable /></view>
        <view class="title">{{ modelLabel(b) }}</view><wd-tag>{{ b.currentDefault ? '默认' : b.status === 'CANDIDATE' ? '待确认' : b.status === 'CONFIRMED' ? '已确认' : states[jobFor(b)?.status || ''] || (b.status === 'GENERATING' ? '生成中' : b.status) }}</wd-tag>
        <view class="note">资料版本 {{ b.profile.profileRevision }}</view><view v-if="jobFor(b)?.error" class="error">{{ jobFor(b)?.error }}</view><view v-if="isStale(b)" class="note">基于旧资料生成</view>
        <view class="actions"><wd-button v-if="b.status === 'CANDIDATE'" size="small" @click="confirm(b, false)">确认可用</wd-button><wd-button v-if="['CANDIDATE', 'CONFIRMED'].includes(b.status) && !b.currentDefault" size="small" @click="confirm(b, true)">设为默认</wd-button><wd-button size="small" plain @click="startRename(b)">改名</wd-button><wd-button size="small" type="error" plain @click="remove(b)">删除</wd-button></view>
      </view>
    </view>
    <wd-popup v-model="generateOpen" position="bottom" :closable="!generating" :close-on-click-modal="!generating && !pending">
      <view v-if="preview" class="sheet stack"><view class="title">生成新模特</view>
        <wd-input v-model="newName" :maxlength="20" :disabled="generating || pending" placeholder="给模特起个名字（可选），例如：长发的我" />
        <view v-if="notice" class="note">{{ notice }}</view>
        <view>性别 {{ preview.sex === 'MALE' ? '男' : '女' }}</view><view>身高 {{ preview.heightCm }} cm · {{ preview.sources.heightCm === 'USER_REPORTED' ? '已填写' : '生成默认值' }}</view><view>体重 {{ preview.weightKg }} kg · {{ preview.sources.weightKg === 'USER_REPORTED' ? '已填写' : '示意计算值' }}</view><view>身材 {{ preview.bodyShape }}</view>
        <view class="note">全身自然站姿，素色短袖、及膝短裤与平底鞋。每次一张，使用 1 个图像额度。</view>
        <wd-picker v-model="selectedModel" label="人物生成模型" :disabled="generating || pending" :columns="choices.map(c => ({ value: c.provider + ':' + c.model, label: c.provider + ' / ' + c.model }))" placeholder="选择已验证模型" />
        <view class="note">{{ photo || selectedPhoto ? '本次使用参考照片。照片仅用于建立基准人物，不直接用于 OOTD。' : '本次不使用照片，根据资料与模板生成人物。' }}</view>
        <wd-button :disabled="!capability || generating || (pending && lookupUncertain)" :loading="generating" @click="generate">{{ generating ? '正在提交 / 核对，请稍候' : pending ? '重新提交同一任务' : photo ? '上传照片并生成' : '生成（1 个图像额度）' }}</wd-button>
        <wd-button v-if="pending" :disabled="generating" @click="checkSubmission">核对提交结果</wd-button>
      </view>
    </wd-popup>
    <wd-popup :model-value="!!renaming" position="bottom" closable @close="renaming = null"><view class="sheet stack"><view class="title">模特改名</view><wd-input v-model="renameValue" :maxlength="20" label="模特名称" /><wd-button @click="rename">保存</wd-button><wd-button plain @click="renaming = null">取消</wd-button></view></wd-popup>
    <wd-toast /><wd-message-box />
  </view>
</template>
<style lang="scss" scoped>@import './me.scss';</style>
