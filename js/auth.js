/* ==========================================================================
   Sổ Thu Chi Cá Nhân - Authentication, RBAC Permissions & OTP Mail (js/auth.js)
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

  const PERMISSIONS = {
    admin: ['addTransaction', 'editTransaction', 'deleteTransaction', 'viewReports', 'manageCategories', 'manageRoles', 'syncData'],
    member: ['addTransaction', 'editTransaction', 'deleteTransaction', 'viewReports', 'syncData'],
    viewer: ['viewReports', 'viewTransactions']
  };

  class AuthModule {
    constructor() {
      this.currentUser = null;
      this.otpState = {
        sent: false,
        verified: false,
        timer: null,
        secondsLeft: 0,
        email: ''
      };
      this._init();
    }

    _init() {
      this.currentUser = this._loadUser();
      this._attachListeners();
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

    /* ------------------------------------------------------------------
       OTP Mail & Password Reset Flow
       ------------------------------------------------------------------ */
    async sendOtp(email) {
      const targetEmail = String(email || this.getUser().email || '').trim().toLowerCase();
      if (!targetEmail || !targetEmail.includes('@')) {
        throw new Error('Email tài khoản không hợp lệ');
      }

      const sync = global.SyncEngine;
      const gasUrl = sync?.getSettings?.()?.gasUrl || 'https://script.google.com/macros/s/AKfycbzI9y7gVMLLob2lNltvGyzH5_ZA-XEav5MC-037FI7JzuWS38iQ6dTzitphHBkhC5HiQQ/exec';

      let res;
      try {
        const payload = JSON.stringify({ action: 'sendOtp', email: targetEmail });
        const resp = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: payload
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        res = await resp.json();
      } catch (err) {
        // GET fallback if POST fails
        try {
          const sep = gasUrl.includes('?') ? '&' : '?';
          const resp = await fetch(`${gasUrl}${sep}action=sendOtp&email=${encodeURIComponent(targetEmail)}`);
          res = await resp.json();
        } catch (e2) {
          throw new Error('Không thể kết nối đến máy chủ OTP. Kiểm tra mạng hoặc URL GAS!');
        }
      }

      if (res?.status !== 'success') {
        throw new Error(res?.message || 'Không thể gửi mã OTP');
      }

      this.otpState.sent = true;
      this.otpState.verified = false;
      this.otpState.email = targetEmail;
      this._startOtpTimer(180); // 3 minutes countdown

      return res.message;
    }

    async verifyOtp(otp) {
      const inputOtp = String(otp || '').trim();
      if (!inputOtp || inputOtp.length < 4) {
        throw new Error('Vui lòng nhập mã OTP 6 chữ số');
      }
      if (!this.otpState.email) {
        throw new Error('Vui lòng nhấn "Gửi mã OTP" trước!');
      }

      const sync = global.SyncEngine;
      const gasUrl = sync?.getSettings?.()?.gasUrl || 'https://script.google.com/macros/s/AKfycbzI9y7gVMLLob2lNltvGyzH5_ZA-XEav5MC-037FI7JzuWS38iQ6dTzitphHBkhC5HiQQ/exec';

      let res;
      try {
        const payload = JSON.stringify({ action: 'verifyOtp', email: this.otpState.email, otp: inputOtp });
        const resp = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: payload
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        res = await resp.json();
      } catch (err) {
        try {
          const sep = gasUrl.includes('?') ? '&' : '?';
          const resp = await fetch(`${gasUrl}${sep}action=verifyOtp&email=${encodeURIComponent(this.otpState.email)}&otp=${encodeURIComponent(inputOtp)}`);
          res = await resp.json();
        } catch (e2) {
          throw new Error('Không thể xác thực OTP. Kiểm tra mạng!');
        }
      }

      if (res?.status !== 'success') {
        throw new Error(res?.message || 'Mã OTP không chính xác');
      }

      this.otpState.verified = true;
      clearInterval(this.otpState.timer);
      this._updateOtpUI('verified');
      return true;
    }

    _startOtpTimer(seconds) {
      clearInterval(this.otpState.timer);
      this.otpState.secondsLeft = seconds;
      this._updateOtpUI('sent');

      this.otpState.timer = setInterval(() => {
        this.otpState.secondsLeft--;
        if (this.otpState.secondsLeft <= 0) {
          clearInterval(this.otpState.timer);
          this.otpState.sent = false;
          this.otpState.verified = false;
          this._updateOtpUI('expired');
        } else {
          this._updateOtpUI('ticking');
        }
      }, 1000);
    }

    _updateOtpUI(state) {
      if (typeof document === 'undefined') return;

      const btnSend = document.getElementById('btn-send-otp');
      const otpGroup = document.getElementById('otp-input-group');
      const timerText = document.getElementById('otp-timer-text');
      const newPwGroup = document.getElementById('new-pw-group');

      if (state === 'sent' || state === 'ticking') {
        if (btnSend) {
          btnSend.disabled = true;
          btnSend.textContent = `⏳ Gửi lại (${this.otpState.secondsLeft}s)`;
        }
        if (otpGroup) otpGroup.hidden = false;
        if (timerText) {
          const m = Math.floor(this.otpState.secondsLeft / 60);
          const s = this.otpState.secondsLeft % 60;
          timerText.textContent = `Mã OTP có hiệu lực trong ${m}:${String(s).padStart(2, '0')}`;
          timerText.className = 'field-error text-info';
        }
      } else if (state === 'verified') {
        if (btnSend) {
          btnSend.disabled = true;
          btnSend.textContent = '✅ Đã xác thực OTP';
        }
        if (otpGroup) otpGroup.hidden = true;
        if (timerText) {
          timerText.textContent = '✅ Xác thực OTP qua Email thành công! Nhập mật khẩu mới bên dưới.';
          timerText.className = 'field-error text-success';
        }
        if (newPwGroup) newPwGroup.hidden = false;
      } else if (state === 'expired') {
        if (btnSend) {
          btnSend.disabled = false;
          btnSend.textContent = '📩 Gửi lại mã OTP';
        }
        if (timerText) {
          timerText.textContent = '⚠️ Mã OTP đã hết hạn. Vui lòng nhấn gửi lại!';
          timerText.className = 'field-error text-danger';
        }
      }
    }

    changePasswordWithOtp(oldPin, newPin, confirmPin) {
      const current = this.getUser();
      const inputOld = String(oldPin || '').trim();
      const inputNew = String(newPin || '').trim();
      const inputConfirm = String(confirmPin || '').trim();

      if (!inputOld) throw new Error('Vui lòng nhập Mật khẩu hiện tại');
      if (current.pin && inputOld !== current.pin) throw new Error('Mật khẩu hiện tại không đúng!');
      if (!this.otpState.verified) throw new Error('Vui lòng xác nhận mã OTP gửi qua Email trước khi đổi mật khẩu!');
      if (!inputNew || inputNew.length < 4) throw new Error('Mật khẩu mới phải có ít nhất 4 ký tự!');
      if (inputNew !== inputConfirm) throw new Error('Xác nhận mật khẩu mới không trùng khớp!');

      const updated = { ...current, pin: inputNew };
      this._saveUser(updated);

      // Reset OTP state
      this.otpState.sent = false;
      this.otpState.verified = false;
      return updated;
    }

    changeRole(newRole) {
      if (!this.hasPermission('manageRoles')) {
        throw new Error('Chỉ Quản trị viên (Admin) mới có quyền thay đổi vai trò!');
      }

      const validRoles = ['admin', 'member', 'viewer'];
      const role = validRoles.includes(newRole) ? newRole : 'admin';
      const updated = { ...this.getUser(), role, roleName: ROLE_NAMES[role] };
      this._saveUser(updated);
      return updated;
    }

    hasPermission(action) {
      const role = this.getUser().role || 'admin';
      const allowed = PERMISSIONS[role] || PERMISSIONS.admin;
      return allowed.includes(action);
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
      if (roleSelect) {
        roleSelect.value = user.role || 'admin';
        roleSelect.disabled = !this.hasPermission('manageRoles');
      }

      // Hide/Disable add transaction form for Viewers
      const canAdd = this.hasPermission('addTransaction');
      const addFormCard = document.querySelector('#view-transactions .form-card');
      if (addFormCard) {
        const inputs = addFormCard.querySelectorAll('input, select, button[type="submit"]');
        inputs.forEach(i => { i.disabled = !canAdd; });
        let warningBadge = addFormCard.querySelector('.viewer-warning');
        if (!canAdd) {
          if (!warningBadge) {
            warningBadge = document.createElement('div');
            warningBadge.className = 'viewer-warning alert-box warning-box mt-2';
            warningBadge.innerHTML = '🔒 <strong>Chế độ Người xem (Viewer):</strong> Bạn không có quyền thêm/sửa/xóa giao dịch.';
            addFormCard.prepend(warningBadge);
          }
        } else if (warningBadge) {
          warningBadge.remove();
        }
      }

      // Hide login modal
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

      document.addEventListener('click', async e => {
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

        // Send OTP Button
        const btnSendOtp = e.target.closest('#btn-send-otp');
        if (btnSendOtp) {
          e.preventDefault();
          const email = this.getUser().email;
          window.Toast?.show('📩 Đang gửi mã OTP đến email ' + email + '...', 'info', 3000);
          try {
            const msg = await this.sendOtp(email);
            window.Toast?.show('✅ ' + msg, 'success', 4000);
          } catch (err) {
            window.Toast?.show('❌ ' + err.message, 'error', 4000);
          }
          return;
        }

        // Verify OTP Button
        const btnVerifyOtp = e.target.closest('#btn-verify-otp');
        if (btnVerifyOtp) {
          e.preventDefault();
          const otpVal = document.getElementById('otp-code-input')?.value || '';
          window.Toast?.show('🔍 Đang kiểm tra mã OTP...', 'info', 2000);
          try {
            await this.verifyOtp(otpVal);
            window.Toast?.show('✅ Xác thực OTP qua Email thành công! Bạn có thể đặt mật khẩu mới.', 'success', 4000);
          } catch (err) {
            window.Toast?.show('❌ ' + err.message, 'error', 4000);
          }
          return;
        }

        // Logout / Lock
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

        // Change password form with OTP
        if (e.target.closest('#form-change-password')) {
          e.preventDefault();
          try {
            this.changePasswordWithOtp(
              document.getElementById('pw-old-input')?.value || '',
              document.getElementById('pw-new-input')?.value || '',
              document.getElementById('pw-confirm-input')?.value || ''
            );
            ['pw-old-input', 'otp-code-input', 'pw-new-input', 'pw-confirm-input'].forEach(id => {
              const el = document.getElementById(id);
              if (el) el.value = '';
            });
            const newPwGroup = document.getElementById('new-pw-group');
            if (newPwGroup) newPwGroup.hidden = true;
            const btnSend = document.getElementById('btn-send-otp');
            if (btnSend) { btnSend.disabled = false; btnSend.textContent = '📩 Gửi mã OTP qua Email'; }
            window.Toast?.show('🎉 Đã đổi mật khẩu thành công!', 'success');
          } catch (err) {
            window.Toast?.show(`❌ ${err.message}`, 'error');
          }
        }
      });

      document.addEventListener('change', e => {
        const roleSelect = e.target.closest('#select-user-role');
        if (roleSelect) {
          try {
            this.changeRole(roleSelect.value);
            window.Toast?.show(`✅ Đã cập nhật vai trò: ${ROLE_NAMES[roleSelect.value]}`, 'info');
          } catch (err) {
            window.Toast?.show(`❌ ${err.message}`, 'error');
            roleSelect.value = this.getUser().role;
          }
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
