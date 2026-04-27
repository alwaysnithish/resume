/* QuantumCV — Auth JS v3 */
'use strict';

const CSRF = () => document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '';

// ── Toast ────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  let c = document.getElementById('toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toast-container';
    document.body.appendChild(c);
  }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<div class="toast-icon"></div><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 300);
  }, 4200);
}

// ── Button loading state ─────────────────────────────────
function setBtnLoading(id, loading) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.classList.toggle('loading', loading);
  btn.disabled = loading;
}

// ── STEP 1: Send OTP ────────────────────────────────────
async function sendOTP() {
  const emailInput = document.getElementById('email-input');
  const errEl      = document.getElementById('email-error');
  const email      = emailInput.value.trim().toLowerCase();

  errEl.textContent = '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errEl.textContent = 'Please enter a valid email address.';
    emailInput.focus();
    return;
  }

  setBtnLoading('send-otp-btn', true);

  try {
    const res  = await fetch('/api/send-otp/', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF() },
      body:    JSON.stringify({ email }),
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById('email-display').textContent = email;
      transition('step-email', 'step-otp');
      setTimeout(() => document.querySelector('.otp-digit')?.focus(), 150);
      startResendTimer(60);
      showToast('Code sent — check your inbox.', 'success');
    } else {
      errEl.textContent = data.message;
    }
  } catch {
    errEl.textContent = 'Network error. Please try again.';
  } finally {
    setBtnLoading('send-otp-btn', false);
  }
}

// ── STEP 2: Verify OTP ──────────────────────────────────
async function verifyOTP() {
  const digits  = [...document.querySelectorAll('.otp-digit')];
  const otp     = digits.map(d => d.value).join('');
  const errEl   = document.getElementById('otp-error');

  errEl.textContent = '';

  if (otp.length < 6) {
    errEl.textContent = 'Enter all 6 digits.';
    return;
  }

  setBtnLoading('verify-btn', true);

  try {
    const res  = await fetch('/api/verify-otp/', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF() },
      body:    JSON.stringify({
        otp,
        full_name: document.getElementById('name-input')?.value?.trim() || '',
      }),
    });
    const data = await res.json();

    if (data.success) {
      showToast('Verified! Signing you in…', 'success');
      setTimeout(() => { window.location.href = data.redirect; }, 600);
    } else {
      errEl.textContent = data.message;
      flashDigitError(digits);
    }
  } catch {
    errEl.textContent = 'Network error. Please try again.';
  } finally {
    setBtnLoading('verify-btn', false);
  }
}

function flashDigitError(digits) {
  digits.forEach(d => { d.classList.add('error'); d.value = ''; d.classList.remove('filled'); });
  setTimeout(() => digits.forEach(d => d.classList.remove('error')), 500);
  digits[0]?.focus();
}

// ── OTP digit keyboard / paste handling ─────────────────
function initOTPInputs() {
  const digits = [...document.querySelectorAll('.otp-digit')];

  digits.forEach((inp, i) => {
    inp.addEventListener('input', e => {
      const v = e.target.value.replace(/\D/g, '');
      e.target.value = v.slice(-1);
      e.target.classList.toggle('filled', !!e.target.value);
      if (v && i < digits.length - 1) digits[i + 1].focus();
      if (digits.every(d => d.value)) setTimeout(verifyOTP, 300);
    });

    inp.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !e.target.value && i > 0) {
        digits[i - 1].value = '';
        digits[i - 1].classList.remove('filled');
        digits[i - 1].focus();
      }
      if (e.key === 'ArrowLeft'  && i > 0)               digits[i - 1].focus();
      if (e.key === 'ArrowRight' && i < digits.length - 1) digits[i + 1].focus();
      if (e.key === 'Enter') verifyOTP();
    });

    inp.addEventListener('paste', e => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      pasted.split('').forEach((ch, j) => {
        if (digits[j]) { digits[j].value = ch; digits[j].classList.add('filled'); }
      });
      if (pasted.length === 6) setTimeout(verifyOTP, 300);
    });
  });
}

// ── Resend timer ─────────────────────────────────────────
let _resendTimer = null;

function startResendTimer(seconds = 60) {
  const btn   = document.getElementById('resend-btn');
  const timer = document.getElementById('resend-timer');
  if (!btn) return;

  btn.disabled = true;
  clearInterval(_resendTimer);
  let t = seconds;

  const update = () => { if (timer) timer.textContent = t; };
  update();

  _resendTimer = setInterval(() => {
    t--;
    update();
    if (t <= 0) {
      clearInterval(_resendTimer);
      btn.disabled = false;
    }
  }, 1000);
}

async function resendOTP() {
  const btn = document.getElementById('resend-btn');
  if (btn) btn.disabled = true;

  try {
    const res  = await fetch('/api/resend-otp/', {
      method:  'POST',
      headers: { 'X-CSRFToken': CSRF() },
    });
    const data = await res.json();

    if (data.success) {
      showToast('New code sent!', 'success');
      startResendTimer(60);
    } else {
      showToast(data.message || 'Failed to resend.', 'error');
      if (btn) btn.disabled = false;
    }
  } catch {
    showToast('Network error. Try again.', 'error');
    if (btn) btn.disabled = false;
  }
}

// ── Step transition ──────────────────────────────────────
function transition(fromId, toId) {
  document.getElementById(fromId)?.classList.remove('active');
  document.getElementById(toId)?.classList.add('active');
}

function goBack() {
  transition('step-otp', 'step-email');
  document.getElementById('email-error').textContent = '';
  clearInterval(_resendTimer);
}

// ── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initOTPInputs();

  document.getElementById('email-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') sendOTP();
  });
});

// Expose for inline onclick handlers
window.sendOTP   = sendOTP;
window.verifyOTP = verifyOTP;
window.resendOTP = resendOTP;
window.goBack    = goBack;
