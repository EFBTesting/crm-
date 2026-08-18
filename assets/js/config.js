/* ==========================================================================
   Supabase connection config.
   The anon/public key is safe to ship in client-side code by design —
   Supabase enforces access with Row Level Security policies on the
   database side, not by keeping this key secret. Never put the
   "service_role" key here.
   ========================================================================== */

const SUPABASE_URL = 'https://onyzrarsonxkubnmutjb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uM5D1G-YyKd1ZlN04sxMsQ_DCmsgOU1';

const supabaseClient = (SUPABASE_URL.startsWith('http'))
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
