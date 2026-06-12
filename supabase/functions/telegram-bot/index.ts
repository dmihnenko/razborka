// Telegram-бот разборки: единая Edge Function на два режима.
//
//  1) ВЕБХУК Telegram (Telegram шлёт сюда апдейты):
//     пользователь открывает бота по ссылке t.me/<bot>?start=<company_id>,
//     присылается «/start <company_id>» — мы сохраняем chat_id в
//     parts_companies.telegram_chat_id и отвечаем подтверждением.
//
//  2) ВНУТРЕННЯЯ ОТПРАВКА (вызывается из БД через pg_net с секретом):
//     POST с заголовком x-internal-secret: <NOTIFY_SECRET> и телом
//     { company_id?, chat_id?, text } — шлём сообщение владельцу разборки.
//
// Секреты функции (supabase secrets set ...):
//   TELEGRAM_BOT_TOKEN      — токен бота из @BotFather
//   TELEGRAM_WEBHOOK_SECRET — произвольная строка; ею же регистрируем вебхук
//   NOTIFY_SECRET           — произвольная строка; ею же подписаны вызовы из БД
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — подставляются платформой.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? ''
const NOTIFY_SECRET = Deno.env.get('NOTIFY_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })
}

async function tgSend(chatId: string | number, text: string) {
  if (!BOT_TOKEN) return
  await fetch(`${TG_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok', { status: 200 })

  let body: any = {}
  try { body = await req.json() } catch { body = {} }

  // ── Режим 2: внутренняя отправка уведомления (вызов из БД) ──────────────────
  const internal = req.headers.get('x-internal-secret')
  if (internal) {
    if (!NOTIFY_SECRET || internal !== NOTIFY_SECRET) {
      return new Response('forbidden', { status: 403 })
    }
    const text: string = body.text ?? ''
    let chatId: string | null = body.chat_id ?? null
    if (!chatId && body.company_id) {
      const { data } = await admin()
        .from('parts_companies')
        .select('telegram_chat_id')
        .eq('id', body.company_id)
        .maybeSingle()
      chatId = data?.telegram_chat_id ?? null
    }
    if (!chatId || !text) {
      // Нет привязки Telegram у компании — это не ошибка, просто пропускаем.
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      })
    }
    await tgSend(chatId, text)
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── Режим 1: вебхук Telegram ────────────────────────────────────────────────
  // Защита: Telegram шлёт секрет в этом заголовке (задаётся при setWebhook).
  if (WEBHOOK_SECRET) {
    const got = req.headers.get('x-telegram-bot-api-secret-token')
    if (got !== WEBHOOK_SECRET) return new Response('forbidden', { status: 403 })
  }

  const msg = body.message ?? body.edited_message
  const chatId = msg?.chat?.id
  const text: string = (msg?.text ?? '').trim()

  if (chatId && text.startsWith('/start')) {
    const arg = text.slice('/start'.length).trim()
    if (UUID_RE.test(arg)) {
      const { error } = await admin()
        .from('parts_companies')
        .update({ telegram_chat_id: String(chatId) })
        .eq('id', arg)
      if (error) {
        await tgSend(chatId, '⚠️ Не удалось подключить уведомления. Попробуйте ещё раз из настроек разборки.')
      } else {
        await tgSend(chatId, '✅ <b>Уведомления подключены.</b>\nТеперь вы будете получать сюда новые заявки с маркета и напоминания о подписке.')
      }
    } else {
      await tgSend(chatId, 'Чтобы подключить уведомления, откройте эту ссылку из раздела «Настройки» вашей разборки в приложении.')
    }
  }

  // Telegram всегда ждёт 200.
  return new Response('ok', { status: 200 })
})
