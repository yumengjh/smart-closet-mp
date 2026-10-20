<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { closetApi, type Garment } from '../../services/api'
import type { PersonCatalog, PersonPart } from '../../domain/person-stickers'
import { artworkForGarment } from '../../domain/outfit-images'
import { formatGarmentLabel, outfitRoleOptions, roleFromGarment, type OutfitElement } from '../../domain/outfit'
import { navigateOutfitLink } from '../../services/outfit'
import AuthImage from '../AuthImage.vue'
const props = defineProps<{ elements: OutfitElement[]; replacing?: boolean; adding?: boolean }>()
const emit = defineEmits<{ (e: 'garment', garment: Garment): void; (e: 'person', part: PersonPart): void; (e: 'cancel'): void }>()
const material = ref('我的衣物'), search = ref(''), role = ref('ALL'), garments = ref<Garment[]>([]), loading = ref(false), error = ref('')
const catalog = ref<PersonCatalog | null>(null), loadingPeople = ref(false), peopleError = ref(''), personMode = ref('角色套装'), selectedSet = ref('chibi'), personSearch = ref('')
const roles = [{ value: 'ALL', label: '全部分类' }, ...outfitRoleOptions]
const filtered = computed(() => garments.value.filter(g => (!search.value.trim() || [g.name, ...g.category, ...g.primaryColor, ...g.brand, ...g.styles, ...g.seasons].join(' ').toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())) && (role.value === 'ALL' || roleFromGarment(g) === role.value)))
const picked = computed(() => new Set(props.elements.filter(e => e.kind !== 'PERSON_PART').map(e => e.garmentId)))
const parts = computed(() => (personMode.value === '零散部位' ? catalog.value?.sets.flatMap(set => set.parts.filter(p => p.loose).map(p => ({ ...p, label: `${set.label} · ${p.label}` }))) : catalog.value?.sets.find(s => s.id === selectedSet.value)?.parts)?.filter(p => p.label.includes(personSearch.value.trim())) || [])
const sets = computed(() => catalog.value?.sets.map(s => ({ value: s.id, label: s.label })) || [])
async function load() {
  loading.value = true; error.value = ''
  try { const first = await closetApi.list({ status: 'ACTIVE', q: '', category: '', color: '', season: '', page: 1, size: 50 }); const items = [...first.items]; for (let page = 2; page <= Math.min(40, Math.ceil(first.total / 50)); page++) { const next = await closetApi.list({ status: 'ACTIVE', q: '', category: '', color: '', season: '', page, size: 50 }); items.push(...next.items) } garments.value = items }
  catch (e) { error.value = e instanceof Error ? e.message : '衣柜暂时无法加载。' } finally { loading.value = false }
}
async function people() { loadingPeople.value = true; peopleError.value = ''; try { catalog.value = await closetApi.personStickers(); if (!catalog.value.sets.some(s => s.id === selectedSet.value)) selectedSet.value = catalog.value.sets[0]?.id || '' } catch (e) { peopleError.value = e instanceof Error ? e.message : '人物贴纸暂时无法加载。' } finally { loadingPeople.value = false } }
function image(g: Garment) { try { return artworkForGarment(g).url } catch { return g.displayUrl } }
onMounted(() => { void load(); void people() })
</script>
<template><view><view class="sheet-head">贴纸素材</view><wd-segmented v-model:value="material" :disabled="replacing" :options="['我的衣物', '人物贴纸']" />
  <view v-if="material === '我的衣物'" class="section"><wd-search v-model="search" placeholder="搜索颜色、品类或品牌" hide-cancel /><wd-picker v-model="role" label="分类" :columns="roles" /><view v-if="replacing" class="notice">选择一件衣物替换，保留原来的布局。<wd-button type="text" @click="emit('cancel')">取消</wd-button></view><wd-skeleton v-if="loading" :row-col="[{ height: '200rpx' }, { height: '200rpx' }]" /><view v-else-if="error"><wd-status-tip image="network" tip="暂时无法读取衣柜" /><text class="line">{{ error }}</text><wd-button plain block @click="load">重新加载</wd-button></view><view v-else-if="filtered.length" class="materials"><view v-for="g in filtered" :key="g.id" class="material"><view class="material-image" @tap="!adding && emit('garment', g)"><AuthImage :src="image(g)" :width="320" /><view v-if="picked.has(g.id)" class="picked"><wd-tag type="primary">已加入</wd-tag></view></view><view class="material-copy"><text>{{ g.category[0] || '衣物' }}</text><text class="small">{{ g.primaryColor[0] || '颜色待确认' }}</text><wd-button size="small" :disabled="adding" plain @click="emit('garment', g)">{{ replacing ? '替换为' : picked.has(g.id) ? '定位' : '加入' }}{{ formatGarmentLabel(g) }}</wd-button></view></view></view><template v-else><wd-status-tip image="search" tip="没有符合条件的衣物" /><text class="line">换个搜索词或分类，也可以先将衣物确认入柜。</text><wd-button plain block @click="navigateOutfitLink('/wardrobe')">打开我的衣柜</wd-button></template><text class="line small">{{ picked.size }} 件已加入 · 点选加入，再到画板调整</text></view>
  <view v-else class="section"><view v-if="peopleError" class="notice error">{{ peopleError }}<wd-button type="text" @click="people">重试</wd-button></view><wd-loading v-if="loadingPeople" /><template v-else-if="catalog"><wd-segmented v-model:value="personMode" :options="['角色套装', '零散部位']" /><wd-picker v-if="personMode === '角色套装'" v-model="selectedSet" :columns="sets" label="人物套装" /><wd-search v-model="personSearch" placeholder="搜索人物部位" hide-cancel /><text class="line small">逐件点选，每张贴纸都能自由调整和重复添加。</text><view class="materials"><view v-for="part in parts" :key="part.id" class="material" @tap="!adding && emit('person', part)"><view class="material-image"><AuthImage :src="part.url" :width="320" /></view><text class="line">{{ part.label }}</text><wd-button size="small" plain :disabled="adding" @click.stop="emit('person', part)">加入</wd-button></view></view><wd-status-tip v-if="!parts.length" image="search" tip="没有找到这个部位" /></template></view>
</view></template>
<style lang="scss" scoped>@import './outfit.scss';.materials{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20rpx}.material{min-width:0;background:$surface-alt;border-radius:$radius-md;padding:16rpx;overflow:hidden}.material-image{height:230rpx;position:relative}.material-copy{display:flex;flex-direction:column;gap:10rpx;padding-top:12rpx}.picked{position:absolute;right:4rpx;bottom:4rpx}</style>
