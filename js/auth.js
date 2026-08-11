/* ==========================================================================
   Sổ Thu Chi Cá Nhân - Authentication & Role Permissions System (js/auth.js)
   Supports login with email phamphuongdong@gmail.com, password/PIN change,
   session persistence, user profile badge, and Role-Based Access Control (RBAC).
   ========================================================================== */

(function (global) {
  'use strict';

  const AUTH_KEY = 'stc_auth_user';
  const DEFAULT_USER = {
    email: 'phamphuongdong@gmail.com',
    name: 'Phạm Phương Đông',
    avatar: '👨‍💼',
    pin: '123456', // default PIN / password
    role: 'admin', // 'admin', 'member', 'viewer'
    roleName: 'Quản trị viên (Admin)',
    isLoggedIn: false
  };

  const ROLE_NAMES = {
    admin: '👑 Quản trị viên (Admin)',
    member: '👤 Thành viên (Member)',
    viewer: '👁️ Người xem (Viewer)'
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
              return {
                ...DEFAULT_USER,
                ...parsed,
                role: parsed.role || 'admin'
              };
            }
          }
        }
      } catch (e) {
        console.warn('[Auth] LocalStorage read failed:', e);
      }
      return { ...DEFAULT_USER, isLoggedIn: true };
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

      if (!inputPin) {
        throw new Error('Vui lòng nhập Mật khẩu / Mã PIN (Không được để trống)');
      }

      const stored = this.getStoredUser();
      if (stored.pin && stored.pin !== inputPin) {
        throw new Error('Mật khẩu / Mã PIN không chính xác!');
      }

      const displayName = inputEmail.includes('phamphuongdong') ? 'Phạm Phương Đông' : inputEmail.split('@')[0];

      const user = {
        ...stored,
        email: inputEmail,
        name: displayName,
        avatar: '👨‍💼',
        pin: stored.pin || inputPin,
        role: stored.role || 'admin',
        isLoggedIn: true,
        loginTime: new Date().toISOString()
      };

      this.saveUser(user);
      return user;
    }

    changePassword(oldPin, newPin, confirmPin) {
      const current = this.getUser();
      const inputOld = String(oldPin || '').trim();
      const inputNew = String(newPin || '').trim();
      const inputConfirm = String(confirmPin || '').trim();

      if (!inputOld) {
        throw new Error('Vui lòng nhập Mật khẩu hiện tại');
      }
      if (current.pin && inputOld !== current.pin) {
        throw new Error('Mật khẩu hiện tại không đúng!');
      }
      if (!inputNew || inputNew.length < 4) {
        throw new Error('Mật khẩu mới phải có ít nhất 4 ký tự!');
      }
      if (inputNew !== inputConfirm) {
        throw new Error('Xác nhận mật khẩu mới không trùng khớp!');
      }

      const updatedUser = {
        ...current,
        pin: inputNew
      };

      this.saveUser(updatedUser);
      return updatedUser;
    }

    changeRole(newRole) {
      const validRoles = ['admin', 'member', 'viewer'];
      const targetRole = validRoles.includes(newRole) ? newRole : 'admin';
      const current = this.getUser();

      const updatedUser = {
        ...current,
        role: targetRole,
        roleName: ROLE_NAMES[targetRole]
      };

      this.saveUser(updatedUser);
      return updatedUser;
    }

    hasPermission(action) {
      const user = this.getUser();
      const role = user.role || 'admin';

      if (role === 'admin') return true;
      if (role === 'member') {
        return ['addTransaction', 'editTransaction', 'deleteTransaction', 'viewReports'].includes(action);
      }
      if (role === 'viewer') {
        return ['viewReports', 'viewTransactions'].includes(action);
      }
      return true;
    }

    logout() {
      const user = {
        ...this.getUser(),
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
      const userEmailText = document.getElementById('user-email-text');
      const userNameText = document.getElementById('user-name-text');
      const userRoleBadge = document.getElementById('user-role-badge');

      if (userEmailText) userEmailText.textContent = user.email;
      if (userNameText) userNameText.textContent = user.name;
      if (userRoleBadge) {
        userRoleBadge.textContent = ROLE_NAMES[user.role] || ROLE_NAMES.admin;
      }

      // Settings User Display
      const settingsUserEl = document.getElementById('settings-user-info');
      if (settingsUserEl) {
        settingsUserEl.textContent = `${user.name} (${user.email})`;
      }

      const roleSelect = document.getElementById('select-user-role');
      if (roleSelect) {
        roleSelect.value = user.role || 'admin';
      }

      // Login Modal Visibility
      const loginModal = document.getElementById('modal-auth-login');
      if (loginModal) {
        if (!user.isLoggedIn) {
          loginModal.removeAttribute('hidden');
          loginModal.setAttribute('aria-hidden', 'false');
          loginModal.style.display = 'flex';
          const pinInput = document.getElementById('auth-pin-input');
          if (pinInput) pinInput.value = '';
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
        // Toggle Password Eye Icon
        const btnTogglePw = e.target.closest('#btn-toggle-auth-pw, .btn-toggle-pw');
        if (btnTogglePw) {
          e.preventDefault();
          const wrapper = btnTogglePw.closest('.pw-input-wrapper');
          const input = wrapper ? wrapper.querySelector('input') : document.getElementById('auth-pin-input');
          const eyeIcon = btnTogglePw.querySelector('.eye-icon');
          if (input) {
            const isPw = input.type === 'password';
            input.type = isPw ? 'text' : 'password';
            if (eyeIcon) eyeIcon.textContent = isPw ? '🙈' : '👁️';
          }
        }

        // Logout / Lock App Button
        const btnLogout = e.target.closest('[data-action="logout"], #btn-logout, #btn-lock-app');
        if (btnLogout) {
          e.preventDefault();
          this.logout();
          if (window.Toast) {
            window.Toast.show('🔒 Đã khóa ứng dụng và đăng xuất', 'info');
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
          const pinErrorEl = document.getElementById('auth-pin-error');

          const email = emailInput ? emailInput.value : '';
          const pin = pinInput ? pinInput.value : '';

          if (pinErrorEl) pinErrorEl.textContent = '';

          try {
            this.login(email, pin);
            if (window.Toast) {
              window.Toast.show(`✅ Chào mừng ${this.currentUser.name}!`, 'success');
            }
          } catch (err) {
            formLogin.classList.remove('shake-error');
            // Trigger reflow to restart CSS animation
            void formLogin.offsetWidth;
            formLogin.classList.add('shake-error');

            if (pinErrorEl) pinErrorEl.textContent = err.message;
            if (pinInput) pinInput.focus();

            if (window.Toast) {
              window.Toast.show(`❌ ${err.message}`, 'error');
            }
          }
        }

        // Submit Change Password Form
        const formChangePw = e.target.closest('#form-change-password');
        if (formChangePw) {
          e.preventDefault();
          const oldPwInput = document.getElementById('pw-old-input');
          const newPwInput = document.getElementById('pw-new-input');
          const confirmPwInput = document.getElementById('pw-confirm-input');

          try {
            this.changePassword(
              oldPwInput ? oldPwInput.value : '',
              newPwInput ? newPwInput.value : '',
              confirmPwInput ? confirmPwInput.value : ''
            );
            if (oldPwInput) oldPwInput.value = '';
            if (newPwInput) newPwInput.value = '';
            if (confirmPwInput) confirmPwInput.value = '';

            if (window.Toast) {
              window.Toast.show('✅ Đã đổi mật khẩu thành công!', 'success');
            }
          } catch (err) {
            if (window.Toast) {
              window.Toast.show(`❌ ${err.message}`, 'error');
            }
          }
        }
      });

      // Change Role Selector Listener
      document.addEventListener('change', (e) => {
        const roleSelect = e.target.closest('#select-user-role');
        if (roleSelect) {
          const newRole = roleSelect.value;
          this.changeRole(newRole);
          if (window.Toast) {
            window.Toast.show(`✅ Đã cập nhật vai trò thành: ${ROLE_NAMES[newRole]}`, 'info');
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
