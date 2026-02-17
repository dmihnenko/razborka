# PWA Configuration Guide

## Обзор

Приложение настроено как Progressive Web App (PWA) с полной поддержкой:
- ✅ Установка на устройство (Android, iOS, Desktop)
- ✅ Офлайн работа через Service Worker
- ✅ Автоматические обновления
- ✅ Кэширование для быстрой загрузки
- ✅ Push-уведомления (готово к интеграции)

## Основные возможности

### 1. Автоматическая установка
Браузер автоматически предложит установить приложение при соблюдении PWA-требований:
- HTTPS подключение (или localhost для разработки)
- Валидный манифест
- Зарегистрированный Service Worker
- Минимум 2 иконки (192x192 и 512x512)

### 2. Офлайн поддержка
Service Worker кэширует:
- Все статические ресурсы (JS, CSS, HTML, шрифты)
- API запросы к Supabase (с автоматическим обновлением)
- Шрифты Google

Стратегии кэширования:
- **NetworkFirst** для API Supabase - сначала сеть, затем кэш
- **CacheFirst** для шрифтов - приоритет кэша для скорости

### 3. Автоматические обновления
При наличии новой версии:
1. Service Worker скачивает обновление в фоне
2. Пользователь получает диалог с предложением обновиться
3. После подтверждения приложение перезагружается с новой версией

## Конфигурация

### vite.config.ts
```typescript
VitePWA({
  registerType: 'autoUpdate',  // Автообновление SW
  workbox: {
    // Кэширование всех ресурсов
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
    
    // Runtime кэширование API
    runtimeCaching: [...]
  }
})
```

### Манифест (manifest.json)
Автоматически генерируется из конфигурации в vite.config.ts:
- `name`: Полное название приложения
- `short_name`: Короткое название (под иконкой)
- `theme_color`: Цвет темы (#2563eb - синий)
- `background_color`: Цвет фона при запуске (#ffffff - белый)
- `display`: standalone - полноэкранный режим без браузерных элементов
- `orientation`: portrait - вертикальная ориентация

### Service Worker
Регистрация в `src/main.tsx`:
```typescript
registerSW({
  onNeedRefresh() {
    // Диалог обновления
  },
  onOfflineReady() {
    // Готовность к офлайн работе
  }
})
```

## Иконки

### Требуемые размеры
Создайте и замените placeholder-файлы в папке `public/`:

1. **pwa-64x64.png** (64×64px)
   - Маленькая иконка для различных контекстов

2. **pwa-192x192.png** (192×192px)
   - Стандартная иконка для Android, Windows

3. **pwa-512x512.png** (512×512px)
   - Большая иконка для splash screens

4. **maskable-icon-512x512.png** (512×512px)
   - Адаптивная иконка для Android 13+
   - [Проверить maskable иконку](https://maskable.app/)
   - Важные элементы должны быть в "safe zone" (80% центра)

5. **apple-touch-icon.png** (180×180px)
   - Иконка для iOS/Safari

6. **favicon.ico**
   - Классический фавикон (32×32px или multi-size)

### Создание иконок

#### Вариант 1: Онлайн-генераторы
- [RealFaviconGenerator](https://realfavicongenerator.net/) - генерация всех размеров
- [PWA Asset Generator](https://github.com/elegantapp/pwa-asset-generator) - CLI инструмент
- [Favicon.io](https://favicon.io/) - простой генератор

#### Вариант 2: Вручную
1. Создайте основную иконку 512×512px
2. Используйте Photoshop/Figma/GIMP для изменения размеров
3. Для maskable - добавьте padding 10% с каждой стороны

#### Требования к дизайну
- Простой узнаваемый логотип
- Контрастные цвета
- Избегайте мелких деталей
- Для maskable - важный контент в центре 80%
- PNG с прозрачным фоном (или цветным для maskable)

## Тестирование

### Локальная разработка
```bash
npm run dev
```
PWA функции активны даже в dev режиме благодаря `devOptions.enabled: true`

### Production сборка
```bash
npm run build
npm run preview
```

### Проверка PWA

1. **Chrome DevTools**
   - Application → Manifest - проверка манифеста
   - Application → Service Workers - статус SW
   - Lighthouse → PWA Audit - полная проверка

2. **PWA требования**
   - ✅ HTTPS (или localhost)
   - ✅ Регистрированный Service Worker
   - ✅ Web App Manifest
   - ✅ Иконки 192x192 и 512x512
   - ✅ start_url отвечает 200 даже оффлайн
   - ✅ viewport meta tag
   - ✅ theme-color meta tag

3. **Lighthouse Score**
   Запустите Lighthouse аудит в Chrome DevTools:
   - Performance: должен быть 90+
   - Progressive Web App: должен быть 100
   - Best Practices: должен быть 90+
   - Accessibility: должен быть 90+

## Установка на устройства

### Android (Chrome)
1. Откройте сайт в Chrome
2. Нажмите меню (⋮) → "Установить приложение" или "Add to Home Screen"
3. Приложение появится в списке приложений

### iOS (Safari)
1. Откройте сайт в Safari
2. Нажмите кнопку "Поделиться" (□↑)
3. Выберите "На экран «Домой»"
4. Подтвердите установку

### Desktop (Chrome/Edge)
1. Откройте сайт
2. В адресной строке появится иконка установки (⊕)
3. Или меню (⋮) → "Установить приложение"
4. Приложение откроется в отдельном окне

## Обновление приложения

### Автоматическое
1. Service Worker проверяет обновления при каждом визите
2. Если найдена новая версия → скачивается в фоне
3. Пользователь видит диалог "Доступно обновление"
4. После согласия → автоматическая перезагрузка

### Ручное
Пользователь может принудительно проверить обновление:
- Закрыть и переоткрыть приложение
- В Chrome DevTools: Application → Service Workers → Update

## Кэширование

### Что кэшируется

1. **Статические файлы** (автоматически)
   - JavaScript бандлы
   - CSS файлы
   - HTML страницы
   - Иконки и изображения
   - Шрифты

2. **API запросы** (runtime)
   - Supabase API: 24 часа, max 100 записей
   - Google Fonts: 1 год, max 10 записей

### Очистка кэша

#### Для пользователей
- Chrome: Settings → Privacy → Clear browsing data → Cached images
- iOS Safari: Settings → Safari → Clear History and Website Data

#### Для разработчиков
```javascript
// Chrome DevTools Console
caches.keys().then(keys => keys.forEach(key => caches.delete(key)))
```

## Продвинутые настройки

### Push-уведомления (будущее)
Готовность для интеграции:
```typescript
// В Service Worker
self.addEventListener('push', (event) => {
  const data = event.data.json()
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/pwa-192x192.png'
  })
})
```

### Background Sync (будущее)
Отправка данных при восстановлении соединения:
```typescript
// Регистрация
navigator.serviceWorker.ready.then(sw => {
  return sw.sync.register('sync-appointments')
})
```

### Share API
Уже доступно в браузерах с PWA:
```typescript
navigator.share({
  title: 'Заявка №123',
  text: 'Посмотрите детали заявки',
  url: '/appointments/123'
})
```

## Отладка проблем

### Service Worker не регистрируется
1. Проверьте HTTPS (или localhost)
2. Проверьте консоль на ошибки
3. Chrome DevTools → Application → Service Workers
4. Кнопка "Unregister" и перезагрузка

### Старая версия не обновляется
1. Unregister Service Worker в DevTools
2. Clear Site Data
3. Hard reload (Ctrl+Shift+R)
4. Проверьте версию в vite.config.ts

### Иконки не отображаются
1. Проверьте пути в vite.config.ts
2. Убедитесь что файлы в папке `public/`
3. Проверьте размеры и формат (PNG)
4. Chrome DevTools → Application → Manifest

### Оффлайн не работает
1. Проверьте Service Worker активен
2. Проверьте Network tab → Offline mode
3. Убедитесь что запросы в runtimeCaching
4. Проверьте консоль на fetch errors

## Производительность

### Метрики
- **FCP** (First Contentful Paint): < 1.8s
- **LCP** (Largest Contentful Paint): < 2.5s
- **TTI** (Time to Interactive): < 3.8s
- **CLS** (Cumulative Layout Shift): < 0.1

### Оптимизации
- ✅ Service Worker precaching
- ✅ Code splitting (Vite автоматически)
- ✅ Asset hashing для кэширования
- ✅ Компрессия (gzip/brotli на сервере)
- ✅ Lazy loading компонентов React

## Checklist перед деплоем

- [ ] Созданы все иконки (64, 192, 512, maskable, apple, favicon)
- [ ] Проверен манифест в Chrome DevTools
- [ ] Service Worker регистрируется успешно
- [ ] Lighthouse PWA score = 100
- [ ] Тест установки на Android
- [ ] Тест установки на iOS
- [ ] Тест офлайн режима
- [ ] Тест автоматического обновления
- [ ] HTTPS настроен на production
- [ ] Домен добавлен в scope манифеста

## Ресурсы

### Документация
- [MDN PWA Guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [web.dev PWA](https://web.dev/progressive-web-apps/)
- [Workbox Documentation](https://developer.chrome.com/docs/workbox/)
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)

### Инструменты
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [PWA Builder](https://www.pwabuilder.com/)
- [Maskable.app](https://maskable.app/) - тест maskable иконок

### Примеры
- [PWA Directory](https://pwa-directory.com/) - галерея PWA приложений
- [Workbox Recipes](https://developer.chrome.com/docs/workbox/modules/workbox-recipes/)

## Поддержка

Текущая конфигурация поддерживает:
- ✅ Chrome/Edge 90+ (Desktop & Mobile)
- ✅ Safari 14+ (iOS & macOS)
- ✅ Firefox 90+ (Desktop & Mobile)
- ✅ Samsung Internet 14+
- ✅ Opera 76+

Ограничения iOS:
- Push-уведомления пока не поддерживаются
- Background Sync недоступен
- Ограничения на storage (50MB)
