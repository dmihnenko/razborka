// Имя Telegram-бота уведомлений (без «@»).
// Дефолт — рабочий бот разборки (@avtopoisk_help_bot); можно переопределить через
// VITE_TELEGRAM_BOT_USERNAME (Netlify env vars / .env). Username — не секрет.
export const TELEGRAM_BOT_USERNAME =
  (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined)?.replace(/^@/, '') ||
  'avtopoisk_help_bot'

/** Deep-link, по которому владелец привязывает свою разборку к Telegram-боту. */
export function telegramConnectLink(companyId: string): string {
  return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${companyId}`
}
