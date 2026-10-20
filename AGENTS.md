# 鱼搭微信小程序约定

- 本仓库是 ../smart-closet（Web 用户端）的 uni-app（Vue3 + Vite + TS）微信小程序复刻，后端为 ../smart-closet-server，接口不为小程序单独改动。
- 组件库统一 wot-design-uni（`wd-*`，easycom 自动引入）。Ant Design Vue 无法在小程序运行；禁止混用原生 picker/checkbox/textarea 与 wx.showModal 以外的自制弹层，提示用 wd-toast / wd-message-box。
- 网络只走 src/services/http.ts（Cookie 罐 + CSRF）；服务器图片只用 src/components/AuthImage.vue 或 services/media.ts，禁止 `<image :src="/api/...">`。上传用 http.upload，流式回复用 http.streamPost。
- src/domain/* 从 Web 端复制，保持与 Web 同步，不得引入 window/document/localStorage；存储用 uni.getStorageSync。
- 页面一一对应 Web 路由（见 src/pages.json）；主包只放 tab 页与登录注册，其余放分包，主包须小于 2MB。
- Konva 画板不移植：搭配画板用小程序 canvas 2d 或静态排版实现查看与简单调整。
- 构建：npm run build:mp-weixin 必须通过；npm test 通过。
