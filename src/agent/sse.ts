export type StreamEvent = { event: string; data: any }
type RawEvent = { event: string; data: string }
/** The shared transport decodes SSE chunks; require a terminal done frame before accepting completion. */
export async function readAgentStream(receive: (onEvent: (event: RawEvent) => void) => Promise<void>, onEvent: (event: StreamEvent) => void) {
  let complete = false
  await receive(frame => {
    if (frame.data.length > 200000) throw new Error('回复数据过大。')
    const data = JSON.parse(frame.data)
    if (frame.event === 'done') complete = true
    onEvent({ event: frame.event, data })
  })
  if (!complete) throw new Error('回复已中断。消息可能已经计入额度，请查看会话后再主动重试。')
}
