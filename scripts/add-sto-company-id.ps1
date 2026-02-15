# Добавляет sto_company_id ко всем INSERT appointments в safe_import.sql

$inputFile = "database\migrations\safe_import.sql"
$outputFile = "database\migrations\safe_import_with_sto.sql"

$content = Get-Content $inputFile -Raw -Encoding UTF8

# Заменяем все INSERT INTO appointments добавляя sto_company_id
$content = $content -replace `
  '(INSERT INTO appointments \(\r?\n  firebase_id,\r?\n  request_number,)', `
  '$1' + "`r`n  sto_company_id,"

# Заменяем VALUES добавляя значение sto_company_id
$content = $content -replace `
  "(\) VALUES \(\r?\n  '[^']+',\r?\n  '[^']+',)", `
  "`$1`r`n  'e0e2202a-e4c2-4505-8b4c-07037cb64281',"

# Сохраняем с UTF-8
[System.IO.File]::WriteAllText((Resolve-Path $outputFile).Path, $content, [System.Text.Encoding]::UTF8)

Write-Host "Создан файл: $outputFile" -ForegroundColor Green
Write-Host "Размер: $([math]::Round((Get-Item $outputFile).Length / 1KB, 2)) KB" -ForegroundColor Cyan
Write-Host "Загрузите этот файл в Supabase SQL Editor" -ForegroundColor Yellow
