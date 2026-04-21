export const teacherNavigationItems = [
  {
    label: '审批管理',
    icon: 'Document',
    route: '/dashboard/approval',
    adminOnly: false
  },
  {
    label: '总览统计',
    icon: 'DataAnalysis',
    route: '/dashboard/overview-statistics',
    adminOnly: false
  },
  {
    label: '今日统计',
    icon: 'DataAnalysis',
    route: '/dashboard/statistics',
    adminOnly: false
  },
  {
    label: '学生管理',
    icon: 'User',
    route: '/dashboard/students',
    adminOnly: true
  },
  {
    label: '课表管理',
    icon: 'Calendar',
    route: '/dashboard/schedules',
    adminOnly: true
  },
  {
    label: '记录/日志',
    icon: 'Tickets',
    route: '/dashboard/audit-logs',
    adminOnly: false
  },
  {
    label: '设置',
    icon: 'Setting',
    route: '/dashboard/settings',
    adminOnly: false
  }
];
