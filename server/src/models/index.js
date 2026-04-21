const Class = require('./Class');
const Student = require('./Student');
const Teacher = require('./Teacher');
const Dormitory = require('./Dormitory');
const Schedule = require('./Schedule');
const SchedulePeriod = require('./SchedulePeriod');
const ClassSpecialDate = require('./ClassSpecialDate');
const LeaveRequest = require('./LeaveRequest');
const LeaveRecord = require('./LeaveRecord');
const LeaveHistoryArchive = require('./LeaveHistoryArchive');
const AuditLog = require('./AuditLog');
const StudentLoginLog = require('./StudentLoginLog');
const ClassroomCheckSubmission = require('./ClassroomCheckSubmission');
const PushDevice = require('./PushDevice');
const PushDelivery = require('./PushDelivery');
const NotificationOutbox = require('./NotificationOutbox');

Class.hasMany(Student, { foreignKey: 'class_id', as: 'students' });
Student.belongsTo(Class, { foreignKey: 'class_id', as: 'class' });

Class.hasMany(Teacher, { foreignKey: 'class_id', as: 'teachers' });
Teacher.belongsTo(Class, { foreignKey: 'class_id', as: 'class' });

Class.hasMany(Dormitory, { foreignKey: 'class_id', as: 'dormitories' });
Dormitory.belongsTo(Class, { foreignKey: 'class_id', as: 'class' });

Class.hasMany(Schedule, { foreignKey: 'class_id', as: 'schedules' });
Schedule.belongsTo(Class, { foreignKey: 'class_id', as: 'class' });

Class.hasMany(SchedulePeriod, { foreignKey: 'class_id', as: 'schedulePeriods' });
SchedulePeriod.belongsTo(Class, { foreignKey: 'class_id', as: 'class' });

Class.hasMany(ClassSpecialDate, { foreignKey: 'class_id', as: 'specialDates' });
ClassSpecialDate.belongsTo(Class, { foreignKey: 'class_id', as: 'class' });

Student.hasMany(LeaveRequest, { foreignKey: 'student_id', as: 'leaveRequests' });
LeaveRequest.belongsTo(Student, { foreignKey: 'student_id', as: 'student' });

Dormitory.hasMany(Student, { foreignKey: 'dormitory_id', as: 'students' });
Student.belongsTo(Dormitory, { foreignKey: 'dormitory_id', as: 'dormitory' });

Class.hasMany(LeaveRequest, { foreignKey: 'class_id', as: 'leaveRequests' });
LeaveRequest.belongsTo(Class, { foreignKey: 'class_id', as: 'class' });

Teacher.hasMany(LeaveRequest, { foreignKey: 'teacher_id', as: 'reviewedRequests' });
LeaveRequest.belongsTo(Teacher, { foreignKey: 'teacher_id', as: 'reviewer' });

LeaveRequest.hasMany(LeaveRecord, { foreignKey: 'leave_request_id', as: 'records' });
LeaveRecord.belongsTo(LeaveRequest, { foreignKey: 'leave_request_id', as: 'leaveRequest' });

Student.hasMany(LeaveHistoryArchive, { foreignKey: 'student_id', as: 'leaveHistoryArchives' });
LeaveHistoryArchive.belongsTo(Student, { foreignKey: 'student_id', as: 'student' });

Class.hasMany(LeaveHistoryArchive, { foreignKey: 'class_id', as: 'leaveHistoryArchives' });
LeaveHistoryArchive.belongsTo(Class, { foreignKey: 'class_id', as: 'class' });

Schedule.hasMany(LeaveRecord, { foreignKey: 'schedule_id', as: 'leaveRecords' });
LeaveRecord.belongsTo(Schedule, { foreignKey: 'schedule_id', as: 'schedule' });

Student.hasMany(StudentLoginLog, { foreignKey: 'student_id', as: 'loginLogs' });
StudentLoginLog.belongsTo(Student, { foreignKey: 'student_id', as: 'student' });

Class.hasMany(ClassroomCheckSubmission, { foreignKey: 'class_id', as: 'classroomCheckSubmissions' });
ClassroomCheckSubmission.belongsTo(Class, { foreignKey: 'class_id', as: 'class' });

Student.hasMany(ClassroomCheckSubmission, { foreignKey: 'submitted_by_student_id', as: 'classroomChecks' });
ClassroomCheckSubmission.belongsTo(Student, { foreignKey: 'submitted_by_student_id', as: 'submittedByStudent' });

Teacher.hasMany(PushDevice, { foreignKey: 'teacher_id', as: 'pushDevices' });
PushDevice.belongsTo(Teacher, { foreignKey: 'teacher_id', as: 'teacher' });

Teacher.hasMany(PushDelivery, { foreignKey: 'teacher_id', as: 'pushDeliveries' });
PushDelivery.belongsTo(Teacher, { foreignKey: 'teacher_id', as: 'teacher' });

module.exports = {
  Class,
  Student,
  Teacher,
  Dormitory,
  Schedule,
  SchedulePeriod,
  ClassSpecialDate,
  LeaveRequest,
  LeaveRecord,
  LeaveHistoryArchive,
  AuditLog,
  StudentLoginLog,
  ClassroomCheckSubmission,
  PushDevice,
  PushDelivery,
  NotificationOutbox
};
