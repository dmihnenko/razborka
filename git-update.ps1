# Git Update - автоматическое обновление версии и push
# Использование: .\git-update.ps1 "commit message"

param(
    [string]$message = "Update version"
)

Write-Host "📦 Git Update - Auto Version & Push" -ForegroundColor Cyan
Write-Host ""

# Читаем текущую версию из package.json
$packageJson = Get-Content package.json -Raw | ConvertFrom-Json
$currentVersion = $packageJson.version
Write-Host "📌 Текущая версия: $currentVersion" -ForegroundColor Gray

# Разбираем версию (major.minor.patch)
$versionParts = $currentVersion.Split('.')
$major = [int]$versionParts[0]
$minor = [int]$versionParts[1]
$patch = [int]$versionParts[2]

# Увеличиваем patch
$patch++
$newVersion = "$major.$minor.$patch"

Write-Host "🆙 Новая версия: $newVersion" -ForegroundColor Green
Write-Host ""

# Обновляем package.json
$packageJson.version = $newVersion
$packageJson | ConvertTo-Json -Depth 100 | Set-Content package.json -Encoding UTF8

# Обновляем Version.tsx
$versionFile = "src\components\Version.tsx"
$versionContent = Get-Content $versionFile -Raw
$versionContent = $versionContent -replace 'v\d+\.\d+\.\d+', "v$newVersion"
$versionContent | Set-Content $versionFile -Encoding UTF8 -NoNewline

Write-Host "✅ Версия обновлена в package.json и Version.tsx" -ForegroundColor Green
Write-Host ""

# Git commit и push
Write-Host "📝 Коммит изменений..." -ForegroundColor Yellow
git add -A
git commit -m "$message (v$newVersion)"
git push origin master

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "🎉 Изменения отправлены в GitHub!" -ForegroundColor Green
    Write-Host "🔗 Netlify автоматически задеплоит v$newVersion" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "❌ Ошибка при push в GitHub" -ForegroundColor Red
    exit 1
}
