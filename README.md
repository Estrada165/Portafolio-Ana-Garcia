# Portfolio Ana García — Guía de Configuración
## Paso a paso, sin conocimientos técnicos avanzados

---

## 📁 Archivos del proyecto

```
portfolio-ana/
├── index.html          ← Portafolio público (lo que ven todos)
├── admin.html          ← Panel de administración (solo tú)
├── style.css           ← Estilos del portafolio
├── main.js             ← Lógica del portafolio
├── supabase-config.js  ← ⚠️ Aquí pones tus claves de Supabase
└── imagenes/           ← Imágenes locales existentes
```

---

## 1️⃣ Crear cuenta en Supabase (gratis)

1. Ve a **https://app.supabase.com**
2. Haz clic en **"Start your project"**
3. Regístrate con tu cuenta de Google o email
4. Haz clic en **"New Project"**
5. Pon el nombre: `ana-garcia-portfolio`
6. Elige una contraseña para la base de datos (guárdala)
7. Región: **South America (São Paulo)** — la más cercana a Perú
8. Haz clic en **"Create new project"** y espera ~2 minutos

---

## 2️⃣ Obtener tus claves API

1. En el panel de Supabase, ve a **Settings** (ícono de engranaje) → **API**
2. Copia estos dos valores:
   - **Project URL**: algo como `https://abcdefgh.supabase.co`
   - **anon public key**: una cadena muy larga de letras y números

3. Abre el archivo `supabase-config.js` con el Bloc de Notas
4. Reemplaza las líneas:
   ```js
   const SUPABASE_URL  = 'https://TU_PROYECTO.supabase.co';
   const SUPABASE_ANON = 'TU_ANON_KEY_AQUI';
   ```
   Con tus valores reales. Por ejemplo:
   ```js
   const SUPABASE_URL  = 'https://abcdefgh.supabase.co';
   const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIs...';
   ```

5. También cambia la contraseña del admin:
   ```js
   const ADMIN_USER = 'ana';         // ← tu usuario
   const ADMIN_PASS = 'tuClave123';  // ← cambia esto
   ```

---

## 3️⃣ Crear las tablas en Supabase

1. En Supabase, ve a **SQL Editor** (ícono de terminal)
2. Copia y pega TODO el siguiente código y haz clic en **Run**:

```sql
-- Tabla: mockups
CREATE TABLE mockups (
  id         BIGSERIAL PRIMARY KEY,
  image_url  TEXT NOT NULL,
  title      TEXT DEFAULT 'Mockup',
  category   TEXT DEFAULT 'Presentación de Marca',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: designs
CREATE TABLE designs (
  id         BIGSERIAL PRIMARY KEY,
  image_url  TEXT NOT NULL,
  title      TEXT DEFAULT 'Diseño',
  category   TEXT DEFAULT 'Proyecto Único',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: logos
CREATE TABLE logos (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  main_image  TEXT NOT NULL,
  variations  JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: illustrations
CREATE TABLE illustrations (
  id         BIGSERIAL PRIMARY KEY,
  image_url  TEXT NOT NULL,
  title      TEXT DEFAULT 'Ilustración',
  category   TEXT DEFAULT 'Arte Digital',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: featured
CREATE TABLE featured (
  id         BIGSERIAL PRIMARY KEY,
  image_url  TEXT NOT NULL,
  title      TEXT DEFAULT 'Proyecto Destacado',
  category   TEXT DEFAULT 'Portfolio',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: pdfs
CREATE TABLE pdfs (
  id          BIGSERIAL PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  client      TEXT,
  year        INT,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Permisos públicos de lectura (para que el portafolio muestre el contenido)
ALTER TABLE mockups       ENABLE ROW LEVEL SECURITY;
ALTER TABLE designs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE logos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE illustrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE featured      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdfs          ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública" ON mockups       FOR SELECT USING (true);
CREATE POLICY "Lectura pública" ON designs       FOR SELECT USING (true);
CREATE POLICY "Lectura pública" ON logos         FOR SELECT USING (true);
CREATE POLICY "Lectura pública" ON illustrations FOR SELECT USING (true);
CREATE POLICY "Lectura pública" ON featured      FOR SELECT USING (true);
CREATE POLICY "Lectura pública" ON pdfs          FOR SELECT USING (true);

CREATE POLICY "Escritura anon" ON mockups       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Escritura anon" ON designs       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Escritura anon" ON logos         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Escritura anon" ON illustrations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Escritura anon" ON featured      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Escritura anon" ON pdfs          FOR ALL USING (true) WITH CHECK (true);
```

---

## 4️⃣ Crear los buckets y sus políticas de almacenamiento

Los buckets ya los creaste. El problema es que **necesitan políticas de escritura** para que el admin pueda subir archivos.

### Paso 4a — Crear los buckets (si no los creaste aún)

1. En Supabase → **Storage** → **"New bucket"**
2. Crear estos 6 buckets, marcando ✅ **Public** en cada uno:
   `mockups`, `designs`, `logos`, `illustrations`, `featured`, `pdfs`

### Paso 4b — Agregar políticas de escritura (OBLIGATORIO)

Esto es lo que falta. Sin este paso el admin no puede subir archivos.

1. Ve a **Storage → Policies** (en el menú de la izquierda)
2. Haz clic en **"New policy"** del bucket **mockups**
3. Selecciona **"For full customization"**
4. Pon estos valores:
   - Policy name: `Allow anon uploads`
   - Allowed operation: marcar **INSERT, SELECT, UPDATE, DELETE**
   - Target roles: **anon**
   - USING expression: `true`
   - WITH CHECK expression: `true`
5. Guarda y **repite para los 5 buckets restantes** (designs, logos, illustrations, featured, pdfs)

**Alternativa más rápida — SQL Editor:**

Ve a **SQL Editor** y ejecuta esto (una sola vez para todos los buckets):

```sql
-- Políticas de Storage (leer y escribir para todos)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('mockups',       'mockups',       true),
  ('designs',       'designs',       true),
  ('logos',         'logos',         true),
  ('illustrations', 'illustrations', true),
  ('featured',      'featured',      true),
  ('pdfs',          'pdfs',          true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Política: cualquiera puede leer
CREATE POLICY "Lectura pública storage" ON storage.objects
  FOR SELECT USING ( bucket_id IN ('mockups','designs','logos','illustrations','featured','pdfs') );

-- Política: cualquiera puede subir (admin usa clave anon)
CREATE POLICY "Subida pública storage" ON storage.objects
  FOR INSERT WITH CHECK ( bucket_id IN ('mockups','designs','logos','illustrations','featured','pdfs') );

-- Política: cualquiera puede eliminar
CREATE POLICY "Eliminar storage" ON storage.objects
  FOR DELETE USING ( bucket_id IN ('mockups','designs','logos','illustrations','featured','pdfs') );
```

> Si ves el error "policy already exists", ignóralo — significa que ya estaba creada.

---

## 5️⃣ Publicar el portafolio en Netlify (gratis)

1. Ve a **https://netlify.com** y crea una cuenta gratis
2. Haz clic en **"Add new site"** → **"Deploy manually"**
3. Arrastra toda la carpeta `portfolio-ana` al área indicada
4. Netlify te dará una URL como: `https://ana-garcia-portfolio.netlify.app`
5. ¡Listo! Ese es tu portafolio público

Para actualizar el portafolio en el futuro:
- Desde el panel de Netlify → **Deploys** → arrastra la carpeta de nuevo

---

## 6️⃣ Cómo usar el panel admin

1. Ve a tu URL + `/admin.html`
   Por ejemplo: `https://ana-garcia-portfolio.netlify.app/admin.html`
2. Ingresa con tu usuario y contraseña (los que configuraste en `supabase-config.js`)
3. Desde ahí puedes:
   - Subir mockups, diseños, logos con variaciones, ilustraciones, destacados y PDFs
   - Ver y eliminar cualquier contenido
   - El portafolio público se actualiza automáticamente

---

## 📐 Límites de archivos y espacio

Supabase Free tiene **50 MB por bucket** y **500 MB total**. Para aprovechar bien ese espacio, **el admin comprime automáticamente tus imágenes** antes de subirlas (las redimensiona a máx. 1400px y las convierte a JPEG).

| Tipo | Formato de subida | Peso máximo | Peso real subido |
|------|-------------------|-------------|-----------------|
| Imágenes | JPG, PNG, WEBP | 4 MB | ~100–400 KB (comprimido automático) |
| PDFs | PDF | 8 MB | igual (no se comprime) |

**Para comprimir PDFs gratis:** https://www.ilovepdf.com/compress_pdf

**Si quieres comprimir imágenes antes de subir** (opcional, ya lo hace el admin automáticamente):
- https://squoosh.app — recomendado
- https://tinypng.com — muy fácil

---

## 🧹 Limpiar registros sin imagen (si subiste algo que falló)

Si en el portafolio aparece un item que muestra el overlay en lugar de imagen, o si en el admin ves el aviso rojo "registro sin imagen", ejecuta esto en el **SQL Editor** de Supabase:

```sql
-- Eliminar registros sin URL de imagen (subidas incompletas)
DELETE FROM mockups       WHERE image_url IS NULL OR image_url = '';
DELETE FROM designs       WHERE image_url IS NULL OR image_url = '';
DELETE FROM illustrations WHERE image_url IS NULL OR image_url = '';
DELETE FROM featured      WHERE image_url IS NULL OR image_url = '';
```

También puedes hacerlo desde el admin → sección correspondiente → botón **"Limpiar"** que aparece en rojo si hay registros corruptos.

---

## 🎨 Cambiar colores

El color principal es el **púrpura** (`#7C3AED`). Para cambiarlo:
1. Abre `style.css`
2. Busca `--accent: #7C3AED`
3. Cambia el valor por el color que prefieras
4. El cambio se aplica en todo el portafolio automáticamente

---

## ❓ Problemas frecuentes

**Las imágenes no cargan después de subirlas:**
→ Verifica que los buckets estén marcados como **Public** en Supabase Storage

**El panel admin dice "Error al guardar":**
→ Revisa que las claves en `supabase-config.js` estén correctas (sin espacios extra)

**El portafolio no muestra el nuevo contenido:**
→ Espera unos segundos y recarga la página (Ctrl + F5)

**El PDF pesa más de 10 MB:**
→ Comprímelo en https://www.ilovepdf.com/compress_pdf y vuelve a intentarlo
