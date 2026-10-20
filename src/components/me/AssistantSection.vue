<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useToast } from 'wot-design-uni'
import { agentRequest, type Models, type Quota } from '../../services/me'
type MemoryDocument = { kind: string; content: string; revision: number; updatedAt: number }
type Permission = { purpose: string; revision: number; expiresAt: number }
const toast = useToast(), models = ref<Models>({ defaultModel: '', models: [], configured: false }), model = ref(''), quota = ref<Quota | null>(null)
const mode = ref('basic'), saving = ref(false), error = ref(''), memoryError = ref(''), loading = ref(true)
const documents = ref<MemoryDocument[]>([]), drafts = ref<Record<string, string>>({}), permissions = ref<Permission[]>([]), busy = ref('')
const purposes = [{ value: 'OUTFIT', label: '个性化搭配' }, { value: 'BASELINE', label: '基准人物' }, { value: 'OOTD', label: 'OOTD 穿搭图' }]
const modes = [{ value: 'static', label: '静态' }, { value: 'basic', label: '基础动效' }, { value: 'personal', label: 'Agent 个性动效' }]
async function load() {
  error.value = ''
  try {
    const [m, p, q] = await Promise.all([agentRequest<Models>('/models'), agentRequest<{ model: string; avatarMode: string }>('/preferences'), agentRequest<Quota>('/quota')])
    models.value = m; model.value = p.model; mode.value = p.avatarMode; quota.value = q
  } catch (e) { error.value = e instanceof Error ? e.message : '助手设置无法加载。' }
}
async function saveModel() { try { await agentRequest('/preferences', 'PUT', { model: model.value }); toast.success('个人默认模型已保存。') } catch (e) { toast.error(String(e)) } }
async function saveMode(value: string) {
  saving.value = true
  try { mode.value = (await agentRequest<{ avatarMode: string }>('/preferences', 'PUT', { avatarMode: value })).avatarMode; toast.success('助手动效已保存。') }
  catch (e) { toast.error(String(e)) } finally { saving.value = false }
}
async function loadMemory(preserve = false) {
  try {
    const [docs, grants] = await Promise.all([agentRequest<MemoryDocument[]>('/memory-documents'), agentRequest<Permission[]>('/memory-permissions')])
    for (const d of docs) if (!preserve || drafts.value[d.kind] === documents.value.find(x => x.kind === d.kind)?.content) drafts.value[d.kind] = d.content
    documents.value = docs; permissions.value = grants; memoryError.value = ''
  } catch (e) { memoryError.value = String(e) } finally { loading.value = false }
}
async function saveDoc(d: MemoryDocument) {
  busy.value = d.kind
  try { Object.assign(d, await agentRequest<MemoryDocument>(`/memory-documents/${d.kind}`, 'PUT', { revision: d.revision, content: drafts.value[d.kind] })); if (d.kind === 'SENSITIVE') permissions.value = []; toast.success('记忆文档已保存，旧上下文已隔离。') }
  catch (e) { memoryError.value = String(e); toast.error('保存未完成，输入已保留。请核对最新版本。') } finally { busy.value = '' }
}
async function permission(purpose: string, checked: boolean) {
  try {
    if (checked) await agentRequest('/memory-permissions', 'POST', { purpose, revision: documents.value.find(d => d.kind === 'SENSITIVE')?.revision })
    else await agentRequest(`/memory-permissions/${purpose}`, 'DELETE')
    permissions.value = await agentRequest<Permission[]>('/memory-permissions')
  } catch (e) { toast.error(String(e)) }
}
function exportDoc(d: MemoryDocument) {
  // #ifdef MP-WEIXIN
  // @ts-ignore
  const path = `${wx.env.USER_DATA_PATH}/${d.kind === 'GENERAL' ? '通用长期记忆' : '敏感长期记忆'}.md`
  // @ts-ignore
  wx.getFileSystemManager().writeFile({ filePath: path, data: d.content, encoding: 'utf8', success: () => wx.shareFileMessage({ filePath: path }), fail: () => toast.error('导出未完成，请稍后重试。') })
  // #endif
  // #ifndef MP-WEIXIN
  uni.setClipboardData({ data: d.content })
  // #endif
}
function sensitive(text: string) { return /身高|体重|体型|身材|围度|胸围|腰围|臀围|病史|手机号|身份证|地址/.test(text) }
function help() { uni.navigateTo({ url: '/pkg-closet/help/index?article=03-assistant' }) }
function onMemoryChanged() { void loadMemory(true) }
onMounted(() => { void load(); void loadMemory(); uni.$on('closet-agent-memory-changed', onMemoryChanged) })
onUnmounted(() => { uni.$off('closet-agent-memory-changed', onMemoryChanged) })
</script>
<template>
  <view class="stack">
    <view v-if="error" class="error">{{ error }}<wd-button type="text" @click="load">重试</wd-button></view>
    <view class="section stack"><view class="title">默认模型与对话额度</view><view class="note">从平台开放的模型中选择。当前对话还可以单独切换模型。</view><wd-button type="text" @click="help">查看助手说明 ↗</wd-button>
      <wd-picker v-model="model" label="个人助手默认模型" :columns="models.models" /><wd-button :disabled="!model" @click="saveModel">保存模型</wd-button>
      <view v-if="quota">今天已提交 {{ quota.used }} / {{ quota.limit }} 条助手消息</view><view class="note">助手消息与图像任务分开统计，每天按北京时间重置。内部工具调用不另计消息次数。</view>
    </view>
    <view class="section stack"><view class="title">角色动效</view><view class="note">基础动画和空闲玩法不消耗模型 token。个性动效让助手每轮最多选择一次表达，只增加少量提示与控制信息，不另发模型请求。</view>
      <wd-radio-group :model-value="mode" :disabled="saving || !!error" @change="saveMode($event.value)"><wd-radio v-for="m in modes" :key="m.value" :value="m.value">{{ m.label }}</wd-radio></wd-radio-group>
      <view class="note">{{ mode === 'static' ? '安静圆球，任务状态仍有文字提示。' : mode === 'basic' ? '任务和拖拽跟随真实状态；收起后每隔 10–20 秒随机玩一个动作。' : '真实任务优先，聊天温和表达；收起后每隔 10–20 秒随机玩一个动作。' }} 设置随账号保存，系统减少动态效果优先。</view>
      <view class="title">动作预览</view><view class="avatar" :class="{ animated: mode !== 'static' }">●</view>
    </view>
    <view class="section stack"><view class="title">长期记忆</view><view class="note">直接查看和编辑原始文档。删除聊天不会删除记忆；临时穿搭要求不会自动变为长期偏好。</view>
      <view v-if="memoryError" class="error">{{ memoryError }}<wd-button type="text" @click="loadMemory(true)">核对最新版本</wd-button></view><wd-skeleton v-if="loading" :row-col="[1, 1, 1]" />
      <view v-for="doc in documents" :key="doc.kind" class="item stack">
        <view class="row"><view class="title">{{ doc.kind === 'GENERAL' ? '通用长期记忆' : '敏感长期记忆' }}</view><text class="note">版本 {{ doc.revision }}</text></view>
        <view class="note">{{ doc.kind === 'GENERAL' ? '颜色、风格和长期穿搭偏好。身体、健康和联系方式请放入敏感文档。' : '保存与使用授权分开；数量查询和普通问答不会读取身体资料。' }}</view>
        <view v-if="doc.kind === 'GENERAL' && sensitive(drafts[doc.kind] || '')" class="note">这里含有可能敏感的内容，请转入敏感文档并按用途授权。自由文本无法保证完整识别敏感信息。</view>
        <wd-textarea v-model="drafts[doc.kind]" :maxlength="20000" auto-height show-word-limit />
        <view class="actions"><wd-button :disabled="drafts[doc.kind] === doc.content" :loading="busy === doc.kind" @click="saveDoc(doc)">保存文档</wd-button><wd-button plain @click="exportDoc(doc)">导出 Markdown</wd-button></view>
        <template v-if="doc.kind === 'SENSITIVE'"><view>允许按用途读取相关片段</view><wd-checkbox v-for="p in purposes" :key="p.value" :model-value="permissions.some(x => x.purpose === p.value && x.revision === doc.revision)" :disabled="drafts[doc.kind] !== doc.content" @change="permission(p.value, $event.value)">{{ p.label }}</wd-checkbox><view class="note">文档变化后需重新授权。撤销后停止后续使用；已经发送给上游的内容无法撤回。</view></template>
      </view>
    </view><wd-toast />
  </view>
</template>
<style lang="scss" scoped>
@import './me.scss';
.avatar { align-self: center; color: #3279d7; font-size: 120rpx; line-height: 140rpx; }.animated { animation: float 3s ease-in-out infinite; }@keyframes float { 50% { transform: translateY(-12rpx); } }@media (prefers-reduced-motion: reduce) { .animated { animation: none; } }
</style>
