# Run TSP - автоматический деплой на Netlify
# Использование: .\run-tsp.ps1 "commit message"

param(
    [string]$message = "Update"
)

Write-Host "🚀 Run TSP - Deploy Script" -ForegroundColor Cyan
Write-Host ""

# Проверяем изменения
$status = git status --porcelain
if ($status) {
    Write-Host "📝 Найдены изменения, коммитим..." -ForegroundColor Yellow
    git add -A
    git commit -m $message
    git push origin master
    Write-Host "✅ Изменения отправлены в GitHub" -ForegroundColor Green
} else {
    Write-Host "ℹ️  Нет изменений для коммита" -ForegroundColor Gray
}

Write-Host ""
Write-Host "🔨 Сборка проекта..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Сборка успешна" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 Деплой на Netlify..." -ForegroundColor Yellow
    netlify deploy --prod
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "🎉 Деплой завершен успешно!" -ForegroundColor Green
        Write-Host "🔗 Сайт доступен: https://tsp.pp.ua" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "❌ Ошибка деплоя" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host ""
    Write-Host "❌ Ошибка сборки" -ForegroundColor Red
    exit 1
}
