<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useToast } from 'wot-design-uni'
import { platformRequest, PlatformRequestError, type BodyAdjustments, type RenderJob, type RenderSubmission } from '../../services/platform'
import { resolveMedia } from '../../services/media'
import { createUuid } from '../../domain/id'
import { BODY_DIMENSIONS, describeAdjustments } from './body-adjust'
import AuthImage from '../AuthImage.vue'
const props = defineProps<{ job: RenderJob | null; canAdjust: boolean }>()
const emit = defineEmits<{ close: []; changed: []; submitted: [RenderJob]; remove: [RenderJob] }>()
const toast = useToast(), adjusting = ref(false), values = ref<Required<BodyAdjustments>>({ build: 0, shoulders: 0, waist: 0, hips: 0, legs: 0 }), busy = ref(false), key = ref(createUuid()), notice = ref('')
const feedbackOpen = ref(false), feedback = ref(''), feedbackBusy = ref(false), pending = ref(false), attempt = ref<BodyAdjustments | null>(null)
const touched = computed(() => Object.values(values.value).some(v => v !== 0))
watch(() => props.job?.id, () => { adjusting.value = false; reset(); notice.value = ''; feedbackOpen.value = false })
function reset() { values.value = { build: 0, shoulders: 0, waist: 0, hips: 0, legs: 0 }; key.value = createUuid(); pending.value = false; attempt.value = null }
function close() { if (!busy.value) emit('close') }
async function reconcile() {
  const r = await platformRequest<RenderSubmission>(`/api/me/image-render-submissions/${encodeURIComponent(key.value)}`, 'GET', undefined, undefined, { timeoutMs: 10000 })
  if (r.found && r.job) { done(r.job); return true }; return false
}
async function submit() {
  if (!props.job || !touched.value || busy.value) return
  busy.value = true; notice.value = ''
  try {
    if (pending.value && await reconcile()) return
    attempt.value ||= { ...values.value }
    done(await platformRequest<RenderJob>(`/api/ootd/jobs/${props.job.id}/adjustments`, 'POST', attempt.value, key.value, { timeoutMs: 60000 }))
  } catch (e) {
    if (e instanceof PlatformRequestError && e.uncertain) {
      pending.value = true
      try { if (await reconcile()) return; notice.value = '暂未查到这次调整。再点一次会复用原提交编号，不会重复生成。' }
      catch { notice.value = '连接仍未恢复，暂时无法确认是否已提交。请稍后在生成记录里查看。' }
    } else notice.value = e instanceof Error ? e.message : String(e)
  } finally { busy.value = false }
}
function done(job: RenderJob) { adjusting.value = false; reset(); emit('submitted', job) }
function openFeedback() { feedback.value = props.job?.feedback || ''; feedbackOpen.value = true }
async function saveFeedback() {
  if (!props.job || feedbackBusy.value) return
  feedbackBusy.value = true
  try { await platformRequest(`/api/ootd/jobs/${props.job.id}/feedback`, 'PUT', { content: feedback.value }); feedbackOpen.value = false; emit('changed'); toast.success('反馈已保存。') }
  catch (e) { toast.error(String(e)) } finally { feedbackBusy.value = false }
}
async function saveImage() {
  if (!props.job?.mediaUrl) return
  try { const filePath = await resolveMedia(props.job.mediaUrl); await uni.saveImageToPhotosAlbum({ filePath }); toast.success('图片已保存。') }
  catch (e) { toast.error(e instanceof Error ? e.message : '图片未能保存，请检查相册权限后重试。') }
}
</script>
<template>
  <wd-popup :model-value="!!job" position="bottom" :closable="!busy" :close-on-click-modal="!busy" @close="close">
    <view v-if="job" class="sheet stack"><view class="title">OOTD 生成结果</view><view class="media"><AuthImage v-if="job.mediaUrl" :src="job.mediaUrl" previewable /></view>
      <view class="actions"><wd-tag v-if="job.summary?.kind === 'ADJUST'">身材调整</wd-tag><wd-tag v-if="job.summary?.model">{{ job.summary.model }}</wd-tag><wd-tag v-if="job.summary?.pose">动作 · {{ job.summary.pose }}</wd-tag></view><view class="note">{{ new Date(job.createdAt).toLocaleString('zh-CN') }}</view><view v-if="job.summary?.adjustments" class="note">{{ describeAdjustments(job.summary.adjustments) }}</view>
      <template v-if="!adjusting"><wd-button v-if="canAdjust" @click="adjusting = true">调节身材</wd-button><wd-button v-if="job.mediaUrl" plain @click="saveImage">保存图片</wd-button><view class="actions"><wd-button plain @click="openFeedback">反馈</wd-button><wd-button type="error" plain @click="emit('remove', job)">删除</wd-button></view><view v-if="job.feedback" class="note">我的反馈：{{ job.feedback }}</view></template>
      <view v-else class="stack"><view class="title">调节身材</view><view v-for="d in BODY_DIMENSIONS" :key="d.key" class="item"><view>{{ d.label }}</view><wd-slider v-model="values[d.key]" :min="-2" :max="2" :step="1" :disabled="busy || pending" /><view class="row note"><text>{{ d.less }}</text><text>不变</text><text>{{ d.more }}</text></view></view>
        <view class="note">{{ touched ? describeAdjustments(values) : '拖动滑块选择要调整的部位' }}</view><view v-if="notice" class="error">{{ notice }}</view><view class="note">生成一张新图，用 1 个图像额度；原图保留。</view><view class="actions"><wd-button :disabled="busy || pending" plain @click="adjusting = false; reset()">取消</wd-button><wd-button :disabled="!touched" :loading="busy" @click="submit">{{ pending ? '核对并重试原提交' : '生成' }}</wd-button></view>
      </view><wd-button type="text" :disabled="busy" @click="close">关闭</wd-button>
    </view>
    <wd-toast />
  </wd-popup>
  <wd-popup v-model="feedbackOpen" position="bottom" closable><view class="sheet stack"><view class="title">反馈这张图</view><wd-textarea v-model="feedback" :maxlength="1000" show-word-limit auto-height placeholder="人物不像、衣服不对、花纹变了……" /><wd-button :loading="feedbackBusy" @click="saveFeedback">保存</wd-button><wd-button plain @click="feedbackOpen = false">取消</wd-button></view></wd-popup>
</template>
<style lang="scss" scoped>@import './me.scss';</style>
