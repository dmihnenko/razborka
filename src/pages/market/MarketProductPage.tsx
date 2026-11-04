import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Car, ChevronRight, Copy, Heart, Package, Share2, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { getMarketPart, getRelatedParts, getMarketCategories, marketCategoryName } from '@/services/marketplaceService'
import type { MarketPart } from '@/types/marketplace'
import { useCart } from '@/hooks/useCart'
import { useFavorites } from '@/hooks/useFavorites'
import { formatPrice } from '@/utils/currency'
import { PARTS_CONDITION_LABELS } from '@/utils/status'
import { slugify } from '@/utils/slug'
import { Spinner } from '@/components/ui/Spinner'
import PhotoGallery from '@/components/parts/PhotoGallery'
import type { ImgbbPhoto } from '@/services/imgbbService'
import { SellerContactCard } from '@/components/market/SellerContactCard'
import { MarketProductCard } from '@/components/market/MarketProductCard'
import { usePageMeta } from '@/hooks/usePageMeta'

// ============================================================================
// Карточка товара — /market/part/:id
// ПК: галерея и детали слева, sticky-колонка покупки 400px справа.
// Телефон: одна колонка, порядок задан классами order-*, снизу sticky-панель.
// ============================================================================

const CONDITION_KEY: Record<string, string> = {
  new: 'card.condNew', used: 'card.condUsed', damaged: 'card.condDamaged',
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
  const { t, i18n } = useTranslation('market')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addItem, items } = useCart()
  const fav = useFavorites()

  useEffect(() => { window.scrollTo({ top: 0 }) }, [id])

  const { data: part, isLoading } = useQuery({
    queryKey: ['market-part', id], queryFn: () => getMarketPart(id!), enabled: !!id, staleTime: 60_000,
  })
  const { data: related = [] } = useQuery({
    queryKey: ['market-related', part?.company.id, id],
    queryFn: () => getRelatedParts(part!.company.id, part!.id),
    enabled: !!part?.company.id, staleTime: 60_000,
  })

  const { data: categories = [] } = useQuery({ queryKey: ['market', 'categories'], queryFn: getMarketCategories, staleTime: 5 * 60_000 })

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

  const buyBlockRef = useRef<HTMLDivElement>(null)
  const [buyBlockVisible, setBuyBlockVisible] = useState(true)
  const hasPart = !!part
  useEffect(() => {
    const el = buyBlockRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setBuyBlockVisible(entry.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [hasPart])

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

  const handleFav = () => {
    if (!fav.canUse) { toast.error(t('card.loginForFav'), { position: 'top-center' }); return }
    fav.toggle(part.id)
  }

  const sectionRow = part.categorySlug ? categories.find(c => c.slug === part.categorySlug) : undefined
  const categoryName = sectionRow ? marketCategoryName(sectionRow, i18n.language) : ''
  const carName = part.vehicle ? [part.vehicle.make, part.vehicle.model, part.vehicle.year].filter(Boolean).join(' ') : ''
  const conditionLabel = CONDITION_KEY[part.condition] ? t(CONDITION_KEY[part.condition]) : part.condition
  const oem = part.partNumber ? part.partNumber.toUpperCase() : ''
  const price = formatPrice(part.sellingPrice, part.priceCurrency)
  const favOn = fav.isFavorite(part.id)

  const specs: { label: string; value: string; mono?: boolean }[] = [
    ...(oem ? [{ label: t('productPage.specOem'), value: oem, mono: true }] : []),
    ...(part.article ? [{ label: t('productPage.specArticle'), value: part.article, mono: true }] : []),
    { label: t('productPage.specCondition'), value: String(conditionLabel) },
    ...(carName ? [{ label: t('productPage.specFromCar'), value: carName }] : []),
    ...(categoryName ? [{ label: t('productPage.specCategory'), value: categoryName }] : []),
  ]

  const sectionTitle = 'text-base font-bold mb-2'

  return (
    <div className="mx-auto max-w-6xl">
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

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8 lg:items-start">
        {/* Левая колонка (на телефоне "растворяется": дети идут в общий порядок) */}
        <div className="contents lg:block lg:min-w-0">
          <div className="order-2 min-w-0">
            {galleryPhotos.length > 0 ? (
              <div className="mk-card overflow-hidden p-0">
                <PhotoGallery photos={galleryPhotos} alt={part.name} mainAspect="aspect-[4/3]" objectFit="contain" mainBgClass="bg-[var(--mk-surface-2)]" />
              </div>
            ) : (
              <div className="mk-card aspect-[4/3] flex flex-col items-center justify-center gap-3" style={{ color: 'var(--mk-text-3)', background: 'var(--mk-surface-2)' }}>
                <Package className="w-12 h-12" strokeWidth={1.5} aria-hidden="true" />
                <span className="text-sm mk-meta">{t('productPage.noPhoto')}</span>
              </div>
            )}
          </div>

          <div className="order-5 min-w-0 flex flex-col gap-6 lg:mt-8">
            <section aria-labelledby="pp-specs">
              <h2 id="pp-specs" className={sectionTitle}>{t('productPage.specs')}</h2>
              <dl className="m-0">
                {specs.map(row => (
                  <div key={row.label} className="mk-spec">
                    <dt>{row.label}</dt>
                    <span className="mk-spec-dots" aria-hidden="true" />
                    <dd className={row.mono ? 'font-mono' : ''}>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {part.vehicle && (
              <section aria-labelledby="pp-fit">
                <h2 id="pp-fit" className={sectionTitle}>{t('productPage.fitment')}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color: 'var(--mk-text)' }}>{part.vehicle.make}</span>
                  <Link
                    to={`/market/catalog/${slugify(part.vehicle.make)}/${slugify(part.vehicle.model)}`}
                    className="mk-chip"
                    aria-label={t('productPage.fitmentAria', { car: carName })}
                  >
                    {[part.vehicle.model, part.vehicle.year].filter(Boolean).join(' ')}
                  </Link>
                </div>
              </section>
            )}

            {part.description?.trim() && (
              <section aria-labelledby="pp-desc">
                <h2 id="pp-desc" className={sectionTitle}>{t('productPage.description')}</h2>
                <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--mk-text-2)' }}>{part.description}</p>
              </section>
            )}
          </div>
        </div>

        {/* Правая колонка: на ПК sticky, на телефоне — часть общего порядка */}
        <div className="contents lg:flex lg:flex-col lg:gap-4 lg:min-w-0 lg:sticky lg:top-32">
          <h1 className="order-1 text-xl lg:text-[22px] font-bold leading-snug tracking-tight" style={{ color: 'var(--mk-text)' }}>{part.name}</h1>

          <div className="order-3 min-w-0 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 min-h-[32px]">
              {oem ? (
                <button
                  type="button" onClick={copyPartNumber} title={t('productPage.clickToCopy')}
                  aria-label={t('productPage.copyOemAria', { number: oem })}
                  className="inline-flex items-center gap-1.5 min-w-0 text-sm mk-meta transition-colors hover:text-[var(--mk-text)]"
                >
                  <span className="flex-shrink-0">OEM</span>
                  <span className="font-mono truncate">{oem}</span>
                  <Copy className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
                </button>
              ) : <span />}
              <button
                type="button" onClick={handleShare}
                aria-label={t('productPage.share')} title={t('productPage.share')}
                className="mk-btn mk-btn-ghost !min-h-0 w-8 h-8 !p-0 flex-shrink-0"
              >
                <Share2 className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>

            {part.vehicle && (
              <div className="mk-panel mk-panel-row flex items-start gap-2.5" style={{ background: 'var(--mk-surface-2)' }}>
                <Car className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--mk-text-3)' }} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--mk-text)' }}>{t('productPage.removedFrom', { car: carName })}</p>
                  <p className="text-xs mk-meta mt-0.5">{t('productPage.checkCompat')}</p>
                </div>
              </div>
            )}

            <div className="flex items-end justify-between gap-3">
              <span className="mk-price-lg leading-none">{price}</span>
              <div className="text-right text-sm">
                {part.quantity > 0 && (
                  <p className="inline-flex items-center gap-1.5 font-semibold" style={{ color: 'var(--mk-text)' }}>
                    <span className="mk-dot" aria-hidden="true" /> {t('productPage.inStock')}
                  </p>
                )}
                <p className="text-xs mk-meta">
                  {conditionLabel}{part.quantity > 1 ? `, ${t('productPage.pcs', { n: part.quantity })}` : ''}
                </p>
              </div>
            </div>

            <div ref={buyBlockRef} className="flex flex-col gap-2">
              <div className="flex gap-2">
                {inCart ? (
                  <Link to="/market/cart" className="mk-btn mk-btn-accent flex-1">
                    <ShoppingCart className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" /> {t('productPage.goToCart')}
                  </Link>
                ) : (
                  <button type="button" onClick={handleAddToCart} className="mk-btn mk-btn-accent flex-1">
                    <ShoppingCart className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" /> {t('productPage.addToCart')}
                  </button>
                )}
                {fav.enabled && (
                  <button
                    type="button" onClick={handleFav}
                    aria-label={favOn ? t('card.removeFav') : t('card.addFav')} aria-pressed={favOn}
                    title={favOn ? t('card.removeFav') : t('card.addFav')}
                    className="mk-btn mk-btn-outline mk-btn-square"
                  >
                    <Heart className="w-4 h-4" strokeWidth={1.75}
                      fill={favOn ? 'var(--mk-accent)' : 'none'}
                      color={favOn ? 'var(--mk-accent)' : 'var(--mk-text-2)'} aria-hidden="true" />
                  </button>
                )}
              </div>
              {!inCart && (
                <button type="button" onClick={handleBuyNow} className="mk-btn mk-btn-outline w-full">
                  {t('productPage.buyNow')}
                </button>
              )}
            </div>
          </div>

          <div className="order-4 min-w-0">
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

      {/* Закреплённая панель покупки (телефон/планшет) */}
      <div className="mk-buybar-spacer lg:hidden" aria-hidden="true" />
      <div className={`mk-buybar items-center gap-3 lg:hidden ${buyBlockVisible ? 'hidden' : 'flex'}`}>
        <div className="min-w-0">
          <p className="mk-price-lg leading-none">{price}</p>
          {part.quantity > 0 && (
            <p className="inline-flex items-center gap-1.5 text-xs mk-meta mt-1"><span className="mk-dot" aria-hidden="true" /> {t('productPage.inStock')}</p>
          )}
        </div>
        {inCart ? (
          <Link to="/market/cart" className="mk-btn mk-btn-accent flex-1">{t('productPage.goToCart')}</Link>
        ) : (
          <button type="button" onClick={handleAddToCart} className="mk-btn mk-btn-accent flex-1">
            <ShoppingCart className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" /> {t('productPage.addToCart')}
          </button>
        )}
      </div>
    </div>
  )
}

export { MarketProductPage }
