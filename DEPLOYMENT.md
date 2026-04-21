# 部署说明

本文说明当前开源 Demo 的本地部署、Docker 部署、环境变量、数据库迁移、演示库初始化和常见排查方式。示例环境为 Windows + PowerShell。

## 环境要求

- Node.js 18+
- MySQL 8.x
- Windows + PowerShell
- Docker 20.10+ 与 Docker Compose（容器部署时需要）

## 环境变量

仓库提供两份示例配置：

- 根目录 [`.env.example`](./.env.example)：用于 Docker Compose 和容器端口映射
- 后端 [`server/.env.example`](./server/.env.example)：用于本地 Node.js 后端运行

### 本地运行至少要配置的变量

在 `server/` 目录下新建 `.env`，至少填写以下值：

```dotenv
DB_HOST=localhost
DB_PORT=3306
DB_NAME=qingjia_db
DB_USER=qingjia_app
DB_PASSWORD=replace-with-app-db-password
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
APP_VERSION=1.0.0
TRUST_PROXY_HOPS=0
ALLOWED_ORIGINS=http://localhost:5175,http://localhost:5174
```

### Docker 部署常用变量

在仓库根目录复制 `.env.example` 为 `.env`，再补齐所需值：

| 变量 | 说明 |
| --- | --- |
| `MYSQL_ROOT_PASSWORD` | MySQL root 密码 |
| `MYSQL_DATABASE` | 容器内数据库名 |
| `DB_USER` / `DB_PASSWORD` | 应用数据库账号 |
| `BACKUP_DB_USER` / `BACKUP_DB_PASSWORD` | 备份容器使用的数据库账号 |
| `JWT_SECRET` | JWT 密钥 |
| `SERVER_EXPOSE_BIND` | 后端宿主机绑定地址 |
| `SERVER_EXPOSE_PORT` | 后端宿主机端口 |
| `NGINX_STUDENT_PORT` | 学生端静态站点端口 |
| `NGINX_TEACHER_PORT` | 教师端静态站点端口 |
| `ALLOWED_ORIGINS` | 生产模式允许访问的前端来源 |

注意：

- 当前 `docker-compose.yml` 不会自动创建 `DB_USER` / `BACKUP_DB_USER`
- 若沿用 `.env.example` 中的专用账号，需在 MySQL 容器启动后手动创建并授权
- 若已有可用 MySQL 账号，可直接替换 `.env` 中对应变量

### 可选推送变量

如需接入教师端 Android 远程推送，还需补充：

```dotenv
JPUSH_APP_KEY=
JPUSH_MASTER_SECRET=
```

开源版默认不包含第三方推送 SDK 和本地厂商配置。未补齐时，教师端 Android 按“无远程推送”模式运行。

## 本地部署步骤

以下命令默认在仓库根目录执行。

### 1. 安装依赖

```powershell
cd server
npm install

cd ..\student-app
npm install

cd ..\teacher-app
npm install
```

### 2. 配置本地后端环境变量

```powershell
Copy-Item .\server\.env.example .\server\.env
```

根据本地 MySQL 实例修改 `server/.env`。

### 3. 执行数据库迁移

```powershell
cd server
npx sequelize-cli db:migrate
```

如需检查迁移状态，可执行：

```powershell
cd server
npx sequelize-cli db:migrate:status
```

### 4. 构建前端

```powershell
cd student-app
npm run build

cd ..\teacher-app
npm run build
```

### 5. 启动开发环境

分别启动：

```powershell
cd server
npm run dev

cd ..\student-app
npm run dev

cd ..\teacher-app
npm run dev
```

也可直接运行根目录脚本：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-dev.ps1
```

### 6. 验证服务健康状态

```powershell
curl http://localhost:3000/health
```

默认开发入口：

- 后端：`http://localhost:3000`
- 学生端：`http://localhost:5175`
- 教师端：`http://localhost:5174`

## Docker 部署步骤

以下命令默认在仓库根目录执行。

### 1. 准备根目录 `.env`

```powershell
Copy-Item .\.env.example .\.env
```

补齐数据库密码、JWT 密钥和对外端口。

### 2. 先构建两个前端

`docker-compose.yml` 会将 `student-app/dist` 和 `teacher-app/dist` 挂载给 Nginx，因此需先在本地构建：

```powershell
cd student-app
npm install
npm run build

cd ..\teacher-app
npm install
npm run build
```

### 3. 先启动 MySQL

```powershell
docker-compose up -d mysql
```

### 4. 创建应用账号与备份账号

如果使用 `.env.example` 中的默认账号，需要在 MySQL 容器内手动授权一次：

```powershell
docker exec qingjia_mysql mysql -uroot -pREPLACE_ROOT_PASSWORD -e "CREATE USER IF NOT EXISTS 'qingjia_app'@'%' IDENTIFIED BY 'replace-with-app-db-password'; GRANT ALL PRIVILEGES ON qingjia_db.* TO 'qingjia_app'@'%'; CREATE USER IF NOT EXISTS 'qingjia_backup'@'%' IDENTIFIED BY 'replace-with-backup-db-password'; GRANT SELECT, SHOW VIEW, EVENT, TRIGGER, LOCK TABLES ON qingjia_db.* TO 'qingjia_backup'@'%'; FLUSH PRIVILEGES;"
```

请将库名、用户名和密码替换为 `.env` 中的实际值。

### 5. 启动其余容器

```powershell
docker-compose up -d server nginx backup
```

涉及的服务如下：

- `mysql`：MySQL 8 数据库
- `server`：Node.js 后端 API 与通知逻辑
- `nginx`：学生端与教师端静态资源入口
- `backup`：定时备份辅助容器

### 6. 执行迁移与 Demo 数据初始化

`server` 容器启动后不会自动执行完整迁移，也不会自动导入 Demo 数据。首次空库部署至少需要手动执行：

```powershell
docker exec qingjia_server npx sequelize-cli db:migrate
docker exec qingjia_server npm run db:seed:demo
```

只需验证接口健康状态时，可只执行迁移；如需与 README、测试文档一致的演示环境，再补充 Demo seed。

### 7. 检查服务

```powershell
curl http://localhost:3000/health
docker-compose ps
```

默认容器入口：

- 学生端：`http://localhost:8090`
- 教师端：`http://localhost:8091`
- 后端健康检查：`http://localhost:3000/health`

## 数据库初始化与演示库重置

### 完整重置为演示库

该方法适用于演示、截图或恢复到干净状态：

```powershell
npm run db:reset:demo
```

脚本会：

- 读取 `server/.env`
- 导出当前数据库备份
- 重建数据库并执行全部迁移
- 导入新的 Demo 班级、教师、学生、课表与课时数据

默认演示凭据：

- 管理员：`admin / admin123`
- 教师：`teacher / teacher123`
- 班级码：`TEST001`

### 仅导入 Demo 数据

如果数据库结构已迁移完成，只需补充演示数据，可执行：

```powershell
cd server
npm run db:seed:demo
```

Docker 场景对应命令：

```powershell
docker exec qingjia_server npm run db:seed:demo
```

## Android 与推送说明

### 学生端 Android

- 仓库保留 `Capacitor Android` 工程
- 调试入口：

```powershell
cd student-app
npm run android:debug
```

### 教师端 Android

- 仓库保留 `Capacitor Android` 工程
- 调试入口：

```powershell
cd teacher-app
npm run android:debug
```

### 远程推送能力

- 开源版保留教师端 JPush / 厂商推送接入代码
- 开源版不附带本地 SDK 包、`local.properties`、`jpush.local.properties` 和私有密钥
- 未补齐这些文件时，教师端 Android 默认按“无远程推送”模式构建和验收

## 常见部署错误

### 前端能打开，但请求后端报 CORS

- 检查 `server/.env` 或根目录 `.env` 中的 `ALLOWED_ORIGINS`
- 本地开发默认来源为 `http://localhost:5175` 和 `http://localhost:5174`
- Docker / 局域网演示时需补充实际访问域名或局域网 IP

### 后端启动失败，提示数据库连接异常

- 检查 `DB_HOST`、`DB_PORT`、`DB_NAME`、`DB_USER`、`DB_PASSWORD`
- 确认 MySQL 已启动且允许该账号访问
- 若为 Docker 首次部署，确认应用账号与备份账号已完成创建和授权
- 可用 `npx sequelize-cli db:migrate:status` 验证连接链路

### 前端页面空白或资源 404

- 确认 `student-app/dist` 和 `teacher-app/dist` 已构建
- Docker 部署前需先执行 `npm run build`

### 接口 200，但数据为空

- 确认数据库迁移已经执行
- 空库场景可执行 `cd server && npm run db:seed:demo`
- Docker 空库场景可执行 `docker exec qingjia_server npm run db:seed:demo`
- 如需恢复完整演示环境，可执行 `npm run db:reset:demo`

### 教师端 Android 没有远程推送

- 这是开源版默认行为，不代表主流程故障
- 仅在补齐本地推送 SDK、配置文件和服务端密钥后，才需要验收远程推送链路

## 常用运维命令

```powershell
docker-compose up -d
docker-compose down
docker-compose logs -f server
curl http://localhost:3000/health
cd server
npx sequelize-cli db:migrate:status
```

## 部署建议

- 正式部署前请替换所有默认密码和 JWT 密钥
- 不要将 `.env`、数据库备份、生产证书和推送密钥提交到公开仓库
- 若仓库仅用于展示，可将远程推送视为可选能力
