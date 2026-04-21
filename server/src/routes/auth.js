const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { Class, Student, Teacher, StudentLoginLog } = require('../models');
const { authMiddleware, requireTeacher } = require('../middleware/auth');
const { writeAuditLog } = require('../utils/auditLog');

const router = express.Router();

// 学生登录限流：10分钟内最多5次
const studentLoginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { error: '登录尝试次数过多，请10分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false
});

// 教师登录限流：15分钟内最多10次
const teacherLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: '登录尝试次数过多，请15分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false
});

// 学生登录
router.post('/student/login', studentLoginLimiter, [
  body('classCode').notEmpty().withMessage('教室组代号不能为空'),
  body('studentId').isInt().withMessage('学生ID必须是数字'),
  body('password').optional().isString().isLength({ min: 6, max: 6 }).withMessage('密码必须是6位')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { classCode, studentId, password } = req.body;

    // 1. 验证班级码
    const classInfo = await Class.findOne({ where: { class_code: classCode } });
    if (!classInfo) {
      return res.status(401).json({ error: '班级码或学生信息错误' });
    }

    // 2. 检查登录窗口是否开启
    if (!classInfo.login_window_open) {
      return res.status(403).json({ error: '登录窗口未开启，请联系教师' });
    }

    // 3. 查找学生
    const student = await Student.findOne({
      where: { id: studentId, class_id: classInfo.id, status: 'active' }
    });

    if (!student) {
      return res.status(401).json({ error: '班级码或学生信息错误' });
    }

    // 4. 检查账号是否被锁定
    if (student.is_locked) {
      return res.status(403).json({ error: '账号已锁定，请联系教师重置' });
    }

    // 5. 首次登录（未设置密码）
    if (!student.is_authenticated) {
      // 生成临时token，只能用于设置密码
      const tempToken = jwt.sign(
        {
          id: student.id,
          type: 'student_temp',
          classId: classInfo.id,
          purpose: 'set_password',
          jwtVersion: student.jwt_version
        },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }  // 30分钟有效期
      );

      return res.json({
        needSetPassword: true,
        tempToken,
        student: {
          id: student.id,
          name: student.student_name,
          classId: classInfo.id,
          className: classInfo.class_name,
          role: student.role
        }
      });
    }

    // 6. 已认证用户，验证密码
    if (!password) {
      return res.status(401).json({ error: '请输入密码' });
    }

    const isPasswordValid = await bcrypt.compare(password, student.password_hash);
    if (!isPasswordValid) {
      // 密码错误，增加失败计数
      await student.increment('password_fail_count');
      await student.reload();

      if (student.password_fail_count >= 10) {
        await student.update({
          is_locked: true,
          locked_at: new Date()
        });
        return res.status(403).json({ error: '密码错误次数过多，账号已锁定，请联系教师' });
      }

      const remaining = 10 - student.password_fail_count;
      return res.status(401).json({ error: `密码错误，还可尝试${remaining}次` });
    }

    // 7. 登录成功，重置失败计数
    await student.update({ password_fail_count: 0 });

    // 8. 生成永久JWT（180天）
    const token = jwt.sign(
      {
        id: student.id,
        type: 'student',
        classId: classInfo.id,
        jwtVersion: student.jwt_version
      },
      process.env.JWT_SECRET,
      { expiresIn: '180d' }
    );

    // 9. 记录登录日志
    await StudentLoginLog.create({
      student_id: student.id,
      device_info: req.get('user-agent'),
      ip_address: req.ip,
      jwt_version: student.jwt_version,
      login_at: new Date()
    });

    res.json({
      token,
      student: {
        id: student.id,
        name: student.student_name,
        classId: classInfo.id,
        className: classInfo.class_name,
        role: student.role
      },
      hasPassword: true
    });
  } catch (error) {
    console.error('学生登录错误:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 根据教室组代号获取学生列表
router.get('/student/classes/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const classInfo = await Class.findOne({
      where: { class_code: code },
      include: [{
        model: Student,
        as: 'students',
        where: { status: 'active' },
        attributes: ['id', 'student_name', 'student_number']
      }]
    });

    if (!classInfo) {
      return res.status(404).json({ error: '班级不存在' });
    }

    res.json({
      classId: classInfo.id,
      className: classInfo.class_name,
      students: classInfo.students
    });
  } catch (error) {
    console.error('获取学生列表错误:', error);
    res.status(500).json({ error: '获取学生列表失败' });
  }
});

// 教师登录
router.get('/teacher/me', authMiddleware, requireTeacher, async (req, res) => {
  try {
    const teacher = await Teacher.findByPk(req.user.id, {
      include: [{ model: Class, as: 'class' }]
    });

    if (!teacher) {
      return res.status(404).json({ error: '教师不存在' });
    }

    res.json({
      teacher: {
        id: teacher.id,
        username: teacher.username,
        realName: teacher.real_name,
        role: teacher.role,
        classId: teacher.class_id,
        className: teacher.class?.class_name || ''
      }
    });
  } catch (error) {
    console.error('获取教师信息错误:', error);
    res.status(500).json({ error: '获取教师信息失败' });
  }
});

router.post('/teacher/login', teacherLoginLimiter, [
  body('username').notEmpty().withMessage('用户名不能为空'),
  body('password').notEmpty().withMessage('密码不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    const teacher = await Teacher.findOne({
      where: { username },
      include: [{ model: Class, as: 'class' }]
    });

    if (!teacher) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const isPasswordValid = await bcrypt.compare(password, teacher.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = jwt.sign(
      {
        id: teacher.id,
        type: 'teacher',
        role: teacher.role,
        classId: teacher.class_id,
        jwtVersion: teacher.jwt_version
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // 记录教师登录审计日志
    await writeAuditLog({
      userId: teacher.id,
      userType: 'teacher',
      action: 'login',
      targetType: 'teacher',
      targetId: teacher.id,
      details: { username: teacher.username, role: teacher.role },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({
      token,
      teacher: {
        id: teacher.id,
        username: teacher.username,
        realName: teacher.real_name,
        role: teacher.role,
        classId: teacher.class_id,
        className: teacher.class?.class_name
      }
    });
  } catch (error) {
    console.error('教师登录错误:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

module.exports = router;
