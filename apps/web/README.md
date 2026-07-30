# Omni Media Agent 管理台（apps/web）

「Mission Control 深空控制台」暗色主题的 React 管理台，对接本仓库 `apps/api` 的 FastAPI 后端；API 不可达时自动降级内置 Mock 数据，可独立预览。

## 技术栈

Node.js 20 · React 19 + TypeScript · Vite 7.2.4 · Tailwind CSS 3.4.19 · shadcn/ui · framer-motion · @tanstack/react-query · react-router v7 · sonner · lucide-react

## 页面

| 路由 | 功能 |
| --- | --- |
| `/dashboard` | KPI 概览、状态机流水线、7 日发布趋势、账号健康、告警事件流 |
| `/accounts` | 账号矩阵：24h cron 调度泳道时间线、配置卡、详情抽屉、手动触发 |
| `/jobs` | 内容工单：9 态 chips 过滤 + 表格/看板双视图 + 工单详情抽屉 |
| `/review` | 审核工作台：FIFO 队列 + 小红书/抖音皮肤化草稿预览 + A/R 快捷键审批 |

## 本地运行

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # 产物 dist/
```

## 关于 src/components/ui/（重要）

该目录未随源码提交（50+ 个 shadcn/ui 原版组件，体积大且可机械再生）。clone 后执行：

```bash
npx shadcn@latest init   # 已有 components.json，直接确认即可
npx shadcn@latest add accordion alert-dialog alert aspect-ratio avatar badge breadcrumb button-group button calendar card carousel chart checkbox collapsible command context-menu dialog drawer dropdown-menu empty field form hover-card input-group input-otp input item kbd label menubar navigation-menu pagination popover progress radio-group resizable scroll-area select separator sheet sidebar skeleton slider sonner spinner switch table tabs textarea toggle-group toggle tooltip
```

`components.json`、`tailwind.config.js`、`src/index.css` 已包含全部 design token，再生后即可正常构建。

## 对接后端

- API 基地址：环境变量 `VITE_API_BASE`，默认 `/api`（同源反代）。
- 本地直连 FastAPI（默认 :8000）：`VITE_API_BASE=http://localhost:8000 npm run dev`（后端需放开 CORS），或在 `vite.config.ts` 中加 `/api` proxy。
- 后端不可达时前端自动切换 Mock 模式（Topbar 显示 MOCK 徽章，Mock 数据由本地 tick 驱动状态机流转，便于演示）。

> 凭证约束：本目录不包含任何密钥；LLM / 搜索 / 发布平台密钥一律由后端从环境变量读取。
