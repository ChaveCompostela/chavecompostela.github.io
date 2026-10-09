// Conexión de só lectura a Supabase para a app pública.
// Project Settings → API no teu proxecto de Supabase. Usa SOLO a clave pública (anon/publishable).
const SUPABASE_URL = 'https://tlpkxrwwdosrzqcqwybq.supabase.co/';
const SUPABASE_KEY = 'sb_publishable_C2pLthVQIIFVGAYJP4JPjw_5n1VwXIh';

let sbfe = null, ERR_CONFIG_FE = '';
if (typeof supabase === 'undefined') {
  ERR_CONFIG_FE = 'Non se puido cargar a conexión con Supabase. Comproba a conexión a internet.';
} else if (!/^https?:\/\//.test(SUPABASE_URL) || SUPABASE_KEY.includes('TU-')) {
  ERR_CONFIG_FE = 'Falta configurar js/configfe.js coa clave pública do proxecto de Supabase.';
} else {
  try { sbfe = supabase.createClient(SUPABASE_URL, SUPABASE_KEY); }
  catch (e) { ERR_CONFIG_FE = 'Configuración de Supabase non válida: ' + e.message; }
}

// Clave PÚBLICA VAPID para os avisos push das novas (a privada NUNCA vai aquí: só nos secretos da Edge Function).
// Xérase unha vez con: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY_FE = 'BJwkYmhsNvFZtfG5fT7DO95iyH0AAdefKIe41NLt2th07S8t4dotbziikmvDfjKRSNLFvA3cuYv4jC3sct6sLcc';
