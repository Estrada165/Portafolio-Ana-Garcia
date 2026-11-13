// ============================================================
//  config.js — conexión pública a Supabase
//  Supabase → Settings → API:  "Project URL" y "anon public key".
//  Ambos valores SON públicos por diseño (van en el navegador);
//  la seguridad la dan las políticas RLS del esquema v2.
//  NUNCA pegues aquí la "service_role key".
// ============================================================
window.PORTFOLIO_CONFIG = {
  SUPABASE_URL : 'https://TU_PROYECTO.supabase.co',
  SUPABASE_ANON: 'TU_ANON_KEY_AQUI',
  BUCKET       : 'media',
};
