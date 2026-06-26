// ============================================================================
// Types для публичного маркетплейса запчастей (/market)
// ============================================================================

export type MarketCondition = 'new' | 'used' | 'damaged'
export type MarketCurrency = 'UAH' | 'USD'
export type MarketSort = 'new' | 'price_asc' | 'price_desc'
export type MarketplaceOrderStatus = 'new' | 'viewed' | 'closed'

/** Фото из jsonb-колонки parts_inventory.photos (imgbb) */
export interface MarketPhoto {
  url: string
  thumb_url?: string
  display_url?: string
  medium_url?: string
}

/** Контакты продавца (разборки) — публичные поля parts_companies */
export interface MarketCompanyContact {
  id: string
  name: string
  phone?: string | null
  telegram?: string | null
  address?: string | null
  city?: string | null
  email?: string | null
  description?: string | null
  /** Скорость отправки: 'today' — сегодня · 'days12' — 1–2 дня */
  shipSpeed?: 'today' | 'days12' | string | null
  /** Гарантия включена продавцом */
  warrantyEnabled?: boolean
  /** Дней гарантии (если включена) */
  warrantyDays?: number | null
}

export interface MarketPartVehicle {
  make: string
  model: string
  year?: number | null
}

/** Публичная карточка запчасти (только безопасные поля) */
export interface MarketPart {
  id: string
  name: string
  /** Внутренний артикул (SKU) разборки — для поиска сотрудниками */
  article?: string | null
  partNumber?: string | null
  description?: string | null
  condition: MarketCondition | string
  quantity: number
  sellingPrice: number
  priceCurrency: MarketCurrency
  /** Первое фото для карточки (photo_url либо photos[0]) */
  photoUrl?: string | null
  /** Полный массив фото для галереи */
  photos?: MarketPhoto[]
  categoryName?: string | null
  vehicle?: MarketPartVehicle | null
  company: MarketCompanyContact
}

/** Разборка в публичном списке поставщиков */
export interface MarketSupplier {
  id: string
  name: string
  phone?: string | null
  telegram?: string | null
  address?: string | null
  city?: string | null
  email?: string | null
  description?: string | null
  /** Число доступных к продаже товаров */
  availableParts: number
}

export interface MarketCategory {
  id: string
  name: string
  count: number
}

/** Модель авто в дереве фасетов (доступные годы для каскада) */
export interface MarketModelFacet {
  model: string
  count: number
  years: number[]
}

/** Марка авто в дереве фасетов каталога (get_market_vehicle_facets) */
export interface MarketMakeFacet {
  make: string
  count: number
  models: MarketModelFacet[]
}

/** Позиция корзины (хранится в localStorage, ключ 'tsp_market_cart') */
export interface CartItem {
  inventoryId: string
  name: string
  sellingPrice: number
  priceCurrency: MarketCurrency
  photoUrl?: string | null
  quantity: number
  companyId: string
  companyName: string
  condition?: string
}

export interface MarketplaceOrderItem {
  id: string
  name: string
  sellingPrice?: number | null
  priceCurrency: MarketCurrency
  quantity: number
  photoUrl?: string | null
  /** Ссылка на позицию склада (для конвертации заявки в заказ) */
  inventoryId?: string | null
  /** Из какой машины снята (для удобной сборки заказа) */
  vehicleName?: string | null
  /** Где лежит на складе (место хранения) */
  storageName?: string | null
}

/** Заявка покупателя (marketplace_orders) — для кабинета разборки */
export interface MarketplaceOrder {
  id: string
  partsCompanyId: string
  buyerName?: string | null
  buyerPhone: string
  comment?: string | null
  status: MarketplaceOrderStatus
  totalAmount: number
  createdAt: string
  items: MarketplaceOrderItem[]
  /** id заказа разборки, созданного из этой заявки (null — ещё не оформлен) */
  convertedOrderId?: string | null
}

/** Позиция в заказе кабинета клиента (marketplace_order_items, минимум полей) */
export interface MyMarketplaceOrderItem {
  name: string
  sellingPrice?: number | null
  priceCurrency: MarketCurrency
  quantity: number
  photoUrl?: string | null
}

/** Контакты разборки, у которой оформлен заказ (безопасные поля parts_companies) */
export interface MyMarketplaceOrderCompany {
  name: string
  phone?: string | null
  telegram?: string | null
  city?: string | null
}

/** Заказ покупателя в его личном кабинете «Мои заказы» (RLS отдаёт только свои). */
export interface MyMarketplaceOrder {
  id: string
  status: MarketplaceOrderStatus
  totalAmount: number
  createdAt: string
  comment?: string | null
  company: MyMarketplaceOrderCompany | null
  items: MyMarketplaceOrderItem[]
}

/** Фильтры каталога */
export interface MarketFilters {
  search?: string
  categoryId?: string
  condition?: MarketCondition
  companyId?: string
  make?: string
  model?: string
  year?: number
  minPrice?: number
  maxPrice?: number
  sort?: MarketSort
  /** Страница, 1-based (по умолчанию 1) */
  page?: number
  /** Размер страницы (по умолчанию 24) */
  pageSize?: number
}
