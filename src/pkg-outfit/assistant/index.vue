<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref } from 'vue'
import { onLoad, onReady, onUnload } from '@dcloudio/uni-app'
import { useMessage, useToast } from 'wot-design-uni'
import { agentRequest, streamMessage, type AgentMessage, type AgentSession, type Memory, type Models, type Quota } from '../../agent/api'
import { discardSessionTrace, flushBoardTrace } from '../../agent/trace-client'
import { handleCanvasCommand, failCanvasExecution, canvasExecution } from '../../services/outfit-runtime'
import { navigateOutfitLink, outfitStreamAbort, pageContext } from '../../services/outfit'
import { playSound, soundEnabled, toggleSound } from '../../services/sound'
import { createUuid } from '../../domain/id'
import { useClosetStore } from '../../stores/closet'
import { recommendApi } from '../../recommend/api'
import type { IntentInput, RecommendationView } from '../../recommend/types'
import RecommendIntent from '../../components/outfit/RecommendIntent.vue'
import RecommendationGroup from '../../components/outfit/RecommendationGroup.vue'
import AssistantAvatar from '../../components/assistant/AssistantAvatar.vue'
import AgentCommandCard from '../../components/assistant/AgentCommandCard.vue'
import AgentProposal from '../../components/assistant/AgentProposal.vue'
import AgentWorkspaceResult from '../../components/assistant/AgentWorkspaceResult.vue'
import TraceSheet from '../../components/assistant/TraceSheet.vue'
import { assistantContextName, assistantRoute, waitingTopics, welcomePrompts } from '../../components/assistant/chat-helpers'
const closet = useClosetStore(), toast = useToast(), message = useMessage(), instance = getCurrentInstance()
const route = ref('/assistant'), garmentQuery = ref('')
const busy = ref(false), loading = ref(false), status = ref(''), error = ref(''), input = ref('')
const activityPhase = ref<'thinking' | 'operating' | 'responding'>('thinking'), taskFailed = ref(false), delighted = ref(false), showTopics = ref(false)
const sessions = ref<AgentSession[]>([]), selected = ref(''), messages = ref<AgentMessage[]>([])
const models = ref<Models>({ defaultModel: '', models: [], configured: false }), personalModel = ref(''), quota = ref<Quota | null>(null)
const imageConsent = ref(false)
const historyOpen = ref(false), optionsOpen = ref(false), moreOpen = ref(false), renameOpen = ref(false), renameTitle = ref(''), renaming = ref(false), quickOpen = ref(false)
const debugOpen = ref(false), debugRequest = ref<string | null>(null), debugUpdates = ref(0)
const anchor = ref(''), viewHeight = ref(0), nearBottomNow = ref(true)
let abort: ReturnType<typeof outfitStreamAbort> | undefined, delightTimer: ReturnType<typeof setTimeout> | undefined
const isOperating = computed(() => busy.value && (activityPhase.value === 'operating' || !!canvasExecution.runId))
const operationSteps = computed(() => messages.value[messages.value.length - 1]?.events.filter(e => e.event === 'operation_result').slice(-6).map(e => ({ text: e.data.label + (e.data.message ? ` · ${e.data.message}` : ''), success: e.data.success })) || [])
const mood = computed(() => busy.value ? 'thinking' : (error.value || taskFailed.value) ? 'concern' : delighted.value ? 'happy' : 'idle')
const session = computed(() => sessions.value.find(s => s.id === selected.value))
const context = computed(() => pageContext(route.value)), contextName = computed(() => assistantContextName(context.value))
const modelOptions = computed(() => [{ value: 'default', label: `个人默认 · ${personalModel.value || models.value.defaultModel}` }, ...models.value.models.map(value => ({ value, label: value }))])
const showQuick = computed(() => { const last = messages.value[messages.value.length - 1]; return !last || !last.events.some(e => e.event === 'local_recommendation' || (e.event === 'proposal' && e.data?.kind === 'RECOMMENDATION')) })
const moreActions = computed(() => [{ name: '重命名当前对话', disabled: !selected.value || busy.value }, { name: '管理长期记忆' }, { name: '助手使用说明' }, { name: '删除当前对话', disabled: !selected.value || busy.value, color: '#bd4b4b' }, { name: '清空聊天记录', disabled: !sessions.value.length || busy.value, color: '#bd4b4b' }])
const quickIntent = ref<IntentInput>({ occasion: 'DAILY', temperatureC: null }), quickLoading = ref(false)
function celebrate() { delighted.value = true; clearTimeout(delightTimer); delightTimer = setTimeout(() => { delighted.value = false }, 2400) }
function measure() { uni.createSelectorQuery().in(instance?.proxy as any).select('.transcript').boundingClientRect((rect: any) => { if (rect?.height) viewHeight.value = rect.height }).exec() }
function onScroll(e: { detail: { scrollTop: number; scrollHeight: number } }) { nearBottomNow.value = !viewHeight.value || e.detail.scrollHeight - e.detail.scrollTop - viewHeight.value < 72 }
async function scrollBottom() { await nextTick(); anchor.value = ''; await nextTick(); anchor.value = 'bottom-anchor' }
function pickTopic(prompt: string) { if (busy.value || input.value.trim()) { toast.info('输入框里有正在编辑的消息，先保留你的草稿。'); return } input.value = prompt }
async function refreshSessions() { sessions.value = await agentRequest<AgentSession[]>('/sessions') }
async function load() {
  void flushBoardTrace(); loading.value = true; error.value = ''
  try {
    const [modelList, preferences, usage] = await Promise.all([agentRequest<Models>('/models'), agentRequest<{ model: string; avatarMode: string }>('/preferences'), agentRequest<Quota>('/quota')])
    models.value = modelList; personalModel.value = preferences.model; quota.value = usage; await refreshSessions()
    if (!selected.value && sessions.value.length) { selected.value = sessions.value[0].id; await selectSession() }
  } catch (e) { error.value = e instanceof Error ? e.message : '助手无法加载。' } finally { loading.value = false }
}
async function createSession() { const created = await agentRequest<AgentSession>('/sessions', 'POST'); sessions.value.unshift(created); selected.value = created.id; messages.value = []; return created }
async function selectSession() { if (busy.value) return; error.value = ''; const id = selected.value; try { const history = id ? await agentRequest<AgentMessage[]>(`/sessions/${id}/messages`) : []; if (selected.value === id) messages.value = history } catch (e) { error.value = e instanceof Error ? e.message : String(e) } }
async function newSession() { try { await createSession(); input.value = ''; showTopics.value = false } catch (e) { error.value = e instanceof Error ? e.message : String(e) } }
async function setModel(value: string) { const target = session.value; if (!target) return; const model = value === 'default' ? null : value; try { const updated = await agentRequest<AgentSession>(`/sessions/${selected.value}`, 'PUT', { title: target.title, model }); Object.assign(target, updated) } catch (e) { error.value = e instanceof Error ? e.message : String(e) } }
function rename() { if (session.value) { renameTitle.value = session.value.title; renameOpen.value = true } }
async function saveTitle() {
  const target = session.value; if (!target || !renameTitle.value.trim()) return
  renaming.value = true
  try { const updated = await agentRequest<AgentSession>(`/sessions/${target.id}`, 'PUT', { title: renameTitle.value.trim(), model: target.model }); Object.assign(target, updated); renameOpen.value = false; playSound('success') }
  catch (e) { toast.error(e instanceof Error ? e.message : String(e)) } finally { renaming.value = false }
}
async function chooseSession(id: string) { selected.value = id; historyOpen.value = false; await selectSession(); await scrollBottom() }
async function deleteChats(all = false) {
  try { await message.confirm({ title: all ? '清空所有聊天？' : '删除当前对话？', msg: '聊天记录和长期记忆独立管理，这个操作会保留所有记忆。', confirmButtonText: '确认删除', cancelButtonText: '取消' }) } catch { return }
  try { await agentRequest(all ? '/sessions' : `/sessions/${selected.value}`, 'DELETE'); if (closet.user) discardSessionTrace(closet.user.username, all ? undefined : selected.value); selected.value = ''; messages.value = []; await refreshSessions(); playSound('success') }
  catch (e) { toast.error(e instanceof Error ? e.message : String(e)) }
}
function moreAction(e: { index: number }) {
  moreOpen.value = false
  if (e.index === 0) rename(); else if (e.index === 1) navigateOutfitLink('/settings?section=assistant'); else if (e.index === 2) navigateOutfitLink('/help?article=03-assistant')
  else if (e.index === 3) void deleteChats(); else if (e.index === 4) void deleteChats(true)
}
async function undoMemory(memory: Memory & { revoked?: boolean }) { try { await agentRequest(`/memories/${memory.id}`, 'DELETE'); memory.revoked = true; uni.$emit('closet-agent-memory-changed'); toast.success('已删除这条记忆。') } catch (e) { toast.error(e instanceof Error ? e.message : String(e)) } }
async function runQuick() {
  quickLoading.value = true
  try { const view = await recommendApi.recommend({ ...quickIntent.value, temperatureC: quickIntent.value.temperatureC ?? undefined, count: 3 }); quickResult(view); quickOpen.value = false }
  catch (e) { toast.error(e instanceof Error ? e.message : '推荐暂时不可用。') } finally { quickLoading.value = false }
}
function quickResult(view: RecommendationView) {
  // Shown in this chat only (not sent to the model and not saved to the conversation).
  messages.value.push({ id: createUuid(), role: 'assistant', content: `按“${view.intent.description}”为你推荐（规则计算，未调用大模型，不占对话次数）`, status: 'COMPLETE', events: [{ event: 'local_recommendation', data: view }] })
  void scrollBottom()
}
async function send() {
  if (busy.value || !input.value.trim() || !models.value.configured) return
  taskFailed.value = false; error.value = ''; busy.value = true; activityPhase.value = 'thinking'; status.value = '正在理解你的请求'; playSound('bubble')
  let reply: AgentMessage | undefined
  const body = { requestId: createUuid(), content: input.value.trim(), context: context.value, imageConsent: imageConsent.value }
  try {
    if (!selected.value) await createSession()
    messages.value.push({ id: body.requestId, role: 'user', content: body.content, status: 'COMPLETE', events: [] })
    messages.value.push({ id: createUuid(), role: 'assistant', content: '', status: 'RUNNING', events: [], requestId: body.requestId }); reply = messages.value[messages.value.length - 1]
    input.value = ''; imageConsent.value = false; abort = outfitStreamAbort(); nearBottomNow.value = true; await scrollBottom()
    await streamMessage(selected.value, body, event => {
      const follow = nearBottomNow.value
      if (event.event === 'token') { reply!.content += event.data.text; activityPhase.value = 'responding' }
      else if (event.event === 'avatar') { /* The mini program avatar is static. */ }
      else if (event.event === 'debug_trace') { debugUpdates.value++; reply!.requestId = event.data.requestId }
      else if (event.event === 'status') { status.value = event.data.text; activityPhase.value = event.data.phase === 'operating' ? 'operating' : 'thinking' }
      else if (event.event === 'canvas_operation') { activityPhase.value = 'operating'; status.value = event.data.label; handleCanvasCommand(event.data) }
      else if (event.event === 'done') { reply!.status = 'COMPLETE'; quota.value = event.data.quota; if (!taskFailed.value) celebrate(); playSound('complete') }
      else if (event.event === 'error') { failCanvasExecution(); error.value = event.data.message; reply!.status = 'FAILED'; playSound('error') }
      else {
        reply!.events.push(event)
        if (event.event === 'workspace_result' && event.data.status === 'FAILED') taskFailed.value = true
        if (event.event === 'memory') uni.$emit('closet-agent-memory-changed')
        if (event.event === 'navigation') navigateOutfitLink(event.data.path)
      }
      if (follow) void scrollBottom()
    }, abort.signal)
  } catch (e) { failCanvasExecution(); error.value = e instanceof Error ? e.message : '回复未完成。'; if (reply) reply.status = 'FAILED' }
  finally { busy.value = false; status.value = ''; abort = undefined; try { await refreshSessions(); quota.value = await agentRequest<Quota>('/quota') } catch { /* Quota is refreshed on the next load. */ } }
}
// A proposal applied into the open workspace returns to it, mirroring the web panel closing on phones.
function applied() { if (route.value === '/outfits/workspace') uni.navigateBack() }
function openTrace(item: AgentMessage) { debugRequest.value = item.requestId || null; debugOpen.value = true }
const operationEvents = (item: AgentMessage) => item.events.filter(e => e.event === 'operation_result')
onLoad(async query => {
  route.value = assistantRoute(query?.from, query?.garment); garmentQuery.value = query?.garment || ''
  showTopics.value = query?.waiting === '1'
  await closet.ensureUser(); if (!closet.user) { uni.reLaunch({ url: '/pages/login/index' }); return }
  await load(); await scrollBottom()
})
onReady(measure)
onUnload(() => { abort?.abort(); clearTimeout(delightTimer) })
</script>
<template><view class="chat">
  <view class="head"><AssistantAvatar :size="84" :mood="mood" /><view class="identity"><text class="name">鱼搭助手</text><text class="sub">{{ session?.title || '今天也一起好好穿衣' }}</text></view>
    <view class="tools"><wd-button type="text" size="small" :disabled="busy" @click="newSession">新建</wd-button><wd-button type="text" size="small" :disabled="busy || loading" @click="historyOpen = true">记录</wd-button><wd-button type="text" size="small" @click="moreOpen = true">更多</wd-button></view></view>
  <view class="context"><view class="dot" /><text class="ctx">{{ contextName }}</text><text class="small">随页面更新</text></view>
  <view v-if="showTopics" class="topics"><text class="small">等衣物的这会儿，想聊点什么？选话题后由你发送。</text><view class="topic-row"><wd-button v-for="topic in waitingTopics" :key="topic.label" size="small" plain :disabled="busy || loading || !models.configured" @click="pickTopic(topic.prompt)">{{ topic.label }}</wd-button></view></view>
  <scroll-view class="transcript" scroll-y :scroll-into-view="anchor" :scroll-with-animation="false" @scroll="onScroll">
    <wd-skeleton v-if="loading" :row-col="[{ width: '60%' }, { height: '120rpx' }, { width: '40%' }]" />
    <view v-if="!messages.length && !loading" class="welcome"><AssistantAvatar :size="148" mood="happy" /><text class="eyebrow">你的鱼搭助手</text><text class="h2">今天我能帮你做什么？</text><text class="small center">查衣柜、管理衣物、查看任务，也可以聊穿搭或了解平台。</text><wd-button v-for="p in welcomePrompts" :key="p.label" block plain @click="input = p.prompt">{{ p.label }}</wd-button></view>
    <view v-for="item in messages" :key="item.id" class="msg" :class="item.role">
      <text class="who">{{ item.role === 'user' ? '你' : '鱼搭助手' }}</text>
      <text v-if="item.content" class="bubble" selectable>{{ item.content }}</text><text v-if="item.status === 'FAILED'" class="interrupted">回复未完成</text>
      <wd-button v-if="item.role === 'assistant'" type="text" size="small" @click="openTrace(item)">查看决策与执行记录</wd-button>
      <wd-collapse v-if="operationEvents(item).length" class="ops cards"><wd-collapse-item title="查看搭台操作记录" name="steps"><view v-for="event in operationEvents(item)" :key="event.data.operationId" class="op">{{ event.data.success ? '✓' : '!' }} {{ event.data.label }}<text v-if="event.data.message" class="small"> · {{ event.data.message }}</text></view></wd-collapse-item></wd-collapse>
      <view v-if="item.events.length" class="cards"><template v-for="(event, index) in item.events" :key="index">
        <AgentWorkspaceResult v-if="event.event === 'workspace_result'" :result="event.data" />
        <AgentCommandCard v-else-if="event.event === 'command'" :command="event.data" />
        <AgentProposal v-else-if="event.event === 'proposal'" :proposal="event.data" :route="route" @applied="applied" />
        <RecommendationGroup v-else-if="event.event === 'local_recommendation'" :view="event.data" dense />
        <view v-else-if="event.event === 'memory'" class="memory"><text>{{ event.data.revoked ? '已撤销' : '已记住' }}：{{ event.data.content }}</text><wd-button v-if="!event.data.revoked" type="text" size="small" @click="undoMemory(event.data)">撤销记忆</wd-button></view>
        <view v-else-if="event.event === 'sources' && event.data.articles?.length" class="sources"><text v-for="article in event.data.articles" :key="article.id" class="source" @tap="navigateOutfitLink(article.href)">{{ article.title }} ↗</text></view>
      </template></view>
    </view>
    <view v-if="busy && (isOperating || activityPhase !== 'responding')" class="activity"><wd-loading size="36rpx" /><view class="activity-body"><text>{{ isOperating ? (canvasExecution.runId ? canvasExecution.label || status : status || '正在操作') : status || '正在思考' }}</text><text v-for="(step, i) in (isOperating ? operationSteps : [])" :key="i" class="small">{{ step.success ? '✓' : '!' }} {{ step.text }}</text></view></view>
    <view id="bottom-anchor" class="anchor" />
  </scroll-view>
  <view class="composer">
    <view v-if="error" class="notice error">{{ error }}<wd-button type="text" size="small" @click="error = ''">关闭</wd-button></view>
    <text v-if="!models.configured && !loading" class="small">助手尚未配置，请联系平台维护者。</text>
    <wd-button v-if="showQuick" size="small" plain :disabled="busy" @click="quickOpen = true">今天穿什么</wd-button>
    <view class="input-row"><view class="input-box"><wd-textarea v-model="input" no-border auto-height :maxlength="4000" :disabled="busy || !models.configured" placeholder="想怎么搭？或者问问平台用法…" :show-confirm-bar="false" :cursor-spacing="24" /></view><wd-button :loading="busy" :disabled="busy || !input.trim() || !models.configured" @click="send">发送</wd-button></view>
    <view class="spread foot"><view class="actions"><wd-button type="text" size="small" @click="optionsOpen = true">对话选项</wd-button><text v-if="imageConsent" class="small">本条已授权发送图片</text></view><text class="small">{{ quota ? `今日剩余 ${Math.max(0, quota.limit - quota.used)} 条` : '正在读取额度' }}</text></view>
  </view>
  <wd-popup v-model="historyOpen" position="bottom" closable :z-index="30"><view class="sheet"><view class="sheet-head">聊天记录</view><wd-status-tip v-if="!sessions.length" image="content" tip="还没有聊天记录" /><wd-cell v-for="item in sessions" :key="item.id" :title="item.title" :value="item.id === selected ? '当前' : ''" clickable @click="chooseSession(item.id)" /><text class="small">聊天与长期记忆独立保存。</text></view></wd-popup>
  <wd-popup v-model="optionsOpen" position="bottom" closable :z-index="30"><view class="sheet"><view class="sheet-head">本次对话选项</view>
    <wd-picker :model-value="session?.model || 'default'" label="本会话模型" :columns="modelOptions" :disabled="!selected || busy" @confirm="setModel($event.value)" /><text v-if="!selected" class="small">发送消息或新建对话后可设置会话模型。</text>
    <view class="spread opt"><text>音效</text><wd-switch :model-value="soundEnabled" size="22px" @change="toggleSound" /></view>
    <wd-checkbox v-if="context.garmentId" v-model="imageConsent" :disabled="busy">发送当前衣物图片到模型（仅本条）</wd-checkbox>
    <wd-button type="text" @click="optionsOpen = false; navigateOutfitLink('/settings')">设置角色动效与预览 ↗</wd-button></view></wd-popup>
  <wd-popup v-model="renameOpen" position="bottom" closable :z-index="30"><view class="sheet"><view class="sheet-head">重命名对话</view><wd-input v-model="renameTitle" :maxlength="100" placeholder="对话名称" /><view class="section"><wd-button block :loading="renaming" :disabled="!renameTitle.trim()" @click="saveTitle">保存名称</wd-button></view></view></wd-popup>
  <wd-popup v-model="quickOpen" position="bottom" closable :z-index="30"><view class="sheet"><view class="sheet-head">今天穿什么</view><RecommendIntent v-model="quickIntent" compact :loading="quickLoading" submit-label="出推荐" @submit="runQuick" /><text class="small">直接按规则计算，不调用大模型，也不占今天的对话次数。</text></view></wd-popup>
  <wd-action-sheet v-model="moreOpen" :actions="moreActions" cancel-text="取消" @select="moreAction" />
  <TraceSheet v-model="debugOpen" :session-id="selected" :request-id="debugRequest" :updates="debugUpdates" />
  <wd-toast /><wd-message-box />
</view></template>
<style lang="scss" scoped>@import '../../components/outfit/outfit.scss';
.chat { height: 100vh; display: flex; flex-direction: column; background: $paper; overflow: hidden; }
.head { display: flex; align-items: center; gap: 20rpx; padding: 20rpx 24rpx; background: $surface; border-bottom: 1rpx solid $line; flex-shrink: 0; }
.identity { flex: 1; min-width: 0; display: flex; flex-direction: column; }.name { font-weight: 650; font-size: 32rpx; }.sub { font-size: 24rpx; color: $muted; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.tools { display: flex; flex-shrink: 0; }
.context { display: flex; align-items: center; gap: 12rpx; padding: 12rpx 24rpx; font-size: 24rpx; background: $accent-soft; flex-shrink: 0; }.dot { width: 14rpx; height: 14rpx; border-radius: 50%; background: $success; }.ctx { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.topics { padding: 20rpx 24rpx; border-bottom: 1rpx solid $line; background: $surface; flex-shrink: 0; }.topic-row { display: flex; gap: 14rpx; flex-wrap: wrap; margin-top: 12rpx; }
.transcript { flex: 1; min-height: 0; padding: 0 24rpx; box-sizing: border-box; }
.welcome { display: flex; flex-direction: column; align-items: center; gap: 18rpx; padding: 48rpx 0; }.eyebrow { font-size: 24rpx; color: $accent; }.h2 { font-size: 40rpx; font-weight: 650; }.center { text-align: center; }
.msg { display: flex; flex-direction: column; align-items: flex-start; gap: 6rpx; margin: 28rpx 0; }.msg.user { align-items: flex-end; }.who { font-size: 22rpx; color: $muted; }
.bubble { max-width: 88%; padding: 20rpx 24rpx; border-radius: $radius-md; background: $surface; border: 1rpx solid $line; font-size: 28rpx; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; }
.msg.user .bubble { background: $accent; border-color: $accent; color: #fff; }.cards { align-self: stretch; width: 100%; }.interrupted { font-size: 22rpx; color: $danger; }
.ops, .op { font-size: 24rpx; color: $muted; }.op { margin: 8rpx 0; }.memory { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; padding: 16rpx 20rpx; border-radius: $radius-sm; background: $accent-soft; font-size: 26rpx; }
.sources { display: flex; flex-wrap: wrap; gap: 20rpx; }.source { color: $accent; font-size: 26rpx; text-decoration: underline; }
.activity { display: flex; gap: 16rpx; padding: 20rpx; background: $surface; border-radius: $radius-md; margin: 20rpx 0; font-size: 26rpx; }.activity-body { display: flex; flex-direction: column; gap: 6rpx; }.anchor { height: 2rpx; }
.composer { background: $surface; border-top: 1rpx solid $line; padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 12rpx; flex-shrink: 0; align-items: stretch; }
.input-row { display: flex; align-items: flex-end; gap: 16rpx; }.input-box { flex: 1; min-width: 0; background: $surface-alt; border-radius: $radius-md; max-height: 240rpx; overflow-y: auto; }.foot { align-items: center; }.opt { padding: 24rpx 0; }
</style>
