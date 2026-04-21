# 校园请假管理

面向校园班级场景的学生请假申请、教师审批与统计留痕 Demo，适合演示、二次开发和本地部署。

<div style="background-color: #f8fafc; border: 1px solid #e7edf5; border-radius: 10px; padding: 14px 16px; margin: 14px 0 18px 0;">
  <p style="margin: 0 0 8px 0; color: #4a5a70;"><strong>项目形态</strong></p>
  <p style="margin: 0 0 10px 0; color: #5f6b7a;">包含 Node.js 后端服务、学生端和教师端分离式 Android App、教师端网页，以及 iOS 跨平台支持。</p>
  <p style="margin: 0 0 8px 0; color: #4a5a70;"><strong>特色功能</strong></p>
  <p style="margin: 0 0 10px 0; color: #5f6b7a;">支持 <span style="color: #5c7cbd;">一键报备</span>、<span style="color: #c97b63;">旷课统计</span> 和 <span style="color: #7a6f97;">动效设计</span>，兼顾操作效率、数据呈现和界面体验。</p>
  <p style="margin: 0 0 8px 0; color: #4a5a70;"><strong>项目说明</strong></p>
  <p style="margin: 0 0 10px 0; color: #5f6b7a;">项目把学生请假、教师审批、班级统计和记录追踪放在同一套系统里，减少纸面登记、聊天确认和人工汇总带来的流程割裂。</p>
  <p style="margin: 0; color: #5f6b7a;"><strong>已通过内网测试和部分攻击测试，可稍作配置投入使用或根据需求继续开发</strong></p>
</div>

<img src="./ImageMD/ChatGPT%20Image%202026年4月21日%2019_44_03.png" alt="校园请假管理系统架构图，展示学生端、教师端、Node.js / Express 后端、Socket.IO、MySQL、通知队列与 JPush 的关系" width="1100" />

## 实机内容

### 教师端

#### 审批管理

<img src="./ImageMD/qingjia%20shenpiguanli.png" alt="教师端审批管理页，展示待审批列表和同意驳回操作" width="720" />

- 教师可集中查看待审批列表，完成同意、驳回与备注处理。

#### 总览统计

<img src="./ImageMD/qingjia%20zonglantongji.png" alt="教师端总览统计页，展示趋势、风险排行和重点对象" width="720" />

- 提供趋势总览、重点对象和高发规律，方便展示项目的数据分析能力。

#### 今日统计

<img src="./ImageMD/qingjia%20jinritongji.png" alt="教师端今日统计页，展示教室核对结果、当前请假和宿舍视图" width="720" />

- 支持查看当天课堂核对结果、宿舍分布和当前请假状态。

#### 记录日志

<img src="./ImageMD/qingjia%20jilurizhi.png" alt="教师端记录日志页，支持按类型、学生、日期和状态筛选" width="720" />

- 支持按记录类型、学生、日期范围、状态和来源联动筛选。

### 学生端

#### 请假历史

<img src="./ImageMD/qingjia%20lishi.png" alt="学生端请假历史页，查看状态、模式和归档详情" width="180" />

- 支持按状态和模式筛选历史记录，适合回看处理进度与归档详情。

#### 请假申请

<img src="./ImageMD/qingjia%20shenqing.png" alt="学生端请假申请页，支持按课程范围发起请假" width="180" />

- 支持按当前课程、剩余课程或自定义范围发起当天请假，也保留周末回家报备等模式。

#### 首页总览

<img src="./ImageMD/qingjia%20home.png" alt="学生端首页，展示今日状态、请假入口和课表入口" width="180" />

- 学生进入系统后可直接看到今日状态、最近处理结果、请假入口和课表入口。

## 技术栈

### 后端

- `Express 5`
- `Sequelize 6`
- `MySQL 8`
- `Socket.IO`
- `JWT`

### 学生端

- `Vue 3`
- `Vite`
- `Vant`
- `PWA`
- `Capacitor Android`

### 教师端

- `Vue 3`
- `Vite`
- `Element Plus`
- `ECharts`
- `Capacitor Android`

### 测试与辅助

- `Playwright` 端到端测试
- `Docker Compose` 容器部署
- `PowerShell` 开发、备份和演示库重置脚本

支持中文

## 完整文档

完整说明请直接看：

- [ARCHITECTURE.md](./ARCHITECTURE.md)：系统结构、通信链路、数据流和数据库关系
- [DEPLOYMENT.md](./DEPLOYMENT.md)：本地部署、Docker 部署、环境变量和演示库初始化
- [TESTING-GUIDE.md](./TESTING-GUIDE.md)：自动化测试、手工验收、Android 构建和截图验收点
- [SECURITY.md](./SECURITY.md)：反馈与联系

## 部署简介

如果你只是想把项目跑起来，推荐按下面 4 步走：

1. 准备 Node.js 18+、MySQL 8.x、PowerShell；如需容器部署，再准备 Docker。
2. 复制根目录 `.env.example` 和 `server/.env.example`，按本机环境填写数据库、JWT 和允许访问的来源地址。
3. 在 `server/` 执行数据库迁移，在 `student-app/` 和 `teacher-app/` 构建前端资源。
4. 选择本地开发启动或 Docker 启动，然后通过 `http://localhost:3000/health` 检查服务健康状态。

完整步骤、常见报错和演示库重置方法见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

如果你走 Docker 首次部署，请注意当前仓库不是“一键空库开箱即用”模式，仍需要按 [DEPLOYMENT.md](./DEPLOYMENT.md) 完成数据库账号创建、迁移和 Demo 数据初始化。

## 快速开始

### 环境要求

- Node.js 18+
- MySQL 8.x
- Windows + PowerShell
- Docker 20.10+ 与 Docker Compose（可选）

### 安装依赖

```powershell
cd server
npm install

cd ../student-app
npm install

cd ../teacher-app
npm install
```

### 配置本地环境变量

```powershell
Copy-Item .\server\.env.example .\server\.env
```

按你的 MySQL 实例和本机访问地址修改 `server/.env`，至少确认数据库连接、`JWT_SECRET` 和 `ALLOWED_ORIGINS` 正确。

### 执行数据库迁移

```powershell
cd server
npx sequelize-cli db:migrate
```

### 本地开发启动

分别启动：

```powershell
cd server
npm run dev

cd ../student-app
npm run dev

cd ../teacher-app
npm run dev
```

或使用根目录脚本一次启动：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-dev.ps1
```

### 重置为全新演示库

如需先私有备份、再重建一套干净的演示数据，可在仓库根目录执行：

```powershell
npm run db:reset:demo
```

这个脚本会：

- 读取 `server/.env`
- 先导出当前数据库备份
- 重建数据库并执行全部迁移
- 灌入新的 Demo 班级、教师、学生、课表与课时数据

### 默认入口

- 后端健康检查：`http://localhost:3000/health`
- 学生端开发页：`http://localhost:5175`
- 教师端开发页：`http://localhost:5174`

## 演示账号与班级码

| 角色   | 默认凭据               |
| ------ | ---------------------- |
| 管理员 | `admin / admin123`     |
| 教师   | `teacher / teacher123` |
| 班级码 | `TEST001`              |

学生端首次登录默认需要先设置 6 位数字密码；设置完成后，后续再使用该密码登录。

## 项目结构

```text
.
├─ server/        后端接口、模型、迁移脚本、通知与备份逻辑
├─ student-app/   学生端 Web / PWA / Android 工程
├─ teacher-app/   教师端 Web / Android 工程
├─ tests/         Playwright 端到端测试
├─ scripts/       启动、备份、证书和重置脚本
```

## 开源版边界

- 仓库内示例班级、课表、教师、地点均为通用 Demo 数据，不包含真实业务数据。
- 开源版保留学生端 Web/PWA、教师端 Web、两端 Android 容器壳以及后端主流程代码。
- 教师端远程推送保留接入代码，但默认视为可选增强能力，不作为开箱即用前提。
- 私有证书、私有部署文件、真实数据库备份、第三方推送 SDK 和本地调试材料不随仓库分发。

## 协议与维护信息

- License: [MIT](./LICENSE)
- Last Updated: `2026-04-21`

## 作者与联系

- 邮箱：`shj561661@gmail.com`
- QQ：`1570666721`
- 哔哩哔哩：`3546716596865871`

<div style="background-color: #f7f9fc; border-left: 4px solid #8aa4d6; padding: 12px 16px; border-radius: 8px; margin-top: 12px; color: #4b5563;">
  <p style="margin: 0 0 8px 0; color: #5c7cbd;"><strong>介绍</strong></p>
  <p style="margin: 0 0 8px 0; color: #5f6b7a;">其实这个项目是被老师无视了，因为要租用服务器，老师非得找免费的 <span style="color: #7c8fb3;">TvT</span>，一气之下直接开源。</p>
  <p style="margin: 0 0 8px 0; color: #5f6b7a;">耗时 <span style="color: #c97b63;">21 天</span>，<span style="color: #6d82b5;">Claude 4.6 Opus</span> 搭基座，<span style="color: #4f7f9d;">Codex 5.4</span> 完善功能，消耗 <span style="color: #b7795f;">50.11 RMB</span>。</p>
  <p style="margin: 0 0 8px 0; color: #7a6f97;">还有十几天就 17 ✌</p>
  <p style="margin: 0; color: #8a94a6;">2026/4/21</p>
</div>
