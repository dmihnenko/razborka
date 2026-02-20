/**
 * Форматирование валюты в гривны
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' ₴'
}
