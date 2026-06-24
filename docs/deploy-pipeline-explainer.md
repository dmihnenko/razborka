# Как у нас устроен деплой по `git push` (объяснение для другого ИИ)

> Скопируй этот файл целиком и передай ИИ в другом проекте. Это описание РАБОЧЕЙ
> схемы проекта razborka.net — как образец «push в master → автодеплой на Cloudflare».

## Короткая суть
**Пуш в ветку `master` на GitHub → GitHub Actions собирает фронт (Vite) и деплоит на
Cloudflare Workers (Static Assets) через `wrangler deploy`.** Никаких ручных шагов:
`git push` — и через 1–2 минуты прод обновлён. Ручной деплой возможен (`npm run deploy`),
но обычно не нужен.

Важно: хостинг — **Cloudflare Workers + Static Assets**, а НЕ Netlify и НЕ Cloudflare
Pages. Статика отдаётся с edge, воркер запускается только для `/api/*`.

## Из чего состоит пайплайн

### 1. Триггер — GitHub Actions (`.github/workflows/deploy.yml`)
```yaml
on:
  push:
    branches: [master]      # любой пуш в master
  workflow_dispatch: {}     # можно запустить вручную из вкладки Actions
concurrency:                # параллельные деплои одного ref отменяются
  group: deploy-${{ github.ref }}
  cancel-in-progress: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }   # wrangler 4.x требует Node >= 22
      - run: npm ci
      - run: npm run lint                          # гейт: линт должен пройти
      - run: npm run deploy                        # = build + wrangler deploy
        env:
          VITE_SUPABASE_URL:      ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          VITE_IMGBB_API_KEY:     ${{ secrets.VITE_IMGBB_API_KEY }}
          WORKERS_CI_COMMIT_SHA:  ${{ github.sha }}   # хеш сборки → /version.json (PWA-обновление)
          CLOUDFLARE_API_TOKEN:   ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID:  ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

### 2. Команды (`package.json`)
```json
"build":  "vite build",                  // → каталог dist/
"deploy": "npm run build && wrangler deploy"
```
`npm run deploy` = собрать фронт в `dist/` и выложить через wrangler.

### 3. Конфиг Cloudflare (`wrangler.jsonc`)
```jsonc
{
  "name": "razborka",
  "compatibility_date": "2024-11-01",
  "main": "worker/index.js",                 // воркер
  "routes": [                                // кастомные домены (зона в этом же аккаунте CF)
    { "pattern": "razborka.net",     "custom_domain": true },
    { "pattern": "www.razborka.net", "custom_domain": true }
  ],
  "assets": {
    "directory": "./dist",                   // что выкладываем
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",  // SPA-фолбэк: неизвестный путь → index.html
    "run_worker_first": ["/api/*"]           // воркер только для /api/*; статика — мимо воркера (экономит лимит)
  }
}
```

### 4. Воркер (`worker/index.js`) — минимальный
Запускается только на `/api/*` (здесь это прокси курса валют, обход CORS). Всё
остальное (`env.ASSETS.fetch(request)`) отдаёт статика с edge.

### 5. Заголовки (`public/_headers`)
Кэш/безопасность задаются файлом `_headers` (Cloudflare его читает из `dist`):
хешированные `/assets/*` — `immutable` на год; `sw.js`/`workbox-*` — `no-store`
(чтобы PWA обновлялась); HTML — `must-revalidate`.

## Что нужно, чтобы это заработало в другом проекте
1. **Репозиторий на GitHub**, прод-ветка `master` (или поменяй ветку в `on.push.branches`).
2. **Аккаунт Cloudflare**, домен (зона) в этом аккаунте — wrangler сам создаст
   привязку домена и DNS при первом `wrangler deploy`.
3. **API-токен Cloudflare** с правами на Workers (Edit) и нужный `account_id`.
4. **Секреты в GitHub** → Settings → Secrets and variables → Actions:
   - деплой: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`;
   - сборка (свои для проекта): `VITE_*` и т.п.
5. Файлы в репо: `wrangler.jsonc` (или `wrangler.toml`), `worker/index.js` (если нужен
   воркер — иначе можно чисто-статический ассет-деплой), `package.json` со
   `build`/`deploy`, `.github/workflows/deploy.yml`.

## Как проверить/диагностировать
- После пуша — вкладка **Actions** в GitHub: там лог сборки и деплоя.
- Зелёный workflow = задеплоено; Cloudflare обновляет edge за ~1–2 мин.
- Локальный прод-деплой в обход CI: `npm run deploy` (нужны те же CF-переменные в окружении).
- Частые ошибки: Node < 22 (wrangler 4 не запустится); нет `CLOUDFLARE_API_TOKEN`;
  домен не в том аккаунте CF; забыли `VITE_*` секрет → сборка падает.

## Чек-лист для второго ИИ (что сделать в своём проекте)
1. Создай `.github/workflows/deploy.yml` по образцу выше (поменяй имена секретов под свой стек).
2. Добавь `wrangler.jsonc`: `name`, `assets.directory` = твой билд-каталог, SPA-фолбэк если SPA.
3. В `package.json` добавь `"deploy": "<твой build> && wrangler deploy"`.
4. Заведи секреты в GitHub Actions (CF токен + account_id + build-time переменные).
5. Запушь в `master` → смотри Actions. Готово.
