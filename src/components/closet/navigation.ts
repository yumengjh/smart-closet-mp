import {openTab} from '../../services/tab-route'
import {currentRoute,gotoPage,pushPage} from '../../services/page-stack'
const GARMENT='pkg-closet/garment/index',BATCH='pkg-closet/batch/index',ADD='pkg-closet/add/index'
// batch <-> garment <-> add used to push a new page on every hop; WeChat caps the stack at 10, so hops from these pages go back or replace.
export const openGarment = (id:string, task?:string, batch?:string) => {
  const url=`/pkg-closet/garment/index?id=${encodeURIComponent(id)}${task?'&task='+encodeURIComponent(task):''}${batch?'&batch='+encodeURIComponent(batch):''}`
  if(currentRoute()===GARMENT)uni.redirectTo({url});else pushPage(url)
}
export const openAdd = (mode='') => {
  const url='/pkg-closet/add/index'+(mode?'?mode='+mode:'')
  gotoPage(url,ADD,o=>(o.mode||'')===mode,[GARMENT,BATCH].includes(currentRoute()))
}
export const openBatch = (id:string) => {
  const url='/pkg-closet/batch/index?id='+encodeURIComponent(id)
  gotoPage(url,BATCH,o=>o.id===id,[GARMENT,ADD].includes(currentRoute()))
}
export const openTasks = () => pushPage('/pkg-closet/tasks/index')
export const wardrobe = () => openTab('wardrobe')
export const pending = () => openTab('pending')
export const settings = () => openTab('settings')
export const outfitWith = (id:string) => openTab('outfits',{with:id})
export const errorText = (e:unknown, fallback='操作失败，请稍后重试。') => e instanceof Error ? e.message : fallback
export async function choosePhotos(source:'album'|'camera',count=1) {
  try { const result=await uni.chooseMedia({count,mediaType:['image'],sourceType:[source]}) as unknown as {tempFiles?:{tempFilePath:string;name?:string;size:number}[]}; return result.tempFiles||[] }
  catch(e) { if(String((e as {errMsg?:string})?.errMsg).includes('cancel')) return []; throw new Error('无法读取照片，请检查相机或相册权限后重试。') }
}
