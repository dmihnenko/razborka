# Git Update - автоматическое обновление версии и push
# Использование: .\git-update.ps1 "commit message"

param(
    [string]$message = "Update version"
)

Write-Host "Git Update - Auto Version and Push" -ForegroundColor Cyan
Write-Host ""

# Читаем package.json как текст
$packageContent = Get-Content package.json -Raw

# Извлекаем текущую версию через regex
if ($packageContent -match '"version":\s*"(\d+)\.(\d+)\.(\d+)"') {
    $major = [int]$Matches[1]
    $minor = [int]$Matches[2]
    $patch = [int]$Matches[3]
    $currentVersion = "$major.$minor.$patch"
    
    Write-Host "Текущая версия: $currentVersion" -ForegroundColor Gray
    
    # Увеличиваем patch
    $patch++
    $newVersion = "$major.$minor.$patch"
    
    Write-Host "Новая версия: $newVersion" -ForegroundColor Green
    Write-Host ""
    
    # Обновляем версию в package.json
    $packageContent = $packageContent -replace '"version":\s*"\d+\.\d+\.\d+"', "`"version`": `"$newVersion`""
    $packageContent | Set-Content package.json -NoNewline -Encoding UTF8
    
    # Обновляем Version.tsx
    $versionFile = "src\components\Version.tsx"
    $versionContent = Get-Content $versionFile -Raw
    $versionContent = $versionContent -replace 'v\d+\.\d+\.\d+', "v$newVersion"
    $versionContent | Set-Content $versionFile -Encoding UTF8 -NoNewline
    
    Write-Host "Версия обновлена в package.json и Version.tsx" -ForegroundColor Green
    Write-Host ""
    
    # Git commit и push
    Write-Host "Коммит изменений..." -ForegroundColor Yellow
    git add -A
    git commit -m "$message (v$newVersion)"
    git push origin master
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Изменения отправлены в GitHub!" -ForegroundColor Green
        Write-Host "Netlify автоматически задеплоит v$newVersion" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "Ошибка при push в GitHub" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Ошибка: не удалось найти версию в package.json" -ForegroundColor Red
    exit 1
}
