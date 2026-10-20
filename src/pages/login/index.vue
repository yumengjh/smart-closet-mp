<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useClosetStore } from '../../stores/closet'
import { closetApi } from '../../services/api'
import { apiBase, setApiBase } from '../../services/http'
import { useAppearance } from '../../composables/useAppearance'
const { pageStyle } = useAppearance()

const closet = useClosetStore()
const username = ref(''), password = ref(''), busy = ref(false), error = ref('')
const registrationOpen = ref(false)
const serverOpen = ref(false), server = ref(apiBase())

// Cold start: a still-valid cookie jar means the user is already signed in, so never show the form to them.
const checking = ref(true)
function enter() {
  if (closet.user?.mustChangePassword) uni.reLaunch({ url: '/pages/settings/index?firstLogin=1' })
  else uni.switchTab({ url: '/pages/wardrobe/index' })
}
onLoad(async () => {
  await closet.ensureUser()
  if (closet.user) { enter(); return }
  checking.value = false
  try { registrationOpen.value = (await closetApi.registration()).mode !== 'CLOSED' } catch { /* 登录仍可使用。 */ }
})

async function submit() {
  if (busy.value) return
  if (!username.value.trim() || !password.value) { error.value = '请输入用户名和密码。'; return }
  busy.value = true; error.value = ''
  try {
    closet.user = await closetApi.login(username.value.trim(), password.value)
    enter()
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '登录失败，请稍后重试。' }
  finally { busy.value = false }
}
function goRegister() { uni.navigateTo({ url: '/pages/register/index' }) }
function saveServer() {
  try { setApiBase(server.value); serverOpen.value = false; uni.showToast({ title: '已切换服务地址', icon: 'none' }) }
  catch (cause) { uni.showToast({ title: (cause as Error).message, icon: 'none' }) }
}
</script>

<template><page-meta :page-style="pageStyle" />
  <view v-if="checking" class="login checking"><wd-loading /><text class="muted">正在进入你的衣柜…</text></view>
  <view v-else class="login">
    <view class="brand"><image class="logo" src="/static/yuda-logo.png" mode="aspectFit" /><view><text class="name">鱼搭</text><text class="sub">数字衣橱</text></view></view>
    <view class="hero"><text class="eyebrow">专属衣橱</text><text class="title">登录你的衣柜</text><text class="muted">从照片，到你的数字衣柜。</text></view>
    <view class="card form">
      <wd-input v-model="username" label="用户名" placeholder="请输入你的用户名" clearable />
      <wd-input v-model="password" label="密码" placeholder="请输入密码" show-password @confirm="submit" />
      <view v-if="error" class="error">{{ error }}</view>
      <wd-button block :loading="busy" custom-class="submit" @click="submit">进入我的衣橱</wd-button>
      <view class="links">
        <wd-button v-if="registrationOpen" type="text" @click="goRegister">注册账号</wd-button>
        <wd-button type="text" @click="serverOpen = true">服务地址</wd-button>
      </view>
    </view>
    <wd-popup v-model="serverOpen" position="bottom" closable custom-style="padding: 32rpx; border-radius: 28rpx 28rpx 0 0;">
      <view class="sheet-title">服务地址</view>
      <wd-input v-model="server" placeholder="https://closet.example.com" clearable />
      <view class="muted hint">留空则使用构建时的默认地址。切换后需要重新登录。</view>
      <wd-button block @click="saveServer">保存</wd-button>
    </wd-popup>
  </view>
</template>

<style lang="scss" scoped>
.login { min-height: 100vh; padding: calc(env(safe-area-inset-top) + 120rpx) 40rpx 60rpx; box-sizing: border-box; background: $paper; }
.checking { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24rpx; padding-top: 0; }
.brand { display: flex; align-items: center; gap: 20rpx; }
.logo { width: 88rpx; height: 72rpx; }
.name { display: block; font-size: 44rpx; font-weight: 650; }
.sub { display: block; color: $muted; font-size: 24rpx; }
.hero { margin: 80rpx 0 48rpx; display: flex; flex-direction: column; gap: 12rpx; }
.eyebrow { color: $accent; font-size: 24rpx; letter-spacing: 4rpx; }
.title { font-size: 52rpx; font-weight: 600; }
.form { display: flex; flex-direction: column; gap: 24rpx; }
.error { color: $danger; font-size: 26rpx; }
.links { display: flex; justify-content: space-between; }
.sheet-title { font-size: 32rpx; font-weight: 600; margin-bottom: 24rpx; }
.hint { margin: 16rpx 0 32rpx; }
</style>
