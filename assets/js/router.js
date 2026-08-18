/* ==========================================================================
   Tiny hash router. Routes are registered as patterns like:
     '#/dashboard', '#/contacts', '#/contacts/:id'
   Works reliably on GitHub Pages (and file://) with zero server config.
   ========================================================================== */

const Router = (() => {
  const routes = [];

  function register(pattern, handler) {
    const paramNames = [];
    const regex = new RegExp(
      '^' +
        pattern
          .replace(/\/:([A-Za-z0-9_]+)/g, (_, name) => {
            paramNames.push(name);
            return '/([^/]+)';
          })
          .replace(/\//g, '\\/') +
        '$'
    );
    routes.push({ regex, paramNames, handler });
  }

  function currentPath() {
    const hash = window.location.hash || '#/dashboard';
    return hash.slice(1) || '/dashboard';
  }

  function resolve() {
    const path = currentPath();
    for (const r of routes) {
      const m = path.match(r.regex);
      if (m) {
        const params = {};
        r.paramNames.forEach((name, i) => (params[name] = decodeURIComponent(m[i + 1])));
        r.handler(params);
        setActiveNav(path);
        return;
      }
    }
    // fallback
    navigate('/dashboard');
  }

  function setActiveNav(path) {
    const section = '/' + path.split('/')[1];
    qsa('.nav-link').forEach(a => {
      a.classList.toggle('is-active', a.getAttribute('data-section') === section);
    });
  }

  function navigate(path) {
    window.location.hash = `#${path}`;
  }

  function start() {
    window.addEventListener('hashchange', resolve);
    resolve();
  }

  /** Re-run whichever route is currently active — used to redraw the
   *  screen after a remote (realtime) data change. */
  function rerender() {
    resolve();
  }

  return { register, navigate, start, rerender };
})();
