# Telegram-уведомления разборки — инструкция по запуску

Код готов. Чтобы включить бота, нужно выполнить шаги ниже (требуют твоих действий:
создать бота, задать секреты, задеплоить функцию, применить SQL).

Архитектура:
- **Edge Function `telegram-bot`** (`supabase/functions/telegram-bot/index.ts`) — два режима:
  - вебхук Telegram: ловит `/start <company_id>` и сохраняет `chat_id` разборки;
  - внутренняя отправка: по вызову из БД (с секретом) шлёт сообщение владельцу.
- **Триггер** на `marketplace_orders` → уведомление о новой заявке.
- **pg_cron** → ежедневная проверка истечения подписки (+ автодеактивация истёкших).
- **Кнопка «Подключить уведомления»** в Настройках разборки (появится после шага 5).

## 1. Создать бота
1. В Telegram открой **@BotFather** → `/newbot` → задай имя и username.
2. Скопируй **токен** (вида `8123456:AAE...`) и запомни **username** бота (без `@`).

## 2. Придумать два секрета
- `NOTIFY_SECRET` — любая длинная случайная строка (подпись вызовов из БД).
- `WEBHOOK_SECRET` — любая длинная случайная строка (защита вебхука).

## 3. Задать секреты функции и задеплоить
```bash
supabase secrets set TELEGRAM_BOT_TOKEN=<токен> \
  TELEGRAM_WEBHOOK_SECRET=<WEBHOOK_SECRET> \
  NOTIFY_SECRET=<NOTIFY_SECRET> --project-ref hwckvddevjucuzxdoqqh
supabase functions deploy telegram-bot --project-ref hwckvddevjucuzxdoqqh
```
(`SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` платформа подставляет сама.)

## 4. Зарегистрировать вебхук Telegram
```bash
curl "https://api.telegram.org/bot<ТОКЕН>/setWebhook" \
  -d "url=https://hwckvddevjucuzxdoqqh.supabase.co/functions/v1/telegram-bot" \
  -d "secret_token=<WEBHOOK_SECRET>"
```

## 5. Включить кнопку во фронте
Задать переменную сборки (Netlify → Environment variables, затем redeploy):
```
VITE_TELEGRAM_BOT_USERNAME=<username_бота_без_@>
```

## 6. Применить SQL (триггер + крон)
В файле `database/migrations/2026-06-12_waveE_telegram_notifications.sql`
заменить `__NOTIFY_SECRET__` на реальное значение `NOTIFY_SECRET` и выполнить
скрипт в Supabase (SQL editor). Не коммитить файл с подставленным секретом.

## Проверка
1. В приложении: Настройки разборки → «Подключить уведомления» → откроется бот → `/start`.
   Бот ответит «✅ Уведомления подключены», в `parts_companies.telegram_chat_id` появится id.
2. Оформи тестовую заявку на маркете на эту разборку → должно прийти сообщение.
3. Крон проверки подписки идёт ежедневно в 09:00 UTC.
