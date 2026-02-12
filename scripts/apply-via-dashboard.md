# Применение схемы через Supabase Dashboard

Из-за проблем с DNS на вашей системе, самый надежный способ - использовать SQL Editor в веб-интерфейсе Supabase.

## Шаги

1. **Откройте Supabase Dashboard**
   - Перейдите на: https://supabase.com/dashboard/project/hwckvddevjucuzxdoqqh
   - Войдите в свой аккаунт

2. **Откройте SQL Editor**
   - В левом меню выберите "SQL Editor"
   - Нажмите "+ New query"

3. **Примените schema.sql**
   - Скопируйте содержимое файла: `database\schema.sql`
   - Вставьте в SQL Editor
   - Нажмите "Run" (или Ctrl+Enter)
   - Дождитесь завершения выполнения

4. **Примените user_profile_trigger.sql**
   - Создайте новый запрос (+ New query)
   - Скопируйте содержимое файла: `database\user_profile_trigger.sql`
   - Вставьте в SQL Editor
   - Нажмите "Run"

## Автоматизация на будущее

После того как схема будет применена первый раз, можно использовать:

```powershell
# Через Supabase REST API (если настроим Service Role Key)
.\scripts\apply-schema-api.ps1
```

Или настроим GitHub Actions для автоматического применения миграций при push в репозиторий.

## Проверка

После применения схемы:
1. Перезагрузите приложение: http://localhost:5174
2. Откройте страницу Services
3. Должна загрузиться таблица с категориями
