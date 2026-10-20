<script setup lang="ts">
import { computed } from 'vue'
import { usePreferencesStore } from '../../stores/preferences'
import { pushPage } from '../../services/page-stack'
// Entry to the full-screen assistant from any page (the web has a topbar button; minimal mode hides it).
// `from` names the page it was opened from; `garment` adds the garment context; `waiting` opens the chat-while-waiting topics.
const props = defineProps<{ from: string; garment?: string; waiting?: boolean; label?: string }>()
const preferences = usePreferencesStore()
const url = computed(() => `/pkg-outfit/assistant/index?from=${encodeURIComponent(props.from)}${props.garment ? '&garment=' + encodeURIComponent(props.garment) : ''}${props.waiting ? '&waiting=1' : ''}`)
</script>
<template><wd-button v-if="!preferences.minimal" size="small" type="text" @click="pushPage(url)">{{ label || '问鱼搭助手' }}</wd-button></template>
