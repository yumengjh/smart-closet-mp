<div align="center">

# 鱼搭 · 微信小程序

**鱼搭用户端的 uni-app 复刻：衣柜、入柜、搭配画板、助手、OOTD 一个小程序里完成。**

![uni-app](https://img.shields.io/badge/uni--app-Vue_3-42b883)
![TypeScript](https://img.shields.io/badge/TypeScript-4.9-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![wot-design-uni](https://img.shields.io/badge/wot--design--uni-1.14-1677FF)
![License](https://img.shields.io/badge/license-源码仅供评审_·_非开源-red)

</div>

> **许可声明：源码仅供评审查看，不是开源软件。** 完整条款见 [LICENSE](LICENSE)，与[用户端仓库](https://github.com/yumengjh/smart-closet)相同。

本仓库是 [smart-closet](https://github.com/yumengjh/smart-closet)（Web 用户端）的微信小程序版本，页面与 Web 路由一一对应，接口直接使用鱼搭后端，不为小程序单独改动。

## 页面

| 位置 | 页面 |
|---|---|
| 主包 tab | 我的衣柜、未入柜、组合台、OOTD 试穿、我的 |
| 主包 | 登录、注册 |
| `pkg-closet` | 衣物详情、添加衣物、批次、回收站、任务、帮助 |
| `pkg-outfit` | 搭配画板（小程序 canvas 2d）、全局助手 |
| `pkg-admin` | 模板审核、OOTD 样本、处理监控、用户管理（管理员可见） |

主包只放 tab 页与登录注册，其余放分包，主包须小于 2 MB。

## 快速开始

需要 Node.js 22+ 和[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)。

```bash
npm install
cp .env.example .env.local     # 填写 VITE_API_BASE_URL，指向鱼搭后端
npm run dev:mp-weixin          # 生成 dist/dev/mp-weixin
```

用微信开发者工具导入**本仓库根目录**（`project.config.json` 已指向 `dist/dev/mp-weixin/`）。开发时可在工具里勾选“不校验合法域名”，直接连局域网 `http://192.168.x.x:8080`；真机预览需要 HTTPS，并在小程序后台配置 request / downloadFile / uploadFile 合法域名。

后端见[评审裁剪副本](https://github.com/yumengjh/smart-closet-server-review)（不能直接构建；完整后端为私有仓库）。

| 命令 | 作用 |
|---|---|
| `npm run dev:mp-weixin` | 开发构建（监听） |
| `npm run build:mp-weixin` | 生产构建，输出 `dist/build/mp-weixin` |
| `npm run dev:h5` / `build:h5` | H5 预览与构建 |
| `npm run type-check` | `vue-tsc` 类型检查 |
| `npm test` | Node 内置测试：请求层、服务层、画板几何 |

## 目录

```text
src/
├── pages/            tab 页与登录注册
├── pkg-closet/       衣物相关分包
├── pkg-outfit/       搭配画板与助手分包
├── pkg-admin/        管理员分包
├── components/       业务组件（衣柜、助手、我的、运维等）
├── services/         请求层（http.ts：Cookie 罐 + CSRF）、图片与媒体
├── domain/           从 Web 端复制的纯逻辑，与 Web 保持同步
├── agent/            助手接口与流式回复（SSE）
├── recommend/        推荐接口与类型
└── stores/           Pinia 状态
```

## 开发约定

约定全文见 [AGENTS.md](AGENTS.md)，要点：

- 组件库统一 [wot-design-uni](https://wot-design-uni.cn/)（`wd-*`，easycom 自动引入）；提示用 `wd-toast` / `wd-message-box`。
- 网络只走 `src/services/http.ts`；服务器图片只用 `AuthImage.vue` 或 `services/media.ts`，不直接 `<image :src="/api/...">`；上传用 `http.upload`，流式回复用 `http.streamPost`。
- `src/domain/*` 与 Web 端同步，不引入 `window` / `document` / `localStorage`，存储用 `uni.getStorageSync`。
- Konva 画板不移植，搭配画板用小程序 canvas 2d 实现查看与简单调整。

## 相关仓库

| 仓库 | 内容 |
|---|---|
| [smart-closet](https://github.com/yumengjh/smart-closet) | Web 用户端 |
| [smart-closet-server-review](https://github.com/yumengjh/smart-closet-server-review) | 后端评审裁剪副本 |
| [smart-closet-admin](https://github.com/yumengjh/smart-closet-admin) · [smart-closet-admin-server](https://github.com/yumengjh/smart-closet-admin-server) | 管理平台 |
| [yuda-website](https://github.com/yumengjh/yuda-website) | 产品官网 |
| [smart-closet-promo](https://github.com/yumengjh/smart-closet-promo) | 演示视频 |

## 许可

采用[鱼搭源码可见评审许可](LICENSE)：源码仅供竞赛评审人员核验之用，未经权利人书面授权，不得复制、转发、公开发布、Fork、修改、二次开发、商业使用，或用于训练 AI 模型。第三方组件遵循各自许可证。
