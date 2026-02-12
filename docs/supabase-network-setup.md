# Настройка доступа к Supabase для PostgreSQL

## Проблема
PostgreSQL client не может подключиться к `db.hwckvddevjucuzxdoqqh.supabase.co` из-за блокировки сети.

## Решение

### 1. Windows Firewall

#### Проверка блокировки:
```powershell
# Откройте PowerShell от имени Администратора и выполните:
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*PostgreSQL*"}
```

#### Создание правила для PostgreSQL:
```powershell
# Откройте PowerShell от имени Администратора
New-NetFirewallRule -DisplayName "PostgreSQL Client Outbound" `
  -Direction Outbound `
  -Program "C:\Users\home\AppData\Local\PostgreSQL\pgsql\bin\psql.exe" `
  -Action Allow `
  -Protocol TCP `
  -RemotePort 5432,6543

# Или для всех портов:
New-NetFirewallRule -DisplayName "PostgreSQL Client" `
  -Direction Outbound `
  -Program "C:\Users\home\AppData\Local\PostgreSQL\pgsql\bin\psql.exe" `
  -Action Allow
```

#### Через GUI:
1. Нажмите `Win + R`, введите `wf.msc`
2. Выберите **"Правила для исходящего подключения"**
3. **"Создать правило"** → **"Для программы"**
4. Укажите путь: `C:\Users\home\AppData\Local\PostgreSQL\pgsql\bin\psql.exe`
5. **"Разрешить подключение"** → **Далее** → **Готово**

### 2. Антивирус

#### Kaspersky:
1. Настройки → Дополнительно → Сеть
2. Добавить `*.supabase.co` в исключения

#### Windows Defender:
1. Параметры Windows → Конфиденциальность и безопасность → Безопасность Windows
2. Защита от вирусов → Управление параметрами
3. Исключения → Добавить исключение → Процесс → `psql.exe`

#### ESET/NOD32:
1. Настройка → Дополнительные параметры → Веб и электронная почта
2. Исключения URL → Добавить `*.supabase.co`

#### Avast/AVG:
1. Меню → Настройки → Общие → Исключения
2. Добавить `C:\Users\home\AppData\Local\PostgreSQL\pgsql\bin\psql.exe`

### 3. Проверка DNS

```powershell
# Проверка разрешения имени
nslookup db.hwckvddevjucuzxdoqqh.supabase.co

# Проверка через Google DNS
nslookup db.hwckvddevjucuzxdoqqh.supabase.co 8.8.8.8

# Если DNS не работает, смените DNS сервер на:
# Основной: 8.8.8.8
# Альтернативный: 8.8.4.4
```

#### Смена DNS через PowerShell:
```powershell
# Узнайте имя вашего сетевого адаптера
Get-NetAdapter

# Установите Google DNS (замените "Ethernet" на ваш адаптер)
Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ServerAddresses ("8.8.8.8","8.8.4.4")
```

### 4. Корпоративная сеть / Proxy

Если вы в корпоративной сети:

```powershell
# Проверка proxy
netsh winhttp show proxy

# Настройка proxy для psql (если нужно)
$env:http_proxy = "http://proxy-server:port"
$env:https_proxy = "http://proxy-server:port"
```

### 5. Проверка подключения после настройки

```powershell
# Загрузите переменные из .env
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$' -and $_ -notmatch '^#') {
        [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
    }
}

# Попробуйте подключиться
.\scripts\apply-schema.ps1
```

## Альтернативное решение: VPN

Если проблема в провайдере, используйте VPN:
- Cloudflare WARP (бесплатно): https://1.1.1.1/
- Proton VPN (бесплатно): https://protonvpn.com/

## Быстрая диагностика

```powershell
# Запустите этот скрипт для диагностики:
Write-Host "🔍 Диагностика подключения к Supabase..." -ForegroundColor Cyan
Write-Host ""

# 1. DNS
Write-Host "1. Проверка DNS:" -ForegroundColor Yellow
try {
    $dns = [System.Net.Dns]::GetHostAddresses("db.hwckvddevjucuzxdoqqh.supabase.co")
    Write-Host "   ✅ DNS работает: $($dns[0].IPAddressToString)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ DNS не работает: $($_.Exception.Message)" -ForegroundColor Red
}

# 2. Ping
Write-Host ""
Write-Host "2. Проверка доступности хоста:" -ForegroundColor Yellow
Test-NetConnection -ComputerName db.hwckvddevjucuzxdoqqh.supabase.co -Port 5432

# 3. Firewall
Write-Host ""
Write-Host "3. Проверка правил Firewall для PostgreSQL:" -ForegroundColor Yellow
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*PostgreSQL*"} | 
    Select-Object DisplayName, Enabled, Direction, Action

Write-Host ""
Write-Host "Если все проверки прошли успешно, попробуйте:" -ForegroundColor Cyan
Write-Host ".\scripts\apply-schema.ps1" -ForegroundColor White
```
