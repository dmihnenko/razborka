// Имя Telegram-бота уведомлений (без «@»).
// Получить у @BotFather после создания бота и задать в окружении сборки:
//   VITE_TELEGRAM_BOT_USERNAME=my_razborka_bot   (Netlify env vars / .env)
// Пока не задано — кнопка «Подключить уведомления» в настройках скрыта.
export const TELEGRAM_BOT_USERNAME =
  (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined)?.replace(/^@/, '') || ''

/** Deep-link, по которому владелец привязывает свою разборку к Telegram-боту. */
export function telegramConnectLink(companyId: string): string {
  return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${companyId}`
}
