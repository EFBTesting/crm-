/* ==========================================================================
   App bootstrap: nav wiring + route registration.
   ========================================================================== */

(function initApp() {
  const appRoot = qs('#app-root');

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
  Router.register('/leads/:id', params => mount(renderLeadDetail, params));

  // Mobile nav toggle
  const navToggle = qs('#nav-toggle');
  const sidebar = qs('.sidebar');
  if (navToggle) {
    navToggle.addEventListener('click', () => sidebar.classList.toggle('is-open'));
  }
  qsa('.nav-link').forEach(link => {
    link.addEventListener('click', () => sidebar?.classList.remove('is-open'));
  });

  // Footer clock / brand year
  const yearEl = qs('#footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  Router.start();
})();
