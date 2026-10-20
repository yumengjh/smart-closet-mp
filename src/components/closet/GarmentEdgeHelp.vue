<script setup lang="ts">
import {ref} from 'vue'
const open=ref(false)
const guides=[{title:'背景与衣物分开',body:'浅色衣物配稍深的背景，深色衣物配浅一些的背景。避免白衣融进白床单、黑衣融进暗处。'},{title:'保留细小结构',body:'蕾丝、薄纱、流苏、毛边，以及细肩带和鞋带要放大检查。细线、孔洞和半透明区域可能被误删。'},{title:'让轮廓完整入镜',body:'衣物四周留一点空隙，手、手机和其他衣物尽量别挡住。多件同框时分开放，减少互相遮挡。'}]
</script>
<template><wd-button type="text" @click="open=true">衣物边缘与拍摄建议</wd-button><wd-popup v-model="open" position="bottom" closable><view class="sheet"><text class="sheet-title">让衣物边缘更清楚</text><text class="subtitle">不用拍成商品图。换一个背景、留一点空隙，往往更容易处理。</text><view v-for="guide in guides" :key="guide.title" class="section"><text class="section-title">{{guide.title}}</text><text class="subtitle">{{guide.body}}</text></view><wd-notice-bar text="处理完成后，先看边缘，再确认入柜。对照原图放大检查：领口、袖口、裙摆、鞋带和细肩带是否完整；蕾丝孔洞、薄纱透感是否保留；四周有没有背景残留或白边。" :scrollable="false" wrapable/><text class="section-title">如果边缘不理想</text><text class="subtitle">仅背景残留：重新去背景。\n细节被遮住或融进背景：换背景、补拍一张，再处理。</text><text class="hint">原图保留，核对时随时可以对照。</text><view class="actions"><wd-button block @click="open=false">我知道了</wd-button></view></view></wd-popup></template>
<style lang="scss" scoped>@import './closet.scss';.section-title{margin-top:24rpx}</style>
