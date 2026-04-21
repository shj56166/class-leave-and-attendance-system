# 校园请假管理 Demo

一个适合二次开发和演示的校园请假管理项目，包含学生端、教师端、Node.js 后端与 MySQL 数据库。当前开源版保留 Web、Android 容器壳和学生端 PWA 结构，移除了私有部署资料、真实演示数据和本地调试痕迹。

## 技术栈

- `server`：Express + Sequelize + MySQL
- `student-app`：Vue 3 + Vite + Vant + PWA
- `teacher-app`：Vue 3 + Vite + Element Plus + Capacitor Android
- `tests`：Playwright 浏览器回归测试
- `scripts`：开发启动、备份恢复、证书与辅助脚本

## 目录结构

- `server`：后端接口、模型、迁移脚本
- `student-app`：学生端 Web / PWA / Android 工程
- `teacher-app`：教师端 Web / Android 工程
- `scripts`：本地开发和运维辅助脚本
- `design-system`：界面与交互规范参考

## 快速开始

### 环境要求

- Node.js 18+
- MySQL 8.x
- Windows + PowerShell

### 安装依赖

```powershell
cd server
npm install

cd ../student-app
npm install

cd ../teacher-app
npm install
```

### 启动方式

分别启动：

```powershell
cd server
npm run dev

cd ../student-app
npm run dev

cd ../teacher-app
npm run dev
```

或使用根目录辅助脚本：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-dev.ps1
```

### 重置为全新演示库

如需先私有备份、再清空当前数据库并重建一套新的演示数据，可在仓库根目录执行：

```powershell
npm run db:reset:demo
```

该命令会：
- 读取 `server/.env`
- 先导出当前数据库备份
- 重建数据库并执行全部迁移
- 灌入一套新的 Demo 班级、教师、学生、课表与课时数据

重置完成后的默认口径：
- 管理员：`admin / admin123`
- 教师：`teacher / teacher123`
- 班级码：`TEST001`

### 默认入口

- 后端健康检查：`http://localhost:3000/health`
- 学生端开发页：`http://localhost:5175`
- 教师端开发页：`http://localhost:5174`

## 开源版说明

- 仓库内示例班级、课表、教师、地点均为通用 Demo 数据。
- 私有证书、环境变量、数据库备份、阶段性调试文档和第三方推送 SDK 不随仓库分发。
- 教师端 Android 远程推送能力保留接入代码，但默认作为本地可选增强能力。
- 若需要接入 JPush / 厂商推送，请自行补充本地 SDK 包和配置文件。

## 配套文档

- [DEPLOYMENT.md](./DEPLOYMENT.md)：通用部署与本地运行说明
- [TESTING-GUIDE.md](./TESTING-GUIDE.md)：构建与基础验收说明
