/* ==========================================================================
   Sổ Thu Chi Cá Nhân - Authentication Module (js/auth.js)
   Supports login with email phamphuongdong@gmail.com, session persistence,
   user profile badge, and logout control.
   ========================================================================== */

(function (global) {
  'use strict';

  const AUTH_KEY = 'stc_auth_user';
  const DEFAULT_USER = {
    email: 'phamphuongdong@gmail.com',
    name: 'Phạm Phương Đông',
    avatar: '👨‍💼',
    pin: '123456', // default 6-digit PIN
    isLoggedIn: false
  };

  class AuthModule {
    constructor() {
      this.currentUser = null;
      this.init();
    }

    init() {
      this.currentUser = this.getStoredUser();
      this.attachEventListeners();
    }

    getStoredUser() {
      try {
        const storage = global.localStorage || (global.window && global.window.localStorage);
        if (storage) {
          const raw = storage.getItem(AUTH_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.email) {
              return parsed;
            }
          }
        }
      } catch (e) {
        console.warn('[Auth] LocalStorage read failed:', e);
      }
      return { ...DEFAULT_USER, isLoggedIn: true }; // default auto-login for seamless UX
    }

    saveUser(user) {
      this.currentUser = user;
      try {
        const storage = global.localStorage || (global.window && global.window.localStorage);
        if (storage) {
          storage.setItem(AUTH_KEY, JSON.stringify(user));
        }
      } catch (e) {
        console.error('[Auth] Save user session failed:', e);
      }

      this.updateUI();

      if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
        try {
          window.dispatchEvent(new CustomEvent('authchanged', { detail: { user } }));
        } catch (e) {}
      }
    }

    login(email, pin) {
      const inputEmail = String(email || '').trim().toLowerCase();
      const inputPin = String(pin || '').trim();

      if (!inputEmail) {
        throw new Error('Vui lòng nhập Email đăng nhập');
      }

      // Check if email matches or is valid
      const displayName = inputEmail.includes('phamphuongdong') ? 'Phạm Phương Đông' : inputEmail.split('@')[0];

      const user = {
        email: inputEmail,
        name: displayName,
        avatar: '👨‍💼',
        pin: inputPin || '123456',
        isLoggedIn: true,
        loginTime: new Date().toISOString()
      };

      this.saveUser(user);
      return user;
    }

    logout() {
      const user = {
        ...DEFAULT_USER,
        isLoggedIn: false
      };
      this.saveUser(user);
      return user;
    }

    isLoggedIn() {
      return !!(this.currentUser && this.currentUser.isLoggedIn);
    }

    getUser() {
      return this.currentUser || DEFAULT_USER;
    }

    updateUI() {
      if (typeof document === 'undefined') return;

      const user = this.getUser();

      // Header User Badge
      const userBadgeEl = document.getElementById('header-user-badge');
      const userEmailText = document.getElementById('user-email-text');
      const userNameText = document.getElementById('user-name-text');

      if (userEmailText) userEmailText.textContent = user.email;
      if (userNameText) userNameText.textContent = user.name;

      // Settings User Display
      const settingsUserEl = document.getElementById('settings-user-info');
      if (settingsUserEl) {
        settingsUserEl.textContent = `${user.name} (${user.email})`;
      }

      // Login Modal Visibility
      const loginModal = document.getElementById('modal-auth-login');
      if (loginModal) {
        if (!user.isLoggedIn) {
          loginModal.removeAttribute('hidden');
          loginModal.setAttribute('aria-hidden', 'false');
          loginModal.style.display = 'flex';
        } else {
          loginModal.setAttribute('hidden', 'true');
          loginModal.setAttribute('aria-hidden', 'true');
          loginModal.style.display = 'none';
        }
      }
    }

    attachEventListeners() {
      if (typeof document === 'undefined') return;

      document.addEventListener('DOMContentLoaded', () => {
        this.updateUI();
      });

      document.addEventListener('click', (e) => {
        // Quick Login Button
        const btnQuickLogin = e.target.closest('#btn-quick-login-dong');
        if (btnQuickLogin) {
          e.preventDefault();
          this.login('phamphuongdong@gmail.com', '123456');
          if (window.Toast) {
            window.Toast.show('✅ Đã đăng nhập thành công với phamphuongdong@gmail.com', 'success');
          }
        }

        // Logout Button
        const btnLogout = e.target.closest('[data-action="logout"], #btn-logout');
        if (btnLogout) {
          e.preventDefault();
          this.logout();
          if (window.Toast) {
            window.Toast.show('🚪 Đã đăng xuất khỏi tài khoản', 'info');
          }
        }
      });

      // Submit Login Form
      document.addEventListener('submit', (e) => {
        const formLogin = e.target.closest('#form-auth-login');
        if (formLogin) {
          e.preventDefault();
          const emailInput = document.getElementById('auth-email-input');
          const pinInput = document.getElementById('auth-pin-input');

          const email = emailInput ? emailInput.value : '';
          const pin = pinInput ? pinInput.value : '';

          try {
            this.login(email, pin);
            if (window.Toast) {
              window.Toast.show(`✅ Chào mừng ${this.currentUser.name}!`, 'success');
            }
          } catch (err) {
            if (window.Toast) {
              window.Toast.show(`❌ ${err.message}`, 'error');
            }
          }
        }
      });
    }
  }

  const authInstance = new AuthModule();
  global.Auth = authInstance;
  global.AuthModule = authInstance;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = authInstance;
  }
})(typeof window !== 'undefined' ? window : this);
