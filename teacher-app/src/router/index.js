import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { APPROVAL_REMINDER_PERMISSIONS_ROUTE } from '../constants/notifications';
import { resolveTeacherStartupRoute } from '../services/teacherNotificationRuntime';

const routes = [
  {
    path: '/',
    name: 'Login',
    component: () => import('../views/Login.vue')
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: 'approval',
        name: 'Approval',
        component: () => import('../views/Approval.vue')
      },
      {
        path: 'approval-reminder-permissions',
        name: 'ApprovalReminderPermissions',
        component: () => import('../views/ApprovalReminderPermissions.vue')
      },
      {
        path: 'overview-statistics',
        name: 'OverviewStatistics',
        component: () => import('../views/OverviewStatistics.vue')
      },
      {
        path: 'statistics',
        name: 'Statistics',
        component: () => import('../views/Statistics.vue')
      },
      {
        path: 'students',
        name: 'Students',
        component: () => import('../views/Students.vue')
      },
      {
        path: 'schedules',
        name: 'Schedules',
        component: () => import('../views/Schedules.vue')
      },
      {
        path: 'audit-logs',
        name: 'AuditLogs',
        component: () => import('../views/AuditLogs.vue')
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('../views/Settings.vue')
      }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    next('/');
    return;
  }

  if (!authStore.isLoggedIn) {
    next();
    return;
  }

  if (to.path === '/' || to.path === '/dashboard') {
    next(await resolveTeacherStartupRoute());
    return;
  }

  if (to.meta.requiresAuth && to.path !== APPROVAL_REMINDER_PERMISSIONS_ROUTE) {
    const targetRoute = await resolveTeacherStartupRoute();
    if (targetRoute === APPROVAL_REMINDER_PERMISSIONS_ROUTE) {
      next(targetRoute);
      return;
    }
  }

  next();
});

export default router;
