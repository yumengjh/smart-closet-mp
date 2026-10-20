<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onLoad, onShow, onUnload, onBackPress } from '@dcloudio/uni-app'
import { useToast, useMessage } from 'wot-design-uni'
import { useClosetStore } from '../../stores/closet'
import { useThemeStore } from '../../stores/theme'
import { usePreferencesStore } from '../../stores/preferences'
import { soundEnabled, toggleSound } from '../../services/sound'
import { closetApi } from '../../services/api'
import { serverBuild, webBuild } from '../../services/version'
import { formatVersion } from '../../domain/app-version'
import AccountSection from '../../components/me/AccountSection.vue'
import PersonalSection from '../../components/me/PersonalSection.vue'
import AssistantSection from '../../components/me/AssistantSection.vue'
import StyleSection from '../../components/me/StyleSection.vue'
import TidySection from '../../components/me/TidySection.vue'
import RenderSupport from '../../components/me/RenderSupport.vue'
const closet = useClosetStore(), theme = useThemeStore(), preferences = usePreferencesStore(), toast = useToast(), message = useMessage()
const forced = ref(false), section = ref(''), serverVersion = ref('读取中…'), quota = ref<Awaited<ReturnType<typeof closetApi.quota>> | null>(null), quotaError = ref('')
const firstLogin = computed(() => forced.value || Boolean(closet.user?.mustChangePassword))
const portable = computed(() => Boolean(closet.user?.portableLogin))
const links = computed(() => [
  { key: 'personal', label: '个人形象', note: '资料与模特' },
  ...(!portable.value ? [{ key: 'account', label: '账户安全', note: '资料、密码与登录' }] : []),
  { key: 'assistant', label: '个人助手', note: '模型、动效与记忆' }, { key: 'tidy', label: '整理衣柜', note: '可能重复的衣物' }, { key: 'style', label: '穿搭画像', note: '推荐偏好与依据' }, { key: 'quota', label: 'AI 额度', note: '图像任务' },
  ...(!portable.value ? [{ key: 'portable', label: '便携登录', note: '跨设备访问' }] : []), { key: 'install', label: '安装应用', note: '桌面与主屏幕' }, { key: 'appearance', label: '外观与声音', note: '主题、音效与极简模式' },
])
const currentLabel = computed(() => links.value.find(x => x.key === section.value)?.label || '我的')
const admins = [{ path: 'templates', label: '搭配模板审核', note: '审核经典搭法模板，通过后参与推荐加分。' }, { path: 'ootd-samples', label: '整套穿搭样本', note: '收集整套穿搭图，提取物品与姿势，审核后生成搭配模板。' }, { path: 'processing', label: '任务与资源', note: '查看积压、共享账户与调度容量。' }, { path: 'users', label: '用户管理', note: '管理用户、登录会话、每日额度和邀请码。' }]
// The forced-password screen owns navigation until the password request succeeds.
const guardedApis = ['switchTab', 'navigateTo', 'redirectTo', 'reLaunch', 'navigateBack'] as const
const guard: UniNamespace.InterceptorOptions = { invoke: (args: { url?: string }) => { if (!firstLogin.value) return true; return Boolean(args.url?.startsWith('/pages/settings/index') || args.url?.startsWith('/pages/login/index')) } }
let guarded = false
function syncGuard() {
  if (firstLogin.value) { uni.hideTabBar(); if (!guarded) { guardedApis.forEach(api => uni.addInterceptor(api as string, guard)); guarded = true }; section.value = 'account' }
  else { releaseGuard(); uni.showTabBar() }
}
function releaseGuard() { if (guarded) { guardedApis.forEach(api => uni.removeInterceptor(api as string)); guarded = false } }
watch(firstLogin, syncGuard)
onBackPress(() => firstLogin.value)
onLoad(query => { forced.value = query?.firstLogin === '1'; section.value = String(query?.section || ''); syncGuard() })
onShow(async () => {
  await closet.ensureUser(); if (!closet.user) { uni.reLaunch({ url: '/pages/login/index' }); return }
  const requested = uni.getStorageSync('me.settings.section'); if (requested) { section.value = requested; uni.removeStorageSync('me.settings.section') }
  syncGuard(); if (portable.value && ['account', 'portable'].includes(section.value) && !firstLogin.value) section.value = ''
  const server = await serverBuild(); serverVersion.value = server ? formatVersion(server) : '无法连接'
})
onUnload(releaseGuard)
async function loadQuota() { quotaError.value = ''; try { quota.value = await closetApi.quota() } catch (e) { quotaError.value = e instanceof Error ? e.message : '无法加载额度。' } }
function select(key: string) { if (firstLogin.value) return; section.value = key; if (key === 'quota') void loadQuota() }
function back() { if (!firstLogin.value) section.value = '' }
function passwordChanged() { forced.value = false; releaseGuard(); uni.showTabBar(); uni.switchTab({ url: '/pages/wardrobe/index' }) }
function go(url: string) { if (!firstLogin.value) uni.navigateTo({ url }) }
async function signOut() {
  try { await message.confirm({ title: '退出登录？', confirmButtonText: '退出登录', cancelButtonText: '取消' }) } catch { return }
  try { await closet.signOut() } catch (e) { toast.error(e instanceof Error ? e.message : String(e)) }
  uni.reLaunch({ url: '/pages/login/index' })
}
</script>
<template>
  <view class="page stack" :class="{ dark: theme.isDark }">
    <template v-if="firstLogin"><view class="heading">欢迎使用鱼搭</view><view class="section"><view class="title">先为你的账号换一个新密码。</view><view class="note">这是管理员提供的初始密码，修改后就可以开始整理衣橱。</view></view><AccountSection :first-login="true" @password-changed="passwordChanged" /></template>
    <template v-else>
      <view v-if="!section" class="row"><view><view class="note">账户与设置</view><view class="heading">我的</view><view class="note">账户、助手和衣橱偏好。</view></view><view class="avatar">{{ (closet.user?.displayName || closet.user?.username || '').slice(0, 1).toUpperCase() }}</view></view>
      <view v-if="portable" class="note">当前使用便携登录授权，最长 24 小时有效。修改密码或管理授权需退出后使用账号密码登录。</view>
      <template v-if="!section">
        <wd-cell-group border><wd-cell v-for="link in links" :key="link.key" :title="link.label" :label="link.note" is-link @click="select(link.key)" /></wd-cell-group>
        <wd-cell-group v-if="closet.user?.role === 'ADMIN'" title="管理员" border><template v-for="admin in admins" :key="admin.path"><wd-cell v-if="admin.path !== 'users' || !portable" :title="admin.label" :label="admin.note" is-link @click="go('/pkg-admin/' + admin.path + '/index')" /></template></wd-cell-group>
        <wd-cell-group border><wd-cell title="帮助" is-link @click="go('/pkg-closet/help/index')" /><wd-cell title="处理中心" is-link @click="go('/pkg-closet/tasks/index')" /><wd-cell title="回收站" label="恢复已删除的衣物" is-link @click="go('/pkg-closet/trash/index')" /></wd-cell-group>
        <view class="note">前端 {{ formatVersion(webBuild) }}<view>服务端 {{ serverVersion }}</view></view><wd-button plain @click="signOut">退出登录</wd-button>
      </template>
      <template v-else>
        <view><wd-button type="text" @click="back">〈 返回设置</wd-button><view class="heading">{{ currentLabel }}</view></view>
        <AccountSection v-if="section === 'account' && !portable" :first-login="false" />
        <PersonalSection v-else-if="section === 'personal'" />
        <AssistantSection v-else-if="section === 'assistant'" />
        <StyleSection v-else-if="section === 'style'" />
        <TidySection v-else-if="section === 'tidy'" />
        <view v-else-if="section === 'quota'" class="section stack"><view class="title">今日 AI 额度</view><view class="note">识别和图片整理合计算一次；本地贴纸不计入额度。</view><view v-if="quotaError" class="error">{{ quotaError }}<wd-button type="text" @click="loadQuota">重试</wd-button></view><wd-loading v-else-if="!quota" /><template v-if="quota"><view>{{ Math.max(0, quota.limit - quota.used) }} / {{ quota.limit }} 次还可以使用</view><wd-progress :percentage="quota.limit ? Math.min(100, Math.round(quota.used / quota.limit * 100)) : 0" /><view class="row note"><text>已使用 {{ quota.used }} 次</text><text>{{ Math.max(0, quota.limit - quota.used) }} 次可用</text></view><view class="note">每日按北京时间重置 · 下次重置 {{ new Date(quota.resetAt).toLocaleString('zh-CN') }}</view></template></view>
        <view v-else-if="section === 'portable'" class="section"><view class="title">便携登录</view><view class="note">便携登录用于 Web 端跨设备访问。链接 10 分钟内有效，只能兑换一次；登录后最长保持 24 小时，可随时撤回访问。</view><view class="note">小程序内请使用账号密码登录；如需生成或管理一次性登录链接，请前往 Web 端“我的 → 便携登录”。</view></view>
        <view v-else-if="section === 'install'" class="section"><view class="title">安装应用</view><view class="note">当前已在微信小程序中使用鱼搭。可通过微信右上角菜单“添加到我的小程序”，下次从微信快速打开。</view></view>
        <view v-else-if="section === 'appearance'" class="section stack"><view class="row"><text>深色模式</text><wd-switch :model-value="theme.isDark" @change="theme.toggle" /></view><view class="row"><text>声音</text><wd-switch :model-value="soundEnabled" @change="toggleSound" /></view><view class="note">声音偏好保存在本机，小程序暂不播放 Web 合成音效。</view><view class="row"><text>极简模式</text><wd-switch v-model="preferences.minimal" /></view><view class="note">隐藏副标题、解释和次要操作，保留主要流程。</view></view>
      </template>
      <RenderSupport />
    </template><wd-toast /><wd-message-box />
  </view>
</template>
<style lang="scss" scoped>
@import '../../components/me/me.scss';
.avatar { width: 96rpx; height: 96rpx; line-height: 96rpx; text-align: center; border-radius: 50%; background: $accent-soft; color: $accent; font-size: 40rpx; }
.dark { background: #171c1a; color: #e8eeeb; --wot-dark-background: #171c1a; --wot-cell-background: #242b27; --wot-cell-title-color: #e8eeeb; --wot-input-bg: #242b27; --wot-input-color: #e8eeeb; --wot-textarea-bg: #242b27; --wot-textarea-color: #e8eeeb; }
.dark :deep(.section) { background: #242b27; border-color: #3a443e; }.dark :deep(.note) { color: #b8c6be; }
</style>
