import { useEffect, useMemo } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Copy, FileText, Package, ShoppingCart, Tag } from 'lucide-react'
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
// Карточка товара (Graphite) — /market/part/:id
// Компактная раскладка: фото (≤560px) + узкая инфо-колонка (360px), без 3-й
// колонки и без растягивания блоков. Авто и продавец — в той же колонке.
// ============================================================================

const CONDITION_BADGE: Record<string, string> = {
  new: 'mk-badge-new', used: 'mk-badge-used', damaged: 'mk-badge-damaged',
}

function conditionBadge(condition: string) {
  const label = PARTS_CONDITION_LABELS[condition] ?? condition
  return <span className={`mk-badge ${CONDITION_BADGE[condition] ?? 'mk-badge-neutral'}`}>{label}</span>
}

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
  const navigate = useNavigate()
  const { addItem, items } = useCart()

  useEffect(() => { window.scrollTo({ top: 0 }) }, [id])

  const { data: part, isLoading } = useQuery({
    queryKey: ['market-part', id], queryFn: () => getMarketPart(id!), enabled: !!id, staleTime: 60_000,
  })
  const { data: related = [] } = useQuery({
    queryKey: ['market-related', part?.company.id, id],
    queryFn: () => getRelatedParts(part!.company.id, part!.id),
    enabled: !!part?.company.id, staleTime: 60_000,
  })

  const galleryPhotos = useMemo(() => (part ? toGalleryPhotos(part) : []), [part])

  if (isLoading) {
    return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
  }

  if (!part) {
    return (
      <div className="py-16 flex flex-col items-center gap-4 text-center">
        <span className="inline-flex items-center justify-center w-20 h-20 rounded-2xl" style={{ background: 'var(--mk-surface-2)', color: 'var(--mk-text-3)' }}>
          <Package className="w-9 h-9" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <div>
          <p className="text-lg font-bold" style={{ color: 'var(--mk-text)' }}>Товар не найден</p>
          <p className="mk-sub mt-1">Возможно, запчасть уже продана или снята с публикации</p>
        </div>
        <Link to="/market/catalog" className="mk-btn mk-btn-accent mt-1">Перейти в каталог</Link>
      </div>
    )
  }

  const photo = part.photoUrl || part.photos?.[0]?.thumb_url || part.photos?.[0]?.url || null
  const inCart = items.some(i => i.inventoryId === part.id)

  const handleAddToCart = () => {
    addItem({
      inventoryId: part.id, name: part.name, sellingPrice: part.sellingPrice, priceCurrency: part.priceCurrency,
      photoUrl: photo, quantity: 1, companyId: part.company.id, companyName: part.company.name, condition: part.condition,
    })
    toast.success('Добавлено в корзину')
  }

  const handleBuyNow = () => {
    if (!inCart) handleAddToCart()
    navigate('/market/cart')
  }

  const copyPartNumber = () => {
    if (!part.partNumber) return
    navigator.clipboard.writeText(part.partNumber.toUpperCase())
    toast.success('Номер скопирован')
  }


  return (
    <div>
      {/* Хлебные крошки */}
      <nav aria-label="Хлебные крошки" className="mb-4">
        <ol className="flex items-center gap-1 text-xs sm:text-sm min-w-0 mk-meta">
          <li><Link to="/market" className="font-medium mk-link">Маркет</Link></li>
          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--mk-text-3)' }} />
          <li><Link to="/market/catalog" className="font-medium mk-link">Каталог</Link></li>
          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--mk-text-3)' }} />
          <li className="font-semibold truncate min-w-0" aria-current="page" style={{ color: 'var(--mk-text-2)' }}>{part.name}</li>
        </ol>
      </nav>

      {/* ПК — 3 колонки (фото · цена+инфо · разборка); мобайл — вертикально */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px_300px] gap-4 lg:gap-5 items-start">
        {/* Фото */}
        <div className="min-w-0">
          {galleryPhotos.length > 0 ? (
            <div className="rounded-xl overflow-hidden mk-card p-0"><PhotoGallery photos={galleryPhotos} alt={part.name} mainAspect="aspect-[4/3]" objectFit="contain" mainBgClass="bg-white" /></div>
          ) : (
            <div className="mk-card aspect-[4/3] flex flex-col items-center justify-center gap-3" style={{ color: 'var(--mk-text-3)' }}>
              <Package className="w-12 h-12" strokeWidth={1.5} aria-hidden="true" />
              <span className="text-sm mk-meta">Нет фото</span>
            </div>
          )}
        </div>

        {/* Цена + характеристики */}
        <div className="mk-card p-4">
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {conditionBadge(part.condition)}
              <span className="mk-badge mk-badge-neutral">Оригинал</span>
              {part.quantity > 0 && <span className="mk-badge mk-badge-new">В наличии</span>}
              {part.categoryName && (
                <span className="mk-badge mk-badge-neutral"><Tag className="w-3 h-3" strokeWidth={1.5} aria-hidden="true" /> {part.categoryName}</span>
              )}
            </div>

            <h1 className="text-[17px] font-extrabold leading-snug tracking-tight mb-1" style={{ color: 'var(--mk-text)' }}>{part.name}</h1>

            {/* Коды: артикул (всегда) + OEM (если есть) — без фона, номер кликабелен (копирует) */}
            <div className="mt-2 mb-3 space-y-0.5 text-sm" style={{ color: 'var(--mk-text-2)' }}>
              {part.article && (
                <p>
                  Артикул:{' '}
                  <span className="font-mono font-bold" style={{ color: 'var(--mk-text)' }}>{part.article}</span>
                </p>
              )}
              {part.partNumber && (
                <p>
                  OEM:{' '}
                  <button
                    type="button" onClick={copyPartNumber} title="Нажмите, чтобы скопировать"
                    aria-label={`Скопировать оригинальный номер ${part.partNumber.toUpperCase()}`}
                    className="font-mono font-bold uppercase inline-flex items-center gap-1 hover:underline"
                    style={{ color: 'var(--mk-text)' }}
                  >
                    {part.partNumber.toUpperCase()}
                    <Copy className="w-3 h-3" strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--mk-text-3)' }} />
                  </button>
                </p>
              )}
            </div>

            {/* Цена — в строку, компактно */}
            <div className="mt-3 px-3.5 py-2.5 rounded-xl flex items-baseline gap-2 flex-wrap" style={{ background: 'var(--mk-surface-2)' }}>
              <span className="text-[10px] uppercase tracking-widest font-bold mk-meta">Цена</span>
              <span className="mk-price-lg leading-none">{formatPrice(part.sellingPrice, part.priceCurrency)}</span>
              {part.quantity > 1 && (
                <span className="text-xs mk-meta ml-auto">в наличии {part.quantity} шт.</span>
              )}
            </div>

            {/* CTA — в один ряд, компактные */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {inCart ? (
                <Link to="/market/cart" className="mk-btn mk-btn-accent w-full col-span-2">
                  <ShoppingCart className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" /> Перейти в корзину
                </Link>
              ) : (
                <>
                  <button type="button" onClick={handleAddToCart} className="mk-btn mk-btn-accent w-full">
                    <ShoppingCart className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" /> В корзину
                  </button>
                  <button type="button" onClick={handleBuyNow} className="mk-btn mk-btn-brand w-full">
                    Купить сейчас
                  </button>
                </>
              )}
            </div>

            {/* Авто-донор — в той же карточке через разделитель */}
            {part.vehicle && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--mk-border)' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-2 mk-meta">Снята с автомобиля</p>
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-snug" style={{ color: 'var(--mk-text)' }}>
                    {[part.vehicle.make, part.vehicle.model].filter(Boolean).join(' ')}
                    {part.vehicle.year && <span className="font-medium mk-meta"> · {part.vehicle.year} г.</span>}
                  </p>
                  {part.vehicle.vin && <p className="text-[11px] font-mono mt-0.5 select-all mk-meta">VIN: {part.vehicle.vin}</p>}
                </div>
              </div>
            )}
          </div>

        {/* Разборка (продавец) — отдельная колонка (доставка/гарантия — внутри карточки) */}
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

      {/* Описание — под колонками (авто / доставка / гарантия); скрыто, если описания нет */}
      {part.description?.trim() && (
        <div className="mk-card p-4 mt-4 sm:mt-5">
          <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest mb-3 mk-meta">
            <FileText className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" /> Описание
          </h2>
          <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--mk-text-2)' }}>{part.description}</p>
        </div>
      )}

      {related.length > 0 && (
        <section className="mt-8 sm:mt-10">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="mk-title">Ещё от этой разборки</h2>
            <Link to={`/market/supplier/${part.company.id}`} className="text-sm mk-link inline-flex items-center gap-1 min-h-[44px]">
              Все товары <ChevronRight className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>
          <div className="mk-grid">{related.map(p => <MarketProductCard key={p.id} part={p} />)}</div>
        </section>
      )}
    </div>
  )
}

export { MarketProductPage }
