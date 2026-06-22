/**
 * Shared date formatting utilities — локаль по текущему языку интерфейса (ru/uk).
 */
import { intlLocale } from '@/i18n'

/**
 * Format a date string as DD.MM.YYYY
 * Returns '-' if date is null/undefined/empty
 */
export function formatDate(date: string | null | undefined): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString(intlLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Format a date string as DD.MM.YYYY HH:mm
 * Returns '-' if date is null/undefined/empty
 */
export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString(intlLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
