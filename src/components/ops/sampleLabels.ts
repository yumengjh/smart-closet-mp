export const STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: '提取中', color: 'processing' }, EXTRACTED: { label: '待审核', color: 'gold' }, FAILED: { label: '提取失败', color: 'red' },
  APPROVED: { label: '已通过', color: 'green' }, REJECTED: { label: '已拒绝', color: 'default' },
}
export const LICENSE: Record<string, string> = { OWN: '自己拍摄/本人授权', PERMITTED: '已获使用许可', OPEN: '开放许可（CC 等）', RESEARCH: '仅研究用途', UNKNOWN: '未知（只参与统计）' }
export const REJECT: Record<string, string> = { NONE: '可用', MULTIPLE_PEOPLE: '多人', NOT_FULL_OUTFIT: '看不到整套', COLLAGE: '拼图', MINOR_LIKELY: '疑似未成年（已删除）', NOT_PHOTO: '不是照片', HEAVY_EDIT: '重度修图', OTHER: '其他原因' }
export const PRESENTATION: Record<string, string> = { FEMININE: '女性化', MASCULINE: '男性化', NEUTRAL: '中性', UNKNOWN: '未知' }
export const WORDS: Record<string, string> = {
  STANDING: '站立', WALKING: '行走', SITTING: '坐', SQUATTING: '蹲', LEANING: '倚靠', FRONT: '正面', THREE_QUARTER: '微侧', SIDE: '侧面', BACK: '背面',
  CAMERA: '看镜头', AWAY: '看别处', DOWN: '低头', UP: '抬头', HIDDEN: '看不到', FULL_BODY: '全身', HALF_BODY: '半身', CLOSE_UP: '特写', EYE_LEVEL: '平视', HIGH: '俯拍', LOW: '仰拍',
  STREET: '街头', INDOOR: '室内', STUDIO: '影棚', NATURE: '自然', CAFE: '咖啡店', CAMPUS: '校园', MALL: '商场', HOME: '家中', BEACH: '海边',
  SHORT: '短发', MEDIUM: '中长发', LONG: '长发', TIED: '扎发', COVERED: '被遮住', SMILE: '微笑', NEUTRAL: '平静', COOL: '酷', PLAYFUL: '俏皮',
  TUCKED: '塞进', HALF_TUCKED: '半塞', UNTUCKED: '不塞', OPEN: '敞开', CLOSED: '扣上', NA: '—', FULL: '完整', PARTIAL: '部分', OTHER: '其他', UNKNOWN: '未知',
}
export const word = (w: string) => WORDS[w] || w
