<script setup lang="ts">
import { watch } from 'vue'
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { useClosetStore } from './stores/closet'
import { useProcessingStore } from './stores/processing'
import { useNotificationStore } from './stores/notifications'

const closet = useClosetStore(), processing = useProcessingStore(), notices = useNotificationStore()

function onLoginPage() {
  const pages = getCurrentPages()
  return pages.length > 0 && (pages[pages.length - 1] as { route?: string }).route === 'pages/login/index'
}

onLaunch(() => {
  uni.$on('closet-session-expired', () => { closet.signedOut(); uni.reLaunch({ url: '/pages/login/index' }) })
  uni.$on('closet-password-change-required', () => { closet.passwordRequired(); uni.reLaunch({ url: '/pages/settings/index?firstLogin=1' }) })
  void closet.ensureUser().then(() => { if (!closet.user && !onLoginPage()) uni.reLaunch({ url: '/pages/login/index' }) })
})
onShow(() => { void closet.refreshCounts() })

// One owner for the background monitors (like the web ClosetShell): they follow the signed-in user, on every page.
watch(() => [closet.user?.username, closet.user?.mustChangePassword] as const, ([name, mustChange]) => {
  if (name && !mustChange) { processing.start(name); notices.start(); void closet.refreshCounts() }
  else { processing.stop(); notices.stop() }
}, { immediate: true })
// A finished task or a new notice may change the 未入柜 count; announce results wherever the user happens to be.
watch(() => processing.latestNotice, entry => { if (!entry) return; void closet.refreshCounts(); uni.showToast({ title: `${entry.stage}：${entry.title}`.slice(0, 40), icon: 'none', duration: 3500 }) })
watch(() => notices.latest, notice => { if (notice) void closet.refreshCounts() })
</script>

<style lang="scss">
/* Theme wot-design-uni with the product's accent (see ../smart-closet/src/style.css). */
page {
  --wot-color-theme: #1f5c45;
  --wot-color-success: #1f8a6e;
  --wot-color-warning: #956516;
  --wot-color-danger: #bd4b4b;
  --wot-button-primary-bg-color: #25262b;
  color: $ink;
  background: $paper;
  font-family: 'PingFang SC', 'Hiragino Sans GB', system-ui, sans-serif;
  font-size: 28rpx;
}
.page { min-height: 100vh; padding: 24rpx 32rpx calc(24rpx + env(safe-area-inset-bottom)); box-sizing: border-box; }
.muted { color: $muted; font-size: 26rpx; }
.card { background: $surface; border-radius: $radius-lg; padding: 28rpx; }
/* wot-design-uni hard-codes white surfaces; follow the theme variable (set per page by the dark theme). */
.wd-popup, .wd-cell, .wd-cell-group, .wd-cell-group__title, .wd-cell-group__body, .wd-tabs, .wd-tabs__nav, .wd-search, .wd-picker__popup, .wd-action-sheet, .wd-message-box { background: $surface !important; color: $ink; }
.wd-search__block, .wd-search__input { color: $ink; }
</style>
