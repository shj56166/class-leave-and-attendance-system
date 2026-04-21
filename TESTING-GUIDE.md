# 测试指南

本文用于确认当前开源 Demo 的部署、构建和主流程是否正常，覆盖自动化测试、手工检查、Android 构建验证和截图核对。

## 验证前提

开始前请先确认：

- MySQL 已启动，`server/.env` 指向正确数据库
- 已执行数据库迁移：`cd server && npx sequelize-cli db:migrate`
- 如需完整演示数据，已执行：`npm run db:reset:demo`
- 学生端可访问：`http://localhost:5175`
- 教师端可访问：`http://localhost:5174`
- 后端健康检查可访问：`http://localhost:3000/health`

## 自动化测试基线

根目录提供以下 Playwright 命令：

```powershell
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:ui
```

现有 E2E 主要覆盖：

- 课堂核对与班干流程
- 教师端总览统计指标
- 学生端路由与交互切换
- 教师端数据库备份导出
- 宿舍管理、周末报备和教师统计联动

说明：

- Playwright 测试依赖独立测试数据库环境变量，如 `TEST_DB_HOST`、`TEST_DB_NAME`
- 未配置这些变量时，测试会主动拒绝连接开发数据库

## 登录测试

### 教师端

1. 打开 `http://localhost:5174`
2. 使用 `admin / admin123` 登录
3. 成功后应进入审批页或工作台主入口

### 学生端

1. 打开 `http://localhost:5175`
2. 输入班级码 `TEST001`
3. 选择演示学生
4. 如果是新初始化的 Demo 数据库首次登录，页面会提示先设置密码
5. 进入“设置密码”页后，设置 6 位数字密码，例如 `123456`
6. 设置成功后进入首页；后续使用这 6 位数字密码登录

### 登录检查点

- 页面无白屏或接口错误提示
- 刷新页面后仍能保持会话状态
- 教师端可正常读取待审批列表
- 学生端可完成首次设密或正常密码登录，并看到首页状态和请假入口

## 学生端手工验收

### 首页

- 能看到最近处理结果、请假申请入口、请假历史入口和课表入口
- 页面文案与截图中的“已完成今日目标”等状态信息一致

### 请假申请

- 可进入请假申请页
- 可选择请假范围和请假类型
- 输入请假原因后可以提交
- 提交成功后能跳转到历史页或看到成功反馈

### 请假历史

- 可查看历史记录
- 可按状态和模式筛选
- 已处理记录可查看归档详情

### 课表与管理相关入口

- 课表页能正常显示当天或本周课程
- 如已配置班干角色，课堂核对相关入口可以进入
- 非班干账号应看到受限提示，而不是异常页面

## 教师端手工验收

### 审批管理

- 登录后能看到待审批列表
- 点击记录可查看请假详情
- 可执行“同意”“同意并备注”“不同意”等操作

### 今日统计

- 能查看当天课堂核对结果
- 能看到当前请假与宿舍分布视图
- 复制按钮工作正常，不应出现页面卡死

### 总览统计

- 页面能正常加载趋势图
- 能看到综合态势、重点对象、高发规律等模块
- 时间切换后图表和摘要指标会更新

### 记录 / 日志

- 可按记录类型、学生、日期范围、状态和申请模式筛选
- 查询结果列表结构完整，摘要与状态标签显示正常

### 其他后台页面

- 学生管理可正常进入和加载
- 课表管理可正常进入和加载
- 设置页可以查看安全、备份或推送相关状态

## Android 构建测试

### 学生端 Android

```powershell
cd student-app
npm run android:debug
```

检查点：

- `vite build` 成功
- `cap sync android` 成功
- Android 工程可正常打开

### 教师端 Android

```powershell
cd teacher-app
npm run android:debug
```

检查点：

- `vite build` 成功
- `cap sync android` 成功
- Android 工程可正常打开

说明：

- 教师端 Android 远程推送不是开源版默认验收项
- 未补充 SDK 和本地配置时，只需验收“无远程推送”模式

## 接口健康检查

### 基础健康检查

```powershell
curl http://localhost:3000/health
```

期望结果：

- 返回 `status: ok`
- 返回 `database: connected`
- 返回 `version` 与 `timestamp`

### 连通性检查

- 学生端提交请假时，浏览器网络面板可看到 `/api/student/*` 请求成功
- 教师端审批或统计页可看到 `/api/teacher/*`、`/api/statistics/*` 请求成功
- 教师端实时提醒场景可看到 `Socket.IO` 正常连接

## 截图验收点

README 中的截图也可用作界面检查清单：

| 截图 | 页面应看到的关键点 |
| --- | --- |
| `qingjia home.png` | 学生端首页的今日状态、请假申请、请假历史、我的课表 |
| `qingjia shenqing.png` | 请假申请页的课程命中、时间范围、类型选择、原因输入和提交按钮 |
| `qingjia lishi.png` | 历史页的状态筛选、模式筛选和归档详情卡片 |
| `qingjia shenpiguanli.png` | 审批页的待审批列表、详情卡片和审批按钮 |
| `qingjia zonglantongji.png` | 总览页的趋势图、风险排行和重点对象模块 |
| `qingjia jinritongji.png` | 今日统计页的课堂核对结果、当前请假和宿舍视图 |
| `qingjia jilurizhi.png` | 记录日志页的查询筛选区和结果表格 |

## 常见排查

### 打不开前端页面

- 确认对应前端进程已经启动
- 学生端默认端口以 `student-app/vite.config.js` 中的 `5175` 为准
- 教师端默认端口以 `teacher-app/vite.config.js` 中的 `5174` 为准

### 前端能打开，但操作报错

- 先访问 `http://localhost:3000/health`
- 再检查 `server/.env` 是否配置正确
- 确认数据库迁移已经执行

### 自动化测试无法启动

- 检查根目录依赖是否已安装
- 检查 Playwright 浏览器依赖是否齐全
- 检查 `TEST_DB_*` 变量是否已设置

### Android 构建失败

- 检查本机 Android Studio / SDK 环境
- 检查 `Capacitor` 依赖是否完整安装
- 教师端若缺少本地推送 SDK，不要将推送相关失败误判为主流程故障
