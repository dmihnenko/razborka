# update.ps1 — «обновись»: подтянуть последние изменения проекта И памяти Claude одной командой.
#
# Делает ТОЛЬКО pull (никогда push — пуш только по явной команде пользователя):
#   1. git fetch + git pull --ff-only  (быстрая перемотка, без merge-коммитов)
#   2. синк снимка памяти из репо (.claude/memory/*) в активную папку памяти Claude на этой машине
#
# Запуск:  pwsh -File scripts/update.ps1   (или powershell -File scripts/update.ps1)

$ErrorActionPreference = 'Stop'

# --- корень репозитория ---
$repo = (git rev-parse --show-toplevel).Trim()
Set-Location $repo

# --- 1. проект ---
Write-Host "==> Тяну проект (fetch + ff-only pull)..." -ForegroundColor Cyan
git fetch origin --quiet
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
git pull --ff-only origin $branch
Write-Host "HEAD: $((git log --oneline -1))"

# --- 2. память Claude ---
# Активная папка памяти Claude для этого проекта: ~/.claude/projects/<slug>/memory
# slug заканчивается именем папки репозитория, поэтому ищем по суффиксу — переносимо между машинами.
$leaf      = Split-Path $repo -Leaf
$projects  = Join-Path $env:USERPROFILE ".claude\projects"
$src       = Join-Path $repo ".claude\memory"

if (-not (Test-Path $src)) {
    Write-Host "==> Снимка памяти в репо нет ($src) — пропускаю синк памяти." -ForegroundColor Yellow
    return
}

$projDir = $null
if (Test-Path $projects) {
    $projDir = Get-ChildItem $projects -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like "*$leaf" } | Select-Object -First 1
}

if ($null -eq $projDir) {
    Write-Host "==> Папка проекта Claude не найдена под $projects — пропускаю синк памяти." -ForegroundColor Yellow
    return
}

$dst = Join-Path $projDir.FullName "memory"
if (-not (Test-Path $dst)) { New-Item -ItemType Directory -Force $dst | Out-Null }

Write-Host "==> Синк памяти в $dst ..." -ForegroundColor Cyan
$count = 0
foreach ($f in Get-ChildItem $src -Filter *.md) {
    Copy-Item $f.FullName (Join-Path $dst $f.Name) -Force
    $count++
}
Write-Host "Память синхронизирована: $count файл(ов)." -ForegroundColor Green
Write-Host "Готово. (push не выполнялся — он только по твоей команде.)" -ForegroundColor Green

