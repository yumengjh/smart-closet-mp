<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToast, useMessage } from 'wot-design-uni'
import { platformRequest, type Pose, type PoseCatalog, type PoseChoice } from '../../services/platform'
import { upload } from '../../services/http'
import AuthImage from '../AuthImage.vue'
import PoseFigure from './PoseFigure.vue'
const props = defineProps<{ catalog: PoseCatalog | null; modelValue: PoseChoice; compact?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [PoseChoice]; changed: [] }>()
const toast = useToast(), message = useMessage(), tab = ref('预设动作'), extracting = ref(false), preview = ref(''), fresh = ref<Pose | null>(null), freshName = ref('')
const textOpen = ref(false), textForm = ref({ name: '', description: '' }), saving = ref(false), renaming = ref(false), renameValue = ref(''), expanded = ref(false)
const list = computed(() => tab.value === '预设动作' ? props.catalog?.presets || [] : props.catalog?.mine || [])
const selected = computed(() => { const v = props.modelValue; return v.mode === 'AUTO' ? null : [...(props.catalog?.presets || []), ...(props.catalog?.mine || [])].find(p => p.id === v.id) || null })
const left = computed(() => props.catalog ? Math.max(0, props.catalog.dailyExtractions - props.catalog.extractionsToday) : 0)
function pick(p: Pose) { emit('update:modelValue', { mode: p.source === 'PRESET' ? 'PRESET' : 'CUSTOM', id: p.id }) }
function auto() { emit('update:modelValue', { mode: 'AUTO' }) }
function chooseImage() {
  if (extracting.value || !left.value) return
  uni.chooseMedia({ count: 1, mediaType: ['image'], success: r => { const f = r.tempFiles[0]; if (!f) return; if (f.size > 20 * 1024 * 1024 || !/\.(png|jpe?g|webp)$/i.test(f.tempFilePath)) { toast.error('请选择 20MB 以内的 JPG、PNG 或 WebP 图片。'); return }; void extract(f.tempFilePath) } })
}
async function extract(path: string) {
  preview.value = path; extracting.value = true
  try { const p = await upload<Pose>('/api/ootd/poses/extract', path, { timeoutMs: 120000 }); emit('changed'); tab.value = '我的动作卡'; pick(p); fresh.value = p; freshName.value = p.name }
  catch (e) { toast.error(e instanceof Error ? e.message : String(e)) } finally { extracting.value = false; preview.value = '' }
}
async function keepFresh() { if (!fresh.value) return; try { if (freshName.value.trim() && freshName.value.trim() !== fresh.value.name) { await platformRequest(`/api/ootd/poses/${fresh.value.id}`, 'PATCH', { name: freshName.value.trim() }); emit('changed') }; fresh.value = null } catch (e) { toast.error(String(e)) } }
async function createText() {
  if (saving.value) return
  if (textForm.value.description.trim().length < 4) { toast.show('动作描述至少 4 个字。'); return }
  saving.value = true
  try { const p = await platformRequest<Pose>('/api/ootd/poses', 'POST', { ...textForm.value, tags: [] }); emit('changed'); tab.value = '我的动作卡'; pick(p); textOpen.value = false; textForm.value = { name: '', description: '' } }
  catch (e) { toast.error(e instanceof Error ? e.message : String(e)) } finally { saving.value = false }
}
function startRename() { if (selected.value) { renameValue.value = selected.value.name; renaming.value = true } }
async function rename() { if (!selected.value) return; try { await platformRequest(`/api/ootd/poses/${selected.value.id}`, 'PATCH', { name: renameValue.value }); renaming.value = false; emit('changed') } catch (e) { toast.error(String(e)) } }
async function remove() {
  const p = selected.value; if (!p) return
  try { await message.confirm({ title: `删除动作卡「${p.name}」？`, msg: '已生成的图片不受影响。', confirmButtonText: '删除', cancelButtonText: '取消' }) } catch { return }
  try { await platformRequest(`/api/ootd/poses/${p.id}`, 'DELETE'); auto(); emit('changed') } catch (e) { toast.error(String(e)) }
}
</script>
<template>
  <view class="stack">
    <view class="actions"><wd-button :plain="modelValue.mode !== 'AUTO'" size="small" @click="auto">自动</wd-button><wd-button size="small" plain :disabled="extracting || !left" :loading="extracting" @click="chooseImage">从图片提取</wd-button><wd-button size="small" plain @click="textOpen = true">文字描述</wd-button></view>
    <view class="note">按衣服风格挑动作 · {{ !left ? '今天次数已用完' : '生成动作卡' }} · 写下想要的动作</view>
    <view v-if="extracting" class="row"><view class="thumb"><AuthImage :src="preview" /></view><view><wd-loading /><view>正在提取动作…</view><view class="note">只保留姿势，不保存这张图片。</view></view></view>
    <wd-button v-if="compact && !expanded && modelValue.mode === 'AUTO'" type="text" @click="expanded = true">浏览动作卡</wd-button>
    <template v-else><wd-segmented v-model:value="tab" :options="['预设动作', '我的动作卡']" /><view v-if="tab === '我的动作卡'" class="note">我的动作卡 {{ catalog?.mine.length || 0 }}</view>
      <view v-if="list.length" class="poses"><view v-for="p in list" :key="p.id" class="pose" :class="{ selected: modelValue.mode !== 'AUTO' && modelValue.id === p.id }"><PoseFigure :pose="p" /><wd-button size="small" :plain="modelValue.mode === 'AUTO' || modelValue.id !== p.id" @click="pick(p)">{{ p.name }}</wd-button><view class="note">{{ p.tags.join(' · ') }}</view></view></view><wd-status-tip v-else image="content" tip="上传一张喜欢的姿势图，生成你的第一张动作卡" />
    </template>
    <view v-if="selected"><view class="title">{{ selected.name }}</view><view class="note">{{ selected.description }}</view><view v-if="selected.source !== 'PRESET'" class="actions"><wd-button size="small" plain @click="startRename">改名</wd-button><wd-button size="small" type="error" plain @click="remove">删除</wd-button></view></view>
    <wd-popup :model-value="!!fresh" position="bottom" :close-on-click-modal="false"><view v-if="fresh" class="sheet stack"><view class="title">动作卡已生成</view><PoseFigure :pose="fresh" /><wd-input v-model="freshName" :maxlength="12" label="动作名称" /><view class="actions"><wd-tag v-for="t in fresh.tags" :key="t">{{ t }}</wd-tag></view><view class="note">{{ fresh.description }}</view><wd-button @click="keepFresh">就用这个</wd-button><wd-button plain @click="keepFresh">关闭</wd-button></view></wd-popup>
    <wd-popup v-model="textOpen" position="bottom" closable><view class="sheet stack"><view class="title">用文字新建动作</view><wd-input v-model="textForm.name" label="名称" :maxlength="12" placeholder="例如：比心" /><wd-textarea v-model="textForm.description" label="动作描述" :maxlength="300" show-word-limit placeholder="例如：正面站立，双手在胸前比心，头微微歪向一侧" /><wd-button :loading="saving" @click="createText">保存动作卡</wd-button><wd-button plain @click="textOpen = false">取消</wd-button></view></wd-popup>
    <wd-popup v-model="renaming" position="bottom" closable><view class="sheet stack"><view class="title">动作卡改名</view><wd-input v-model="renameValue" label="动作名称" :maxlength="12" /><wd-button @click="rename">保存</wd-button><wd-button plain @click="renaming = false">取消</wd-button></view></wd-popup><wd-toast /><wd-message-box />
  </view>
</template>
<style lang="scss" scoped>@import './me.scss';.poses { display: flex; gap: 16rpx; flex-wrap: wrap; }.pose { display: flex; flex-direction: column; gap: 12rpx; align-items: center; border: 2rpx solid $line; border-radius: $radius-md; padding: 10rpx; width: 180rpx; }.selected { border-color: $accent; background: $accent-soft; }</style>
