/* ==========================================================================
   App bootstrap: auth gate, route registration, realtime wiring.
   ========================================================================== */

(function initApp() {
  const appRoot = qs('#app-root');
  const loginScreen = qs('#login-screen');
  const appShell = qs('#app-shell');
  const configError = qs('#config-error');

  function mount(renderFn, params = {}) {
    Charts.destroyAll();
    appRoot.scrollTop = 0;
    renderFn(appRoot, params);
  }

  Router.register('/dashboard', () => mount(renderDashboard));
  Router.register('/contacts', () => mount(renderContacts));
  Router.register('/contacts/:id', params => mount(renderContactDetail, params));
  Router.register('/companies', () => mount(renderCompanies));
  Router.register('/companies/:id', params => mount(renderCompanyDetail, params));
  Router.register('/pipeline', () => mount(renderPipeline));
  Router.register('/projects', () => mount(renderProjectTracking));
  Router.register('/calendar', () => mount(renderProjectCalendar));
  Router.register('/leads/:id', params => mount(renderLeadDetail, params));

  const navToggle = qs('#nav-toggle');
  const sidebar = qs('.sidebar');
  if (navToggle) navToggle.addEventListener('click', () => sidebar.classList.toggle('is-open'));
  qsa('.nav-link').forEach(link => link.addEventListener('click', () => sidebar?.classList.remove('is-open')));

  const yearEl = qs('#footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const signOutBtn = qs('#sign-out-btn');
  if (signOutBtn) signOutBtn.addEventListener('click', async () => {
    await Auth.signOut();
    window.location.reload();
  });

  let started = false;

  async function enterApp() {
    loginScreen.hidden = true;
    appShell.hidden = false;
    if (!started) {
      try {
        await loadAllData();
      } catch (e) {
        console.error(e);
        appRoot.innerHTML = `<div class="empty-state"><p><strong>Couldn't load data.</strong></p><p class="muted">${esc(e.message || e)}</p></div>`;
        return;
      }
      subscribeRealtime();
      onDataChange(() => Router.rerender());
      Router.start();
      started = true;
    } else {
      Router.rerender();
    }
  }

  function showLogin(message) {
    appShell.hidden = true;
    loginScreen.hidden = false;
    const err = qs('#login-error');
    if (message) { err.textContent = message; err.hidden = false; } else { err.hidden = true; }
  }

  async function boot() {
    if (!supabaseClient) {
      configError.hidden = false;
      loginScreen.hidden = true;
      appShell.hidden = true;
      return;
    }
    const session = await Auth.getSession();
    if (session) {
      await enterApp();
    } else {
      showLogin();
    }
    Auth.onChange(session => {
      if (!session) showLogin();
    });
  }

  const loginForm = qs('#login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(loginForm);
      const submitBtn = qs('button[type="submit"]', loginForm);
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in…';
      try {
        await Auth.signIn(fd.get('email'), fd.get('password'));
        await enterApp();
      } catch (err) {
        showLogin(err.message || 'Sign-in failed. Check your email and password.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign in';
      }
    });
  }

  boot();
})();
