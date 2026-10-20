<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { useToast, useMessage } from 'wot-design-uni'
import { platformRequest, type RenderJob } from '../../services/platform'
import { appVisible } from '../../services/lifecycle'
import { useClosetStore } from '../../stores/closet'
import { useSendOffStore } from '../../stores/sendOff'
import { useProcessingStore } from '../../stores/processing'
import AuthImage from '../AuthImage.vue'
const toast = useToast(), message = useMessage(), closet = useClosetStore(), sendOff = useSendOffStore(), processing = useProcessingStore()
const jobs = ref<RenderJob[]>([]), error = ref(''), cancelling = ref(''), phase = ref('deal'), showing = ref(false), game = ref(false)
const active = ['QUEUED', 'WAITING_RESOURCE', 'RUNNING', 'CANCEL_REQUESTED']
const visible = computed(() => jobs.value.filter(j => [...active, 'FAILED', 'UNKNOWN', 'DELETE_PENDING'].includes(j.status)).slice(0, 20))
const states: Record<string, string> = { QUEUED: '排队中', WAITING_RESOURCE: '等待资源', RUNNING: '生成中', CANCEL_REQUESTED: '停止发布中', FAILED: '未完成', UNKNOWN: '结果未知', DELETE_PENDING: '正在清理图片' }
let timer: ReturnType<typeof setInterval> | undefined, dressTimer: ReturnType<typeof setTimeout> | undefined, finishTimer: ReturnType<typeof setTimeout> | undefined, shown = true
async function load() { if (!shown || !appVisible() || !closet.user || closet.user.mustChangePassword) return; try { jobs.value = await platformRequest('/api/me/image-render-jobs'); error.value = '' } catch (e) { error.value = String(e) } }
function finish() { clearTimeout(dressTimer); clearTimeout(finishTimer); if (!sendOff.current) return; sendOff.land(sendOff.current.id); showing.value = false; toast.show('已开始生成，通常 1 分钟左右。可以先逛逛，好了会提醒你。'); void load() }
watch(() => sendOff.current?.id, id => { if (!id || !shown) return; clearTimeout(dressTimer); clearTimeout(finishTimer); showing.value = true; phase.value = 'deal'; dressTimer = setTimeout(() => { phase.value = 'dress' }, 900); finishTimer = setTimeout(finish, 2300) })
watch(() => closet.user?.username, name => { if (name && !closet.user?.mustChangePassword) processing.start(name); else processing.stop() }, { immediate: true })
async function cancel(job: RenderJob) {
  try { await message.confirm({ title: '取消这次生成？', msg: '本平台将停止后续发布；已发出的请求无法保证上游停止或退还额度。', confirmButtonText: '取消任务', cancelButtonText: '继续等待' }) } catch { return }
  cancelling.value = job.id; try { await platformRequest(`/api/me/image-render-jobs/${job.id}/cancel`, 'POST', {}); await load() } catch (e) { toast.error(String(e)) } finally { cancelling.value = '' }
}
function openJob(j: RenderJob) { if (j.purpose === 'BASELINE') personal(); else { uni.setStorageSync('me.ootd.job', j.id); uni.switchTab({ url: '/pages/ootd/index' }) } }
function personal() { uni.setStorageSync('me.settings.section', 'personal'); uni.switchTab({ url: '/pages/settings/index' }) }
function tasks() { uni.navigateTo({ url: '/pkg-closet/tasks/index' }) }
function openNotice() { const entry = processing.latestNotice; if (!entry) return; processing.viewed(entry); processing.dismissNotice(); if (entry.kind === 'render') { if (entry.href.includes('settings')) personal(); else { uni.setStorageSync('me.ootd.job', entry.id); uni.switchTab({ url: '/pages/ootd/index' }) } } else tasks() }
const designs = ['卫衣', '牛仔裤', '球鞋', '棒球帽'], deck = ref<number[]>([]), first = ref<number | null>(null), second = ref<number | null>(null), matched = ref<number[]>([]), turns = ref(0)
let cover: ReturnType<typeof setTimeout> | undefined
function reset() { clearTimeout(cover); deck.value = [0, 1, 2, 3, 0, 1, 2, 3]; for (let i = 7; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck.value[i], deck.value[j]] = [deck.value[j]!, deck.value[i]!] }; first.value = null; second.value = null; matched.value = []; turns.value = 0 }
function revealed(i: number) { return first.value === i || second.value === i || matched.value.includes(i) }
function flip(i: number) { if (revealed(i) || second.value !== null) return; turns.value++; if (first.value === null) { first.value = i; return }; second.value = i; if (deck.value[first.value] === deck.value[i]) { matched.value.push(first.value, i); first.value = null; second.value = null } else cover = setTimeout(() => { first.value = null; second.value = null }, 900) }
function play() { if (!deck.value.length) reset(); game.value = true }
onMounted(() => { void load(); timer = setInterval(load, 5000) }); onShow(() => { shown = true; void load() }); onHide(() => { shown = false; if (showing.value) finish() })
onUnmounted(() => { clearInterval(timer); clearTimeout(dressTimer); clearTimeout(finishTimer); clearTimeout(cover); if (showing.value && sendOff.current) sendOff.land(sendOff.current.id) })
</script>
<template>
  <view class="stack">
    <view v-if="visible.length || error" class="section"><view class="title">人物与穿搭图生成</view><view class="note">只列出生成中或需要检查的图片，做好的结果保存在各自页面。</view><view v-if="error" class="error">生成状态暂时无法更新：{{ error }}</view>
      <view v-for="j in visible" :key="j.id" class="item"><view>{{ j.purpose === 'BASELINE' ? '模特形象' : j.summary?.kind === 'ADJUST' ? '身材调整图' : 'OOTD 穿搭图' }} <wd-tag>{{ states[j.status] || j.status }}</wd-tag></view><view class="note">{{ j.status === 'UNKNOWN' ? '已经发出，结果尚不确定；为免重复扣额度，不会自动重发。' : j.error }}<view>开始于 {{ new Date(j.createdAt).toLocaleString('zh-CN') }}</view></view><view class="actions"><wd-button v-if="j.purpose === 'OOTD' && ['UNKNOWN', 'FAILED'].includes(j.status)" size="small" @click="openJob(j)">查看并重新生成</wd-button><wd-button v-if="['QUEUED', 'WAITING_RESOURCE', 'RUNNING', 'UNKNOWN'].includes(j.status)" size="small" plain :loading="cancelling === j.id" @click="cancel(j)">取消生成</wd-button></view></view>
      <view class="actions"><wd-button type="text" @click="personal">我的模特</wd-button><wd-button type="text" @click="tasks">处理中心</wd-button><wd-button type="text" @click="play">衣物记忆翻牌</wd-button></view>
    </view>
    <view v-if="processing.latestNotice" class="section"><view class="title">{{ processing.latestNotice.stage }}</view><view class="note">{{ processing.latestNotice.note }}</view><view class="actions"><wd-button size="small" @click="openNotice">查看结果</wd-button><wd-button size="small" plain @click="processing.dismissNotice">收起</wd-button></view></view>
    <wd-popup :model-value="showing" position="bottom" @close="finish"><view class="sheet stack" @tap="finish"><view class="title">{{ phase === 'deal' ? sendOff.current?.title : '正在为你穿上身…' }}</view><view class="bundle" :class="phase"><view v-if="sendOff.current?.person" class="thumb"><AuthImage :src="sendOff.current.person" /></view><view v-for="(c, i) in sendOff.current?.cards" :key="i" class="mini"><AuthImage v-if="c.image" :src="c.image" /><text>{{ c.label }}</text></view></view><view class="note">已放进处理中心，好了会叫你</view><wd-button type="text" @click="finish">收起</wd-button></view></wd-popup>
    <wd-popup v-model="game" position="bottom" closable><view class="sheet stack"><view class="title">衣物记忆翻牌</view><view class="title">{{ matched.length === 8 ? '都找到啦！' : '找出藏起来的四对衣物' }}</view><view class="note">{{ matched.length === 8 ? '衣柜也被你整理得整整齐齐。' : '没有倒计时，慢慢翻，随时可以离开。' }}</view><view class="row"><text>已配对 {{ matched.length / 2 }} / 4</text><text>翻牌 {{ turns }} 次</text></view><view class="memory-grid"><wd-button v-for="(d, i) in deck" :key="i" :plain="!revealed(i)" :disabled="matched.includes(i) || second !== null" @click="flip(i)">{{ revealed(i) ? designs[d] : '？' }}</wd-button></view><view class="note">{{ processing.activeCount ? processing.activeCount + ' 个任务仍在后台处理' : '处理结果可在站内任务中查看' }}</view><wd-button @click="reset">{{ matched.length === 8 ? '再玩一局' : '重新开始' }}</wd-button><view class="note">不消耗 AI 额度 · 关闭后保留本轮，刷新后重新开始</view></view></wd-popup>
    <wd-toast /><wd-message-box />
  </view>
</template>
<style lang="scss" scoped>
@import './me.scss';
.bundle { display: flex; justify-content: center; flex-wrap: wrap; gap: 16rpx; padding: 32rpx 0; }.mini { width: 120rpx; height: 160rpx; text-align: center; transition: transform .6s ease-out; font-size: 22rpx; }.dress .mini { transform: scale(.7) translateY(-20rpx); }.memory-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20rpx; }@media (prefers-reduced-motion: reduce) { .mini { transition: none; } }
</style>
