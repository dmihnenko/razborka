---
name: release
description: Выпуск и деплой этого проекта — бамп версии, сборка, публикация на Cloudflare, проверка PWA-обновления. Используй, когда нужно подготовить релиз, выкатить изменения в прод или разобраться с процессом деплоя/версионирования.
---

# Release / деплой (этот проект)

## Как деплоится
- Хостинг — **Cloudflare** (Workers + Static Assets). Конфиг — `wrangler.jsonc` (биндинг `ASSETS` → `dist`, SPA-фолбэк `not_found_handling: single-page-application`), Worker — `worker/index.js`.
- **Авто-деплой по пушу** в `master` (если репозиторий подключён к Cloudflare Workers Builds) — обычно достаточно `git push`.
- Ручной деплой: `npm run deploy` (= `npm run build && wrangler deploy`).
- SPA-роутинг — через `not_found_handling` в `wrangler.jsonc`. Заголовки безопасности/кеша — в `public/_headers`. Прокси курса ПриватБанка (`/api/privatbank-rate`) — в `worker/index.js`.

## Версия и PWA-обновление
- `package.json` → `"version"` — обнови при значимом релизе (semver: patch/minor/major).
- При сборке `vite.config.ts` (плагин `version-json`) пишет `/version.json` с хешем сборки; `VersionChecker`/`Version` на клиенте сравнивают его и предлагают обновить PWA (`registerType: 'autoUpdate'`). Поэтому после деплоя у пользователей всплывает апдейт — это норма.

## Порядок релиза
1. Убедись, что рабочее дерево чистое и сборка проходит: `npx vite build`. По возможности — `npm test`.
2. Бампни `package.json version` (если релиз значимый).
3. Коммит с понятным сообщением (см. правила репо: ветка от master при необходимости, корректный Co-Authored-By).
4. **Только по явной просьбе пользователя** — `git push` (запускает авто-деплой) или `npm run deploy`. Не пушь/деплой без разрешения.
5. После деплоя — проверь, что Netlify-сборка прошла и `/version.json` обновился.

## Правила
- Не коммить секреты. Supabase-ключи — через env (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), не в коде.
- Деплой — внешнее, необратимое действие: подтверждай перед выполнением.
- Если применялись SQL-миграции — напомни применить их в Supabase **до/вместе** с релизом, чтобы прод-схема совпадала с кодом.
