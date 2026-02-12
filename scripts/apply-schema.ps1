# Скрипт для автоматического применения схемы базы данных к Supabase

param(
    [string]$SupabasePassword = $env:SUPABASE_DB_PASSWORD
)

$ErrorActionPreference = "Stop"

# Проверка пароля
if (-not $SupabasePassword) {
    Write-Host "❌ Ошибка: Не указан пароль базы данных" -ForegroundColor Red
    Write-Host ""
    Write-Host "Укажите пароль одним из способов:" -ForegroundColor Yellow
    Write-Host "1. Переменная окружения: `$env:SUPABASE_DB_PASSWORD = 'ваш_пароль'" -ForegroundColor Cyan
    Write-Host "2. Параметр скрипта: .\apply-schema.ps1 -SupabasePassword 'ваш_пароль'" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Пароль можно найти в Supabase Dashboard -> Settings -> Database" -ForegroundColor Gray
    exit 1
}

# Параметры подключения
$env:PGHOST = "db.hwckvddevjucuzxdoqqh.supabase.co"
$env:PGDATABASE = "postgres"
$env:PGUSER = "postgres"
$env:PGPASSWORD = $SupabasePassword
$env:PGPORT = "6543"

Write-Host "🚀 Применение схемы базы данных к Supabase..." -ForegroundColor Cyan
Write-Host ""

# Проверка наличия psql
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "❌ Ошибка: psql не найден" -ForegroundColor Red
    Write-Host "Установите PostgreSQL client: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    exit 1
}

$databasePath = Join-Path $PSScriptRoot "..\database"

# Применяем схему
Write-Host "📝 Применение schema.sql..." -ForegroundColor Green
psql -f "$databasePath\schema.sql"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Ошибка при применении schema.sql" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📝 Применение user_profile_trigger.sql..." -ForegroundColor Green
psql -f "$databasePath\user_profile_trigger.sql"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Ошибка при применении user_profile_trigger.sql" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ База данных успешно настроена!" -ForegroundColor Green
Write-Host ""
Write-Host "Можете обновить страницу приложения 🎉" -ForegroundColor Cyan
