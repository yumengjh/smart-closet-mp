<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow, onHide, onPullDownRefresh } from '@dcloudio/uni-app'
import { useMessage } from 'wot-design-uni'
import { closetApi, type ClosetTask } from '../../services/api'
import { taskLabels, isProcessing } from '../../domain/workflow'
import { useClosetStore } from '../../stores/closet'
import { useProcessingStore } from '../../stores/processing'
import ExecutionTasks from '../../components/ops/ExecutionTasks.vue'
import RenderTasksOverview from '../../components/ops/RenderTasksOverview.vue'
import TaskInboxPanel from '../../components/ops/TaskInboxPanel.vue'
import AssistantEntry from '../../components/assistant/AssistantEntry.vue'
import AuthImage from '../../components/AuthImage.vue'
import { go, when, errorText } from '../../components/ops/utils'
import { useOpsPolling } from '../../components/ops/polling'
import { useAppearance } from '../../composables/useAppearance'
const { pageStyle, minimal } = useAppearance()
const message = useMessage(), tasks = ref<ClosetTask[]>([]), active = ref(false), loading = ref(true), error = ref(''), cancelling = ref(''), filter = ref('全部')
const closet = useClosetStore(), processing = useProcessingStore()
let delay = 2000
const runningCount = computed(() => tasks.value.filter(t => isProcessing(t.status)).length)
const needsCheck = (t: ClosetTask) => ['FAILED','UNKNOWN','NEEDS_REVIEW'].includes(t.status)
const matches = (t: ClosetTask, name: string) => name === '全部' || (name === '处理中' ? isProcessing(t.status) : name === '需检查' ? needsCheck(t) : !isProcessing(t.status))
const filtered = computed(() => tasks.value.filter(t => matches(t, filter.value)))
const filters = computed(() => ['全部','处理中','已结束','需检查'].map(name => ({ name, title: `${name} ${tasks.value.filter(t => matches(t, name)).length}` })))
const stepNote = (s: ClosetTask['steps'][number]) => s.status === 'skipped' ? s.name === '制作贴纸' ? '尚未制作' : '已跳过' : s.status === 'review' ? '需检查' : ''
async function load() { try { tasks.value = await closetApi.tasks(); error.value = ''; delay = 2000 } catch (e) { error.value = errorText(e, '任务暂时无法加载。'); delay = Math.min(delay * 2, 30000) } finally { loading.value = false } }
async function cancel(task: ClosetTask) {
  try { await message.confirm({ title:'取消这次处理？', msg:'原图与已完成步骤的图片会保留，需要等待服务端终止任务。', confirmButtonText:'取消处理', cancelButtonText:'继续等待' }) } catch { return }
  cancelling.value = task.id
  try { await closetApi.cancel(task.id); await load() } catch (e) { error.value = errorText(e, '取消失败。') } finally { cancelling.value = '' }
}
function visit(task: ClosetTask) { if (task.garmentId) go(`/garment/${task.garmentId}?task=${task.id}`) }
onShow(async () => { await closet.ensureUser(); active.value = true })
onHide(() => { active.value = false })
onPullDownRefresh(async () => { try { await Promise.all([load(), processing.refresh(true)]) } finally { uni.stopPullDownRefresh() } })
useOpsPolling(active, load, () => runningCount.value || error.value ? delay : 15000)
</script>
<template><page-meta :page-style="pageStyle" />
  <view class="page ops-page"><view class="ops-heading"><text class="ops-title">任务记录</text><view v-if="!minimal" class="ops-subtitle">每件衣物从上传到入柜的处理步骤和结果。快速入柜会自动完成，其他整理方式可以逐件核对。</view><wd-tag v-if="runningCount" type="primary" plain>{{ runningCount }} 项处理中</wd-tag><AssistantEntry v-if="runningCount" from="tasks" waiting label="等待时聊聊" /></view>
    <TaskInboxPanel :tasks="tasks" :active="active" :history-error="!!error" /><ExecutionTasks :tasks="tasks" :active="active" /><RenderTasksOverview :active="active" />
    <wd-tabs v-model="filter"><wd-tab v-for="f in filters" :key="f.name" :name="f.name" :title="f.title" /></wd-tabs><view class="ops-meta">显示最近 50 项</view>
    <view v-if="error" class="ops-alert ops-warning">无法更新任务状态：{{ error }}，正在重新连接。<wd-button type="text" size="small" @click="load">重试</wd-button></view>
    <wd-skeleton v-if="loading" :row-col="[1,1,1,1,1,1]" animation="gradient" />
    <view v-for="task in filtered" v-else-if="filtered.length" :key="task.id" class="ops-section"><view class="ops-media-row"><view><view class="ops-thumb"><AuthImage v-if="task.outputUrl || task.inputUrl" :src="task.outputUrl || task.inputUrl" :width="320" /><wd-icon v-else name="picture" size="48rpx" /></view><view class="ops-meta">{{ task.outputUrl && task.outputUrl !== task.inputUrl ? '结果' : '原图' }}</view></view><view class="ops-grow"><view class="ops-tags"><text class="ops-h3">{{ task.title }}</text><wd-tag :type="needsCheck(task) ? 'warning' : 'primary'" plain>{{ taskLabels[task.status] }}</wd-tag></view><view class="ops-meta">{{ task.mode }} · {{ when(task.createdAt) }}</view><view class="ops-tags"><wd-tag v-for="(step,i) in task.steps" :key="i" :type="step.status === 'failed' ? 'danger' : step.status === 'completed' ? 'success' : step.status === 'review' ? 'warning' : 'default'" plain>{{ step.status === 'running' ? '处理中 · ' : step.status === 'completed' ? '✓ ' : '' }}{{ step.name }} {{ stepNote(step) }}</wd-tag></view></view></view><view v-if="task.note" class="ops-alert ops-warning">{{ task.note }}</view><view class="ops-actions"><wd-button v-if="task.garmentId" size="small" @click="visit(task)">{{ isProcessing(task.status) ? '查看进度' : needsCheck(task) ? '去检查' : '查看结果' }}</wd-button><wd-button v-if="isProcessing(task.status)" size="small" plain :disabled="task.status === 'CANCEL_REQUESTED' || !!cancelling" :loading="cancelling === task.id" @click="cancel(task)">取消</wd-button></view></view>
    <view v-else class="ops-section"><wd-status-tip image="content" :tip="`没有${filter === '全部' ? '' : filter}任务`" /><view class="ops-copy">上传衣物后，服务端保存的处理记录会显示在这里。</view><view class="ops-actions"><wd-button plain @click="go('/add')">添加衣物</wd-button></view></view>
  </view><wd-message-box />
</template>
<style scoped lang="scss">@import '../../components/ops/shared.scss';</style>
