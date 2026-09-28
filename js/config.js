// Project Settings → API en Supabase. Usa SOLO la clave pública (anon/publishable), NUNCA la service_role.
const SUPABASE_URL = 'https://tlpkxrwwdosrzqcqwybq.supabase.co/';
const SUPABASE_ANON_KEY = 'sb_publishable_C2pLthVQIIFVGAYJP4JPjw_5n1VwXIh';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
