<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast, useMessage } from 'wot-design-uni'
import { closetApi, type AccountProfile, type AccountSession } from '../../services/api'
import { accountTime, registeredViaLabels } from '../../domain/account'
import { useClosetStore } from '../../stores/closet'
const props = defineProps<{ firstLogin: boolean }>()
const emit = defineEmits<{ passwordChanged: [] }>()
const closet = useClosetStore(), toast = useToast(), message = useMessage()
const currentPassword = ref(''), newPassword = ref(''), repeatPassword = ref(''), signOutOthers = ref(true)
const loading = ref(false), error = ref(''), success = ref('')
const profile = ref<AccountProfile>(), displayName = ref(''), profileBusy = ref(false), profileError = ref('')
const sessions = ref<AccountSession[]>([]), sessionsLoading = ref(false), sessionsError = ref('')
const deactivateOpen = ref(false), deactivatePassword = ref(''), deactivateError = ref(''), deactivating = ref(false)
async function loadProfile() {
  profileError.value = ''
  try { profile.value = await closetApi.profile(); displayName.value = profile.value.displayName || '' }
  catch (e) { profileError.value = e instanceof Error ? e.message : '个人资料暂时无法加载。' }
}
async function loadSessions() {
  sessionsLoading.value = true; sessionsError.value = ''
  try { sessions.value = await closetApi.sessions() }
  catch (e) { sessionsError.value = e instanceof Error ? e.message : '登录设备暂时无法加载。' }
  finally { sessionsLoading.value = false }
}
onMounted(() => { if (!props.firstLogin) { void loadProfile(); void loadSessions() } })
async function saveProfile() {
  if (profileBusy.value) return
  profileError.value = ''
  if (displayName.value.trim().length > 40 || /[\x00-\x1f\x7f]/.test(displayName.value)) { profileError.value = '昵称不能超过 40 个字符，也不能包含控制字符。'; return }
  profileBusy.value = true
  try {
    profile.value = await closetApi.updateProfile({ displayName: displayName.value.trim() || null })
    displayName.value = profile.value.displayName || ''; if (closet.user) closet.user.displayName = profile.value.displayName
    toast.success('个人资料已保存。')
  } catch (e) { profileError.value = e instanceof Error ? e.message : '个人资料未能保存。' }
  finally { profileBusy.value = false }
}
async function changePassword() {
  if (loading.value) return
  error.value = ''; success.value = ''
  if (newPassword.value.length < 12) { error.value = '新密码至少需要 12 个字符。'; return }
  if (newPassword.value !== repeatPassword.value) { error.value = '两次输入的新密码不一致。'; return }
  loading.value = true
  try {
    await closetApi.changePassword(currentPassword.value, newPassword.value, signOutOthers.value)
    if (closet.user) closet.user.mustChangePassword = false
    success.value = '密码已更新。'; currentPassword.value = ''; newPassword.value = ''; repeatPassword.value = ''
    if (props.firstLogin) emit('passwordChanged'); else await loadSessions()
  } catch (e) { error.value = e instanceof Error ? e.message : '密码未能更新。' }
  finally { loading.value = false }
}
async function signOutOtherDevices() {
  try { await message.confirm({ title: '退出其他设备？', msg: '当前设备会保持登录，其他设备会退出，便携登录授权也会被撤销。', confirmButtonText: '退出其他设备', cancelButtonText: '取消' }) } catch { return }
  try { const r = await closetApi.signOutOtherSessions(); toast.success(`已退出 ${r.revokedSessions} 个其他会话。`); await loadSessions() }
  catch (e) { toast.error(e instanceof Error ? e.message : '退出失败，请稍后重试。') }
}
async function deactivate() {
  if (deactivating.value) return
  deactivateError.value = ''
  if (!deactivatePassword.value) { deactivateError.value = '请输入当前密码。'; return }
  deactivating.value = true
  try { await closetApi.deactivate(deactivatePassword.value); closet.clearSession(); deactivateOpen.value = false; deactivatePassword.value = ''; uni.reLaunch({ url: '/pages/login/index' }) }
  catch (e) { deactivateError.value = e instanceof Error ? e.message : '注销未能完成。' }
  finally { deactivating.value = false }
}
function openDeactivation() { deactivatePassword.value = ''; deactivateError.value = ''; deactivateOpen.value = true }
</script>
<template>
  <view class="stack">
    <view v-if="!firstLogin" class="section stack">
      <view><view class="title">个人资料</view><view class="note">昵称用于界面展示，用户名用于登录，暂不支持修改。</view></view>
      <view v-if="profileError" class="error">{{ profileError }}<wd-button type="text" @click="loadProfile">重新加载</wd-button></view>
      <wd-skeleton v-if="!profile && !profileError" :row-col="[1, 1, 1]" />
      <template v-if="profile">
        <wd-input :model-value="profile.username" label="用户名" readonly />
        <wd-input v-model="displayName" label="昵称" :maxlength="40" placeholder="留空时显示用户名" />
        <wd-button :loading="profileBusy" @click="saveProfile">保存资料</wd-button>
        <view class="note">注册时间 {{ accountTime(profile.createdAtMs) }}<view>最近登录 {{ accountTime(profile.lastLoginAtMs) }}</view><view>注册来源 {{ registeredViaLabels[profile.registeredVia] || profile.registeredVia }}</view></view>
      </template>
    </view>
    <view class="section stack">
      <view><view class="title">{{ firstLogin ? '设置新密码' : '修改密码' }}</view><view class="note">密码至少 12 个字符，修改后立即生效。</view></view>
      <wd-input v-if="!firstLogin" v-model="currentPassword" label="当前密码" show-password placeholder="输入当前密码" />
      <wd-input v-model="newPassword" label="新密码" show-password placeholder="至少 12 个字符" />
      <wd-input v-model="repeatPassword" label="再输一次新密码" show-password placeholder="确认新密码" />
      <wd-checkbox v-model="signOutOthers">同时退出其他设备</wd-checkbox>
      <view v-if="error" class="error">{{ error }}</view><view v-if="success" class="success">{{ success }}</view>
      <wd-button block :loading="loading" @click="changePassword">{{ firstLogin ? '设置密码并开始使用' : '保存密码' }}</wd-button>
    </view>
    <template v-if="!firstLogin">
      <view class="section">
        <view class="title">登录设备</view><view class="note">查看仍在登录的设备，移除不再使用的会话。</view>
        <wd-button @click="signOutOtherDevices">退出其他设备</wd-button>
        <view v-if="sessionsError" class="error">{{ sessionsError }}<wd-button type="text" @click="loadSessions">重新加载</wd-button></view>
        <wd-loading v-if="sessionsLoading" />
        <wd-status-tip v-else-if="!sessions.length && !sessionsError" image="content" tip="暂无登录设备" />
        <view v-for="session in sessions" :key="session.sessionRef" class="item">
          <view>{{ session.device }} <wd-tag v-if="session.current" type="success">当前设备</wd-tag> <wd-tag v-if="session.portable">便携登录</wd-tag></view>
          <view class="note">登录于 {{ accountTime(session.createdAtMs) }}<view>最近活动 {{ accountTime(session.lastAccessAtMs) }}</view><view>到期时间 {{ accountTime(session.expiresAtMs) }}</view></view>
        </view>
      </view>
      <view class="section"><view class="title">注销账号</view><view class="note">注销后账号将停用，所有设备会退出。衣物和其他数据会保留，管理员可恢复账号。</view><wd-button type="error" plain @click="openDeactivation">注销账号</wd-button></view>
    </template>
    <wd-popup v-model="deactivateOpen" position="bottom" :close-on-click-modal="false" :closable="!deactivating" @after-leave="deactivatePassword = ''">
      <view class="sheet stack"><view class="title">确认注销账号</view><view class="note">注销会停用账号并退出全部设备，数据会保留，管理员可恢复账号。</view>
        <wd-input v-model="deactivatePassword" label="当前密码" show-password placeholder="输入密码确认注销" />
        <view v-if="deactivateError" class="error">{{ deactivateError }}</view>
        <wd-button type="error" :loading="deactivating" @click="deactivate">注销账号</wd-button><wd-button :disabled="deactivating" plain @click="deactivateOpen = false">取消</wd-button>
      </view>
    </wd-popup>
    <wd-toast /><wd-message-box />
  </view>
</template>
<style lang="scss" scoped>@import './me.scss';</style>
