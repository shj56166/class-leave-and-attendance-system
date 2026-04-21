# 部署说明

面向开源 Demo 版的通用部署指南，默认以本地开发和 Docker 部署为主。

## 环境要求

- Docker 20.10+ 与 Docker Compose
- Node.js 18+
- MySQL 8.0+
- Windows + PowerShell

## 环境变量

仓库根目录与 `server/` 目录都提供了示例配置文件：
- `.env.example`
- `server/.env.example`

后端最小可用变量示例：

```dotenv
DB_HOST=localhost
DB_PORT=3306
DB_NAME=leave_demo_db
DB_USER=leave_demo_user
DB_PASSWORD=replace-with-db-password
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
NODE_ENV=production
APP_VERSION=1.0.0
TRUST_PROXY_HOPS=1
ALLOWED_ORIGINS=http://localhost:5175,http://localhost:5174
```

如果使用 Docker，也可以在根目录 `.env` 中补充：

```dotenv
SERVER_EXPOSE_BIND=127.0.0.1
MYSQL_EXPOSE_BIND=127.0.0.1
NGINX_STUDENT_PORT=8090
NGINX_TEACHER_PORT=8091
```

## 标准部署步骤

### 1. 构建前端

```powershell
cd student-app
npm install
npm run build

cd ../teacher-app
npm install
npm run build
```

### 2. 安装后端依赖并执行迁移

```powershell
cd ../server
npm install
npx sequelize-cli db:migrate
```

### 3. 启动 Docker

```powershell
cd ..
docker-compose up -d
```

### 4. 检查健康状态

```powershell
curl http://localhost:3000/health
```

## 演示数据初始化

如需把当前数据库重置成一套全新的演示库，推荐在仓库根目录执行：

```powershell
npm run db:reset:demo
```

该命令会先做私有备份，再重建数据库、执行迁移，并灌入新的 Demo 班级、教师、学生、课表和课时数据。

重置完成后的默认口径：
- 管理员：`admin / admin123`
- 教师：`teacher / teacher123`
- 班级码：`TEST001`

如果你只想在“已经迁移完成的空库”上补充演示数据，而不做整库重置，可以执行：

```powershell
cd server
npm run db:seed:demo
```

兼容入口 `node init-db.js` 仍可用，但它现在只负责灌入演示数据，不再负责 `sync({ force: true })` 式的整库重建。

## 可选能力

### 学生端本地 HTTPS / PWA

仓库保留了本地 HTTPS 证书脚本：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-local-ios-cert.ps1
```

开源版不包含任何本机证书和实际局域网配置，请按自己的环境生成并维护本地证书。

### 教师端 Android 远程推送

开源版保留了教师端远程推送的接入代码，但不再附带第三方 SDK 和本地配置文件。

如需启用 Android 远程推送，请自行补充：
- 本地 JPush / 厂商推送 SDK
- 本地 `local.properties` 或 `jpush.local.properties`
- 服务端推送凭据

若不补充这些材料，教师端 Android 将按“无远程推送”的默认模式构建和运行。

## 常用运维命令

- 启动 / 停止：`docker-compose up -d` / `docker-compose down`
- 查看日志：`docker-compose logs -f server`
- 检查迁移：`cd server && npx sequelize-cli db:migrate:status`
- Nginx 配置检查：`docker exec qingjia_nginx nginx -t`

## 注意事项

- 正式部署前请替换数据库密码、JWT 密钥和 CORS 白名单。
- 开源版不包含任何生产证书、数据库备份或私有推送配置。
- `backups/`、`.logs/`、`test-results/` 属于本地运行数据，不应作为公开内容分发。
