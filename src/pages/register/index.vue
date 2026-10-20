<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { closetApi, type RegistrationMode } from '../../services/api'
import { useClosetStore } from '../../stores/closet'
import { useAppearance } from '../../composables/useAppearance'
const { pageStyle } = useAppearance()
const closet = useClosetStore()
const mode = ref<RegistrationMode>(), modeLoading = ref(false), busy = ref(false), error = ref('')
const username = ref(''), displayName = ref(''), password = ref(''), repeat = ref(''), inviteCode = ref('')
async function loadMode() {
  modeLoading.value = true; error.value = ''
  try { mode.value = (await closetApi.registration()).mode }
  catch (e) { error.value = e instanceof Error ? e.message : '注册信息暂时无法加载。' }
  finally { modeLoading.value = false }
}
onLoad(query => { inviteCode.value = String(query?.invite || ''); void loadMode() })
async function submit() {
  if (busy.value || !mode.value || mode.value === 'CLOSED') return
  error.value = ''
  if (!/^[A-Za-z0-9_.-]{2,80}$/.test(username.value)) { error.value = '用户名需为 2–80 个字符，只能包含字母、数字、下划线、点和短横线。'; return }
  if (displayName.value.trim().length > 40 || /[\x00-\x1f\x7f]/.test(displayName.value)) { error.value = '昵称不能超过 40 个字符，也不能包含控制字符。'; return }
  if (password.value.length < 12) { error.value = '密码至少需要 12 个字符。'; return }
  if (password.value !== repeat.value) { error.value = '两次输入的密码不一致。'; return }
  if (mode.value === 'INVITE' && !inviteCode.value.trim()) { error.value = '请输入邀请码。'; return }
  busy.value = true
  try {
    closet.user = await closetApi.register({ username: username.value, password: password.value, displayName: displayName.value.trim() || undefined, inviteCode: inviteCode.value.trim() || undefined })
    password.value = ''; repeat.value = ''
    uni.switchTab({ url: '/pages/wardrobe/index' })
  } catch (e) { error.value = e instanceof Error ? e.message : '注册未能完成，请稍后重试。' }
  finally { busy.value = false }
}
function login() { uni.reLaunch({ url: '/pages/login/index' }) }
</script>
<template><page-meta :page-style="pageStyle" />
  <view class="register">
    <view class="brand"><image class="logo" src="/static/yuda-logo.png" mode="aspectFit" /><view><text class="name">鱼搭</text><text class="muted">数字衣橱</text></view></view>
    <view class="hero"><text class="eyebrow">专属衣橱</text><text class="hero-title">注册你的账号</text><text class="muted">为你的衣物，留一个自己的位置。</text></view>
    <view class="section stack">
      <wd-status-tip v-if="mode === 'CLOSED'" image="content" tip="当前暂未开放注册，请使用已有账号登录。" />
      <template v-else>
        <wd-input v-model="username" label="用户名" :maxlength="80" placeholder="2–80 位字母、数字或 _ . -" clearable />
        <wd-input v-model="displayName" label="昵称（可选）" :maxlength="40" placeholder="希望我们如何称呼你" clearable />
        <wd-input v-model="password" label="密码" show-password placeholder="至少 12 个字符" />
        <wd-input v-model="repeat" label="确认密码" show-password placeholder="再输一次密码" />
        <wd-input v-model="inviteCode" :label="mode === 'OPEN' ? '邀请码（可选）' : '邀请码'" placeholder="输入管理员提供的邀请码" clearable />
        <wd-button block :disabled="!mode" :loading="busy || modeLoading" @click="submit">注册并进入衣柜</wd-button>
      </template>
      <view v-if="error" class="error">{{ error }}</view>
      <wd-button v-if="!mode && !modeLoading" type="text" @click="loadMode">重新加载注册信息</wd-button>
      <wd-button type="text" @click="login">已有账号？返回登录</wd-button>
    </view>
  </view>
</template>
<style lang="scss" scoped>
@import '../../components/me/me.scss';
.register { min-height: 100vh; padding: calc(env(safe-area-inset-top) + 120rpx) 40rpx 60rpx; box-sizing: border-box; background: $paper; }
.brand { display: flex; align-items: center; gap: 20rpx; }.logo { width: 88rpx; height: 72rpx; }.name { display: block; font-size: 44rpx; font-weight: 650; }
.hero { margin: 60rpx 0 40rpx; display: flex; flex-direction: column; gap: 16rpx; }.eyebrow { color: $accent; font-size: 24rpx; letter-spacing: 4rpx; }.hero-title { font-size: 48rpx; font-weight: 600; }
</style>
