<script setup lang="ts">
import { getCurrentInstance, nextTick, onMounted, ref, watch } from 'vue'
import type { TemplateSlot } from '../../services/admin'
const props = defineProps<{ slots: TemplateSlot[]; uid: string }>()
const instance = getCurrentInstance()
const HEX: Record<string,string> = { BLACK:'#2b2b2b',WHITE:'#f7f7f2',GRAY:'#9b9b9b',BEIGE:'#d9c7a7',BROWN:'#8a5a3b',NAVY:'#24345c',DENIM:'#5b7fa8',BLUE:'#3d7bd9',RED:'#d23c3c',ORANGE:'#ec8a2f',YELLOW:'#f1cf3b',GREEN:'#4f9a55',PURPLE:'#8a5ab8',PINK:'#f0a1bd' }
const shapes: Record<string,number[][]> = {
  TOP:[[37,34],[44,30],[50,36],[56,30],[63,34],[72,48],[65,53],[61,49],[61,75],[39,75],[39,49],[35,53],[28,48]],
  OUTER:[[35,32],[44,29],[50,51],[56,29],[65,32],[75,48],[68,53],[65,50],[65,92],[35,92],[35,50],[32,53],[25,48]],
  BOTTOM:[[34,76],[66,76],[64,128],[53,128],[50,90],[47,128],[36,128]],
  SKIRT:[[35,76],[65,76],[74,110],[26,110]],
  ONE_PIECE:[[38,34],[44,30],[50,36],[56,30],[62,34],[66,54],[60,56],[69,108],[25,108],[34,56],[28,54]],
  OVERALL:[[38,36],[44,36],[44,52],[56,52],[56,36],[62,36],[62,56],[71,108],[29,108],[38,56]],
  HAT:[[38,15],[42,6],[58,6],[62,15],[68,15],[68,19],[32,19],[32,15]],
  HEADWEAR:[[44,13],[50,16],[56,13],[56,19],[50,16],[44,19]], BAG:[[76,66],[90,66],[90,80],[76,80]],
}
const order = ['SOCKS','BOTTOM','ONE_PIECE','OVERALL','TOP','OUTER','SHOES','HAT','HEADWEAR','BAG','HANDHELD']
// Legacy canvas-id canvases are native layers that paint above popups (the 查看示意 sheet). Draw on an off-screen 2d canvas
// and show the exported picture instead, which behaves like any other <image>.
const picture = ref('')
async function draw() {
  await nextTick()
  const node = await new Promise<any>(resolve => uni.createSelectorQuery().in(instance?.proxy as any).select('.hidden-canvas').fields({ node: true, size: true } as any, (result: any) => resolve(result?.node || null)).exec())
  if (!node) return
  const ratio = 4
  node.width = 100 * ratio; node.height = 140 * ratio
  const c = node.getContext('2d')
  c.scale(ratio, ratio); c.clearRect(0, 0, 100, 140); c.fillStyle = '#efe7dc'; c.beginPath(); c.arc(50, 22, 7, 0, Math.PI * 2); c.fill()
  for (const role of order) for (const s of props.slots.filter(slot => slot.roles.includes(role))) {
    const color = s.colorAny.find(k => HEX[k]); c.fillStyle = color ? HEX[color] : '#d6d6d6'; c.strokeStyle = '#5f5f5f'; c.lineWidth = .8; c.setLineDash(color ? [] : [2, 1.5])
    if (role === 'SHOES' || role === 'SOCKS') { const y = role === 'SHOES' ? 129 : 112; c.fillRect(33, y, 13, role === 'SHOES' ? 6 : 16); c.fillRect(54, y, 13, role === 'SHOES' ? 6 : 16); continue }
    if (role === 'HANDHELD') { c.beginPath(); c.arc(14, 73, 5, 0, Math.PI * 2); c.fill(); continue }
    const points = shapes[role === 'BOTTOM' && s.categoryAny.some(x => x.includes('裙')) ? 'SKIRT' : role]; if (!points) continue
    c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); c.stroke()
    if (s.patternMin) { c.save(); c.clip(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.setLineDash([]); for (let x = -140; x < 100; x += 7) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 140, 140); c.stroke() }; c.restore() }
  }
  picture.value = await new Promise<string>(resolve => uni.canvasToTempFilePath({ canvas: node, fileType: 'png', success: (result: any) => resolve(result.tempFilePath), fail: () => resolve('') } as any, instance?.proxy))
}
onMounted(draw); watch(() => props.slots, draw, { deep: true })
</script>
<template><view class="preview"><image v-if="picture" :src="picture" class="picture" mode="aspectFit" /><canvas type="2d" class="hidden-canvas" /></view></template>
<style scoped lang="scss">.preview { width: 200rpx; height: 280rpx; background: $surface-alt; border-radius: $radius-sm; overflow: hidden; position: relative; }.picture { width: 100%; height: 100%; }.hidden-canvas { position: absolute; left: -400rpx; top: 0; width: 200rpx; height: 280rpx; }</style>
