import { defineStore } from 'pinia';

function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    // Ignore storage write failures and keep in-memory state.
  }
}

function safeRemoveItem(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    // Ignore storage removal failures and keep in-memory state.
  }
}

function getInitialTeacherState() {
  const token = safeGetItem('teacher_token') || '';
  const rawUser = safeGetItem('teacher_user');

  if (!rawUser) {
    if (token) {
      safeRemoveItem('teacher_token');
    }
    return {
      token: '',
      user: null
    };
  }

  try {
    return {
      token,
      user: JSON.parse(rawUser)
    };
  } catch (error) {
    safeRemoveItem('teacher_token');
    safeRemoveItem('teacher_user');
    return {
      token: '',
      user: null
    };
  }
}

const initialState = getInitialTeacherState();

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: initialState.token,
    user: initialState.user
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
    isAdmin: (state) => state.user?.role === 'admin'
  },

  actions: {
    setToken(token) {
      this.token = token;
      safeSetItem('teacher_token', token);
    },

    setUser(user) {
      this.user = user;
      safeSetItem('teacher_user', JSON.stringify(user));
    },

    login(token, user) {
      this.setToken(token);
      this.setUser(user);
    },

    logout() {
      this.token = '';
      this.user = null;
      safeRemoveItem('teacher_token');
      safeRemoveItem('teacher_user');
    }
  }
});
