# Кабинет клиента разборок («Мои заказы») — план реализации

Цель: пользователь (роль `user`, кабинет «Мои авто») видит и отслеживает СВОИ заказы, оформленные на маркете у разборок. Покупка — через существующий каталог маркета. Сторона разборки — уже есть («Заявки с маркета» в кабинете разборки).

## ✅ DB (сделано, применено к проду — `2026-06-26_client_orders.sql`)
- `marketplace_orders.user_id uuid` (FK auth.users, on delete set null) + индекс.
- RPC `submit_marketplace_order` проставляет `user_id := auth.uid()` (гость → null, залогиненный → его id). Остальное без изменений.
- RLS: `market_orders_select_own` (`user_id = auth.uid()`) и `market_order_items_select_own` (позиции своих заказов) — покупатель читает свои заказы.

## Фронтенд (осталось)
**Стиль:** подсистема «Мои авто» — НЕ Ink & Signal ядра. Эталоны: `src/pages/MyVehicles.tsx` (каркас/карточки подсистемы) и `src/pages/PublicPartsCustomerView.tsx` (рендер заказов клиента — статусы, позиции, суммы — переиспользовать паттерн).

1. **Сервис** (`src/services/marketplaceService.ts` или новый): `getMyMarketplaceOrders()` — select из `marketplace_orders` (RLS отдаёт только свои), embed `marketplace_order_items(*)` + `parts_companies(name, phone, telegram, city)`; сортировка `created_at desc`. Тип: `{id, status, total_amount, created_at, comment, company:{name,phone,telegram,city}, items:[{name, selling_price, price_currency, quantity, photo_url}]}`.
2. **Хук** `useMyOrders()` — react-query (`['my-orders', userId]`).
3. **Страница** `src/pages/MyOrders.tsx`: список заказов. Карточка: статус-бейдж, разборка (имя + контакты tel/telegram), позиции (фото+название+кол-во+цена), итог (мульти-валюта), дата, комментарий. Раскрытие деталей или detail-вид. Состояния loading(скелетон)/пусто(`EmptyState` + ссылка в каталог)/ошибка.
4. **Роут** `/my-orders` в `src/App.tsx` — внутри `ProtectedRoute`+`Layout` блока (рядом с `/my-vehicles`).
5. **Навигация** `src/config/navigation.ts`: пункт «Мои заказы» → `/my-orders`, иконка `Package`/`ShoppingBag` (lucide), в user-контексте рядом с «Мои авто» (desktop + mobile записи).
6. **Каркас** `src/components/Layout.tsx`: контекст `/my-orders` отнести к user-разделу (как `/my-vehicles`, ~стр.172-187) — хлебная крошка/заголовок «Мои заказы» (Layout map `nav.myOrders`).
7. **i18n** ru/uk: ключи навигации `nav.myOrders`, заголовки/статусы страницы. Статусы заказа маркета — проверить значения (new/…); переиспользовать существующие где есть, добавить недостающие (паритет ru/uk).

«Прочий функционал» (MVP+): детали заказа, контакты разборки (позвонить/Telegram), повтор/ссылка в каталог. Дальше по желанию: отмена заявки, уведомления.

## Проверка
build:check + lint + i18n-паритет зелёные. После деплоя: залогиниться, оформить заказ на маркете → он появляется в «Мои заказы»; гостевой заказ (без входа) туда не попадает; чужие заказы не видны (RLS).
