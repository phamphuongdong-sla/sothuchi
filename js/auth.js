/* ==========================================================================
   Sổ Thu Chi Cá Nhân - Authentication & Role Permissions (js/auth.js)
   ========================================================================== */

(function (global) {
  'use strict';

  const AUTH_KEY = 'stc_auth_user';

  const DEFAULT_USER = {
    email: 'phamphuongdong@gmail.com',
    name: 'Phạm Phương Đông',
    avatar: '👨‍💼',
    pin: '123456',
    role: 'admin',
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
      this._init();
    }

    _init() {
      this.currentUser = this._loadUser();
      this._attachListeners();
      // Initial UI update after DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.updateUI());
      } else {
        this.updateUI();
      }
    }

    _loadUser() {
      try {
        const storage = global.localStorage;
        const raw = storage?.getItem(AUTH_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.email) {
            return { ...DEFAULT_USER, ...parsed, role: parsed.role || 'admin' };
          }
        }
      } catch (e) {
        console.warn('[Auth] LocalStorage read failed:', e);
      }
      return { ...DEFAULT_USER, isLoggedIn: true };
    }

    _saveUser(user) {
      this.currentUser = user;
      try {
        global.localStorage?.setItem(AUTH_KEY, JSON.stringify(user));
      } catch (e) {
        console.error('[Auth] Save user session failed:', e);
      }
      this.updateUI();
      try {
        window.dispatchEvent(new CustomEvent('authchanged', { detail: { user } }));
      } catch (_) {}
    }

    login(email, pin) {
      const inputEmail = String(email || '').trim().toLowerCase();
      const inputPin = String(pin || '').trim();

      if (!inputEmail) throw new Error('Vui lòng nhập Email đăng nhập');
      if (!inputPin) throw new Error('Vui lòng nhập Mật khẩu / Mã PIN');

      const stored = this._loadUser();
      if (stored.pin && stored.pin !== inputPin) {
        throw new Error('Mật khẩu / Mã PIN không chính xác!');
      }

      const displayName = inputEmail.includes('phamphuongdong')
        ? 'Phạm Phương Đông'
        : inputEmail.split('@')[0];

      const user = {
        ...stored,
        email: inputEmail,
        name: displayName,
        pin: stored.pin || inputPin,
        role: stored.role || 'admin',
        isLoggedIn: true,
        loginTime: new Date().toISOString()
      };

      this._saveUser(user);
      return user;
    }

    changePassword(oldPin, newPin, confirmPin) {
      const current = this.getUser();
      const inputOld = String(oldPin || '').trim();
      const inputNew = String(newPin || '').trim();
      const inputConfirm = String(confirmPin || '').trim();

      if (!inputOld) throw new Error('Vui lòng nhập Mật khẩu hiện tại');
      if (current.pin && inputOld !== current.pin) throw new Error('Mật khẩu hiện tại không đúng!');
      if (!inputNew || inputNew.length < 4) throw new Error('Mật khẩu mới phải có ít nhất 4 ký tự!');
      if (inputNew !== inputConfirm) throw new Error('Xác nhận mật khẩu mới không trùng khớp!');

      const updated = { ...current, pin: inputNew };
      this._saveUser(updated);
      return updated;
    }

    changeRole(newRole) {
      const validRoles = ['admin', 'member', 'viewer'];
      const role = validRoles.includes(newRole) ? newRole : 'admin';
      const updated = { ...this.getUser(), role, roleName: ROLE_NAMES[role] };
      this._saveUser(updated);
      return updated;
    }

    hasPermission(action) {
      const role = this.getUser().role || 'admin';
      if (role === 'admin') return true;
      if (role === 'member') return ['addTransaction', 'editTransaction', 'deleteTransaction', 'viewReports'].includes(action);
      if (role === 'viewer') return ['viewReports', 'viewTransactions'].includes(action);
      return true;
    }

    logout() {
      const user = { ...this.getUser(), isLoggedIn: false };
      this._saveUser(user);
      return user;
    }

    isLoggedIn() {
      return !!(this.currentUser?.isLoggedIn);
    }

    getUser() {
      return this.currentUser || DEFAULT_USER;
    }

    updateUI() {
      if (typeof document === 'undefined') return;
      const user = this.getUser();

      const el = id => document.getElementById(id);

      const userEmailText = el('user-email-text');
      const userNameText = el('user-name-text');
      const userRoleBadge = el('user-role-badge');
      if (userEmailText) userEmailText.textContent = user.email;
      if (userNameText) userNameText.textContent = user.name;
      if (userRoleBadge) userRoleBadge.textContent = ROLE_NAMES[user.role] || ROLE_NAMES.admin;

      const settingsUserEl = el('settings-user-info');
      if (settingsUserEl) settingsUserEl.textContent = `${user.name} (${user.email})`;

      const roleSelect = el('select-user-role');
      if (roleSelect) roleSelect.value = user.role || 'admin';

      const loginModal = el('modal-auth-login');
      if (loginModal) {
        if (!user.isLoggedIn) {
          loginModal.removeAttribute('hidden');
          loginModal.setAttribute('aria-hidden', 'false');
          loginModal.style.display = 'flex';
          const pinInput = el('auth-pin-input');
          if (pinInput) pinInput.value = '';
        } else {
          loginModal.setAttribute('hidden', 'true');
          loginModal.setAttribute('aria-hidden', 'true');
          loginModal.style.display = 'none';
        }
      }
    }

    _attachListeners() {
      if (typeof document === 'undefined') return;

      document.addEventListener('click', e => {
        // Toggle password visibility
        const btnTogglePw = e.target.closest('#btn-toggle-auth-pw, .btn-toggle-pw');
        if (btnTogglePw) {
          e.preventDefault();
          const wrapper = btnTogglePw.closest('.pw-input-wrapper');
          const input = wrapper?.querySelector('input') || document.getElementById('auth-pin-input');
          const icon = btnTogglePw.querySelector('.eye-icon');
          if (input) {
            const isPw = input.type === 'password';
            input.type = isPw ? 'text' : 'password';
            if (icon) icon.textContent = isPw ? '🙈' : '👁️';
          }
          return;
        }

        // Logout/Lock
        const btnLogout = e.target.closest('[data-action="logout"], #btn-logout, #btn-lock-app');
        if (btnLogout) {
          e.preventDefault();
          this.logout();
          window.Toast?.show('🔒 Đã khóa ứng dụng và đăng xuất', 'info');
        }
      });

      document.addEventListener('submit', e => {
        // Login form
        if (e.target.closest('#form-auth-login')) {
          e.preventDefault();
          const email = document.getElementById('auth-email-input')?.value || '';
          const pin = document.getElementById('auth-pin-input')?.value || '';
          const errorEl = document.getElementById('auth-pin-error');
          if (errorEl) errorEl.textContent = '';
          try {
            this.login(email, pin);
            window.Toast?.show(`✅ Chào mừng ${this.currentUser.name}!`, 'success');
          } catch (err) {
            const form = e.target;
            form.classList.remove('shake-error');
            void form.offsetWidth;
            form.classList.add('shake-error');
            if (errorEl) errorEl.textContent = err.message;
            document.getElementById('auth-pin-input')?.focus();
            window.Toast?.show(`❌ ${err.message}`, 'error');
          }
          return;
        }

        // Change password form
        if (e.target.closest('#form-change-password')) {
          e.preventDefault();
          try {
            this.changePassword(
              document.getElementById('pw-old-input')?.value || '',
              document.getElementById('pw-new-input')?.value || '',
              document.getElementById('pw-confirm-input')?.value || ''
            );
            ['pw-old-input', 'pw-new-input', 'pw-confirm-input'].forEach(id => {
              const el = document.getElementById(id);
              if (el) el.value = '';
            });
            window.Toast?.show('✅ Đã đổi mật khẩu thành công!', 'success');
          } catch (err) {
            window.Toast?.show(`❌ ${err.message}`, 'error');
          }
        }
      });

      document.addEventListener('change', e => {
        const roleSelect = e.target.closest('#select-user-role');
        if (roleSelect) {
          this.changeRole(roleSelect.value);
          window.Toast?.show(`✅ Đã cập nhật vai trò: ${ROLE_NAMES[roleSelect.value]}`, 'info');
        }
      });
    }
  }

  const authInstance = new AuthModule();
  global.Auth = authInstance;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = authInstance;
  }
})(typeof window !== 'undefined' ? window : this);
