/* ==========================================================================
   Auth — a single shared team login. Supabase persists the session in
   localStorage itself, so staying signed in across reloads/restarts is
   automatic; this file just wires the login form and sign-out button.
   ========================================================================== */

const Auth = {
  async getSession() {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) { console.error(error); return null; }
    return data.session;
  },
  async signIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session;
  },
  async signOut() {
    await supabaseClient.auth.signOut();
  },
  onChange(fn) {
    supabaseClient.auth.onAuthStateChange((_event, session) => fn(session));
  },
};
