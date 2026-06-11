import { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Car, ChevronRight, Copy, FileText, Package, ShoppingCart, Tag,
} from 'lucide-react'
import { toast } from 'sonner'
import { getMarketPart, getRelatedParts } from '@/services/marketplaceService'
import type { MarketPart } from '@/types/marketplace'
import { useCart } from '@/hooks/useCart'
import { formatPrice } from '@/utils/currency'
import { PARTS_CONDITION_LABELS } from '@/utils/status'
import { Spinner } from '@/components/ui/Spinner'
import PhotoGallery from '@/components/parts/PhotoGallery'
import type { ImgbbPhoto } from '@/services/imgbbService'
import { SellerContactCard } from '@/components/market/SellerContactCard'
import { MarketProductCard } from '@/components/market/MarketProductCard'

// ============================================================================
// Публичная карточка товара маркетплейса — /market/part/:id
// Рендерится внутри <MarketLayout /> (Outlet), CartProvider уже сверху.
// ============================================================================

const CONDITION_CLS: Record<string, string> = {
  new: 'bg-green-100 text-green-700 border-green-200',
  used: 'bg-blue-50 text-blue-700 border-blue-100',
  damaged: 'bg-red-50 text-red-700 border-red-100',
}

function conditionBadge(condition: string) {
  const label = PARTS_CONDITION_LABELS[condition] ?? condition
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${
        CONDITION_CLS[condition] ?? 'bg-gray-100 text-gray-600 border-gray-200'
      }`}
    >
      {label}
    </span>
  )
}

/** MarketPhoto (jsonb из БД) → ImgbbPhoto для готовой галереи */
function toGalleryPhotos(part: MarketPart): ImgbbPhoto[] {
  return (part.photos ?? [])
    .filter(p => p?.url || p?.display_url)
    .map(p => ({
      url: p.url || p.display_url || '',
      medium_url: p.medium_url || p.display_url,
      thumb_url: p.thumb_url || p.url || p.display_url || '',
      delete_url: '',
    }))
}

export default function MarketProductPage() {
  const { id } = useParams<{ id: string }>()
  const { addItem } = useCart()

  // При переходе между товарами (блок «Ещё от этой разборки») — наверх
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [id])

  const { data: part, isLoading } = useQuery({
    queryKey: ['market-part', id],
    queryFn: () => getMarketPart(id!),
    enabled: !!id,
    staleTime: 60_000,
  })

  const { data: related = [] } = useQuery({
    queryKey: ['market-related', part?.company.id, id],
    queryFn: () => getRelatedParts(part!.company.id, part!.id),
    enabled: !!part?.company.id,
    staleTime: 60_000,
  })

  const galleryPhotos = useMemo(
    () => (part ? toGalleryPhotos(part) : []),
    [part]
  )

  // ── Загрузка ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  // ── 404 ────────────────────────────────────────────────────────────────────
  if (!part) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 flex flex-col items-center gap-3 text-center">
        <Package className="w-14 h-14 text-gray-300" strokeWidth={1.5} />
        <p className="text-lg font-semibold text-gray-700">Товар не найден</p>
        <p className="text-sm text-gray-500">
          Возможно, запчасть уже продана или снята с публикации
        </p>
        <Link
          to="/market/catalog"
          className="mt-2 inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 active:scale-[0.98] transition-all"
        >
          Перейти в каталог
        </Link>
      </div>
    )
  }

  const photo =
    part.photoUrl || part.photos?.[0]?.thumb_url || part.photos?.[0]?.url || null

  const handleAddToCart = () => {
    addItem({
      inventoryId: part.id,
      name: part.name,
      sellingPrice: part.sellingPrice,
      priceCurrency: part.priceCurrency,
      photoUrl: photo,
      quantity: 1,
      companyId: part.company.id,
      companyName: part.company.name,
      condition: part.condition,
    })
    toast.success('Добавлено в корзину')
  }

  const copyPartNumber = () => {
    if (!part.partNumber) return
    navigator.clipboard.writeText(part.partNumber.toUpperCase())
    toast.success('Номер скопирован')
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6">

      {/* ── Хлебные крошки ─────────────────────────────────────────────── */}
      <nav aria-label="Хлебные крошки" className="mb-3 sm:mb-4">
        <ol className="flex items-center gap-1 text-xs sm:text-sm text-gray-500 min-w-0">
          <li>
            <Link to="/market" className="hover:text-primary transition-colors">
              Маркетплейс
            </Link>
          </li>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
          <li>
            <Link to="/market/catalog" className="hover:text-primary transition-colors">
              Каталог
            </Link>
          </li>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
          <li className="text-gray-700 font-medium truncate min-w-0" aria-current="page">
            {part.name}
          </li>
        </ol>
      </nav>

      {/* ── Основной grid: фото | sticky-инфо ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 lg:gap-5 items-start">

        {/* ЛЕВАЯ КОЛОНКА: галерея + описание */}
        <div className="space-y-3 min-w-0">
          {galleryPhotos.length > 0 ? (
            <PhotoGallery photos={galleryPhotos} alt={part.name} mainAspect="aspect-[4/3]" />
          ) : (
            <div className="bg-white rounded-xl shadow-sm aspect-[4/3] flex flex-col items-center justify-center gap-2 text-gray-300">
              <Package className="w-16 h-16" strokeWidth={1.5} />
              <span className="text-sm text-gray-400">Нет фото</span>
            </div>
          )}

          {part.description && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Описание
              </h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {part.description}
              </p>
            </div>
          )}
        </div>

        {/* ПРАВАЯ КОЛОНКА: sticky-инфо + продавец */}
        <div className="lg:sticky lg:top-4 space-y-3">

          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5">
            {/* Бейджи: состояние + категория */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {conditionBadge(part.condition)}
              {part.categoryName && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                  <Tag className="w-3 h-3" />
                  {part.categoryName}
                </span>
              )}
            </div>

            {/* Название */}
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight mb-1">
              {part.name}
            </h1>

            {/* Артикул (оригинальный номер) */}
            {part.partNumber && (
              <div className="mb-3 mt-2">
                <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-1">
                  Оригинальный номер
                </p>
                <button
                  type="button"
                  onClick={copyPartNumber}
                  title="Нажмите, чтобы скопировать"
                  className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border-2 border-primary/25 shadow-sm hover:border-primary/50 hover:shadow-md active:scale-95 transition-all"
                >
                  <span className="font-mono font-bold tracking-wider text-gray-800 uppercase">
                    {part.partNumber.toUpperCase()}
                  </span>
                  <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary transition-colors" />
                </button>
              </div>
            )}

            {/* Цена */}
            <div className="mt-3 p-3.5 rounded-xl bg-primary/5 border border-primary/15">
              <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-0.5">
                Цена
              </p>
              <p className="text-3xl font-bold text-primary leading-none">
                {formatPrice(part.sellingPrice, part.priceCurrency)}
              </p>
              {part.quantity > 1 && (
                <p className="text-xs text-gray-500 mt-1.5">
                  В наличии: <span className="font-semibold">{part.quantity} шт.</span>
                </p>
              )}
            </div>

            {/* Действия */}
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={handleAddToCart}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 active:scale-[0.98] transition-all"
              >
                <ShoppingCart className="w-4 h-4" />
                Добавить в корзину
              </button>
              <Link
                to="/market/cart"
                className="w-full flex items-center justify-center gap-2 py-3 bg-white text-primary border border-primary/30 text-sm font-semibold rounded-lg hover:bg-primary/5 active:scale-[0.98] transition-all"
              >
                Перейти к корзине
              </Link>
            </div>
          </div>

          {/* Автомобиль-донор */}
          {part.vehicle && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5" />
                Снята с автомобиля
              </h2>
              <p className="text-base font-bold text-gray-900">
                {part.vehicle.make} {part.vehicle.model}
                {part.vehicle.year && (
                  <span className="font-normal text-gray-500 ml-1">{part.vehicle.year} г.</span>
                )}
              </p>
              {part.vehicle.vin && (
                <p className="text-[11px] font-mono text-gray-400 mt-0.5 select-all">
                  VIN: {part.vehicle.vin}
                </p>
              )}
            </div>
          )}

          {/* Контакты продавца + ссылка на страницу разборки */}
          <SellerContactCard company={part.company} />
        </div>
      </div>

      {/* ── Ещё от этой разборки ───────────────────────────────────────── */}
      {related.length > 0 && (
        <section className="mt-8">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">
              Ещё от этой разборки
            </h2>
            <Link
              to={`/market/supplier/${part.company.id}`}
              className="text-sm font-medium text-primary hover:underline whitespace-nowrap"
            >
              Все товары
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {related.map(p => (
              <MarketProductCard key={p.id} part={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export { MarketProductPage }
