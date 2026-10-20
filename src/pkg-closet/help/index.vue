<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { helpApi, type Article } from '../../services/help'
import { markdownNodes } from '../../components/ops/markdown'
import { go, errorText } from '../../components/ops/utils'
const articles = ref<Article[]>([]), articleId = ref(''), error = ref(''), loading = ref(true)
const current = computed(() => articles.value.find(a => a.id === articleId.value) || articles.value[0])
const columns = computed(() => articles.value.map(a => ({ value:a.id, label:a.title })))
const nodes = computed(() => markdownNodes(current.value?.markdown || ''))
async function load() { loading.value = true; error.value = ''; try { articles.value = await helpApi.list(); if (!articles.value.some(a => a.id === articleId.value)) articleId.value = articles.value[0]?.id || '' } catch(e) { error.value = errorText(e, '帮助资料无法加载。') } finally { loading.value = false } }
onLoad(query => { articleId.value = String(query?.article || ''); void load() })
</script>
<template>
  <view class="page ops-page"><view class="ops-heading"><view class="ops-eyebrow">平台使用指南</view><text class="ops-title">鱼搭帮助</text><view class="ops-subtitle">与助手共享的说明资料，依据当前平台功能维护。</view></view>
    <view v-if="error" class="ops-alert ops-error">{{ error }}<wd-button type="text" size="small" @click="load">重试</wd-button></view><wd-skeleton v-if="loading" :row-col="[1,1,1,1,1]" animation="gradient" /><template v-else><wd-picker v-model="articleId" label="帮助文章" :columns="columns" /><view class="ops-section"><rich-text v-if="current" :nodes="nodes" selectable /><wd-status-tip v-else-if="!error" image="content" tip="暂无帮助文章" /><view class="ops-meta">没有找到需要的说明时，助手会明确表示暂时不知道。你可以向平台反馈；当前版本尚无反馈提交入口。</view></view></template><wd-button type="text" @click="go('/wardrobe')">回到我的衣柜 ↗</wd-button>
  </view>
</template>
<style scoped lang="scss">@import '../../components/ops/shared.scss';</style>
