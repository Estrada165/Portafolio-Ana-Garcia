// ============================================================
//  config.js — conexión pública a Supabase
//  Supabase → Settings → API:  "Project URL" y "anon public key".
//  Ambos valores SON públicos por diseño (van en el navegador);
//  la seguridad la dan las políticas RLS del esquema v2.
//  NUNCA pegues aquí la "service_role key".
// ============================================================
window.PORTFOLIO_CONFIG = {
  SUPABASE_URL : 'https://gxpcujfjvlqecpnipkly.supabase.co',
  SUPABASE_ANON: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4cGN1amZqdmxxZWNwbmlwa2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyODI5NjgsImV4cCI6MjA5Mzg1ODk2OH0.ZLMLvu5aMdCvF8odqF3FwAdxSc4sjJkSPi-IsuTBTms',
  BUCKET       : 'media',
};
