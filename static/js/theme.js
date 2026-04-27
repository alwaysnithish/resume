/* QuantumCV — Theme Manager v2 */
window.QTheme = (() => {
  const KEY  = 'qcv-theme';
  const MQ   = window.matchMedia('(prefers-color-scheme: dark)');

  function systemTheme() {
    return MQ.matches ? 'dark' : 'light';
  }

  function get() {
    return localStorage.getItem(KEY) || systemTheme();
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);

    // Sync all light/dark icon toggles
    document.querySelectorAll('.theme-icon-light').forEach(el => {
      el.style.display = theme === 'dark' ? 'none' : '';
    });
    document.querySelectorAll('.theme-icon-dark').forEach(el => {
      el.style.display = theme === 'dark' ? '' : 'none';
    });

    // Update meta theme-color for mobile browsers
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0c0f1a' : '#ffffff');
  }

  function toggle() {
    apply(get() === 'dark' ? 'light' : 'dark');
  }

  // Apply before first paint to prevent flash of wrong theme
  apply(get());

  // Follow system preference if user hasn't explicitly chosen
  MQ.addEventListener('change', e => {
    if (!localStorage.getItem(KEY)) apply(e.matches ? 'dark' : 'light');
  });

  return { get, apply, toggle };
})();
