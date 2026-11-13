-- ============================================================
--  Etiquetas para "Destacados" (opcional, se ejecuta una vez).
--  Sin esto todo funciona igual; solo no se podrán editar etiquetas.
-- ============================================================
ALTER TABLE works ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
