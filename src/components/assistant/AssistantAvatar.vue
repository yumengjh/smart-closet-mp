<script setup lang="ts">
/** Static CSS stand-in for the web's animated Bloub companion: a soft orb whose face follows the mood. */
withDefaults(defineProps<{ size?: number; mood?: 'idle' | 'thinking' | 'happy' | 'concern' }>(), { size: 72, mood: 'idle' })
</script>
<template>
  <view class="orb" :class="mood" :style="{ width: size + 'rpx', height: size + 'rpx' }">
    <view class="eyes"><view class="eye" /><view class="eye" /></view>
    <view class="mouth" />
  </view>
</template>
<style lang="scss" scoped>
.orb { position: relative; border-radius: 50%; background: radial-gradient(circle at 32% 28%, #8fd3b0, $accent 70%); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8%; flex-shrink: 0; box-shadow: 0 8rpx 20rpx rgba(31, 92, 69, .28); }
.eyes { display: flex; gap: 22%; }.eye { border-radius: 50%; background: #fff; width: 9rpx; height: 14rpx; }
.mouth { width: 22%; height: 8rpx; border-bottom: 5rpx solid #fff; border-radius: 0 0 20rpx 20rpx; }
.thinking { animation: pulse 1.4s ease-in-out infinite; }.happy .mouth { height: 12rpx; width: 30%; }.concern .mouth { border-bottom: 0; border-top: 5rpx solid #fff; border-radius: 20rpx 20rpx 0 0; margin-top: 6rpx; }
@keyframes pulse { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.08) } }
</style>
