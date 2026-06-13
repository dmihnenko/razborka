Findings confirmed against real files. The plan below cites verified line ranges, file paths, and kit tokens.

# План оптимизации интерфейса кабинета авторазборки

## Суть

Два аудита сходятся на одном: интерфейс перегружен **дублями** (клиент показан дважды в заказе, «Управление» дублирует нижнее меню, две «Telegram» в настройках) и **этажностью** (отдельная card на каждое поле, kicker над каждым контактом, тройной стек баннеров на дашборде). Упрощаем по трём осям: (1) свести разрозненные настройки в один раздел «Интеграции» с прогрессивным раскрытием; (2) убрать дубли и схлопнуть пустые секции на 7 экранах `/parts/*`; (3) заменить полноразмерные блоки на компактные pill/chip-тулбары. Ожидаемая экономия — 25–35% вертикали на мобиле плюс снятие визуальной путаницы.

---

## Настройки — раздел «Интеграции»

`PartsSettings.tsx` (702 строки, `grid grid-cols-1 lg:grid-cols-2` на стр. 158): левая колонка несёт 6 блоков, правая — 2. Цель — симметрия и группировка по смыслу настройки, а не по типу виджета.

### Что объединяем в «Интеграции»

Три отдельных card → один card «Интеграции» с под-блоками через `panel-divided`, каждая секция раскрывается нативным `<details>`/`<summary>` (без JS-состояния, без новых зависимостей):

- **ImgBB** (сейчас стр. 336–378) — поле ключа.
- **Новая почта** (сейчас стр. 380–507) — поле ключа + блок отправителя (~6 полей), отправитель остаётся под `hidden` пока ключ пуст (логика уже есть — убираем только обёртку-card).
- **Telegram-уведомления** (сейчас стр. 260–299) — `telegram_chat_id` через deep-link бота. Переезжает сюда из левой колонки.

Каждая секция = строка-заголовок `icon-tile-sm` + название + статус-`badge-green`«Подключено» / `badge-gray`«Не задан», тело под `<summary>`. Токены: `panel-divided`, `icon-tile-sm`, `badge-green`/`badge-gray`, `kicker`, `btn-ghost btn-sm`.

### Разграничение двух «Telegram»

В «Контактах» поле `contacts.telegram` (стр. 222–229) — публичный @username для маркета, его легко спутать с уведомлениями.
- Переименовать label в «Telegram-ссылка (для маркета)» + подсказка `text-xs text-gray-400 mt-1` «Ссылка на канал или чат — видна покупателям».
- Сам блок уведомлений уезжает в «Интеграции» → визуальное соседство разорвано.

### Эскиз новой структуры настроек (одна колонка `max-w-2xl mx-auto`, либо 2×2 на lg)

1. **Контакты разборки** — name, phone, city, адрес, **Telegram-ссылка (для маркета)**.
2. **Финансы — курс доллара** (компактный, см. ниже).
3. **Интеграции** (аккордеон): ImgBB · Новая почта · Telegram-уведомления.
4. **Разделы** (навигатор `panel-divided`): Категории · Места хранения · Корзина.
5. *(опц.)* **Опасная зона** — если есть деструктивные действия, вынести вниз отдельным card с `border-red`.

### Компактный курс доллара

Сейчас card «Курс доллара» (стр. 529–628, ~85 строк) занимает почти всю правую колонку, на мобиле падает в самый низ.
- Убрать разделитель «или установить вручную» → две chip-кнопки «ПриватБанк» / «Вручную» (токен `chip` есть).
- Алерт «Как работает курс» свернуть в `<details><summary className="text-xs text-primary cursor-pointer">Как работает курс?</summary>`.
- Перенести в левую/единую колонку под «Контакты». Правая колонка исчезает → `grid-cols-1 max-w-2xl mx-auto`. Экономия ~40 строк JSX и ~120px.

### Навигатор «Разделы» + компонент NavRow

«Каталог» (стр. 302–334) и «Корзина» (стр. 509–524) — две card `!p-0` одинакового типа, разорванные блоком НП. Свести в один card `!p-0 overflow-hidden` с `panel-divided` из трёх строк (Категории / Места хранения / Корзина). Вынести повторяющуюся разметку в `NavRow` (`icon-tile-sm` + label + sublabel + `ChevronRight`) — сейчас она трижды дублирована. Итог: −1 card, ~−30 строк.

### Консолидация localStorage-утилит

Подтверждено: `imgbbKey.ts` хранит под `parts_imgbb_api_key`, `npApiKey.ts` — под `tsp_np_api_key` (разнобой префиксов), плюс `npConfig.ts` — три файла одного паттерна, три импорта (стр. 10–12).
- Создать `src/utils/integrationKeys.ts` (~35 строк): `getImgbbKey/setImgbbKey`, `getNpApiKey/setNpApiKey`, `getNpConfig/setNpConfig`.
- Старые три файла → реэкспорт из нового (обратная совместимость).
- Унифицировать префикс: `tsp_imgbb_api_key` с однократной миграцией при первом чтении (`localStorage.getItem('parts_imgbb_api_key')` → перенос).

---

## Упрощение экранов

### PartsDashboard
- **Убрать блок «Управление»** (5 кнопок nav, ~120px) — полный дубль нижнего меню. Освободившееся место отдать виджету «Последние заказы» (сейчас только на lg в правой колонке). 1–2 быстрых действия (Аналитика, Склад) можно оставить как `text-link` рядом с заголовком Inventory breakdown. **[S, high]**
- **Свернуть онбординг по умолчанию** (`collapsed=true`) и слить `ContactsReminder` + `OnboardingChecklist` в одну compact-плашку: иконка + «Настройте 3 пункта» + прогресс-бар. Из upsell-баннера и alert о новых заказах «острым» оставить только один (приоритет — alert о заказах). **[M, high]**

### PartsOrderDetails
- **Убрать дубль клиента**: снять hero-секцию клиента (dl ФИО/телефон/город/НП), оставить только форму «Клиент и доставка» (те же поля + редактирование). При read-only — форма в режиме `disabled`. −1 card, ~−120px. **[M, high]**
- **Card «Статус заказа» → в sticky-шапку**: кнопки «Новый / В работе / Отменить» перенести справа от бейджа статуса (бейдж уже в шапке) или в bottom action bar к «Завершить заказ». Удалить отдельную card, ~−80px. **[M, medium]**

### PartsInventory
- **stat-карточки → pill-toolbar**: 5 stat-card (Всего/В наличии/Зарезервировано/Продано/Стоимость, ~240px на мобиле) заменить горизонтальным scroll из кликабельных `chip`-фильтров «В наличии (34) · Зарезервировано (5) · Продано (12)». Стоимость — в заголовок рядом с «Всего». Высота с ~240px до ~44px. **[M, high]**

### PartsInventoryItemPage
- **Схлопнуть 6 border-секций** (Характеристики, Окупаемость, Снята с авто, Расположение, Описание, Заметки): «Характеристики» + «Расположение» → одна `dl` (location строкой рядом с категорией); «Описание» + «Заметки» → один блок; «Окупаемость» → одна строка «Маржа: +$X (+Y%)» с раскрытием по клику. Убирает 2–3 пустых секции whitespace. **[M, medium]**

### PartsCreateOrder
- **Две card + info-alert → одна card**: страница `/parts/orders/create` держит «Информация о клиенте» + «Дополнительная информация» + info-alert «Что дальше?» ради одного select и одного textarea. Свести в один card без под-заголовков (label достаточно), info-alert убрать (смысл очевиден по кнопке «Создать заказ»). ~−300px. **[S, medium]**

### PartsVehicleDetails
- **Слить «Окупаемость» + «Статистика»** в сайдбаре в одну карточку «Окупаемость»: вверху 3 мини-плитки (Всего/Продано/В наличии), ниже строки Покупка/Доход/Итого. «Продано» прямо влияет на «Доход» — разделять незачем. −1 card, ~−100px. **[S, medium]**

### PartsCustomerProfile
- **Убрать kicker-подписи в контактах** hero-карточки: `icon-tile` + значение рядом достаточно (паттерн как в других карточках клиентов). Статистику — в inline-строку «12 заказов · 45 000 ₴ · ср. 3 750 ₴» вместо 3 dl-блоков с kicker. ~−80px. **[S, medium]**

---

## Быстрые победы (S)

| Победа | Эффект |
|---|---|
| Убрать блок «Управление» на дашборде | −120px, снят дубль нижнего меню **(high)** |
| PartsCreateOrder: 2 card + alert → 1 card | −300px на форме из 2 полей |
| Слить «Окупаемость»+«Статистика» в VehicleDetails | −1 card, −100px в сайдбаре |
| Убрать kicker-подписи контактов в CustomerProfile | −80px, чище hero |
| Навигатор «Разделы» + компонент NavRow в настройках | −1 card, −30 строк дублей JSX |
| Переименовать label Telegram в «Контактах» + подсказка | снимает путаницу двух «Telegram» |
| Консолидация 3 localStorage-утилит в `integrationKeys.ts` | −2 файла, единый префикс `tsp_*` |

---

## Этапы

**Этап 1 — Настройки/Интеграции (фундамент).**
`integrationKeys.ts` (консолидация) → раздел «Интеграции» (аккордеон ImgBB+НП+Telegram) → разграничение двух «Telegram» → компактный курс → `NavRow` + «Разделы» → переход на одну колонку `max-w-2xl`. Закрывает находки настроек 1–6 и оба аудита по `PartsSettings`.

**Этап 2 — Высокоэффективные дубли на экранах (S+high).**
Убрать «Управление» на дашборде; PartsCreateOrder в одну card; убрать дубль клиента в PartsOrderDetails.

**Этап 3 — Плотность списков и карточек (M).**
PartsInventory pill-toolbar; PartsInventoryItemPage схлопывание секций; «Статус заказа» в sticky-шапку; компакт онбординга на дашборде.

**Этап 4 — Полировка (S).**
VehicleDetails слияние карточек; CustomerProfile inline-статистика и снятие kicker.

---

## Меню выбора

| # | Пункт | Файл | Эффект | Эффорт |
|---|---|---|---|---|
| 1 | Раздел «Интеграции» (ImgBB+НП+Telegram, аккордеон `<details>`) | PartsSettings.tsx | −3 card, прогрессивное раскрытие **(high)** | M |
| 2 | Разграничить два «Telegram» (label+подсказка) | PartsSettings.tsx | снята путаница **(medium)** | S |
| 3 | Компактный виджет курса (chip + `<details>`) | PartsSettings.tsx | −40 строк, −120px **(medium)** | M |
| 4 | Навигатор «Разделы» + `NavRow` | PartsSettings.tsx | −1 card, −30 строк **(medium)** | S |
| 5 | Консолидация localStorage → `integrationKeys.ts` | utils/* | −2 файла, единый префикс **(low)** | S |
| 6 | Одна колонка `max-w-2xl` вместо асимметричного grid | PartsSettings.tsx | −~50% высоты на мобиле **(high)** | S |
| 7 | Убрать блок «Управление» | PartsDashboard.tsx | −120px, снят дубль **(high)** | S |
| 8 | Компакт онбординга (collapsed + merge с ContactsReminder) | PartsDashboard.tsx | −до 360px, 4 блока → 1 **(high)** | M |
| 9 | Убрать дубль клиента (только форма) | PartsOrderDetails.tsx | −1 card, −120px **(high)** | M |
| 10 | «Статус заказа» в sticky-шапку | PartsOrderDetails.tsx | −80px **(medium)** | M |
| 11 | stat-карточки → pill-toolbar из chip-фильтров | PartsInventory.tsx | −240px → −44px **(high)** | M |
| 12 | Схлопнуть 6 border-секций в 3 | PartsInventoryItemPage.tsx | убран whitespace **(medium)** | M |
| 13 | 2 card + alert → 1 card | PartsCreateOrder.tsx | −300px **(medium)** | S |
| 14 | Слить «Окупаемость»+«Статистика» | PartsVehicleDetails.tsx | −1 card, −100px **(medium)** | S |
| 15 | Убрать kicker контактов + inline-статистика | PartsCustomerProfile.tsx | −80px **(medium)** | S |

Файлы для работы (абсолютные пути):
- `c:\Users\home\Documents\project\tsp\src\pages\PartsSettings.tsx`
- `c:\Users\home\Documents\project\tsp\src\pages\PartsDashboard.tsx`
- `c:\Users\home\Documents\project\tsp\src\pages\PartsOrderDetails.tsx`
- `c:\Users\home\Documents\project\tsp\src\pages\PartsInventory.tsx`
- `c:\Users\home\Documents\project\tsp\src\pages\PartsInventoryItemPage.tsx`
- `c:\Users\home\Documents\project\tsp\src\pages\PartsCreateOrder.tsx`
- `c:\Users\home\Documents\project\tsp\src\pages\PartsVehicleDetails.tsx`
- `c:\Users\home\Documents\project\tsp\src\pages\PartsCustomerProfile.tsx`
- `c:\Users\home\Documents\project\tsp\src\utils\imgbbKey.ts`, `npApiKey.ts`, `npConfig.ts` → новый `c:\Users\home\Documents\project\tsp\src\utils\integrationKeys.ts`