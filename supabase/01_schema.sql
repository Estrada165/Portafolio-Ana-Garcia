-- ============================================================
--  Portfolio Ana Lucía García — Esquema v2
--  Ejecutar en Supabase → SQL Editor (todo de una vez).
--  Es seguro volver a ejecutarlo: usa IF NOT EXISTS / OR REPLACE.
-- ============================================================

-- ── 1. ADMINISTRADORES ──────────────────────────────────────
-- Solo quien esté en esta tabla puede escribir. Así, aunque
-- alguien lograra registrarse, no podría modificar nada.
CREATE TABLE IF NOT EXISTS admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email   text,
  created_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid());
$$;

-- ── 2. TRABAJOS (mockups, diseños, logos, ilustraciones, destacados) ──
CREATE TABLE IF NOT EXISTS works (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text NOT NULL CHECK (kind IN ('mockup','design','logo','illustration','featured')),
  title       text NOT NULL DEFAULT '',
  description text,
  category    text,
  image_url   text NOT NULL,           -- imagen principal (WebP optimizada)
  thumb_url   text,                    -- miniatura para grillas
  width       int,
  height      int,
  sort_order  int  NOT NULL DEFAULT 0, -- orden manual (menor = primero)
  visible     boolean NOT NULL DEFAULT true,
  legacy_id   bigint,                  -- id en las tablas antiguas (migración)
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS works_kind_order_idx ON works (kind, sort_order, created_at DESC);

-- Variaciones de un logo (versión blanca, negra, etc.)
CREATE TABLE IF NOT EXISTS work_assets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id    uuid NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  label      text NOT NULL DEFAULT '',
  image_url  text NOT NULL,
  sort_order int  NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS work_assets_work_idx ON work_assets (work_id, sort_order);

-- ── 3. GUÍAS PDF (se guardan como páginas WebP, no como PDF pesado) ──
CREATE TABLE IF NOT EXISTS pdf_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL,
  title       text NOT NULL,
  client      text,
  year        int,
  description text,
  orientation text CHECK (orientation IN ('portrait','landscape','square')),
  page_count  int  NOT NULL DEFAULT 0,
  cover_url   text,                    -- portada = miniatura de la pág. 1
  source_url  text,                    -- PDF original (solo guías antiguas)
  sort_order  int  NOT NULL DEFAULT 0,
  visible     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pdf_pages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES pdf_documents(id) ON DELETE CASCADE,
  page_number int  NOT NULL,
  image_url   text NOT NULL,
  thumb_url   text,
  width       int,
  height      int,
  UNIQUE (document_id, page_number)
);

-- ── 4. AJUSTES DEL SITIO (tema, tipografía, textos, secciones) ──
CREATE TABLE IF NOT EXISTS site_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Valores iniciales = los colores y fuentes actuales del sitio
INSERT INTO site_settings (key, value) VALUES
('theme', '{
  "colors": {
    "accent":"#7C3AED", "accentLight":"#A78BFA",
    "bg":"#FAF9F7", "bgCard":"#FFFFFF", "bgSoft":"#F3F0EB",
    "text":"#1E1B18", "text2":"#6B6560",
    "dark": { "bg":"#1C1A17", "bgCard":"#252320", "bgSoft":"#2C2924", "text":"#EDE9E3", "text2":"#A09890" }
  },
  "fonts": { "display":"Playfair Display", "body":"Inter" },
  "radius": "soft",
  "sections": {}
}'::jsonb),
('sections', '[
  {"id":"destacados","label":"Destacados","visible":true},
  {"id":"mockups","label":"Mockups","visible":true},
  {"id":"disenos","label":"Diseños","visible":true},
  {"id":"logos","label":"Logos","visible":true},
  {"id":"ilustraciones","label":"Ilustraciones","visible":true},
  {"id":"guias","label":"Guías PDF","visible":true}
]'::jsonb),
('contact', '{"whatsapp":"51977575523","email":"","instagram":""}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ── 5. SEGURIDAD (RLS): lectura pública, escritura solo admin ──
ALTER TABLE admins         ENABLE ROW LEVEL SECURITY;
ALTER TABLE works          ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_assets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_pages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_self"        ON admins;
DROP POLICY IF EXISTS "works_read"         ON works;
DROP POLICY IF EXISTS "works_write"        ON works;
DROP POLICY IF EXISTS "assets_read"        ON work_assets;
DROP POLICY IF EXISTS "assets_write"       ON work_assets;
DROP POLICY IF EXISTS "pdfdocs_read"       ON pdf_documents;
DROP POLICY IF EXISTS "pdfdocs_write"      ON pdf_documents;
DROP POLICY IF EXISTS "pdfpages_read"      ON pdf_pages;
DROP POLICY IF EXISTS "pdfpages_write"     ON pdf_pages;
DROP POLICY IF EXISTS "settings_read"      ON site_settings;
DROP POLICY IF EXISTS "settings_write"     ON site_settings;

CREATE POLICY "admins_self"    ON admins FOR SELECT USING (user_id = auth.uid());

-- El público solo ve lo marcado como visible; el admin ve todo
CREATE POLICY "works_read"     ON works          FOR SELECT USING (visible OR is_admin());
CREATE POLICY "works_write"    ON works          FOR ALL    USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "assets_read"    ON work_assets    FOR SELECT USING (true);
CREATE POLICY "assets_write"   ON work_assets    FOR ALL    USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "pdfdocs_read"   ON pdf_documents  FOR SELECT USING (visible OR is_admin());
CREATE POLICY "pdfdocs_write"  ON pdf_documents  FOR ALL    USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "pdfpages_read"  ON pdf_pages      FOR SELECT USING (true);
CREATE POLICY "pdfpages_write" ON pdf_pages      FOR ALL    USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "settings_read"  ON site_settings  FOR SELECT USING (true);
CREATE POLICY "settings_write" ON site_settings  FOR ALL    USING (is_admin()) WITH CHECK (is_admin());

-- ── 6. STORAGE: un solo bucket público "media" ──────────────
-- Carpetas: works/<kind>/..., pdf/<slug>/...
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('media', 'media', true, 10485760,
        ARRAY['image/webp','image/jpeg','image/png','image/svg+xml'])
ON CONFLICT (id) DO UPDATE
  SET public = true, file_size_limit = 10485760,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "media_read"   ON storage.objects;
DROP POLICY IF EXISTS "media_insert" ON storage.objects;
DROP POLICY IF EXISTS "media_update" ON storage.objects;
DROP POLICY IF EXISTS "media_delete" ON storage.objects;

CREATE POLICY "media_read"   ON storage.objects FOR SELECT USING (bucket_id = 'media');
CREATE POLICY "media_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media' AND is_admin());
CREATE POLICY "media_update" ON storage.objects FOR UPDATE USING (bucket_id = 'media' AND is_admin());
CREATE POLICY "media_delete" ON storage.objects FOR DELETE USING (bucket_id = 'media' AND is_admin());

-- ============================================================
--  PASO MANUAL (una sola vez):
--  1) Authentication → Users → "Add user" → correo y contraseña de Ana.
--  2) Authentication → Sign In / Providers → desactiva "Allow new users to sign up".
--  3) Ejecuta esto con el correo real:
--
--     INSERT INTO admins (user_id, email)
--     SELECT id, email FROM auth.users WHERE email = 'CORREO_DE_ANA@gmail.com';
-- ============================================================
