<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import { useMessage, useToast } from 'wot-design-uni'
import { platformRequest, type RenderJob } from '../../services/platform'
import { when, go, errorText } from './utils'
import { useOpsPolling } from './polling'
const props = defineProps<{ active: boolean }>()
const message = useMessage('renders'), toast = useToast('renders'), jobs = ref<RenderJob[]>([]), error = ref(''), cancelling = ref('')
const visible = computed(() => jobs.value.filter(j => ['QUEUED','WAITING_RESOURCE','RUNNING','CANCEL_REQUESTED','FAILED','UNKNOWN','DELETE_PENDING'].includes(j.status)).slice(0,20))
const states: Record<string,string> = { QUEUED:'排队中', WAITING_RESOURCE:'等待资源', RUNNING:'生成中', CANCEL_REQUESTED:'停止发布中', FAILED:'未完成', UNKNOWN:'结果未知', DELETE_PENDING:'正在清理图片' }
async function load() { try { jobs.value = await platformRequest('/api/me/image-render-jobs'); error.value = '' } catch(e) { error.value = errorText(e, '生成状态暂时无法更新') } }
async function cancel(job: RenderJob) {
  if (cancelling.value) return
  try { await message.confirm({ title:'取消这次生成？', msg:'本平台将停止后续发布；已发出的请求无法保证上游停止或退还额度。', confirmButtonText:'取消任务', cancelButtonText:'继续等待' }) } catch { return }
  cancelling.value = job.id
  try { await platformRequest(`/api/me/image-render-jobs/${job.id}/cancel`, 'POST', {}); await load() } catch(e) { toast.error(errorText(e, '取消失败。')) } finally { cancelling.value = '' }
}
const title = (job: RenderJob) => job.purpose === 'BASELINE' ? '模特形象' : job.summary?.kind === 'ADJUST' ? '身材调整图' : ['OOTD 穿搭图', job.summary?.pose].filter(Boolean).join(' · ')
useOpsPolling(toRef(props, 'active'), load, () => error.value ? 15000 : 5000)
</script>
<template>
  <view v-if="visible.length || error" class="ops-section"><text class="ops-h2">人物与穿搭图生成</text><view class="ops-copy">只列出生成中或需要检查的图片，做好的结果保存在各自页面。</view>
    <view class="ops-actions"><wd-button type="text" @click="go('/settings?section=personal')">我的模特</wd-button><wd-button type="text" @click="go('/ootd')">OOTD 记录</wd-button></view>
    <view v-if="error" class="ops-alert ops-warning">生成状态暂时无法更新：{{ error }}</view>
    <view v-for="job in visible" :key="job.id" class="ops-row"><view class="ops-tags"><text>{{ title(job) }}</text><wd-tag plain>{{ states[job.status] || job.status }}</wd-tag></view><view v-if="job.status === 'UNKNOWN'" class="ops-copy">已经发出，结果尚不确定；为免重复扣额度，不会自动重发。</view><view v-else-if="job.error" class="ops-copy">{{ job.error }}</view><view class="ops-meta">开始于 {{ when(job.createdAt) }}</view><view class="ops-actions"><wd-button v-if="job.purpose === 'OOTD' && ['UNKNOWN','FAILED'].includes(job.status)" size="small" @click="go(`/ootd?job=${job.id}`)">查看并重新生成</wd-button><wd-button v-if="['QUEUED','WAITING_RESOURCE','RUNNING','UNKNOWN'].includes(job.status)" size="small" plain :disabled="!!cancelling" :loading="cancelling === job.id" @click="cancel(job)">取消生成</wd-button></view></view>
  </view><wd-toast selector="renders" /><wd-message-box selector="renders" />
</template>
<style scoped lang="scss">@import './shared.scss';</style>
