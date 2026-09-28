// Project Settings → API en Supabase. Usa SOLO la clave pública (anon/publishable), NUNCA la service_role.
const SUPABASE_URL = 'https://tlpkxrwwdosrzqcqwybq.supabase.co/';
const SUPABASE_KEY = 'sb_publishable_C2pLthVQIIFVGAYJP4JPjw_5n1VwXIh';

let sb = null, ERR_CONFIG = '';
if (typeof supabase === 'undefined') {
  ERR_CONFIG = 'No se pudo cargar la librería de Supabase. Revisa la conexión a internet.';
} else if (!/^https?:\/\//.test(SUPABASE_URL) || SUPABASE_URL.includes('TU-') || SUPABASE_KEY.includes('TU-')) {
  ERR_CONFIG = 'Falta configurar js/config.js con la URL y la clave pública de tu proyecto de Supabase.';
} else {
  try { sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY); }
  catch (e) { ERR_CONFIG = 'Configuración de Supabase no válida: ' + e.message; }
}
