// ─── Единый формат денег (₴, ru-RU) ───────────────────────────────────────────

/** Полный формат: ₴1 234 */
export function fmtMoney(n: number | null | undefined): string {
  return `₴${(n || 0).toLocaleString('ru-RU')}`
}

/** Компактный формат для тесных мест: ₴1,2к / ₴3,4М */
export function fmtMoneyShort(n: number | null | undefined): string {
  const v = n || 0
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `₴${(v / 1_000_000).toFixed(1).replace('.', ',')}М`
  if (abs >= 1_000)     return `₴${(v / 1_000).toFixed(1).replace('.', ',')}к`
  return `₴${v.toLocaleString('ru-RU')}`
}
