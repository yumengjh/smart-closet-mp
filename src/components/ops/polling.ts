import { onBeforeUnmount, watch, type Ref } from 'vue'
/** One sequential poll, stopped when its page is hidden. */
export function useOpsPolling(active: Ref<boolean>, load: () => Promise<void>, delay: () => number) {
  let timer: ReturnType<typeof setTimeout> | undefined, epoch = 0
  async function tick(serial: number) {
    if (!active.value || serial !== epoch) return
    await load()
    if (active.value && serial === epoch) timer = setTimeout(() => { void tick(serial) }, delay())
  }
  watch(active, value => { clearTimeout(timer); const serial = ++epoch; if (value) void tick(serial) }, { immediate: true })
  onBeforeUnmount(() => { epoch++; clearTimeout(timer) })
}
