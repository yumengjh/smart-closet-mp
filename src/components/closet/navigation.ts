export const openGarment = (id:string, task?:string, batch?:string) => uni.navigateTo({url:`/pkg-closet/garment/index?id=${encodeURIComponent(id)}${task?'&task='+encodeURIComponent(task):''}${batch?'&batch='+encodeURIComponent(batch):''}`})
export const openAdd = (mode='') => uni.navigateTo({url:'/pkg-closet/add/index'+(mode?'?mode='+mode:'')})
export const openBatch = (id:string) => uni.navigateTo({url:'/pkg-closet/batch/index?id='+encodeURIComponent(id)})
export const openTasks = () => uni.navigateTo({url:'/pkg-closet/tasks/index'})
export const wardrobe = () => uni.switchTab({url:'/pages/wardrobe/index'})
export const pending = () => uni.switchTab({url:'/pages/pending/index'})
export const settings = () => uni.switchTab({url:'/pages/settings/index'})
export function outfitWith(id:string) { uni.setStorageSync('closet.outfit-with',id); uni.switchTab({url:'/pages/outfits/index'}) }
export const errorText = (e:unknown, fallback='操作失败，请稍后重试。') => e instanceof Error ? e.message : fallback
export async function choosePhotos(source:'album'|'camera',count=1) {
  try { const result=await uni.chooseMedia({count,mediaType:['image'],sourceType:[source]}); return result.tempFiles }
  catch(e) { if(String((e as {errMsg?:string})?.errMsg).includes('cancel')) return []; throw new Error('无法读取照片，请检查相机或相册权限后重试。') }
}
