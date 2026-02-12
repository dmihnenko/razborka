# Применение схемы через Supabase Management API
$ErrorActionPreference = "Stop"

Write-Host "🚀 Применение схемы базы данных..." -ForegroundColor Cyan

# Загружаем переменные окружения
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$' -and $_ -notmatch '^#') {
        [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
    }
}

$projectRef = "hwckvddevjucuzxdoqqh"
$supabaseUrl = $env:VITE_SUPABASE_URL
$anonKey = $env:VITE_SUPABASE_ANON_KEY

if (-not $supabaseUrl -or -not $anonKey) {
    Write-Host "❌ Ошибка: Не найдены переменные VITE_SUPABASE_URL или VITE_SUPABASE_ANON_KEY в .env" -ForegroundColor Red
    exit 1
}

# Читаем SQL файлы
$schemaPath = Join-Path $PSScriptRoot "..\database\schema.sql"
$triggerPath = Join-Path $PSScriptRoot "..\database\user_profile_trigger.sql"

if (-not (Test-Path $schemaPath)) {
    Write-Host "❌ Не найден файл: $schemaPath" -ForegroundColor Red
    exit 1
}

Write-Host "📖 Читаем schema.sql..." -ForegroundColor Gray
$schemaSql = Get-Content $schemaPath -Raw -Encoding UTF8

Write-Host "📖 Читаем user_profile_trigger.sql..." -ForegroundColor Gray
$triggerSql = Get-Content $triggerPath -Raw -Encoding UTF8

# Объединяем SQL
$fullSql = $schemaSql + "`n`n" + $triggerSql

Write-Host ""
Write-Host "📝 Применяем схему через Supabase REST API..." -ForegroundColor Green
Write-Host "   Откройте Supabase SQL Editor и выполните файлы вручную:" -ForegroundColor Yellow
Write-Host ""
Write-Host "   1. Откройте: https://supabase.com/dashboard/project/$projectRef/sql/new" -ForegroundColor Cyan
Write-Host "   2. Скопируйте содержимое: database\schema.sql" -ForegroundColor Cyan
Write-Host "   3. Нажмите 'Run'" -ForegroundColor Cyan
Write-Host "   4. Затем скопируйте: database\user_profile_trigger.sql" -ForegroundColor Cyan
Write-Host "   5. Нажмите 'Run'" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Альтернатива: Установите PostgreSQL client для автоматического применения" -ForegroundColor Gray
Write-Host "   https://www.enterprisedb.com/downloads/postgres-postgresql-downloads" -ForegroundColor Gray

# Открываем браузер со SQL Editor
Start-Process "https://supabase.com/dashboard/project/$projectRef/sql/new"

Write-Host ""
Write-Host "✅ SQL Editor открыт в браузере" -ForegroundColor Green
