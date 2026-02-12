# Deploy Edge Function to Supabase
# Убедитесь, что у вас установлен Supabase CLI: npm install -g supabase

Write-Host "Deploying Edge Function to Supabase..." -ForegroundColor Cyan

# Проверяем, установлен ли Supabase CLI
try {
    $supabaseVersion = supabase --version
    Write-Host "Supabase CLI version: $supabaseVersion" -ForegroundColor Green
} catch {
    Write-Host "Supabase CLI не установлен. Установите его командой:" -ForegroundColor Red
    Write-Host "npm install -g supabase" -ForegroundColor Yellow
    exit 1
}

# Деплой функции
Write-Host "`nДеплой функции delete-user..." -ForegroundColor Cyan

# Связываем проект с Supabase (если еще не связан)
$projectRef = "hwckvddevjucuzxdoqqh"
Write-Host "Linking project: $projectRef" -ForegroundColor Yellow

try {
    supabase link --project-ref $projectRef
} catch {
    Write-Host "Ошибка при связывании проекта. Возможно, он уже связан." -ForegroundColor Yellow
}

# Деплоим функцию
Write-Host "`nDeploying delete-user function..." -ForegroundColor Cyan
supabase functions deploy delete-user

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nEdge Function deployed successfully!" -ForegroundColor Green
    Write-Host "`nFunction URL: https://hwckvddevjucuzxdoqqh.supabase.co/functions/v1/delete-user" -ForegroundColor Cyan
} else {
    Write-Host "`nError deploying function" -ForegroundColor Red
    exit 1
}
