# 测试指南

适用于开源 Demo 版的基础构建与回归检查。

## 构建基线

### 后端

```powershell
cd server
npx sequelize-cli db:migrate:status
```

### 学生端

```powershell
cd student-app
npm run build
```

### 教师端

```powershell
cd teacher-app
npm run build
```

## 本地入口

- 后端：`http://localhost:3000`
- 健康检查：`http://localhost:3000/health`
- 学生端开发页：`http://localhost:5173`
- 教师端开发页：`http://localhost:5174`

## 基础功能验收

### 学生端

- 能正常登录到演示账号或演示班级环境
- 首页能展示今日课程与请假信息
- 能提交请假申请并看到结果反馈
- 请假历史页能正常筛选、查看详情
- 课表页能显示周课表与特殊日期配置

### 教师端

- 登录成功后能进入审批页
- 待审批列表能正常处理请假
- 统计、记录、学生管理、课表管理页面能正常加载
- 数据安全页能完成导出和状态查看

## 平台补充说明

### Web / PWA

- 默认以浏览器访问为主
- 如需测试本地 HTTPS / PWA，请先根据自己的环境生成本地证书

### Android

- 学生端和教师端都保留 Capacitor Android 工程
- 开源版不自带远程推送 SDK；教师端 Android 默认按无远程推送能力验收
- 如需启用远程推送，请自行补充本地 SDK 和配置后再进行真机验收

## 常见排查

- 前端连不上后端：先检查 `http://localhost:3000/health`
- 数据库连不上：核对 `server/.env` 或容器日志
- 教师端 Android 无远程推送：确认是否已自行补充本地推送 SDK 和配置
