# Add sto_company_id to all INSERT appointments

$inputFile = "database\migrations\safe_import.sql"
$outputFile = "database\migrations\safe_import_with_sto.sql"

$content = Get-Content $inputFile -Raw -Encoding UTF8

# Replace pattern
$pattern1 = '(INSERT INTO appointments \(\r?\n  firebase_id,\r?\n  request_number,)'
$replacement1 = "`$1`r`n  sto_company_id,"
$content = $content -replace $pattern1, $replacement1

# Add value  
$pattern2 = "(\) VALUES \(\r?\n  '[^']+',\r?\n  '[^']+',)"
$replacement2 = "`$1`r`n  'e0e2202a-e4c2-4505-8b4c-07037cb64281',"
$content = $content -replace $pattern2, $replacement2

# Save
$content | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host "Created: $outputFile" -ForegroundColor Green
Get-Item $outputFile | Select-Object Name, Length
