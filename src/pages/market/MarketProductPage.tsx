import { useEffect, useMemo } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Copy, FileText, Package, Share2, ShoppingCart, Tag } from 'lucide-react'
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
import { usePageMeta } from '@/hooks/usePageMeta'

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
  const { t } = useTranslation('market')
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

  // Мета вкладки — согласовано с edge (worker computeMeta, route.type==='product').
  const vehicle = part?.vehicle
    ? [part.vehicle.make, part.vehicle.model, part.vehicle.year].filter(Boolean).join(' ')
    : ''
  const metaTitle = part
    ? `${part.name}${vehicle ? ' — ' + vehicle : ''} | Razborka.net`
    : undefined
  const metaDescription = part
    ? [
        part.name,
        `Состояние: ${PARTS_CONDITION_LABELS[part.condition] ?? part.condition}`,
        part.sellingPrice ? `Цена ${formatPrice(part.sellingPrice, part.priceCurrency)}` : '',
        vehicle ? `Авто: ${vehicle}` : '',
      ].filter(Boolean).join('. ') + '.'
    : undefined
  usePageMeta(metaTitle, metaDescription)

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
          <p className="text-lg font-bold" style={{ color: 'var(--mk-text)' }}>{t('productPage.notFoundTitle')}</p>
          <p className="mk-sub mt-1">{t('productPage.notFoundSub')}</p>
        </div>
        <Link to="/market/catalog" className="mk-btn mk-btn-accent mt-1">{t('productPage.goToCatalog')}</Link>
      </div>
    )
  }

  const photo = part.photoUrl || part.photos?.[0]?.thumb_url || part.photos?.[0]?.url || null
  const inCart = items.some(i => i.inventoryId === part.id)

  const handleAddToCart = () => {
    addItem({
      inventoryId: part.id, name: part.name, sellingPrice: part.sellingPrice, priceCurrency: part.priceCurrency,
      photoUrl: photo, quantity: 1, maxQty: part.quantity, companyId: part.company.id, companyName: part.company.name, condition: part.condition,
    })
    toast.success(t('productPage.addedToCart'), { position: 'top-center' })
  }

  const handleBuyNow = () => {
    if (!inCart) handleAddToCart()
    navigate('/market/cart')
  }

  const copyPartNumber = () => {
    if (!part.partNumber) return
    navigator.clipboard.writeText(part.partNumber.toUpperCase())
    toast.success(t('productPage.numberCopied'))
  }

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: part.name, url })
        return
      } catch (err) {
        // Пользователь отменил системный шэр — это НЕ ошибка: тихо выходим,
        // не копируем и не показываем тост. Иначе (шэр упал/недоступен) —
        // проваливаемся ниже к копированию в буфер.
        if (err instanceof Error && err.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t('productPage.linkCopied'))
    } catch {
      toast.error(t('productPage.linkCopyError'))
    }
  }


  return (
    <div>
      {/* Хлебные крошки */}
      <nav aria-label={t('productPage.breadcrumbsAria')} className="mb-4">
        <ol className="flex items-center gap-1 text-xs sm:text-sm min-w-0 mk-meta">
          <li><Link to="/market" className="font-medium mk-link">{t('productPage.crumbMarket')}</Link></li>
          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--mk-text-3)' }} />
          <li><Link to="/market/catalog" className="font-medium mk-link">{t('productPage.crumbCatalog')}</Link></li>
          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--mk-text-3)' }} />
          <li className="font-semibold truncate min-w-0" aria-current="page" style={{ color: 'var(--mk-text-2)' }}>{part.name}</li>
        </ol>
      </nav>

      {/* ПК — 3 колонки (фото · цена+инфо · разборка); мобайл — вертикально.
          Ширина блока ограничена, чтобы фото не растягивалось на пол-экрана. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_minmax(300px,360px)_minmax(280px,320px)] gap-4 lg:gap-5 items-start lg:justify-start">
        {/* Фото */}
        <div className="min-w-0 order-1">
          {galleryPhotos.length > 0 ? (
            <div className="rounded-xl overflow-hidden mk-card p-0"><PhotoGallery photos={galleryPhotos} alt={part.name} mainAspect="aspect-[4/3]" objectFit="contain" mainBgClass="bg-white" /></div>
          ) : (
            <div className="mk-card aspect-[4/3] flex flex-col items-center justify-center gap-3" style={{ color: 'var(--mk-text-3)' }}>
              <Package className="w-12 h-12" strokeWidth={1.5} aria-hidden="true" />
              <span className="text-sm mk-meta">{t('productPage.noPhoto')}</span>
            </div>
          )}
        </div>

        {/* Цена + характеристики */}
        <div className="mk-card p-4 order-2">
            <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
              {conditionBadge(part.condition)}
              <span className="mk-badge mk-badge-neutral">{t('productPage.original')}</span>
              {part.quantity > 0 && <span className="mk-badge mk-badge-new">{t('productPage.inStock')}</span>}
              {part.categoryName && (
                <span className="mk-badge mk-badge-neutral"><Tag className="w-3 h-3" strokeWidth={1.5} aria-hidden="true" /> {part.categoryName}</span>
              )}
              <button
                type="button"
                onClick={handleShare}
                aria-label={t('productPage.share')}
                title={t('productPage.share')}
                className="ml-auto inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors mk-link"
                style={{ color: 'var(--mk-text-3)' }}
              >
                <Share2 className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>

            <h1 className="text-[17px] font-extrabold leading-snug tracking-tight mb-1" style={{ color: 'var(--mk-text)' }}>{part.name}</h1>

            {/* Коды: артикул — обычной строкой; OEM — отдельным блоком с бордером
                (подпись + номер + копирование в рамке), кликабелен (копирует номер). */}
            <div className="mt-2 mb-3 space-y-1.5 text-sm">
              {part.article && (
                <p style={{ color: 'var(--mk-text-2)' }}>
                  {t('productPage.article')}{' '}
                  <span className="font-mono font-bold" style={{ color: 'var(--mk-text)' }}>{part.article}</span>
                </p>
              )}
              {part.partNumber && (
                <button
                  type="button" onClick={copyPartNumber} title={t('productPage.clickToCopy')}
                  aria-label={t('productPage.copyOemAria', { number: part.partNumber.toUpperCase() })}
                  className="inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors hover:bg-[var(--mk-surface-2)]"
                  style={{ borderColor: 'var(--mk-border)' }}
                >
                  {/* Полный текст «Оригинальный номер»; на узких экранах — «OEM» */}
                  <span className="text-xs mk-meta">
                    <span className="hidden sm:inline">{t('productPage.oemFull')}:</span>
                    <span className="sm:hidden">OEM:</span>
                  </span>
                  <span className="font-mono font-bold uppercase" style={{ color: 'var(--mk-text)' }}>{part.partNumber.toUpperCase()}</span>
                  <Copy className="w-3 h-3 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--mk-text-3)' }} />
                </button>
              )}
            </div>

            {/* Цена — в строку, компактно */}
            <div className="mt-3 px-3.5 py-2.5 rounded-xl flex items-baseline gap-2 flex-wrap" style={{ background: 'var(--mk-surface-2)' }}>
              <span className="text-[10px] uppercase tracking-widest font-bold mk-meta">{t('productPage.price')}</span>
              <span className="mk-price-lg leading-none">{formatPrice(part.sellingPrice, part.priceCurrency)}</span>
              {part.quantity > 1 && (
                <span className="text-xs mk-meta ml-auto">{t('productPage.inStockQty', { n: part.quantity })}</span>
              )}
            </div>

            {/* CTA — в один ряд, компактные */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {inCart ? (
                <Link to="/market/cart" className="mk-btn mk-btn-accent w-full col-span-2">
                  <ShoppingCart className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" /> {t('productPage.goToCart')}
                </Link>
              ) : (
                <>
                  <button type="button" onClick={handleAddToCart} className="mk-btn mk-btn-accent w-full">
                    <ShoppingCart className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" /> {t('productPage.addToCart')}
                  </button>
                  <button type="button" onClick={handleBuyNow} className="mk-btn mk-btn-brand w-full">
                    {t('productPage.buyNow')}
                  </button>
                </>
              )}
            </div>

            {/* Авто-донор — в той же карточке через разделитель */}
            {part.vehicle && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--mk-border)' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-2 mk-meta">{t('productPage.removedFromCar')}</p>
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-snug" style={{ color: 'var(--mk-text)' }}>
                    {[part.vehicle.make, part.vehicle.model].filter(Boolean).join(' ')}
                    {part.vehicle.year && <span className="font-medium mk-meta"> · {t('productPage.yearShort', { year: part.vehicle.year })}</span>}
                  </p>
                  {/* VIN на публичном маркете НЕ показываем — только марка/модель/год. */}
                </div>
              </div>
            )}
          </div>

        {/* Описание — на мобиле под ценой (order-3), на ПК — полная ширина под колонками (order-4) */}
        {part.description?.trim() && (
          <div className="mk-card p-4 order-3 lg:order-4 lg:col-span-3">
            <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest mb-3 mk-meta">
              <FileText className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" /> {t('productPage.description')}
            </h2>
            <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--mk-text-2)' }}>{part.description}</p>
          </div>
        )}

        {/* Разборка (продавец) — на мобиле под описанием (order-4), на ПК — 3-я колонка (order-3) */}
        <div className="min-w-0 order-4 lg:order-3">
          <SellerContactCard
            company={part.company}
            hideCallButton
            telegramMessage={
              t('productPage.tgIntro', { name: part.name }) +
              (part.vehicle ? '\n' + t('productPage.tgCar', { car: `${part.vehicle.make} ${part.vehicle.model}${part.vehicle.year ? ` ${part.vehicle.year}` : ''}` }) : '') +
              (part.partNumber ? '\n' + t('productPage.tgOem', { number: part.partNumber.toUpperCase() }) : '') +
              `\n${typeof window !== 'undefined' ? window.location.href : ''}`
            }
          />
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-8 sm:mt-10">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="mk-title">{t('productPage.moreFromSeller')}</h2>
            <Link to={`/market/supplier/${part.company.id}`} className="text-sm mk-link inline-flex items-center gap-1 min-h-[44px]">
              {t('productPage.allProducts')} <ChevronRight className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>
          <div className="mk-grid">{related.map(p => <MarketProductCard key={p.id} part={p} />)}</div>
        </section>
      )}
    </div>
  )
}

export { MarketProductPage }
