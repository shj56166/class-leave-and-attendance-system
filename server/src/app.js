const { createServer } = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const sequelize = require('./config/database');
const { PushDevice, PushDelivery, NotificationOutbox } = require('./models');
const { createSocketServer } = require('./realtime/socketServer');
const { configureNotificationChannels } = require('./notifications');
const { startNotificationOutboxDispatcher } = require('./notifications/outbox');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');
const teacherRoutes = require('./routes/teacher');
const statisticsRoutes = require('./routes/statistics');
const auditLogRoutes = require('./routes/auditLog');
const backupRoutes = require('./routes/backups');

const app = express();
const httpServer = createServer(app);

app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 0));

function isLocalHostname(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function isPrivateIpv4(hostname) {
  return /^(10|192\.168|172\.(1[6-9]|2\d|3[0-1]))\.\d{1,3}\.\d{1,3}$/.test(hostname);
}

function isAllowedDevOrigin(origin) {
  if (!origin) {
    return true;
  }

  try {
    const { protocol, hostname, port } = new URL(origin);

    if (!['http:', 'https:'].includes(protocol)) {
      return false;
    }

    const allowedPorts = new Set(['5173', '5174', '5175', '5176', '8090', '8091']);

    if (isLocalHostname(hostname)) {
      return !port || allowedPorts.has(port);
    }

    return allowedPorts.has(port) && isPrivateIpv4(hostname);
  } catch (error) {
    return false;
  }
}

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  : null;

function isOriginAllowed(origin) {
  if (process.env.NODE_ENV !== 'production') {
    return isAllowedDevOrigin(origin);
  }

  return !origin || allowedOrigins.includes(origin);
}

app.use(helmet());
app.disable('x-powered-by');

app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/teacher/backups', backupRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/audit-logs', auditLogRoutes);

app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({
      status: 'ok',
      database: 'connected',
      uptime: process.uptime(),
      version: process.env.APP_VERSION || 'dev',
      timestamp: new Date()
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      timestamp: new Date()
    });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

const io = createSocketServer(httpServer, { isOriginAllowed });
configureNotificationChannels({ io });

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await sequelize.authenticate();
    await Promise.all([
      PushDevice.sync({ alter: true }),
      PushDelivery.sync(),
      NotificationOutbox.sync()
    ]);
    console.log('数据库连接成功');
    console.log('提示：请确保已运行数据库迁移');

    startNotificationOutboxDispatcher();

    httpServer.listen(PORT, () => {
      console.log(`服务器运行在端口 ${PORT}`);
    });
  } catch (error) {
    console.error('启动服务器失败', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
module.exports.httpServer = httpServer;
module.exports.io = io;
module.exports.startServer = startServer;
