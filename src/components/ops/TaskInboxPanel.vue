<script setup lang="ts">
import { computed, ref, toRef, watch, onMounted, onBeforeUnmount } from 'vue'
import { useMessage, useToast } from 'wot-design-uni'
import { useProcessingStore } from '../../stores/processing'
import { useNotificationStore } from '../../stores/notifications'
import { useClosetStore } from '../../stores/closet'
import type { ClosetTask } from '../../services/api'
import type { WaitingEntry } from '../../domain/waiting'
import type { ClosetNotification } from '../../notifications/api'
import { taskLabels, isProcessing } from '../../domain/workflow'
import AuthImage from '../AuthImage.vue'
import { go, when } from './utils'
import { useOpsPolling } from './polling'
const props = defineProps<{ tasks: ClosetTask[]; active: boolean; historyError: boolean }>()
const processing = useProcessingStore(), notices = useNotificationStore(), closet = useClosetStore(), message = useMessage('inbox'), toast = useToast('inbox')
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined
onMounted(() => { clock = setInterval(() => { now.value = Date.now() }, 1000) }); onBeforeUnmount(() => clearInterval(clock))
const shownNotices = computed(() => [...notices.unreadItems, ...notices.items.filter(item => item.read).slice(0, Math.max(0, 3 - notices.unreadItems.length))].slice(0, 8))
const recent = computed(() => props.tasks.filter(task => !processing.isHidden(task) && !processing.entries.some(entry => entry.key === `task:${task.id}` || entry.childIds.includes(task.id))).slice(0, 4))
const activeEntries = computed(() => processing.ordered.filter(e => e.state === 'processing'))
const finished = computed(() => processing.ordered.filter(e => e.state !== 'processing'))
const summary = computed(() => [processing.activeCount && `${processing.activeCount} 个处理中`, processing.unreadCount && `${processing.unreadCount} 个新结果`, notices.unread && `${notices.unread} 条提醒`].filter(Boolean).join(' · ') || '离开页面也会继续处理')
const stats = computed(() => [{ label: '处理中', count: props.tasks.filter(t => isProcessing(t.status)).length }, { label: '需检查', count: props.tasks.filter(t => ['FAILED','UNKNOWN','NEEDS_REVIEW'].includes(t.status)).length }, { label: '已完成', count: props.tasks.filter(t => t.status === 'SUCCEEDED').length }])
function waited(start: number) { const seconds = Math.max(0, Math.floor((now.value - start) / 1000)), minutes = Math.floor(seconds / 60); return minutes < 1 ? `${seconds} 秒` : minutes < 60 ? `${minutes} 分钟` : minutes < 1440 ? `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分` : `超过 ${Math.floor(minutes / 1440)} 天` }
function visit(entry: WaitingEntry) { processing.viewed(entry); go(entry.href) }
function openTask(task: ClosetTask) { if (task.garmentId) go(`/garment/${task.garmentId}?task=${task.id}`) }
async function openNotice(item: ClosetNotification) { await notices.read(item); go(item.href || '/settings?section=tidy') }
async function clearAll() {
  try { await message.confirm({ title:'清空处理中心', msg:'清空提醒、已结束的结果和任务记录？进行中的处理不受影响，完整记录仍在任务页。', confirmButtonText:'确认清空', cancelButtonText:'先不清' }) } catch { return }
  await notices.removeAll(); processing.dismissFinished(); processing.hideAllTasks()
}
watch(() => notices.latest, item => { if (item && props.active) toast.show(item.title) })
watch(() => processing.latestNotice, entry => { if (entry && props.active) toast.show(`${entry.title} · ${entry.stage}`) })
useOpsPolling(toRef(props, 'active'), () => notices.refresh(), () => 60000)
</script>
<template>
  <view class="ops-section"><view class="ops-between"><text class="ops-h2">处理中心</text><view class="ops-actions"><wd-button v-if="notices.unread" type="text" size="small" @click="notices.readAll()">全部已读</wd-button><wd-button v-if="shownNotices.length + finished.length + recent.length" type="text" size="small" @click="clearAll">清空</wd-button></view></view><view class="ops-copy">{{ summary }}</view>
    <view class="ops-actions"><view v-for="s in stats" :key="s.label" class="ops-stat"><text class="ops-stat-number">{{ s.count }}</text>{{ s.label }}</view></view>
    <view v-if="processing.connectionError" class="ops-alert ops-warning">暂时无法更新进度，稍后继续查询</view>
    <view v-if="notices.error" class="ops-alert ops-warning">提醒暂时无法更新<wd-button type="text" size="small" @click="notices.refresh()">重试</wd-button></view>
    <text v-if="shownNotices.length" class="ops-h3">提醒</text><view v-for="item in shownNotices" :key="item.id" class="ops-row"><view @tap="openNotice(item)"><view class="ops-tags"><text>{{ item.title }}</text><wd-tag v-if="!item.read" type="warning" plain>未读</wd-tag></view><view class="ops-copy">{{ item.body }}</view><view class="ops-meta">{{ when(item.createdAt) }}</view></view><view class="ops-actions"><wd-button type="text" size="small" @click="openNotice(item)">查看</wd-button><wd-button type="text" size="small" @click="notices.remove(item)">删除这条提醒</wd-button></view></view>
    <wd-status-tip v-if="!processing.entries.length && !recent.length && !shownNotices.length && !historyError" image="content" tip="一切都处理好了"><view class="ops-copy">上传衣物后，整理进度会出现在这里</view></wd-status-tip>
    <template v-for="group in [{ title: '进行中', entries: activeEntries }, { title: '最近结果', entries: finished }]" :key="group.title"><text v-if="group.entries.length" class="ops-h3">{{ group.title }}</text><view v-for="entry in group.entries" :key="entry.key" class="ops-row"><view class="ops-media-row" @tap="visit(entry)"><view v-if="entry.thumb" class="ops-thumb"><AuthImage :src="entry.thumb" :width="160" /></view><view class="ops-grow"><view class="ops-tags"><text>{{ entry.title }}</text><wd-tag v-if="!entry.read && entry.state !== 'processing'" type="success" plain>新结果</wd-tag></view><view class="ops-copy">{{ entry.stage }}</view><wd-loading v-if="entry.state === 'processing'" size="28rpx" /><view class="ops-meta">{{ entry.state === 'processing' ? `已等待 ${waited(entry.startedAt)}` : entry.note || when(entry.startedAt) }}</view><view v-if="entry.kind === 'render' && entry.state === 'processing'" class="ops-meta">{{ entry.note }}</view></view></view><view class="ops-actions"><wd-button size="small" plain @click="visit(entry)">{{ entry.state === 'processing' ? '进度' : entry.kind === 'render' && entry.state === 'ready' ? '去看看' : entry.state === 'ready' ? '去核对' : '查看' }}</wd-button><wd-button v-if="entry.state !== 'processing'" type="text" size="small" @click="processing.dismiss(entry)">从处理中心移除</wd-button></view></view></template>
    <text v-if="recent.length" class="ops-h3">任务记录</text><view v-for="task in recent" :key="task.id" class="ops-row"><view @tap="openTask(task)"><text>{{ task.title || '新上传衣物' }}</text><view class="ops-meta">{{ task.mode }} · {{ when(task.createdAt) }} · {{ taskLabels[task.status] }}</view></view><view class="ops-actions"><wd-button v-if="task.garmentId" type="text" size="small" @click="openTask(task)">查看</wd-button><wd-button v-if="!isProcessing(task.status)" type="text" size="small" @click="processing.hideTask(task)">隐藏这条任务记录</wd-button></view></view>
    <view v-if="historyError" class="ops-copy">任务记录暂时无法读取</view><view class="ops-actions"><wd-button plain size="small" @click="go('/pending')">未入柜 {{ closet.pendingCount || '' }}</wd-button></view><view class="ops-meta">站内提醒仅在小程序打开时生效，处理不受页面关闭影响</view>
  </view><wd-toast selector="inbox" /><wd-message-box selector="inbox" />
</template>
<style scoped lang="scss">@import './shared.scss';</style>
