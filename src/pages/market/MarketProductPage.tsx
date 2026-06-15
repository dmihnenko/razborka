import { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Car, ChevronRight, Copy, FileText, Package, ShoppingCart, Tag } from 'lucide-react'
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
  const { addItem } = useCart()

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

  const handleAddToCart = () => {
    addItem({
      inventoryId: part.id, name: part.name, sellingPrice: part.sellingPrice, priceCurrency: part.priceCurrency,
      photoUrl: photo, quantity: 1, companyId: part.company.id, companyName: part.company.name, condition: part.condition,
    })
    toast.success('Добавлено в корзину')
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

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,520px)_minmax(330px,400px)] lg:justify-start gap-4 lg:gap-5 items-start">
        {/* Левая: галерея + описание */}
        <div className="space-y-3 min-w-0">
          {galleryPhotos.length > 0 ? (
            <div className="rounded-xl overflow-hidden mk-card p-0"><PhotoGallery photos={galleryPhotos} alt={part.name} mainAspect="aspect-[4/3]" /></div>
          ) : (
            <div className="mk-card aspect-[4/3] flex flex-col items-center justify-center gap-3" style={{ color: 'var(--mk-text-3)' }}>
              <Package className="w-12 h-12" strokeWidth={1.5} aria-hidden="true" />
              <span className="text-sm mk-meta">Нет фото</span>
            </div>
          )}

          {part.description && (
            <div className="mk-card p-4">
              <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest mb-3 mk-meta">
                <FileText className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" /> Описание
              </h2>
              <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--mk-text-2)' }}>{part.description}</p>
            </div>
          )}
        </div>

        {/* Правая: sticky-инфо */}
        <div className="lg:sticky lg:top-20 space-y-3">
          <div className="mk-card p-4">
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {conditionBadge(part.condition)}
              {part.categoryName && (
                <span className="mk-badge mk-badge-neutral"><Tag className="w-3 h-3" strokeWidth={1.5} aria-hidden="true" /> {part.categoryName}</span>
              )}
            </div>

            <h1 className="text-lg sm:text-xl font-extrabold leading-tight tracking-tight mb-1" style={{ color: 'var(--mk-text)' }}>{part.name}</h1>

            {part.partNumber && (
              <div className="mb-3 mt-2">
                <p className="text-[10px] uppercase font-bold tracking-widest mb-1.5 mk-meta">Оригинальный номер</p>
                <button
                  type="button" onClick={copyPartNumber} title="Нажмите, чтобы скопировать"
                  aria-label={`Скопировать оригинальный номер ${part.partNumber.toUpperCase()}`}
                  className="group inline-flex items-center gap-2 min-h-[44px] px-3 rounded-xl transition-colors"
                  style={{ background: 'var(--mk-surface-2)', border: '1px solid var(--mk-border)' }}
                >
                  <span className="font-mono font-bold tracking-wider uppercase text-sm" style={{ color: 'var(--mk-text)' }}>{part.partNumber.toUpperCase()}</span>
                  <Copy className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--mk-text-3)' }} />
                </button>
              </div>
            )}

            <div className="mt-3 p-3.5 rounded-xl" style={{ background: 'var(--mk-surface-2)' }}>
              <p className="text-[10px] uppercase tracking-widest font-bold mb-1 mk-meta">Цена</p>
              <p className="mk-price-lg leading-none">{formatPrice(part.sellingPrice, part.priceCurrency)}</p>
              {part.quantity > 1 && (
                <p className="text-xs mt-1.5 mk-meta">В наличии: <span className="font-bold" style={{ color: 'var(--mk-text-2)' }}>{part.quantity} шт.</span></p>
              )}
            </div>

            <div className="mt-3 space-y-2">
              <button type="button" onClick={handleAddToCart} className="mk-btn mk-btn-accent w-full">
                <ShoppingCart className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" /> Добавить в корзину
              </button>
              <Link to="/market/cart" className="mk-btn mk-btn-outline w-full">Перейти к корзине</Link>
            </div>
          </div>

          {part.vehicle && (
            <div className="mk-card p-4">
              <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest mb-2.5 mk-meta">
                <Car className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" /> Снята с автомобиля
              </h2>
              <div className="flex items-start gap-3">
                <span className="mk-tile-icon flex-shrink-0"><Car className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" /></span>
                <div>
                  <p className="text-base font-bold leading-tight" style={{ color: 'var(--mk-text)' }}>
                    {part.vehicle.make} {part.vehicle.model}
                    {part.vehicle.year && <span className="font-normal ml-1.5 text-sm mk-meta">{part.vehicle.year} г.</span>}
                  </p>
                  {part.vehicle.vin && <p className="text-[11px] font-mono mt-0.5 select-all mk-meta">VIN: {part.vehicle.vin}</p>}
                </div>
              </div>
            </div>
          )}

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
