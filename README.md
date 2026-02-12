# CRM для СТО

Полнофункциональная CRM система для станции технического обслуживания автомобилей.

## Технологии

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS
- **Backend/БД**: Supabase (PostgreSQL, Authentication)
- **State Management**: React Query (TanStack Query)
- **Icons**: Lucide React
- **Notifications**: Sonner

## Возможности

### ✅ Реализовано

- 🔐 Аутентификация пользователей
- 👥 Управление клиентами
- 🚗 Учет автомобилей
- 📅 Записи на обслуживание
- 🔧 Каталог услуг
- 📦 Склад запчастей с контролем остатков
- 📊 Панель управления с аналитикой

### 🚧 В разработке

- 📝 Заказ-наряды
- 💰 Счета и платежи
- 📈 Расширенная аналитика и отчеты

## Установка

1. **Клонируйте репозиторий и установите зависимости:**

```bash
npm install
```

2. **Настройте Supabase:**

   - Создайте проект на [supabase.com](https://supabase.com)
   - Выполните SQL-скрипт из файла `database/schema.sql` в SQL Editor вашего проекта
   - Скопируйте URL проекта и Anon Key

3. **Настройте переменные окружения:**

Создайте файл `.env` на основе `.env.example`:

```bash
cp .env.example .env
```

Заполните переменные:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Запустите проект:**

```bash
npm run dev
```

5. **Создайте первого пользователя:**

В Supabase Dashboard перейдите в Authentication > Users и создайте нового пользователя.

## Структура проекта

```
TSP-V2/
├── src/
│   ├── components/     # React компоненты
│   ├── pages/          # Страницы приложения
│   ├── hooks/          # Custom hooks
│   ├── lib/            # Утилиты и конфигурация
│   ├── types/          # TypeScript типы
│   ├── App.tsx         # Главный компонент
│   ├── main.tsx        # Точка входа
│   └── index.css       # Глобальные стили
├── database/
│   └── schema.sql      # Схема базы данных
├── scripts/            # Временные скрипты и утилиты
├── docs/               # Документация
└── package.json
```

## Схема базы данных

- **customers** - Клиенты СТО
- **vehicles** - Автомобили клиентов
- **services** - Каталог услуг
- **parts** - Склад запчастей
- **appointments** - Записи на обслуживание
- **work_orders** - Заказ-наряды
- **work_order_items** - Позиции заказ-нарядов
- **invoices** - Счета

## Скрипты

- `npm run dev` - Запуск dev-сервера
- `npm run build` - Сборка проекта
- `npm run preview` - Предпросмотр production сборки
- `npm run lint` - Проверка кода

## Безопасность

Проект использует Supabase Row Level Security (RLS) для защиты данных. Все таблицы защищены политиками доступа, которые требуют аутентификации пользователя.

## Лицензия

MIT
