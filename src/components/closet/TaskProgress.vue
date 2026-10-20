<script setup lang="ts">
import {computed} from 'vue'
import type {ClosetTask} from '../../services/api'
import {taskLabels,processingSeconds,isProcessing} from '../../domain/workflow'
const props=defineProps<{task:ClosetTask;now?:number}>()
const seconds=computed(()=>processingSeconds(props.task,props.now))
const status:Record<string,string>={completed:'已完成',running:'进行中',failed:'未完成',waiting:'等待',review:'需核对',skipped:'已跳过'}
</script>
<template><view class="section"><view class="row"><text class="section-title">{{task.title}}</text><wd-tag>{{taskLabels[task.status]}}</wd-tag></view><text class="hint">{{task.mode}} · {{isProcessing(task.status)?'已等待':'用时'}} {{Math.floor(seconds/60)}} 分 {{seconds%60}} 秒</text><view v-for="(step,index) in task.steps" :key="index" class="field-row"><view class="row"><text>{{step.name}}</text><text>{{status[step.status]}}</text></view><text v-if="step.error" class="hint">{{step.error}}</text><text v-if="step.recognition?.issues?.length" class="hint">{{step.recognition.issues.map(i=>i.message).join('；')}}</text></view><text v-if="task.note" class="hint">{{task.note}}</text><view v-for="(attempt,index) in task.attempts||[]" :key="index" class="hint">{{attempt.provider}} · {{attempt.model}} · {{attempt.status}}</view></view></template>
<style lang="scss" scoped>@import './closet.scss';</style>
