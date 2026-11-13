-- ============================================================
--  Migración de las tablas antiguas (mockups, designs, logos,
--  illustrations, featured, pdfs) al esquema v2.
--  Ejecutar DESPUÉS de 01_schema.sql. No borra las tablas viejas.
--  Las URLs de imágenes ya subidas siguen funcionando tal cual.
-- ============================================================

DO $$
BEGIN
  -- Evita duplicar si se ejecuta dos veces
  IF EXISTS (SELECT 1 FROM works WHERE legacy_id IS NOT NULL) THEN
    RAISE NOTICE 'Ya migrado; no se hace nada.';
    RETURN;
  END IF;

  IF to_regclass('public.mockups') IS NOT NULL THEN
    INSERT INTO works (kind, title, category, image_url, legacy_id, created_at, sort_order)
    SELECT 'mockup', COALESCE(title,''), category, image_url, id, created_at,
           (row_number() OVER (ORDER BY created_at))::int FROM mockups;
  END IF;

  IF to_regclass('public.designs') IS NOT NULL THEN
    INSERT INTO works (kind, title, category, image_url, legacy_id, created_at, sort_order)
    SELECT 'design', COALESCE(title,''), category, image_url, id, created_at,
           (row_number() OVER (ORDER BY created_at))::int FROM designs;
  END IF;

  IF to_regclass('public.illustrations') IS NOT NULL THEN
    INSERT INTO works (kind, title, category, image_url, legacy_id, created_at, sort_order)
    SELECT 'illustration', COALESCE(title,''), category, image_url, id, created_at,
           (row_number() OVER (ORDER BY created_at))::int FROM illustrations;
  END IF;

  IF to_regclass('public.featured') IS NOT NULL THEN
    INSERT INTO works (kind, title, category, image_url, legacy_id, created_at, sort_order)
    SELECT 'featured', COALESCE(title,''), category, image_url, id, created_at,
           (row_number() OVER (ORDER BY created_at))::int FROM featured;
  END IF;

  -- Logos + sus variaciones (variations era JSONB: [{name, image}, ...])
  IF to_regclass('public.logos') IS NOT NULL THEN
    INSERT INTO works (kind, title, description, image_url, legacy_id, created_at, sort_order)
    SELECT 'logo', name, description, main_image, id, created_at,
           (row_number() OVER (ORDER BY created_at))::int FROM logos;

    INSERT INTO work_assets (work_id, label, image_url, sort_order)
    SELECT w.id,
           COALESCE(v.elem->>'name', v.elem->>'label', v.elem->>'title', ''),
           COALESCE(v.elem->>'image', v.elem->>'url', v.elem->>'image_url', v.elem->>'src'),
           (v.ord - 1)::int
    FROM logos l
    JOIN works w ON w.kind = 'logo' AND w.legacy_id = l.id
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(l.variations, '[]'::jsonb))
         WITH ORDINALITY AS v(elem, ord)
    WHERE COALESCE(v.elem->>'image', v.elem->>'url', v.elem->>'image_url', v.elem->>'src') IS NOT NULL;
  END IF;

  -- PDFs antiguos: quedan con su archivo original (source_url) y 0 páginas.
  -- Para convertirlos a páginas optimizadas, súbelos de nuevo desde el panel.
  IF to_regclass('public.pdfs') IS NOT NULL THEN
    INSERT INTO pdf_documents (slug, title, client, year, description, source_url, created_at)
    SELECT slug, name, client, year, description, url, created_at FROM pdfs
    ON CONFLICT (slug) DO NOTHING;
  END IF;
END $$;

-- Comprobación rápida
SELECT kind, count(*) FROM works GROUP BY kind ORDER BY kind;
SELECT count(*) AS variaciones_logo FROM work_assets;
SELECT count(*) AS pdfs FROM pdf_documents;
