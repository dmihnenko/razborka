// Поиск по OEM/артикулу без учёта разделителей, регистра и похожих кириллических букв.
// Правило должно совпадать с generated column parts_inventory.part_number_norm
// (database/migrations/2026-11-04_a_part_number_norm.sql).

const CYR = 'АВЕКМНОРСТХ'
const LAT = 'ABEKMHOPCTX'

/** «1k0 615-301 аа» → «1K0615301AA» (кириллица-двойники → латиница, без разделителей). */
export function normalizePartNumber(raw: string): string {
  return (raw || '')
    .toUpperCase()
    .replace(/[АВЕКМНОРСТХ]/g, (ch) => LAT[CYR.indexOf(ch)])
    .replace(/[^\p{L}\p{N}]/gu, '')
}

/** Нормализованная форма пригодна для поиска по part_number_norm: есть цифра и ≥ 4 символов. */
export function oemSearchTerm(raw: string): string | null {
  const n = normalizePartNumber(raw)
  return n.length >= 4 && /\d/.test(n) ? n : null
}

/** Дополнительное условие для PostgREST or(): пусто, если запрос не похож на OEM.
 *  Нормализованная строка содержит только буквы/цифры — для or() безопасна. */
export function oemOrClause(raw: string): string {
  const n = oemSearchTerm(raw)
  return n ? `,part_number_norm.ilike.%${n}%` : ''
}
