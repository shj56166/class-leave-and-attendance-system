const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { Teacher } = require('../models');

const TEACHER_PENDING_LEAVE_EVENT = 'teacher.leave.pending.created';

function buildTeacherClassRoom(classId) {
  return `teacher:class:${classId}`;
}

function buildTeacherUserRoom(teacherId) {
  return `teacher:user:${teacherId}`;
}

function getHandshakeToken(socket) {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim()) {
    return authToken.trim();
  }

  const authorization = socket.handshake.headers?.authorization;
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    return authorization.slice(7).trim();
  }

  const queryToken = socket.handshake.query?.token;
  if (typeof queryToken === 'string' && queryToken.trim()) {
    return queryToken.trim();
  }

  return '';
}

async function authenticateTeacherSocket(socket) {
  const rawToken = getHandshakeToken(socket);
  if (!rawToken) {
    const error = new Error('UNAUTHORIZED');
    error.data = { code: 'MISSING_TOKEN' };
    throw error;
  }

  let decoded;
  try {
    decoded = jwt.verify(rawToken, process.env.JWT_SECRET);
  } catch (error) {
    const authError = new Error('UNAUTHORIZED');
    authError.data = { code: 'INVALID_TOKEN' };
    throw authError;
  }

  if (decoded.type !== 'teacher') {
    const error = new Error('FORBIDDEN');
    error.data = { code: 'TEACHER_ONLY' };
    throw error;
  }

  if (decoded.jwtVersion === undefined) {
    const error = new Error('UNAUTHORIZED');
    error.data = { code: 'JWT_VERSION_REQUIRED' };
    throw error;
  }

  const teacher = await Teacher.findByPk(decoded.id, {
    attributes: ['id', 'role', 'class_id', 'jwt_version', 'real_name']
  });

  if (!teacher) {
    const error = new Error('UNAUTHORIZED');
    error.data = { code: 'TEACHER_NOT_FOUND' };
    throw error;
  }

  if (teacher.jwt_version !== decoded.jwtVersion) {
    const error = new Error('UNAUTHORIZED');
    error.data = { code: 'JWT_VERSION_MISMATCH' };
    throw error;
  }

  if (teacher.role !== decoded.role || teacher.class_id !== decoded.classId) {
    const error = new Error('FORBIDDEN');
    error.data = { code: 'TEACHER_SCOPE_CHANGED' };
    throw error;
  }

  return {
    teacherId: teacher.id,
    classId: teacher.class_id,
    role: teacher.role,
    realName: teacher.real_name || ''
  };
}

function createSocketServer(httpServer, { isOriginAllowed }) {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`Not allowed by Socket.IO CORS: ${origin}`));
        }
      },
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    try {
      const teacherSession = await authenticateTeacherSocket(socket);
      socket.data.teacherSession = teacherSession;
      next();
    } catch (error) {
      next(error);
    }
  });

  io.on('connection', (socket) => {
    const teacherSession = socket.data.teacherSession;
    if (!teacherSession) {
      socket.emit('unauthorized');
      socket.disconnect(true);
      return;
    }

    socket.join(buildTeacherClassRoom(teacherSession.classId));
    socket.join(buildTeacherUserRoom(teacherSession.teacherId));
  });

  return io;
}

module.exports = {
  TEACHER_PENDING_LEAVE_EVENT,
  buildTeacherClassRoom,
  buildTeacherUserRoom,
  createSocketServer
};
