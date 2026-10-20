<script setup lang="ts">
import {ref} from 'vue'
import type {MetadataField} from '../../domain/metadata'
import {metadataChoices} from '../../domain/metadata'
import type {Garment} from '../../services/api'
const props=defineProps<{schema:MetadataField[];values:Record<string,string[]>;garment:Garment;resetFields:string[];disabled:boolean}>()
const emit=defineEmits<{(e:'edit',key:string,value:string[]):void;(e:'restore',key:string):void}>()
const evidence=ref<MetadataField>(),custom=ref<MetadataField>(),input=ref('')
function change(field:MetadataField,value:unknown){emit('edit',field.key,Array.isArray(value)?value.map(String):value?[String(value)]:[])}
function add(field:MetadataField){custom.value=field;input.value=''}
function submit(){if(!custom.value)return;const text=input.value.trim();if(text)change(custom.value,custom.value.multiple?[...(props.values[custom.value.key]||[]),text]:text);custom.value=undefined}
function serverValue(key:string){return ((props.garment as unknown as Record<string,string[]>)[key]||[]).join('、')||'未知'}
</script>
<template><view class="stack"><view v-for="field in schema" :key="field.key" class="field"><view class="row"><text>{{field.label}}</text><wd-button size="small" type="text" @click="evidence=field">依据与自动值</wd-button></view><wd-select-picker v-if="field.multiple||field.options.length" :model-value="field.multiple?(values[field.key]||[]):values[field.key]?.[0]||''" :type="field.multiple?'checkbox':'radio'" :columns="metadataChoices(field,values[field.key]||[])" :disabled="disabled" :title="field.label" filterable clearable placeholder="选择或填写，未知可留空" @update:model-value="change(field,$event)"/><wd-input v-else :model-value="values[field.key]?.[0]||''" :disabled="disabled" :maxlength="400" clearable placeholder="未知，可留空" @update:model-value="change(field,$event)"/><view v-if="field.multiple||field.options.length" class="row"><wd-button size="small" type="text" :disabled="disabled" @click="add(field)">填写其他值</wd-button><wd-button v-if="values[field.key]?.length" size="small" type="text" :disabled="disabled" @click="change(field,[])">清空</wd-button></view><text v-if="field.suggestion" class="hint">{{garment.overrides[field.key]?.length?'用户核对值':garment.automatic[field.key]?.length?'照片建议，需核对':'未知，可留空'}}</text></view></view>
<wd-popup :model-value="!!evidence" position="bottom" closable @close="evidence=undefined"><view v-if="evidence" class="sheet"><text class="sheet-title">{{evidence.label}}</text><text class="subtitle">服务端当前值：{{serverValue(evidence.key)}}</text><text class="subtitle">{{garment.metadataEvidence?.[evidence.key]?.evidence||'未知可以留空，可根据实物填写。'}}</text><wd-button v-if="Object.prototype.hasOwnProperty.call(garment.overrides,evidence.key)||resetFields.includes(evidence.key)" :disabled="disabled" @click="emit('restore',evidence.key);evidence=undefined">恢复自动值</wd-button></view></wd-popup>
<wd-popup :model-value="!!custom" position="bottom" closable @close="custom=undefined"><view v-if="custom" class="sheet"><text class="sheet-title">{{custom.label}}</text><wd-input v-model="input" :maxlength="400" placeholder="填写后添加，未知可留空"/><view class="actions"><wd-button @click="submit">{{custom.multiple?'添加':'确定'}}</wd-button></view></view></wd-popup></template>
<style lang="scss" scoped>@import './closet.scss';.field{padding-bottom:20rpx;border-bottom:2rpx solid $line}</style>
