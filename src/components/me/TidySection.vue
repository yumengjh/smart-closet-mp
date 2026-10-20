<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useToast } from 'wot-design-uni'
import { similarApi, type DuplicatePair, type DuplicateScan } from '../../services/me'
import type { ImageModelStatus } from '../../services/api'
import { appVisible } from '../../services/lifecycle'
import AuthImage from '../AuthImage.vue'
const toast = useToast(), pairs = ref<DuplicatePair[]>([]), scan = ref<DuplicateScan | null>(null), imageModel = ref<ImageModelStatus | null>(null)
const loading = ref(true), starting = ref(false), error = ref(''), busy = ref('')
const scanning = computed(() => ['QUEUED', 'RUNNING'].includes(scan.value?.status || ''))
let timer: ReturnType<typeof setTimeout> | undefined, alive = true
async function load() { loading.value = true; try { const r = await similarApi.duplicates(); pairs.value = r.items; imageModel.value = r.imageModel || null; error.value = '' } catch (e) { error.value = String(e) } finally { loading.value = false } }
async function watchScan() {
  if (!alive) return
  try { if (appVisible()) { const was = scanning.value, r = await similarApi.scanStatus(); scan.value = r.scan; imageModel.value = r.imageModel || imageModel.value; if (was && !scanning.value) { await load(); if (scan.value?.status === 'DONE') toast.success(scan.value.pairs ? `扫描完成：发现 ${scan.value.pairs} 对可能重复的衣物。` : '扫描完成：没有发现可能重复的衣物。'); else toast.error('扫描没有完成，请稍后再试。') } } }
  catch { /* Preserve scan state and retry. */ }
  if (alive) timer = setTimeout(watchScan, scanning.value ? 2000 : 10000)
}
async function startScan() { if (scanning.value || starting.value) return; starting.value = true; try { scan.value = (await similarApi.startScan()).scan } catch (e) { toast.error(String(e)) } finally { starting.value = false } }
const summary = computed(() => { const s = scan.value; if (!s) return '扫描在后台进行，完成后会在右上角提醒。'; if (scanning.value) return '正在扫描：先补齐图片指纹和图像识别，再逐对比对…'; const when = new Date(s.finishedAt || s.requestedAt).toLocaleString('zh-CN'); return s.status === 'DONE' ? `上次扫描 ${when}：${s.pairs ? `${s.pairs} 对可能重复` : '没有发现重复'}` : `上次扫描 ${when} 没有完成` })
async function dismiss(p: DuplicatePair) { busy.value = p.a.id + p.b.id; try { await similarApi.dismiss(p.a.id, p.b.id); pairs.value = pairs.value.filter(x => x !== p); toast.success('已记住：这两件不是重复。') } catch (e) { toast.error(String(e)) } finally { busy.value = '' } }
function garment(id: string) { uni.navigateTo({ url: '/pkg-closet/garment/index?id=' + encodeURIComponent(id) }) }
onMounted(() => { void load(); void watchScan() }); onUnmounted(() => { alive = false; clearTimeout(timer) })
</script>
<template>
  <view class="section stack"><view class="note">按图像、颜色、轮廓、外观和描述比对出的“可能重复录入”的衣物。只是提示，不会自动合并或删除；确认是重复的，可以打开其中一件移入回收站。新衣物入柜后会自动检查一次，发现可能重复会在右上角提醒你。</view>
    <wd-button :loading="starting || scanning" @click="startScan">{{ scanning ? '扫描中' : '一键扫描整个衣柜' }}</wd-button><view class="note">{{ summary }}</view>
    <view v-if="imageModel && imageModel.state !== 'READY'" class="note">{{ imageModel.message }}</view><view v-if="error" class="error">{{ error }}<wd-button type="text" @click="load">重试</wd-button></view><wd-loading v-if="loading" />
    <wd-status-tip v-else-if="!pairs.length && !error" image="content" tip="没有发现可能重复的衣物" />
    <view v-for="p in pairs" :key="p.a.id + p.b.id" class="item"><view class="thumbs"><view v-for="g in [p.a, p.b]" :key="g.id"><view class="thumb" @tap="garment(g.id)"><AuthImage v-if="g.displayUrl" :src="g.displayUrl" :width="320" /></view><wd-button type="text" @click="garment(g.id)">{{ g.name }}</wd-button></view></view><view class="note">{{ p.reasons.join('，') }}</view><wd-button size="small" :loading="busy === p.a.id + p.b.id" @click="dismiss(p)">不是重复</wd-button></view><wd-toast />
  </view>
</template>
<style lang="scss" scoped>@import './me.scss';</style>
