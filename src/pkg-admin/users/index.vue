<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad, onReachBottom, onPullDownRefresh, onUnload } from '@dcloudio/uni-app'
import { useMessage, useToast } from 'wot-design-uni'
import { closetApi, type AdminUser, type AdminUsersQuery, type AdminRegistration, type RegistrationInvite, type TemporaryPassword, type InviteCreated, type AccountQuota, type AccountEvent, type UserRole } from '../../services/api'
import { apiBase, clearCookies } from '../../services/http'
import { useClosetStore } from '../../stores/closet'
import { accountTime, registeredViaLabels, accountEventLabel } from '../../domain/account'
import OpsSheet from '../../components/ops/OpsSheet.vue'
import { requireAdmin, errorText, copy as copyValue } from '../../components/ops/utils'
const closet = useClosetStore(), message = useMessage(), toast = useToast()
const allowed = ref(false), tab = ref('users'), error = ref(''), usersBusy = ref(false), invitesBusy = ref(false), actionBusy = ref(false)
const query = reactive<AdminUsersQuery>({ q:'', page:1, size:20 }), search = ref(''), statusFilter = ref(''), roleFilter = ref('')
const users = ref<AdminUser[]>([]), total = ref(0), registration = ref<AdminRegistration>(), invites = ref<RegistrationInvite[]>([]), inviteCount = ref(10)
let usersRequest = 0, detailRequest = 0
const roleOptions = [{ value:'ADMIN', label:'管理员' },{ value:'USER', label:'普通用户' }]
const statusOptions = [{ value:'', label:'全部状态' },{ value:'ENABLED', label:'已启用' },{ value:'DISABLED', label:'已停用' }]
const inviteLabels = { ACTIVE:'有效', USED_UP:'已用完', EXPIRED:'已过期', REVOKED:'已撤销' }
const modeLabels = { CLOSED:'关闭注册', INVITE:'邀请注册', OPEN:'公开注册' }
const modeDescriptions = { CLOSED:'当前关闭自助注册，用户由管理员创建。', INVITE:'注册时必须提供有效邀请码，管理员可在下方创建并分享。', OPEN:'任何人都可以注册；填写邀请码时会核销名额并记录来源。' }
async function loadUsers(append = false) {
  if (!allowed.value || closet.user?.portableLogin || usersBusy.value && append) return
  const serial = ++usersRequest, targetPage = append ? query.page + 1 : query.page
  usersBusy.value = true; error.value = ''
  try {
    const result = await closetApi.adminUsers({ ...query, page:targetPage })
    if (serial !== usersRequest) return
    total.value = result.total; users.value = append ? [...users.value, ...result.items] : result.items; query.page = targetPage
    if (!result.items.length && result.total > 0 && targetPage > 1) { query.page = Math.ceil(result.total / query.size); await loadUsers() }
  } catch(e) { if (serial === usersRequest) error.value = errorText(e, '用户列表暂时无法加载。') } finally { if (serial === usersRequest) usersBusy.value = false }
}
function filterUsers() { query.q = search.value.trim(); query.status = (statusFilter.value || undefined) as AdminUsersQuery['status']; query.role = (roleFilter.value || undefined) as UserRole | undefined; query.page = 1; void loadUsers() }
function pageUsers(delta: number) { if (usersBusy.value) return; query.page += delta; void loadUsers() }
async function loadInvites() { if (!allowed.value || closet.user?.portableLogin) return; invitesBusy.value = true; error.value = ''; try { const result = await Promise.all([closetApi.adminRegistration(), closetApi.adminInvites()]); registration.value = result[0]; invites.value = result[1] } catch(e) { error.value = errorText(e, '邀请码暂时无法加载。') } finally { invitesBusy.value = false } }
onLoad(async () => { allowed.value = await requireAdmin(); if (allowed.value) await Promise.all([loadUsers(), loadInvites()]) })
onUnload(() => { usersRequest++; detailRequest++; password.value = undefined; inviteResult.value = undefined })
onReachBottom(() => { if (tab.value === 'users' && users.value.length < total.value && query.page * query.size < total.value) void loadUsers(true); else if (tab.value === 'invites') inviteCount.value += 10 })
onPullDownRefresh(async () => { try { await (tab.value === 'users' ? loadUsers() : loadInvites()) } finally { uni.stopPullDownRefresh() } })
const createOpen = ref(false), createBusy = ref(false), createError = ref(''), newUser = reactive({ username:'', displayName:'', role:'USER' as UserRole })
const password = ref<TemporaryPassword>(), signOutAfterPassword = ref(false)
function openCreateUser() { Object.assign(newUser, { username:'', displayName:'', role:'USER' }); createError.value = ''; createOpen.value = true }
async function createUser() {
  if (createBusy.value) return
  createError.value = ''
  if (!/^[A-Za-z0-9_.-]{2,80}$/.test(newUser.username)) { createError.value = '用户名需为 2–80 个字符，只能包含字母、数字、下划线、点和短横线。'; return }
  if (newUser.displayName.trim().length > 40 || /[\x00-\x1f\x7f]/.test(newUser.displayName)) { createError.value = '昵称不能超过 40 个字符，也不能包含控制字符。'; return }
  createBusy.value = true
  try { password.value = await closetApi.adminCreateUser({ ...newUser, displayName:newUser.displayName.trim() || undefined }); createOpen.value = false; await loadUsers() } catch(e) { createError.value = errorText(e, '用户未能创建。') } finally { createBusy.value = false }
}
function signOut() { clearCookies(); closet.clearSession(); uni.reLaunch({ url:'/pages/login/index' }) }
function closePassword() { password.value = undefined; if (signOutAfterPassword.value) { signOutAfterPassword.value = false; signOut() } }
async function copy(value: string) { try { await copyValue(value); toast.success('已复制。') } catch { toast.warning('无法访问剪贴板，请选中内容手动复制。') } }
async function confirmUser(user: AdminUser, action: 'status' | 'role' | 'password' | 'sessions') {
  if (actionBusy.value || (['status','role'].includes(action) && user.username === closet.user?.username)) return
  const self = user.username === closet.user?.username
  const titles = { status:`${user.enabled ? '停用' : '启用'}用户 ${user.username}？`, role:`${user.role === 'ADMIN' ? '设为普通用户' : '设为管理员'}：${user.username}？`, password:`重置 ${user.username} 的密码？`, sessions:`退出 ${user.username} 的全部会话？` }
  const contents = { status:user.enabled ? '停用后该用户将无法登录，现有会话也会退出。' : '启用后该用户可以重新登录；已注销账号的注销标记会清除。', role:'角色变更会调整管理权限，现有会话可能退出。', password:'现有会话将退出，用户下次登录时必须修改临时密码。', sessions:'该用户所有设备将退出登录，便携登录授权也会撤销。' }
  try { await message.confirm({ title:titles[action], msg:contents[action], confirmButtonText:'确认', cancelButtonText:'取消' }) } catch { return }
  actionBusy.value = true
  try {
    if (action === 'status') await closetApi.adminSetUserStatus(user.username, { enabled:!user.enabled })
    if (action === 'role') await closetApi.adminSetUserRole(user.username, { role:user.role === 'ADMIN' ? 'USER' : 'ADMIN' })
    if (action === 'password') { password.value = await closetApi.adminResetPassword(user.username); signOutAfterPassword.value = self }
    if (action === 'sessions') await closetApi.adminRevokeSessions(user.username)
    toast.success('操作已完成。')
    if (self && action === 'sessions') { signOut(); return }
    // Do not make a now-unauthorized request before the one-time password is saved.
    if (!(self && action === 'password')) await loadUsers()
  } catch(e) { toast.error(errorText(e, '操作未能完成。')) } finally { actionBusy.value = false }
}
const detailOpen = ref(false), selected = ref<AdminUser>(), quota = ref<AccountQuota>(), events = ref<AccountEvent[]>([]), detailBusy = ref(false), detailError = ref(''), quotaBusy = ref(false)
const limits = reactive({ image:'', agent:'' })
async function openDetails(user: AdminUser) {
  selected.value = user; detailOpen.value = true; quota.value = undefined; events.value = []; detailError.value = ''; detailBusy.value = true; limits.image = ''; limits.agent = ''; const serial = ++detailRequest
  try { const [snapshot, recent] = await Promise.all([closetApi.adminUserQuota(user.username), closetApi.adminUserEvents(user.username)]); if (serial !== detailRequest || !detailOpen.value) return; quota.value = snapshot; events.value = recent; limits.image = snapshot.image.overridden ? String(snapshot.image.limit) : ''; limits.agent = snapshot.agent.overridden ? String(snapshot.agent.limit) : '' } catch(e) { if (serial === detailRequest) detailError.value = errorText(e, '详情暂时无法加载。') } finally { if (serial === detailRequest) detailBusy.value = false }
}
async function saveQuota() {
  if (!selected.value || !quota.value || quotaBusy.value) return
  if ([limits.image, limits.agent].some(v => v !== '' && (!/^\d+$/.test(v) || !Number.isSafeInteger(Number(v))))) { detailError.value = '额度需为非负整数；留空恢复默认额度。'; return }
  const username = selected.value.username, serial = detailRequest; quotaBusy.value = true; detailError.value = ''
  try { const result = await closetApi.adminUpdateQuota(username, { imageDailyLimit:limits.image === '' ? null : Number(limits.image), agentDailyLimit:limits.agent === '' ? null : Number(limits.agent) }); if (serial !== detailRequest || !detailOpen.value) return; quota.value = result; toast.success('每日额度已保存。'); const recent = await closetApi.adminUserEvents(username); if (serial === detailRequest) events.value = recent } catch(e) { detailError.value = errorText(e, '额度未能保存。') } finally { quotaBusy.value = false }
}
const inviteOpen = ref(false), inviteBusy = ref(false), inviteError = ref(''), newInvite = reactive({ note:'', maxUses:1, expiresInDays:7 }), inviteResult = ref<InviteCreated>()
const inviteUrl = computed(() => inviteResult.value ? `${apiBase()}/register?invite=${encodeURIComponent(inviteResult.value.code)}` : '')
function openCreateInvite() { Object.assign(newInvite, { note:'', maxUses:1, expiresInDays:7 }); inviteError.value = ''; inviteOpen.value = true }
async function createInvite() {
  if (inviteBusy.value) return
  inviteError.value = ''
  if (!Number.isInteger(newInvite.maxUses) || newInvite.maxUses < 1 || newInvite.maxUses > 100 || !Number.isInteger(newInvite.expiresInDays) || newInvite.expiresInDays < 1 || newInvite.expiresInDays > 90) { inviteError.value = '名额需为 1–100 的整数，有效期需为 1–90 天。'; return }
  inviteBusy.value = true
  try { inviteResult.value = await closetApi.adminCreateInvite({ ...newInvite, note:newInvite.note.trim() || undefined }); inviteOpen.value = false; await loadInvites() } catch(e) { inviteError.value = errorText(e, '邀请码未能创建。') } finally { inviteBusy.value = false }
}
async function revokeInvite(invite: RegistrationInvite) {
  if (actionBusy.value) return
  try { await message.confirm({ title:'撤销这个邀请码？', msg:'撤销后不能再用于注册，已经注册的账号不受影响。', confirmButtonText:'撤销', cancelButtonText:'取消' }) } catch { return }
  actionBusy.value = true
  try { await closetApi.adminRevokeInvite(invite.id); toast.success('邀请码已撤销。'); await loadInvites() } catch(e) { toast.error(errorText(e, '撤销失败。')) } finally { actionBusy.value = false }
}
</script>
<template>
  <view v-if="allowed" class="page ops-page"><view class="ops-heading"><view class="ops-eyebrow">管理员</view><text class="ops-title">用户管理</text><view class="ops-subtitle">管理账号、每日额度和邀请码。</view></view>
    <view v-if="closet.user?.portableLogin" class="ops-alert">便携登录无法管理账号，请退出后使用账号密码登录。</view><template v-else>
      <view v-if="error" class="ops-alert ops-error">{{ error }}</view><wd-tabs v-model="tab"><wd-tab name="users" title="用户" /><wd-tab name="invites" title="邀请码" /></wd-tabs>
      <view v-if="tab === 'users'"><view class="ops-section"><view class="ops-between"><text class="ops-h2">用户</text><wd-button size="small" @click="openCreateUser">新建用户</wd-button></view><view class="ops-copy">按用户名或昵称查找，查看账号状态与登录记录。</view><wd-input v-model="search" :maxlength="80" clearable placeholder="搜索用户名或昵称" @confirm="filterUsers" /><wd-picker v-model="statusFilter" label="用户状态" :columns="statusOptions" @confirm="filterUsers" /><wd-picker v-model="roleFilter" label="用户角色" :columns="[{ value:'', label:'全部角色' }, ...roleOptions]" @confirm="filterUsers" /><wd-picker v-model="query.size" label="每页条数" :columns="[{ value:10, label:'10' },{ value:20, label:'20' },{ value:50, label:'50' }]" @confirm="filterUsers" /><view class="ops-actions"><wd-button size="small" :loading="usersBusy" @click="filterUsers">搜索</wd-button><wd-button size="small" plain :disabled="usersBusy" @click="loadUsers()">刷新</wd-button></view></view>
        <view class="ops-meta">共 {{ total }} 位用户</view><wd-skeleton v-if="usersBusy && !users.length" :row-col="[1,1,1,1]" animation="gradient" /><view v-for="user in users" :key="user.username" class="ops-section"><text class="ops-h2">{{ user.username }}</text><view class="ops-copy">{{ user.displayName || '未设置昵称' }}</view><view class="ops-tags"><wd-tag plain>{{ user.role === 'ADMIN' ? '管理员' : '普通用户' }}</wd-tag><wd-tag :type="user.enabled ? 'success' : 'default'" plain>{{ user.enabled ? '已启用' : user.deactivatedAtMs ? '已注销' : '已停用' }}</wd-tag></view><view class="ops-meta">注册来源：{{ registeredViaLabels[user.registeredVia] || user.registeredVia }}</view><view class="ops-meta">注册时间：{{ accountTime(user.createdAtMs) }}</view><view class="ops-meta">最近登录：{{ accountTime(user.lastLoginAtMs) }}</view><view class="ops-meta">衣物数：{{ user.garmentCount }}</view><view class="ops-actions"><wd-button size="small" @click="openDetails(user)">详情</wd-button><wd-button size="small" plain :disabled="actionBusy || user.username === closet.user?.username" @click="confirmUser(user,'status')">{{ user.enabled ? '停用' : '启用' }}</wd-button><wd-button size="small" plain :disabled="actionBusy || user.username === closet.user?.username" @click="confirmUser(user,'role')">{{ user.role === 'ADMIN' ? '设为普通用户' : '设为管理员' }}</wd-button><wd-button size="small" type="text" :disabled="actionBusy" @click="confirmUser(user,'password')">重置密码</wd-button><wd-button size="small" type="text" :disabled="actionBusy" @click="confirmUser(user,'sessions')">退出全部会话</wd-button></view></view><wd-status-tip v-if="!usersBusy && !users.length && !error" image="content" tip="暂无用户" /><view class="ops-actions"><wd-button size="small" plain :disabled="query.page === 1 || usersBusy" @click="pageUsers(-1)">上一页</wd-button><text class="ops-meta">第 {{ query.page }} 页</text><wd-button size="small" plain :disabled="query.page * query.size >= total || usersBusy" @click="pageUsers(1)">下一页</wd-button></view>
      </view>
      <view v-else class="ops-section"><text class="ops-h2">注册与邀请</text><view class="ops-copy">注册方式默认取部署配置，可在后台管理平台调整。</view><view class="ops-actions"><wd-button size="small" plain :loading="invitesBusy" @click="loadInvites">刷新</wd-button><wd-button size="small" @click="openCreateInvite">创建邀请码</wd-button></view><template v-if="registration"><view class="ops-tags"><wd-tag plain>{{ modeLabels[registration.mode] }}</wd-tag><text class="ops-meta">有效邀请码 {{ registration.activeInviteCount }} 个</text></view><view class="ops-copy">{{ modeDescriptions[registration.mode] }}如需调整注册方式，请在后台管理平台修改。</view></template><wd-skeleton v-if="invitesBusy" :row-col="[1,1,1]" animation="gradient" /><view v-for="invite in invites.slice(0,inviteCount)" :key="invite.id" class="ops-row"><view class="ops-between"><text>{{ invite.note || '—' }}</text><wd-tag plain>{{ inviteLabels[invite.status] }}</wd-tag></view><view class="ops-copy">已用 / 名额：{{ invite.usedCount }} / {{ invite.maxUses }}</view><view class="ops-meta">创建者：{{ invite.createdBy }}</view><view class="ops-meta">创建时间：{{ accountTime(invite.createdAtMs) }}</view><view class="ops-meta">到期时间：{{ accountTime(invite.expiresAtMs) }}</view><wd-button type="text" size="small" :disabled="invite.status !== 'ACTIVE' || actionBusy" @click="revokeInvite(invite)">撤销</wd-button></view><wd-status-tip v-if="!invitesBusy && !invites.length" image="content" tip="暂无邀请码" /><wd-button v-if="inviteCount < invites.length" type="text" @click="inviteCount += 10">加载更多</wd-button></view>
    </template>
    <OpsSheet v-model="createOpen" title="新建用户" :busy="createBusy"><wd-input v-model="newUser.username" label="用户名" :maxlength="80" placeholder="2–80 位字母、数字或 _ . -" /><wd-input v-model="newUser.displayName" label="昵称（可选）" :maxlength="40" placeholder="最多 40 个字符" /><wd-picker v-model="newUser.role" label="角色" :columns="roleOptions" /><view v-if="createError" class="ops-alert ops-error">{{ createError }}</view><view class="ops-actions"><wd-button :loading="createBusy" @click="createUser">创建用户</wd-button><wd-button plain :disabled="createBusy" @click="createOpen = false">取消</wd-button></view></OpsSheet>
    <OpsSheet :model-value="!!password" title="保存临时密码" persistent><template v-if="password"><view class="ops-alert ops-warning">临时密码只显示这一次，请立即保存并交给用户。首次登录必须修改密码。</view><view class="ops-copy">用户名：{{ password.username }}</view><view class="ops-secret"><text selectable>{{ password.temporaryPassword }}</text></view><view class="ops-actions"><wd-button @click="copy(password.temporaryPassword)">复制临时密码</wd-button><wd-button plain @click="closePassword">已保存，关闭</wd-button></view></template></OpsSheet>
    <OpsSheet v-model="detailOpen" :title="selected ? `${selected.displayName || selected.username} · 用户详情` : '用户详情'" :busy="quotaBusy" @closed="detailRequest++"><template v-if="selected"><view class="ops-copy">用户名：{{ selected.username }}</view><view class="ops-copy">角色：{{ selected.role === 'ADMIN' ? '管理员' : '普通用户' }}</view><view class="ops-copy">首次登录改密：{{ selected.mustChangePassword ? '需要' : '无需' }}</view><view v-if="detailError" class="ops-alert ops-error">{{ detailError }}<wd-button v-if="!quota" type="text" @click="openDetails(selected)">重新加载</wd-button></view><wd-skeleton v-if="detailBusy" :row-col="[1,1,1]" animation="gradient" /><text class="ops-h3">每日额度</text><template v-if="quota"><view class="ops-copy">留空恢复默认额度；每日按北京时间重置。</view><view class="ops-meta">图像任务（已用 {{ quota.image.used }} / {{ quota.image.limit }}，{{ quota.image.overridden ? '自定义' : '默认' }}）</view><wd-input v-model="limits.image" type="number" label="图像任务" placeholder="默认额度" /><view class="ops-meta">助手消息（已用 {{ quota.agent.used }} / {{ quota.agent.limit }}，{{ quota.agent.overridden ? '自定义' : '默认' }}）</view><wd-input v-model="limits.agent" type="number" label="助手消息" placeholder="默认额度" /><view class="ops-actions"><wd-button :loading="quotaBusy" @click="saveQuota">保存额度</wd-button></view><view class="ops-meta">下次重置 {{ accountTime(quota.resetAtMs) }}</view></template><text class="ops-h3">最近账号事件</text><wd-status-tip v-if="!events.length && !detailBusy" image="content" tip="暂无账号事件" /><view v-for="(event,index) in events" :key="index" class="ops-row"><text>{{ accountEventLabel(event.action) }}</text><view class="ops-meta">{{ accountTime(event.occurredAtMs) }} · {{ event.actor }}</view><view v-if="event.detail" class="ops-copy">{{ event.detail }}</view></view></template></OpsSheet>
    <OpsSheet v-model="inviteOpen" title="创建邀请码" :busy="inviteBusy"><wd-input v-model="newInvite.note" label="备注（可选）" placeholder="便于区分用途或接收人" /><view class="ops-field"><text class="ops-label">可注册名额</text><wd-input-number v-model="newInvite.maxUses" :min="1" :max="100" /></view><view class="ops-field"><text class="ops-label">有效期（天）</text><wd-input-number v-model="newInvite.expiresInDays" :min="1" :max="90" /></view><view v-if="inviteError" class="ops-alert ops-error">{{ inviteError }}</view><view class="ops-actions"><wd-button :loading="inviteBusy" @click="createInvite">创建邀请码</wd-button><wd-button plain :disabled="inviteBusy" @click="inviteOpen = false">取消</wd-button></view></OpsSheet>
    <OpsSheet :model-value="!!inviteResult" title="保存邀请码" persistent><template v-if="inviteResult"><view class="ops-alert ops-warning">邀请码和邀请链接只显示这一次，请立即保存。关闭后无法再次查看，可撤销后重新创建。</view><text class="ops-label">邀请码</text><view class="ops-secret"><text selectable>{{ inviteResult.code }}</text></view><text class="ops-label">邀请链接</text><view class="ops-secret"><text selectable>{{ inviteUrl }}</text></view><view class="ops-actions"><wd-button @click="copy(inviteResult.code)">复制邀请码</wd-button><wd-button plain @click="copy(inviteUrl)">复制邀请链接</wd-button><wd-button plain @click="inviteResult = undefined">已保存，关闭</wd-button></view></template></OpsSheet>
  </view><wd-toast /><wd-message-box />
</template>
<style scoped lang="scss">@import '../../components/ops/shared.scss';</style>
