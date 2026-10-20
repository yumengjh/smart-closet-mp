<script setup lang="ts">
import {ref} from 'vue'
import {onLoad} from '@dcloudio/uni-app'
import BatchIntake from '../../components/closet/BatchIntake.vue'
import {openAdd} from '../../components/closet/navigation'
const id=ref('')
onLoad(q=>id.value=String(q?.id||''))
</script>
<template><view class="page closet-page"><wd-button type="text" @click="openAdd('multiple')">返回添加衣物</wd-button><BatchIntake v-if="id" :key="id" :batch-id="id"/><wd-status-tip v-else image="content" tip="缺少批次编号，请返回添加衣物后查看最近录入。"/></view></template>
<style lang="scss" scoped>@import '../../components/closet/closet.scss';</style>
