const jwt = require('jsonwebtoken');
const { Student, Teacher } = require('../models');

function buildReloginResponse(res, message) {
  return res.status(401).json({
    error: message,
    needRelogin: true
  });
}

async function verifyStudentToken(decoded, req, res) {
  const student = await Student.findByPk(decoded.id);

  if (!student) {
    buildReloginResponse(res, '账号不存在，请重新登录');
    return null;
  }

  if (decoded.jwtVersion !== student.jwt_version) {
    buildReloginResponse(res, '账号信息已更新，请重新登录');
    return null;
  }

  if (student.class_id !== decoded.classId) {
    buildReloginResponse(res, '班级信息已变化，请重新登录');
    return null;
  }

  if (student.status !== 'active') {
    buildReloginResponse(res, '账号已停用，请联系老师');
    return null;
  }

  if (student.is_locked) {
    buildReloginResponse(res, '账号已锁定，请联系老师');
    return null;
  }

  req.currentStudent = student;
  req.user = {
    ...decoded,
    classId: student.class_id,
    jwtVersion: student.jwt_version
  };

  return student;
}

async function verifyTeacherToken(decoded, req, res) {
  const teacher = await Teacher.findByPk(decoded.id, {
    attributes: ['id', 'role', 'class_id', 'jwt_version', 'real_name']
  });

  if (!teacher) {
    buildReloginResponse(res, '教师账号不存在，请重新登录');
    return null;
  }

  if (decoded.jwtVersion !== teacher.jwt_version) {
    buildReloginResponse(res, '教师账号信息已更新，请重新登录');
    return null;
  }

  if (decoded.role !== teacher.role || decoded.classId !== teacher.class_id) {
    buildReloginResponse(res, '教师权限已变化，请重新登录');
    return null;
  }

  req.currentTeacher = teacher;
  req.user = {
    ...decoded,
    role: teacher.role,
    classId: teacher.class_id,
    jwtVersion: teacher.jwt_version
  };

  return teacher;
}

// 基础认证中间件：验证 JWT
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: '未提供认证令牌' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    if (decoded.type === 'student' && decoded.jwtVersion === undefined) {
      return buildReloginResponse(res, '账号登录信息已升级，请重新登录');
    }

    if (decoded.type === 'teacher' && decoded.jwtVersion === undefined) {
      return buildReloginResponse(res, '教师登录信息已升级，请重新登录');
    }

    if (decoded.type === 'student' && decoded.jwtVersion !== undefined) {
      const student = await verifyStudentToken(decoded, req, res);
      if (!student) {
        return undefined;
      }
    }

    if (decoded.type === 'teacher' && decoded.jwtVersion !== undefined) {
      const teacher = await verifyTeacherToken(decoded, req, res);
      if (!teacher) {
        return undefined;
      }
    }

    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return buildReloginResponse(res, '认证令牌已过期，请重新登录');
    }
    return res.status(401).json({ error: '无效的认证令牌' });
  }
};

// 要求学生身份
const requireStudent = (req, res, next) => {
  if (req.user.type !== 'student') {
    return res.status(403).json({ error: '需要学生权限' });
  }
  return next();
};

// 要求班干身份
const requireCadre = async (req, res, next) => {
  if (req.user.type !== 'student') {
    return res.status(403).json({ error: '需要学生权限' });
  }

  const student = req.currentStudent || await Student.findByPk(req.user.id, {
    attributes: ['id', 'class_id', 'status', 'role', 'student_name', 'is_locked']
  });

  if (
    !student
    || student.class_id !== req.user.classId
    || student.status !== 'active'
    || student.is_locked
  ) {
    return res.status(403).json({ error: '账号当前无法使用该功能' });
  }

  if (student.role !== 'cadre') {
    return res.status(403).json({ error: '只有班干才能使用管理功能' });
  }

  req.student = student;
  return next();
};

// 要求教师身份（包括管理员）
const requireTeacher = (req, res, next) => {
  if (req.user.type !== 'teacher' || !req.currentTeacher) {
    return res.status(403).json({ error: '需要教师权限' });
  }
  return next();
};

// 要求管理员身份
const requireAdmin = (req, res, next) => {
  if (req.user.type !== 'teacher' || req.currentTeacher?.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  return next();
};

// 兼容旧代码的别名
const teacherAuth = requireTeacher;
const adminAuth = requireAdmin;

module.exports = {
  authMiddleware,
  requireStudent,
  requireCadre,
  requireTeacher,
  requireAdmin,
  teacherAuth,
  adminAuth
};
