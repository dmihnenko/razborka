import { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
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

const CONDITION_BADGE: Record<string, string> = {
  new: 'badge-green',
  used: 'badge-blue',
  damaged: 'badge-red',
}

function conditionBadge(condition: string) {
  const label = PARTS_CONDITION_LABELS[condition] ?? condition
  const cls = CONDITION_BADGE[condition] ?? 'badge-gray'
  return (
    <span className={`badge ${cls}`}>
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
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="py-16 flex flex-col items-center gap-4 text-center"
      >
        <span className="icon-tile-lg w-20 h-20 bg-gray-100 text-gray-400">
          <Package className="w-9 h-9" strokeWidth={1.5} />
        </span>
        <div>
          <p className="text-lg font-bold text-gray-800">Товар не найден</p>
          <p className="text-sm text-gray-500 mt-1">
            Возможно, запчасть уже продана или снята с публикации
          </p>
        </div>
        <Link to="/market/catalog" className="btn-primary mt-1">
          Перейти в каталог
        </Link>
      </motion.div>
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* ── Хлебные крошки ─────────────────────────────────────────────── */}
      <nav aria-label="Хлебные крошки" className="mb-4">
        <ol className="flex items-center gap-1 text-xs sm:text-sm text-gray-500 min-w-0">
          <li>
            <Link to="/market" className="hover:text-primary transition-colors font-medium">
              Маркетплейс
            </Link>
          </li>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <li>
            <Link to="/market/catalog" className="hover:text-primary transition-colors font-medium">
              Каталог
            </Link>
          </li>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <li className="text-gray-700 font-semibold truncate min-w-0" aria-current="page">
            {part.name}
          </li>
        </ol>
      </nav>

      {/* ── Основной grid: фото | sticky-инфо ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 lg:gap-5 items-start">

        {/* ЛЕВАЯ КОЛОНКА: галерея + описание */}
        <div className="space-y-3 min-w-0">
          {galleryPhotos.length > 0 ? (
            <div className="rounded-2xl overflow-hidden">
              <PhotoGallery photos={galleryPhotos} alt={part.name} mainAspect="aspect-[4/3]" />
            </div>
          ) : (
            <div className="card aspect-[4/3] flex flex-col items-center justify-center gap-3 text-gray-300">
              <span className="icon-tile-lg w-20 h-20 bg-gray-100 text-gray-300">
                <Package className="w-9 h-9" strokeWidth={1.5} />
              </span>
              <span className="text-sm font-medium text-gray-400">Нет фото</span>
            </div>
          )}

          {part.description && (
            <div className="card p-5">
              <h2 className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                <FileText className="w-3.5 h-3.5" strokeWidth={1.5} />
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

          <div className="card p-5">
            {/* Бейджи: состояние + категория */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {conditionBadge(part.condition)}
              {part.categoryName && (
                <span className="badge badge-blue">
                  <Tag className="w-3 h-3" strokeWidth={1.5} />
                  {part.categoryName}
                </span>
              )}
            </div>

            {/* Название */}
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 leading-tight tracking-tight mb-1">
              {part.name}
            </h1>

            {/* Артикул (оригинальный номер) */}
            {part.partNumber && (
              <div className="mb-3 mt-2">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1.5">
                  Оригинальный номер
                </p>
                <button
                  type="button"
                  onClick={copyPartNumber}
                  title="Нажмите, чтобы скопировать"
                  aria-label={`Скопировать оригинальный номер ${part.partNumber.toUpperCase()}`}
                  className="group inline-flex items-center gap-2 min-h-[44px] px-3 rounded-xl bg-white border-2 border-primary/20 hover:border-primary/50 hover:shadow-glow-blue active:scale-95 transition-all"
                >
                  <span className="font-mono font-bold tracking-wider text-gray-800 uppercase text-sm">
                    {part.partNumber.toUpperCase()}
                  </span>
                  <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary transition-colors" strokeWidth={1.5} aria-hidden="true" />
                </button>
              </div>
            )}

            {/* Цена */}
            <div className="mt-3 p-4 rounded-2xl bg-primary/5 border border-primary/10">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">
                Цена
              </p>
              <p className="text-3xl font-extrabold tracking-tight text-gradient-brand leading-none">
                {formatPrice(part.sellingPrice, part.priceCurrency)}
              </p>
              {part.quantity > 1 && (
                <p className="text-xs text-gray-500 mt-1.5">
                  В наличии: <span className="font-bold text-gray-700">{part.quantity} шт.</span>
                </p>
              )}
            </div>

            {/* Действия */}
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={handleAddToCart}
                className="btn-primary btn-lg w-full"
              >
                <ShoppingCart className="w-5 h-5" strokeWidth={1.5} />
                Добавить в корзину
              </button>
              <Link
                to="/market/cart"
                className="btn-secondary btn-lg w-full"
              >
                Перейти к корзине
              </Link>
            </div>
          </div>

          {/* Автомобиль-донор */}
          {part.vehicle && (
            <div className="card p-4">
              <h2 className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                <Car className="w-3.5 h-3.5" strokeWidth={1.5} />
                Снята с автомобиля
              </h2>
              <div className="flex items-start gap-3">
                <span className="icon-tile bg-primary/10 text-primary flex-shrink-0">
                  <Car className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-base font-bold text-gray-900 leading-tight">
                    {part.vehicle.make} {part.vehicle.model}
                    {part.vehicle.year && (
                      <span className="font-normal text-gray-500 ml-1.5 text-sm">{part.vehicle.year} г.</span>
                    )}
                  </p>
                  {part.vehicle.vin && (
                    <p className="text-[11px] font-mono text-gray-400 mt-0.5 select-all">
                      VIN: {part.vehicle.vin}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Контакты продавца + ссылка на страницу разборки.
              На странице товара: без «Позвонить», с кнопкой «Написать» (шаблон в Telegram). */}
          <SellerContactCard
            company={part.company}
            hideCallButton
            telegramMessage={
              `Здравствуйте! Интересует запчасть:\n«${part.name}»` +
              (part.vehicle ? `\nАвто: ${part.vehicle.make} ${part.vehicle.model}${part.vehicle.year ? ` ${part.vehicle.year}` : ''}` : '') +
              (part.partNumber ? `\nОриг. номер: ${part.partNumber.toUpperCase()}` : '') +
              `\n${typeof window !== 'undefined' ? window.location.href : ''}`
            }
          />
        </div>
      </div>

      {/* ── Ещё от этой разборки ───────────────────────────────────────── */}
      {related.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          className="mt-8 sm:mt-10"
        >
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="heading-3">Ещё от этой разборки</h2>
            <Link
              to={`/market/supplier/${part.company.id}`}
              className="text-sm font-semibold text-primary hover:text-brand-hover transition-colors whitespace-nowrap flex items-center gap-1 min-h-[44px]"
            >
              Все товары
              <ChevronRight className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 stagger-children">
            {related.map(p => (
              <MarketProductCard key={p.id} part={p} />
            ))}
          </div>
        </motion.section>
      )}
    </motion.div>
  )
}

export { MarketProductPage }
