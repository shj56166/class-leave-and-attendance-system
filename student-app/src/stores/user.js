import { defineStore } from 'pinia';
import { safeGetItem, safeRemoveItem, safeSetItem } from '../utils/storage';

function getInitialUserState() {
  const token = safeGetItem('token') || '';
  const rawUser = safeGetItem('user');

  if (!rawUser) {
    if (token) {
      safeRemoveItem('token');
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
    safeRemoveItem('token');
    safeRemoveItem('user');
    return {
      token: '',
      user: null
    };
  }
}

const initialState = getInitialUserState();

export const useUserStore = defineStore('user', {
  state: () => ({
    token: initialState.token,
    user: initialState.user
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
    isCadre: (state) => state.user?.role === 'cadre'
  },

  actions: {
    setToken(token) {
      this.token = token;
      safeSetItem('token', token);
    },

    setUser(user) {
      this.user = user;
      safeSetItem('user', JSON.stringify(user));
    },

    login(token, user) {
      this.setToken(token);
      this.setUser(user);
    },

    logout() {
      this.token = '';
      this.user = null;
      safeRemoveItem('token');
      safeRemoveItem('user');
    }
  }
});
