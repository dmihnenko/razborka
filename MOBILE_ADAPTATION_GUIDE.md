# Руководство по мобильной адаптации

## 📱 Новые компоненты для мобильных устройств

### 1. MobileTable - Адаптивная таблица

Автоматически переключается между таблицей (desktop) и карточками (mobile).

```tsx
import { MobileTable, MobileTableColumn } from '@/components/MobileTable'

const columns: MobileTableColumn<Customer>[] = [
  {
    key: 'name',
    header: 'Имя',
    mobileLabel: 'Клиент', // Лейбл для мобильной версии
    render: (customer) => (
      <span className="font-medium">{customer.name}</span>
    ),
  },
  {
    key: 'phone',
    header: 'Телефон',
    render: (customer) => customer.phone,
  },
  {
    key: 'email',
    header: 'Email',
    hideOnMobile: true, // Скрыть на мобильных
    render: (customer) => customer.email,
  },
  {
    key: 'actions',
    header: 'Действия',
    render: (customer) => (
      <button onClick={() => edit(customer)}>Изменить</button>
    ),
  },
]

function CustomersPage() {
  const { data: customers } = useQuery({ ... })

  return (
    <MobileTable
      data={customers || []}
      columns={columns}
      keyExtractor={(c) => c.id}
      onRowClick={(customer) => navigate(`/customers/${customer.id}`)}
      emptyMessage="Нет клиентов"
    />
  )
}
```

**Кастомная отрисовка карточки:**
```tsx
<MobileTable
  data={appointments}
  columns={columns}
  keyExtractor={(a) => a.id}
  mobileCardRender={(appointment) => (
    <div>
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold">{appointment.request_number}</h3>
        <span className={`badge ${getStatusColor(appointment.status)}`}>
          {appointment.status}
        </span>
      </div>
      <p className="text-sm text-gray-600">{appointment.customers.name}</p>
      <p className="text-xs text-gray-500">{appointment.vehicles.model}</p>
    </div>
  )}
/>
```

---

### 2. MobileAdaptive компоненты

#### MobileContainer - Контейнер с адаптивными отступами

```tsx
import { MobileContainer } from '@/components/MobileAdaptive'

function Page() {
  return (
    <MobileContainer>
      {/* Контент с правильными отступами для всех экранов */}
    </MobileContainer>
  )
}
```

#### MobilePageTitle - Адаптивный заголовок страницы

```tsx
import { MobilePageTitle, MobileButton } from '@/components/MobileAdaptive'
import { Plus } from 'lucide-react'

function Page() {
  return (
    <MobilePageTitle
      title="Клиенты"
      subtitle="Управление базой клиентов"
      action={
        <MobileButton icon={Plus} onClick={handleAdd}>
          Добавить
        </MobileButton>
      }
    />
  )
}
```

#### MobileButton - Кнопка с адаптивным размером

```tsx
<MobileButton
  icon={Plus}
  variant="primary" // primary, secondary, danger, success
  size="md" // sm, md, lg
  fullWidth={false}
  onClick={handleClick}
>
  Добавить клиента
</MobileButton>
```

#### MobileStatCard - Карточка статистики

```tsx
import { MobileStatCard } from '@/components/MobileAdaptive'
import { Users } from 'lucide-react'

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  <MobileStatCard
    title="Всего клиентов"
    value={150}
    icon={Users}
    subtitle="+12 за месяц"
    color="blue"
  />
</div>
```

#### MobileModal - Адаптивное модальное окно

```tsx
import { MobileModal, MobileButton } from '@/components/MobileAdaptive'

function Page() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <MobileModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="Добавить клиента"
      footer={
        <div className="flex gap-2">
          <MobileButton
            variant="secondary"
            fullWidth
            onClick={() => setIsOpen(false)}
          >
            Отмена
          </MobileButton>
          <MobileButton variant="primary" fullWidth onClick={handleSave}>
            Сохранить
          </MobileButton>
        </div>
      }
    >
      {/* Контент модального окна */}
      <form>...</form>
    </MobileModal>
  )
}
```

#### MobileSearchInput - Поисковый input

```tsx
import { MobileSearchInput } from '@/components/MobileAdaptive'

const [search, setSearch] = useState('')

<MobileSearchInput
  value={search}
  onChange={setSearch}
  placeholder="Поиск клиентов..."
  onClear={() => setSearch('')}
/>
```

#### MobileTabs - Вкладки

```tsx
import { MobileTabs } from '@/components/MobileAdaptive'

const [activeTab, setActiveTab] = useState('all')

<MobileTabs
  tabs={[
    { id: 'all', label: 'Все', count: 50 },
    { id: 'active', label: 'Активные', count: 35 },
    { id: 'archived', label: 'Архив', count: 15 },
  ]}
  activeTab={activeTab}
  onChange={setActiveTab}
/>
```

#### MobileBadge - Бейдж

```tsx
import { MobileBadge } from '@/components/MobileAdaptive'

<MobileBadge variant="success" size="md">
  Активен
</MobileBadge>
```

---

## 🎨 CSS классы для мобильной адаптации

### Touch-friendly кнопки

```tsx
// Базовая кнопка (минимум 44x44px)
<button className="btn-touch bg-primary text-white">
  Нажми меня
</button>

// Маленькая кнопка (36x36px)
<button className="btn-touch-sm bg-secondary">
  Маленькая
</button>

// Большая кнопка (52x52px)
<button className="btn-touch-lg bg-success text-white">
  Большая
</button>
```

### Адаптивные карточки

```tsx
// Базовая карточка
<div className="card-mobile">
  Контент
</div>

// Карточка с hover эффектом
<div className="card-mobile-hover">
  Кликабельная карточка
</div>
```

### Адаптивные input поля

```tsx
<input
  type="text"
  className="input-mobile"
  placeholder="Введите текст"
/>
```

### Адаптивные заголовки

```tsx
<h1 className="heading-mobile-1">Главный заголовок</h1>
<h2 className="heading-mobile-2">Подзаголовок</h2>
<h3 className="heading-mobile-3">Заголовок секции</h3>
```

### Адаптивный текст

```tsx
<p className="text-mobile-sm">Маленький текст</p>
<p className="text-mobile-base">Обычный текст</p>
<p className="text-mobile-lg">Большой текст</p>
```

### Container с адаптивными отступами

```tsx
<div className="container-mobile">
  {/* px-4 py-4 на mobile, px-6 py-6 на tablet, px-8 py-8 на desktop */}
</div>
```

### Адаптивная сетка

```tsx
// Стандартная сетка (1 col на mobile, 2 на tablet, 3 на desktop)
<div className="grid-mobile">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>

// Сетка для статистики (1-2-4 колонки)
<div className="grid-mobile-stats">
  <div>Stat 1</div>
  <div>Stat 2</div>
  <div>Stat 3</div>
  <div>Stat 4</div>
</div>
```

### Скрытие элементов

```tsx
// Скрыть таблицу на мобильных
<div className="table-mobile-hide">
  <table>...</table>
</div>

// Показать карточки только на мобильных
<div className="table-mobile-show">
  <div className="card">...</div>
</div>
```

### Floating Action Button

```tsx
<button className="fab-mobile bg-primary text-white">
  <Plus className="w-6 h-6" />
</button>
```

### Safe Area (для iPhone с notch)

```tsx
<div className="safe-top safe-bottom">
  Контент с учетом safe area
</div>
```

### Truncate текст

```tsx
<p className="line-clamp-2">
  Длинный текст, который обрежется после 2 строк...
</p>

<p className="line-clamp-3">
  Длинный текст, который обрежется после 3 строк...
</p>
```

### Touch feedback

```tsx
<button className="touch-feedback bg-primary">
  Кнопка с анимацией при нажатии
</button>

<div className="touch-feedback-sm cursor-pointer">
  Карточка с легкой анимацией
</div>
```

---

## 🔧 Примеры рефакторинга существующих страниц

### До (обычная таблица):

```tsx
function Customers() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Клиенты</h1>
      
      <table className="min-w-full">
        <thead>
          <tr>
            <th>Имя</th>
            <th>Телефон</th>
            <th>Email</th>
          </tr>
        </thead>
        <tbody>
          {customers.map(c => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.phone}</td>
              <td>{c.email}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

### После (мобильная адаптация):

```tsx
import { MobileContainer, MobilePageTitle } from '@/components/MobileAdaptive'
import { MobileTable } from '@/components/MobileTable'

function Customers() {
  const columns = [
    {
      key: 'name',
      header: 'Имя',
      render: (c) => <span className="font-medium">{c.name}</span>,
    },
    {
      key: 'phone',
      header: 'Телефон',
      render: (c) => c.phone,
    },
    {
      key: 'email',
      header: 'Email',
      hideOnMobile: true, // Скрываем email на мобильных
      render: (c) => c.email,
    },
  ]

  return (
    <MobileContainer>
      <MobilePageTitle 
        title="Клиенты"
        action={
          <MobileButton icon={Plus} onClick={handleAdd}>
            Добавить
          </MobileButton>
        }
      />
      
      <MobileTable
        data={customers}
        columns={columns}
        keyExtractor={(c) => c.id}
        onRowClick={(c) => navigate(`/customers/${c.id}`)}
      />
    </MobileContainer>
  )
}
```

---

## 📏 Размеры экранов (Tailwind breakpoints)

- **sm:** 640px (большие телефоны, portrait планшеты)
- **md:** 768px (планшеты)
- **lg:** 1024px (маленькие ноутбуки)
- **xl:** 1280px (desktop)
- **2xl:** 1536px (большие экраны)

---

## ✅ Чек-лист мобильной адаптации

### Общее
- [ ] Все touch targets минимум 44x44px
- [ ] Отступы адаптивные (меньше на mobile)
- [ ] Текст читаемый (минимум 16px base size)
- [ ] Нет горизонтального скролла

### Таблицы
- [ ] Заменены на MobileTable или карточки на мобильных
- [ ] Важные колонки видны всегда
- [ ] Второстепенные скрыты на мобильных

### Формы
- [ ] Input поля на всю ширину на мобильных
- [ ] Большие кнопки отправки
- [ ] Удобный выбор дат (DatePicker вместо input type="date")
- [ ] SearchSelect для больших списков

### Модальные окна
- [ ] Занимают всю ширину на мобильных
- [ ] Открываются снизу (sheet-style)
- [ ] Легко закрыть свайпом вниз

### Навигация
- [ ] Меню адаптивное (hamburger на мобильных)
- [ ] Breadcrumbs сокращены или скрыты
- [ ] Bottom navigation для мобильных

### Производительность
- [ ] Lazy loading изображений
- [ ] Виртуализация длинных списков
- [ ] Debounce для поиска
- [ ] Пагинация вместо "показать все"

---

## 🎯 Где использовать мобильные компоненты

### Обязательно заменить:
1. **Все таблицы** → `MobileTable`
2. **Все модальные окна** → `MobileModal`
3. **Заголовки страниц** → `MobilePageTitle`
4. **Кнопки действий** → `MobileButton`
5. **Поиск** → `MobileSearchInput`
6. **Карточки статистики** → `MobileStatCard`

### Рекомендуется:
7. **Вкладки** → `MobileTabs`
8. **Контейнеры страниц** → `MobileContainer`
9. **Бейджи** → `MobileBadge`

---

## 🚀 Быстрый старт

1. Импортируйте нужный компонент:
```tsx
import { MobileTable } from '@/components/MobileTable'
```

2. Используйте готовые CSS классы:
```tsx
<div className="container-mobile">
  <h1 className="heading-mobile-1">Заголовок</h1>
  <button className="btn-touch bg-primary text-white">
    Кнопка
  </button>
</div>
```

3. Проверьте в DevTools на разных экранах:
- Mobile: 375px (iPhone)
- Tablet: 768px (iPad)
- Desktop: 1440px

---

Все компоненты протестированы и готовы к использованию! 🎉
