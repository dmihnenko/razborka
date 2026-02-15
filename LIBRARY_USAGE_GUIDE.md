# Руководство по использованию новых библиотек

Установленные библиотеки:
- @tanstack/react-table
- react-day-picker
- jspdf + jspdf-autotable
- react-select
- fuse.js
- react-photo-view

## 1. DataTable (TanStack Table)

### Базовое использование

```tsx
import { DataTable } from '@/components/DataTable'
import { ColumnDef } from '@tanstack/react-table'

// Определяем колонки
const columns: ColumnDef<Customer>[] = [
  {
    accessorKey: 'name',
    header: 'Имя',
  },
  {
    accessorKey: 'phone',
    header: 'Телефон',
  },
  {
    accessorKey: 'email',
    header: 'Email',
  },
  {
    id: 'actions',
    header: 'Действия',
    cell: ({ row }) => (
      <button onClick={() => handleEdit(row.original)}>
        Редактировать
      </button>
    ),
  },
]

// Используем в компоненте
function CustomersPage() {
  const { data: customers } = useQuery({ ... })

  return (
    <DataTable
      data={customers || []}
      columns={columns}
      searchPlaceholder="Поиск клиентов..."
      pageSize={20}
    />
  )
}
```

### Особенности:
- ✅ Автоматическая пагинация
- ✅ Сортировка по клику на заголовок
- ✅ Глобальный поиск
- ✅ Показ "Найдено X из Y"
- ✅ Выбор количества строк на странице

---

## 2. DatePicker (react-day-picker)

### Одиночная дата

```tsx
import { DatePicker } from '@/components/DatePicker'

function AppointmentForm() {
  const [selectedDate, setSelectedDate] = useState<Date>()

  return (
    <DatePicker
      selected={selectedDate}
      onSelect={setSelectedDate}
      placeholder="Выберите дату"
      minDate={new Date()} // Только будущие даты
    />
  )
}
```

### Диапазон дат

```tsx
import { DateRangePicker } from '@/components/DatePicker'

function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>()

  return (
    <DateRangePicker
      selected={dateRange}
      onSelect={setDateRange}
      placeholder="Выберите период"
    />
  )
}
```

### Особенности:
- ✅ Русская локализация
- ✅ Блокировка прошлых/будущих дат
- ✅ Диапазоны дат для отчетов
- ✅ Клик вне области закрывает календарь

---

## 3. PDF Utils

### Генерация счета

```tsx
import { pdfUtils } from '@/utils/pdfUtils'

function generateInvoice(appointment) {
  const doc = pdfUtils.generateInvoice({
    number: appointment.request_number,
    date: new Date(appointment.completed_at),
    customerName: appointment.customers.name,
    customerPhone: appointment.customers.phone,
    vehicleBrand: appointment.vehicles.brand,
    vehicleModel: appointment.vehicles.model,
    licensePlate: appointment.vehicles.license_plate,
    vin: appointment.vehicles.vin,
    services: appointment.services.map(s => ({
      name: s.name,
      price: s.price,
      quantity: 1
    })),
    parts: appointment.parts.map(p => ({
      name: p.description,
      price: p.store_cost,
      quantity: p.quantity
    })),
    workTotal: appointment.work_cost || 0,
    partsTotal: appointment.parts_cost || 0,
    total: (appointment.work_cost || 0) + (appointment.parts_cost || 0)
  }, 'СТО "Ваше название"')

  // Скачать PDF
  pdfUtils.savePDF(doc, `invoice-${appointment.request_number}.pdf`)

  // Или открыть в новой вкладке
  // pdfUtils.openPDF(doc)
}
```

### Генерация заказ-наряда

```tsx
function generateWorkOrder(appointment) {
  const doc = pdfUtils.generateWorkOrder({
    requestNumber: appointment.request_number,
    date: new Date(appointment.scheduled_date),
    customerName: appointment.customers.name,
    customerPhone: appointment.customers.phone,
    vehicleInfo: `${appointment.vehicles.brand} ${appointment.vehicles.model} (${appointment.vehicles.license_plate})`,
    description: appointment.description,
    assignedTo: appointment.assigned_to_profile?.full_name,
    status: appointment.status,
    notes: appointment.notes
  }, 'СТО "Ваше название"')

  pdfUtils.savePDF(doc, `work-order-${appointment.request_number}.pdf`)
}
```

### Использование в кнопках

```tsx
<button
  onClick={() => generateInvoice(appointment)}
  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg"
>
  <FileText size={18} />
  Скачать счет
</button>

<button
  onClick={() => generateWorkOrder(appointment)}
  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg"
>
  <Download size={18} />
  Заказ-наряд
</button>
```

---

## 4. SearchSelect (react-select)

### Выбор клиента с поиском

```tsx
import { SearchSelect } from '@/components/SearchSelect'

function AppointmentForm() {
  const { data: customers } = useQuery({ ... })
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  const customerOptions = customers?.map(c => ({
    value: c.id,
    label: `${c.name} (${c.phone})`
  })) || []

  return (
    <SearchSelect
      options={customerOptions}
      value={selectedCustomer}
      onChange={setSelectedCustomer}
      placeholder="Выберите клиента..."
      isClearable
    />
  )
}
```

### Мультиселект (выбор нескольких услуг)

```tsx
import { MultiSearchSelect } from '@/components/SearchSelect'

function AppointmentForm() {
  const { data: services } = useQuery({ ... })
  const [selectedServices, setSelectedServices] = useState([])

  const serviceOptions = services?.map(s => ({
    value: s.id,
    label: `${s.name} - ${s.price} грн`
  })) || []

  return (
    <MultiSearchSelect
      options={serviceOptions}
      value={selectedServices}
      onChange={setSelectedServices}
      placeholder="Выберите услуги..."
    />
  )
}
```

---

## 5. Fuzzy Search (fuse.js)

### Использование хука

```tsx
import { useFuzzySearch } from '@/utils/fuzzySearch'

function CustomersPage() {
  const { data: customers } = useQuery({ ... })
  const [searchQuery, setSearchQuery] = useState('')

  const filteredCustomers = useFuzzySearch(
    customers || [],
    searchQuery,
    {
      keys: ['name', 'phone', 'email'], // Поля для поиска
      threshold: 0.3 // 0.0 = точное совпадение, 1.0 = любое
    }
  )

  return (
    <>
      <input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Поиск..."
      />
      {filteredCustomers.map(customer => (...))}
    </>
  )
}
```

### Примеры нечеткого поиска:

Запрос: "Иван" → найдет "Іван", "Ivahn", "Иаан"
Запрос: "068" → найдет "0681234567", "+380681234567"
Запрос: "passat" → найдет "Volkswagen Passat"

---

## 6. PhotoGallery (react-photo-view)

### Галерея фото

```tsx
import { PhotoGallery } from '@/components/PhotoGallery'

function VehiclePhotos({ vehicleId }) {
  const photos = [
    { src: '/uploads/car1.jpg', alt: 'Фото 1', caption: 'Вид спереди' },
    { src: '/uploads/car2.jpg', alt: 'Фото 2', caption: 'Вид сзади' },
  ]

  return <PhotoGallery photos={photos} />
}
```

### Список фото с действиями

```tsx
import { PhotoList } from '@/components/PhotoGallery'

function VehiclePhotosList({ photos }) {
  const handleDownload = (photo) => {
    const link = document.createElement('a')
    link.href = photo.src
    link.download = photo.alt || 'photo.jpg'
    link.click()
  }

  const handleDelete = async (photo, index) => {
    if (confirm('Удалить фото?')) {
      await deletePhoto(photo)
    }
  }

  return (
    <PhotoList
      photos={photos}
      onDownload={handleDownload}
      onDelete={handleDelete}
    />
  )
}
```

### Одиночное фото с превью

```tsx
import { SinglePhotoView } from '@/components/PhotoGallery'

function Avatar({ photoUrl }) {
  return (
    <SinglePhotoView
      src={photoUrl}
      alt="Фото профиля"
      thumbnailClassName="w-32 h-32 rounded-full object-cover"
    />
  )
}
```

---

## Где использовать эти библиотеки в вашем проекте:

### DataTable:
- `Appointments.tsx` - список заявок с пагинацией
- `Customers.tsx` - список клиентов
- `Services.tsx` - список услуг
- `Parts.tsx` - список запчастей

### DatePicker:
- `AppointmentModal.tsx` - выбор даты записи
- `Analytics.tsx` - фильтр по периоду
- `MonthlyStatistics.tsx` - выбор месяца

### PDF Utils:
- `AppointmentDetails.tsx` - кнопка "Скачать счет"
- `WorkOrders.tsx` - генерация заказ-нарядов

### SearchSelect:
- `AppointmentModal.tsx` - выбор клиента, автомобиля
- `WorkOrderModal.tsx` - выбор услуг

### Fuzzy Search:
- Все страницы со списками (вместо `.includes()`)

### PhotoGallery:
- `MyVehicles.tsx` - фото личных авто
- `VehicleDetails.tsx` - фото авто клиентов
- `PublicPersonalVehicleView.tsx` - публичный просмотр фото

---

## Следующие шаги:

1. Добавьте кнопку "Скачать PDF" в `AppointmentDetails.tsx`
2. Замените `<input type="date">` на `<DatePicker>` в формах
3. Замените обычные таблицы на `<DataTable>` в списках
4. Используйте `useFuzzySearch` вместо `.filter().includes()`
5. Добавьте галерею фото в карточки автомобилей
