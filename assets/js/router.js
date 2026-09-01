/* ==========================================================================
   Tiny hash router. Routes are registered as patterns like:
     '#/dashboard', '#/contacts', '#/contacts/:id'
   Works reliably on GitHub Pages (and file://) with zero server config.
   ========================================================================== */

const Router = (() => {
  const routes = [];
  // Tracks resolved paths in order, so `back()` can return to wherever the
  // user actually came from (e.g. a filtered Pipeline tab, Project
  // Tracking, a Contact/Company's own page) instead of a hardcoded
  // destination — used after deleting something from a detail page, since
  // there's nothing left there to stay on.
  const pathHistory = [];

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
        if (pathHistory[pathHistory.length - 1] !== path) pathHistory.push(path);
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

  /** Returns to whatever path was resolved right before the current one
   *  (the page the user actually came from), or `fallback` if there isn't
   *  one (e.g. this detail page was the first thing loaded this session). */
  function back(fallback) {
    const prev = pathHistory[pathHistory.length - 2];
    navigate(prev || fallback || '/dashboard');
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

  return { register, navigate, back, start, rerender };
})();
