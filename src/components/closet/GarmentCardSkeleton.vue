<script setup lang="ts">defineProps<{label:string}>()</script>
<template><view class="loading"><text>{{label}}</text><wd-skeleton v-for="n in 3" :key="n" theme="image" :row-col="[{width:'100%',height:'400rpx'},1,1]" animation="gradient" /></view></template>
<style lang="scss" scoped>.loading{display:flex;flex-direction:column;gap:28rpx;color:$muted;padding:24rpx 0}</style>
