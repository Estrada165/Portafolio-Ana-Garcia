// ============================================================
//  supabase-config.js  —  Configuración central de Supabase
//  Reemplaza SUPABASE_URL y SUPABASE_ANON_KEY con los tuyos
//  Panel: https://app.supabase.com → Settings → API
// ============================================================

const SUPABASE_URL  = 'https://TU_PROYECTO.supabase.co';
const SUPABASE_ANON = 'TU_ANON_KEY_AQUI';

// Credenciales del panel admin (solo se validan en el cliente;
// para producción real usa Supabase Auth)
const ADMIN_USER = 'ana';
const ADMIN_PASS = 'CAMBIA_ESTA_CLAVE';   // ← cámbiala antes de publicar

// ── Cliente Supabase (sin npm, CDN inline) ───────────────────
let _sb = null;
function getSB() {
  if (_sb) return _sb;
  _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  return _sb;
}

// ── Buckets de Storage ───────────────────────────────────────
const BUCKET = {
  mockups      : 'mockups',
  designs      : 'designs',
  logos        : 'logos',
  illustrations: 'illustrations',
  pdfs         : 'pdfs',
  featured     : 'featured',
};

// ── URL pública de un archivo ────────────────────────────────
function publicUrl(bucket, path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

// ── CRUD genérico ────────────────────────────────────────────
const DB = {
  async getAll(table, order = 'created_at') {
    const { data, error } = await getSB()
      .from(table).select('*').order(order);
    if (error) { console.error(table, error); return []; }
    return data;
  },

  async insert(table, row) {
    const { data, error } = await getSB().from(table).insert(row).select();
    if (error) throw error;
    return data[0];
  },

  async update(table, id, changes) {
    const { error } = await getSB().from(table).update(changes).eq('id', id);
    if (error) throw error;
  },

  async remove(table, id) {
    const { error } = await getSB().from(table).delete().eq('id', id);
    if (error) throw error;
  },
};

// ── Storage helpers ──────────────────────────────────────────
const Storage = {
  MAX_IMAGE_MB: 4,    // conservador para respetar límite de 50 MB por bucket
  MAX_PDF_MB  : 8,
  TARGET_PX   : 1400, // lado máximo en px al comprimir
  QUALITY     : 0.82, // calidad JPEG (0-1)

  // Comprime imagen en canvas antes de subir
  async _compress(file) {
    return new Promise((resolve) => {
      // PDFs y SVGs no se comprimen
      if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
        resolve(file); return;
      }
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        const max = Storage.TARGET_PX;
        if (width > max || height > max) {
          if (width > height) { height = Math.round(height * max / width); width = max; }
          else                { width  = Math.round(width  * max / height); height = max; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => {
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
        }, 'image/jpeg', Storage.QUALITY);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  },

  async upload(bucket, file, folder = '') {
    const isPDF  = bucket === BUCKET.pdfs || file.type === 'application/pdf';
    const maxMB  = isPDF ? Storage.MAX_PDF_MB : Storage.MAX_IMAGE_MB;
    const maxBytes = maxMB * 1024 * 1024;

    // Comprimir imagen si aplica
    const toUpload = isPDF ? file : await Storage._compress(file);

    if (toUpload.size > maxBytes)
      throw new Error(`El archivo supera ${maxMB} MB (${(toUpload.size/1024/1024).toFixed(1)} MB). Comprime el archivo antes de subirlo.`);

    const ext  = toUpload.name.split('.').pop().toLowerCase();
    const mime = isPDF ? 'application/pdf' : 'image/jpeg';
    const name = `${folder}${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await getSB().storage
      .from(bucket)
      .upload(name, toUpload, {
        upsert       : false,
        contentType  : mime,
        cacheControl : '3600',
      });

    if (error) {
      // Mensaje de error más legible
      if (error.message?.includes('row-level security') || error.statusCode === '403') {
        throw new Error('Sin permisos de escritura. Verifica las políticas del bucket en Supabase Storage → Policies.');
      }
      throw new Error(error.message || 'Error al subir archivo');
    }
    return publicUrl(bucket, name);
  },

  async remove(bucket, url) {
    const path = url.split(`/${bucket}/`)[1];
    if (!path) return;
    await getSB().storage.from(bucket).remove([path]);
  },
};

// ── Auth simple (localStorage) ───────────────────────────────
const Auth = {
  login(user, pass) {
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      sessionStorage.setItem('ag_admin', '1');
      return true;
    }
    return false;
  },
  logout() { sessionStorage.removeItem('ag_admin'); },
  isLogged() { return sessionStorage.getItem('ag_admin') === '1'; },
};
