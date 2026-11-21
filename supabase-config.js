// Supabase connection (public client-side values only).
// The publishable key is safe to expose; data access is controlled by RLS policies.
// Never put the service_role / secret key in this file.
const SUPABASE_URL = 'https://nhiibjhssbmsqajrslvr.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_hqarcz4Mo4CuoD4B95xXDg_80gjAW9S';

window.supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;
