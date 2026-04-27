/* QuantumCV — Dashboard JS v2 */
'use strict';

const CSRF = () => document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '';

// ── Toast ────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<div class="toast-icon"></div><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 4000);
}

// ── Delete resume ────────────────────────────────────────
async function deleteResume(id, btn) {
  if (!confirm('Permanently delete this resume? This cannot be undone.')) return;

  const origText = btn.textContent;
  btn.disabled    = true;
  btn.textContent = '…';

  try {
    const res  = await fetch(`/resume/api/delete/${id}/`, {
      method:  'POST',
      headers: { 'X-CSRFToken': CSRF() },
    });
    const data = await res.json();

    if (data.success) {
      const card = document.querySelector(`.resume-card[data-id="${id}"]`);
      if (card) {
        card.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        card.style.opacity    = '0';
        card.style.transform  = 'scale(0.94)';
        setTimeout(() => {
          card.remove();
          showToast('Resume deleted.', 'info');
          if (!document.querySelectorAll('.resume-card[data-id]').length) {
            location.reload();
          }
        }, 280);
      }
    } else {
      showToast(data.message || 'Delete failed.', 'error');
      btn.disabled    = false;
      btn.textContent = origText;
    }
  } catch {
    showToast('Network error. Please try again.', 'error');
    btn.disabled    = false;
    btn.textContent = origText;
  }
}

// ── Duplicate resume (client-side only, opens builder) ──
function openResume(id) {
  window.location.href = `/resume/builder/${id}/`;
}

// Expose
window.deleteResume = deleteResume;
window.openResume   = openResume;
