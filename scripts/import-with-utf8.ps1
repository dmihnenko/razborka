# Скрипт для импорта через Supabase CLI с правильной кодировкой

# 1. Установите Supabase CLI если еще нет:
# npm install -g supabase

# 2. Получите строку подключения из Supabase Dashboard:
# Settings -> Database -> Connection string (Direct connection)

# 3. Установите переменную окружения
$env:DATABASE_URL = "postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres"

# 4. Очистка старых данных
Write-Host "Очистка старых данных..." -ForegroundColor Yellow
psql $env:DATABASE_URL -c "DELETE FROM appointment_services WHERE appointment_id IN (SELECT id FROM appointments WHERE firebase_id IS NOT NULL);"
psql $env:DATABASE_URL -c "DELETE FROM appointment_parts WHERE appointment_id IN (SELECT id FROM appointments WHERE firebase_id IS NOT NULL);"
psql $env:DATABASE_URL -c "DELETE FROM appointments WHERE firebase_id IS NOT NULL;"

# 5. Импорт с правильной кодировкой
Write-Host "Импорт данных с UTF-8..." -ForegroundColor Yellow
Get-Content database\migrations\generated_import.sql -Encoding UTF8 | psql $env:DATABASE_URL

Write-Host "Готово!" -ForegroundColor Green
