// SEO-slug для марок/моделей в URL каталога (/market/catalog/tesla/model-3).
// ВАЖНО: алгоритм должен в точности совпадать с slugify в worker/index.js —
// иначе ссылки и резолв slug→название разойдутся.
export const slugify = (s: string): string =>
  String(s ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яёіїєґ]+/gi, '-')
    .replace(/^-+|-+$/g, '')
