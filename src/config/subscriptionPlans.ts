// ─── Конфигурация тарифов подписки (срок + цена) ──────────────────────────────
// Тариф разборки покупается на 1/3/6/12 месяцев.
// Цена информативная (оплата офлайн через админа); админ может менять цену плана.

export type CompanyType = 'parts'

// Базовая месячная цена по типу (₴)
export const BASE_MONTHLY_PRICE: Record<CompanyType, number> = {
  parts: 399,
}

// Доступные сроки: месяц или год (год — скидка 15%)
export const DURATIONS: { months: number; discount: number; label: string }[] = [
  { months: 1,  discount: 0,    label: 'Месяц' },
  { months: 12, discount: 0.15, label: 'Год'   },
]

/** Итоговая цена тарифа за выбранный срок (по месячной цене плана), округление до 10 ₴ */
export function tierTermPrice(monthlyPrice: number, months: number): number {
  const d = DURATIONS.find(x => x.months === months) ?? DURATIONS[0]
  const raw = monthlyPrice * months * (1 - d.discount)
  return Math.round(raw / 10) * 10
}

/** Эквивалент ₴/мес для выбранного срока (для подписи «выгоднее») */
export function tierTermPerMonth(monthlyPrice: number, months: number): number {
  return Math.round(tierTermPrice(monthlyPrice, months) / months)
}

// Бессрочная цена (для админ-вью; владельцу не предлагается)
export const LIFETIME_PRICE: Record<CompanyType, number> = {
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
  return `${n.toLocaleString('ru-RU')} грн.`
}
