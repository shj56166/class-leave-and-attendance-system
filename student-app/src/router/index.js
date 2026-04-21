import { createRouter, createWebHistory } from 'vue-router';
import { useUserStore } from '../stores/user';
import { safeGetItem } from '../utils/storage';

const routes = [
  {
    path: '/',
    redirect: '/app/home'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { transitionKind: 'auth' }
  },
  {
    path: '/set-password',
    name: 'SetPassword',
    component: () => import('../views/SetPassword.vue'),
    meta: { requiresAuth: false, transitionKind: 'auth' }
  },
  {
    path: '/app',
    component: () => import('../layouts/AppShell.vue'),
    meta: { transitionKind: 'shell' },
    children: [
      {
        path: 'home',
        name: 'AppHome',
        component: () => import('../views/app/Home.vue'),
        meta: { transitionKind: 'tab' }
      },
      {
        path: 'manage',
        name: 'AppManage',
        component: () => import('../views/app/Manage.vue'),
        meta: { requiresAuth: true, transitionKind: 'tab' }
      },
      {
        path: 'manage/history',
        redirect: '/app/manage'
      },
      {
        path: 'settings',
        name: 'AppSettings',
        component: () => import('../views/app/Settings.vue'),
        meta: { requiresAuth: true, transitionKind: 'tab' }
      }
    ]
  },
  {
    path: '/apply',
    name: 'LeaveApply',
    component: () => import('../views/LeaveApply.vue'),
    meta: { requiresAuth: true, transitionKind: 'stack' }
  },
  {
    path: '/leaves',
    name: 'MyLeaves',
    component: () => import('../views/MyLeaves.vue'),
    meta: { requiresAuth: true, transitionKind: 'stack' }
  },
  {
    path: '/schedule',
    name: 'Schedule',
    component: () => import('../views/Schedule.vue'),
    meta: { requiresAuth: true, transitionKind: 'stack' }
  },
  {
    path: '/change-password',
    name: 'ChangePassword',
    component: () => import('../views/ChangePassword.vue'),
    meta: { requiresAuth: true, transitionKind: 'stack' }
  },
  {
    path: '/home',
    redirect: '/app/home'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, from) => {
  const userStore = useUserStore();
  const hasTempToken = safeGetItem('tempToken');

  // 如果是设置密码页面，允许有临时token的用户访问
  if (to.path === '/set-password') {
    if (hasTempToken) {
      return true;
    }
    return '/login';
  }

  // 需要认证的页面
  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    return '/login';
  }

  // 已登录用户访问登录页，跳转到首页
  if (to.path === '/login' && userStore.isLoggedIn) {
    return '/app/home';
  }

  return true;
});

export default router;
