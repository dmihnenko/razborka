// SEO-slug для марок/моделей в URL каталога (/market/catalog/tesla/model-3).
// ВАЖНО: алгоритм должен в точности совпадать с slugify в worker/index.js —
// иначе ссылки и резолв slug→название разойдутся.
export const slugify = (s: string): string =>
  String(s ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яёіїєґ]+/gi, '-')
    .replace(/^-+|-+$/g, '')

/**
 * Находит запись по slug; при коллизии slug (напр. «Model 3» и «Model-3») предпочитает
 * запись с count > 0 — как резолв в worker/index.js.
 */
export function findBySlug<T extends { count?: number }>(items: readonly T[], getName: (x: T) => string, slug: string): T | undefined {
  const matches = items.filter((x) => slugify(getName(x)) === slug)
  return matches.find((x) => (x.count || 0) > 0) ?? matches[0]
}
