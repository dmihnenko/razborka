---
name: ci-cd
description: CI/CD и DevOps этого проекта — сборка, деплой на Netlify, заголовки/кеширование, PWA-обновление, проверки перед выкаткой, GitHub Actions. Используй вместе с release, когда нужно настроить пайплайн, автоматизировать проверки, поправить netlify.toml/заголовки или диагностировать проблемы деплоя.
---

# CI/CD и DevOps (этот проект)

Дополняет [release] (бамп версии, ручная выкатка). Этот скил — про автоматизацию и инфраструктуру деплоя. Хостинг — **Netlify**, деплой по пушу в `master` (auto).

## Как устроен деплой
- **Netlify** собирает по `netlify.toml`: `npm install --include=dev --legacy-peer-deps && npm run build`, publish = `dist`, Node 20.
- Пуш в `master` → авто-сборка и прод-деплой. Ручной альтернативный путь: `npm run deploy` (`netlify deploy --prod`).
- `vite.config.ts` пишет `version.json` (git SHA из `COMMIT_REF`, который даёт Netlify; фолбэк — timestamp). `VersionChecker.tsx` опрашивает его и предлагает обновиться.
- SPA-роутинг и прокси PrivatBank — через `[[redirects]]` в `netlify.toml`.

## Заголовки и кеширование (`netlify.toml`) — критично для PWA
Менять с пониманием, иначе пользователи застрянут на старой версии:
- `index.html` / `/*`: `max-age=0, must-revalidate` — HTML всегда свежий.
- `/assets/*`: `max-age=31536000, immutable` — безопасно, т.к. имена с хешем (`[name].[hash].js`).
- `/sw.js`, `/workbox-*.js`: `no-cache, no-store, must-revalidate` — SW обязан проверяться каждый раз, иначе обновления не доедут.
- `version.json` НЕ должен кешироваться долго (его смысл — детект новой версии).
- Security headers уже есть: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`. При добавлении CSP — не сломай инлайн-скрипты в `index.html` (тема, SW-обновление) и Supabase/ImgBB/Google Fonts источники.

## Проверки перед выкаткой (порядок)
1. `npm run build:check` — `tsc && vite build` (типы + сборка). Это строже, чем просто `build`.
2. `npm run lint` — eslint, `--max-warnings 0`.
3. `npm test` — Vitest (см. [qa-tester]).
4. (по необходимости) `npm run e2e` — Playwright.
Не пушить в `master`, если хоть один шаг падает.

## GitHub Actions (если заводим)
Сейчас `.github/workflows/` НЕТ — CI только на стороне Netlify. Если нужен PR-гейт:
- Workflow на `pull_request` → `npm ci` → `build:check` + `lint` + `test`. Без секретов (это просто проверка).
- Не дублируй прод-деплой в Actions — деплоит Netlify. Actions = качество кода до мёрджа.
- Кешируй `~/.npm` по `package-lock.json` для скорости.
- Секреты — только через GitHub Secrets, никогда в YAML. `VITE_*` для сборки берутся из Netlify env, не из репозитория.

## Частые проблемы
- «Не вижу новую версию» → проверь no-cache на `sw.js` и логику `VersionChecker`; HTML с `max-age=0`.
- Сборка падает на Netlify, локально ок → разница Node-версии (зафиксирована 20) или peer-deps (поэтому `--legacy-peer-deps`).
- 404 на прямом заходе по роуту → SPA-редирект на `index.html` (уже есть, не удаляй).

## Чек перед сдачей
- `netlify.toml` валиден, заголовки SW/assets/HTML не перепутаны.
- `build:check` + `lint` + `test` зелёные.
- Изменения кеша не ломают доставку обновлений PWA.
