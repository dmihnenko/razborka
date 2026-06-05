// ─── Конфигурация тарифов подписки (срок + цена) ──────────────────────────────
// Один платный тариф на тип (СТО / Разборка), покупается на 1/3/6/12 месяцев.
// Цена информативная (оплата офлайн через админа); админ может менять цену плана.

export type CompanyType = 'sto' | 'parts'

// Базовая месячная цена по типу (₴)
export const BASE_MONTHLY_PRICE: Record<CompanyType, number> = {
  sto: 499,
  parts: 399,
}

// Доступные сроки и скидка за длительность
export const DURATIONS: { months: number; discount: number; label: string }[] = [
  { months: 1,  discount: 0,    label: '1 месяц'   },
  { months: 3,  discount: 0.05, label: '3 месяца'  },
  { months: 6,  discount: 0.10, label: '6 месяцев' },
  { months: 12, discount: 0.15, label: '12 месяцев' },
]

// Бессрочная цена (для админ-вью; владельцу не предлагается)
export const LIFETIME_PRICE: Record<CompanyType, number> = {
  sto: 9999,
  parts: 7999,
}

/** Итоговая цена за выбранный срок с учётом скидки (округление до 10 ₴) */
export function durationPrice(type: CompanyType, months: number): number {
  const d = DURATIONS.find(x => x.months === months) ?? DURATIONS[0]
  const raw = BASE_MONTHLY_PRICE[type] * months * (1 - d.discount)
  return Math.round(raw / 10) * 10
}

/** Эквивалент ₴/мес для выбранного срока (для подписи «выгоднее») */
export function pricePerMonth(type: CompanyType, months: number): number {
  return Math.round(durationPrice(type, months) / months)
}

export function durationLabel(months: number): string {
  return DURATIONS.find(x => x.months === months)?.label ?? `${months} мес`
}

export function discountPct(months: number): number {
  return Math.round((DURATIONS.find(x => x.months === months)?.discount ?? 0) * 100)
}

export function fmtPrice(n: number): string {
  return `₴${n.toLocaleString('ru-RU')}`
}
