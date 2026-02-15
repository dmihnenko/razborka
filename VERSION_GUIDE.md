# Система версионирования

## Как это работает

Система автоматически:
1. Проверяет версию при загрузке приложения
2. Периодически (каждые 5 минут) проверяет наличие обновлений
3. Уведомляет пользователя о доступных обновлениях
4. Предлагает кнопку для перезагрузки страницы

## При релизе новой версии

### 1. Обновите версию в package.json:
```json
{
  "version": "1.0.2"  // <- увеличьте версию
}
```

### 2. Обновите версию в src/components/VersionChecker.tsx:
```typescript
const CURRENT_VERSION = '1.0.2'  // <- та же версия
```

### 3. Обновите public/version.json:
```json
{
  "version": "1.0.2",
  "buildDate": "2026-02-15"  // <- текущая дата
}
```

### 4. Соберите production версию:
```bash
npm run build
```

## Автоматизация (опционально)

Можно создать скрипт который автоматически обновляет версию:

```bash
# В package.json добавить:
"scripts": {
  "version:bump": "node scripts/bump-version.js"
}
```

## Принудительная очистка кэша

Пользователи могут очистить кэш вручную:
- **Chrome/Edge**: Ctrl+Shift+Delete
- **Firefox**: Ctrl+Shift+Delete
- **Или**: Ctrl+Shift+R (hard reload)

## Meta-теги

В `index.html` добавлены meta-теги для предотвращения кэширования HTML:
```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
<meta http-equiv="Pragma" content="no-cache" />
<meta http-equiv="Expires" content="0" />
```

## Хеширование файлов

Vite автоматически добавляет хеши к именам JS/CSS файлов при сборке:
- `assets/main.[hash].js`
- `assets/index.[hash].css`

Это гарантирует, что браузер загрузит новые версии при изменении файлов.
