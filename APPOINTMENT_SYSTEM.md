# Система створення записів на обслуживання

## Опис

Багатокрокова форма-візард для створення записів на обслуживання автомобілів з можливістю:
- Вибору або створення клієнта
- Вибору або додавання автомобіля клієнта
- Додавання списку робіт з ціною
- Додавання списку запчастин з кількістю та ціною
- Перегляду фінальної сводки з розрахунком вартості
- Збереження запису з автоматичним розрахунком підсумків

## Компоненти

### 1. AppointmentModal
Головний компонент-візард з 5 кроками:
- Крок 1: Вибір клієнта (ClientSelector)
- Крок 2: Вибір автомобіля (VehicleSelector)
- Крок 3: Додавання робіт (WorkItemsManager)
- Крок 4: Додавання запчастин (PartItemsManager)
- Крок 5: Фінальна сводка (AppointmentSummary)

### 2. ClientSelector
- Пошук серед існуючих клієнтів
- Сітка вибору з картками клієнтів
- Можливість inline створення нового клієнта

### 3. VehicleSelector
- Фільтрація автомобілів за вибраним клієнтом
- Валідація VIN (17 символів, A-HJ-NPR-Z0-9)
- Inline додавання нового автомобіля

### 4. WorkItemsManager
- CRUD для списку робіт
- Поля: назва, опис, ціна
- Автоматичний підрахунок загальної вартості робіт

### 5. PartItemsManager
- CRUD для списку запчастин
- Поля: назва, артикул, кількість, ціна, стан, постачальник
- Автоматичний підрахунок: totalPrice = quantity × price
- Загальна вартість запчастин

### 6. AppointmentSummary
- Відображення всієї зібраної інформації
- Розрахунок підсумків (роботи + запчастини)
- Вибір дати запису та статусу
- Поле для приміток

## Встановлення бази даних

### Крок 1: Запустити міграцію

Виконайте SQL скрипт `database/extend_appointments.sql` у Supabase SQL Editor:

1. Відкрийте Supabase Dashboard
2. Перейдіть до SQL Editor
3. Створіть новий запит
4. Скопіюйте весь вміст файлу `database/extend_appointments.sql`
5. Виконайте запит

Цей скрипт додасть до таблиці `appointments`:
- `sto_company_id` - зв'язок з СТО компанією
- `work_items` - JSONB масив робіт
- `part_items` - JSONB масив запчастин
- `total_work_cost` - загальна вартість робіт
- `total_parts_cost` - загальна вартість запчастин
- `total_cost` - загальна вартість
- `updated_at` - дата оновлення з тригером
- Оновить статуси: pending, confirmed, in_progress, completed, cancelled, paid
- Додасть RLS політики для багатокомпанійної моделі

## Використання

### В існуючій сторінці Appointments

Компонент вже інтегровано в `src/pages/Appointments.tsx`:

```tsx
<AppointmentModal
  isOpen={isModalOpen}
  onClose={() => {
    setIsModalOpen(false)
    setEditingAppointment(null)
  }}
  appointmentId={editingAppointment?.id}
  onSuccess={() => {
    setIsModalOpen(false)
    setEditingAppointment(null)
  }}
/>
```

Кнопка "Новая запись" відкриває модальне вікно з візардом.

## Структура даних

### WorkItem
```typescript
interface WorkItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  isPaid: boolean;
  paidAt?: string;
  notes?: string;
}
```

### PartItem
```typescript
interface PartItem {
  id: string;
  name: string;
  articleNumber?: string;
  quantity: number;
  price: number;
  totalPrice: number;
  condition?: 'new-original' | 'used-original' | 'aftermarket';
  isPaid: boolean;
  paidAt?: string;
  supplier?: string;
  notes?: string;
}
```

### AppointmentFormValues
```typescript
interface AppointmentFormValues {
  customer_id: string;
  vehicle_id: string;
  scheduledDate: string;
  status: AppointmentStatus;
  notes: string;
  workItems: WorkItem[];
  partItems: PartItem[];
  selectedClient?: any;
  selectedVehicle?: any;
}
```

### AppointmentStatus
```typescript
type AppointmentStatus = 
  | 'pending'      // ⏳ Ожидает
  | 'confirmed'    // ✅ Подтверждена
  | 'in_progress'  // 🔧 В работе
  | 'completed'    // ✔️ Завершена
  | 'cancelled'    // ❌ Отменена
  | 'paid';        // 💰 Оплачена
```

## Особливості реалізації

1. **Багатокроковий візард** - кожен крок валідується перед переходом далі
2. **Inline створення** - клієнтів та автомобілі можна створювати без закриття форми
3. **Автоматичні розрахунки** - вартість обчислюється автоматично при змінах
4. **VIN валідація** - перевірка формату VIN при додаванні автомобіля
5. **UUID для елементів** - кожна робота та запчастина має унікальний ID
6. **Багатокомпанійність** - записи прив'язані до sto_company_id
7. **RLS політики** - доступ тільки до записів своєї компанії
8. **Оптимістичні оновлення** - TanStack Query кешує та оновлює дані

## Файли

```
src/
├── types/
│   └── appointments.ts           # TypeScript типи
├── components/
│   └── appointments/
│       ├── AppointmentModal.tsx      # Головний візард
│       ├── ClientSelector.tsx        # Вибір клієнта
│       ├── VehicleSelector.tsx       # Вибір автомобіля
│       ├── WorkItemsManager.tsx      # Управління роботами
│       ├── PartItemsManager.tsx      # Управління запчастинами
│       └── AppointmentSummary.tsx    # Фінальна сводка
└── pages/
    └── Appointments.tsx          # Інтеграція модального вікна

database/
└── extend_appointments.sql       # SQL міграція
```

## Майбутні покращення

- [ ] Редагування існуючих записів
- [ ] Друк заявки на обслуживання
- [ ] Відправка SMS/Email нагадувань клієнту
- [ ] Історія зміни статусів
- [ ] Прикріплення фото/документів
- [ ] Розрахунок часу виконання робіт
- [ ] Календар для візуалізації записів
- [ ] Фільтри та пошук по записам
- [ ] Експорт в PDF/Excel
