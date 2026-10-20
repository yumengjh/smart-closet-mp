<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { useClosetStore } from './stores/closet'

onLaunch(() => {
  const closet = useClosetStore()
  uni.$on('closet-session-expired', () => { closet.signedOut(); uni.reLaunch({ url: '/pages/login/index' }) })
  uni.$on('closet-password-change-required', () => { closet.passwordRequired(); uni.reLaunch({ url: '/pages/settings/index?firstLogin=1' }) })
  void closet.ensureUser().then(() => { if (!closet.user) uni.reLaunch({ url: '/pages/login/index' }) })
})
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
</style>
