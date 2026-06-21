export type PriceCurrency = 'UAH' | 'USD'

/**
 * Форматирование валюты в гривны
 * @param amount - сумма (если undefined/null/0 — возвращает '—')
 */
export function formatCurrency(amount?: number | null): string {
  if (!amount) return '—'
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' грн.'
}

/**
 * Форматирование цены с учётом валюты (UAH или USD)
 */
export function formatPrice(amount?: number | null, currency: PriceCurrency = 'UAH'): string {
  if (!amount) return '—'
  const formatted = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
  return currency === 'USD' ? `$${formatted}` : `${formatted} грн.`
}
