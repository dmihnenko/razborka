import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ShoppingCart, Check, Heart } from 'lucide-react'
import { toast } from 'sonner'
import NoPhoto from './NoPhoto'
import { photoSrc } from '@/utils/photoSrc'
import type { MarketPart } from '@/types/marketplace'
import { useCart } from '@/hooks/useCart'
import { useFavorites } from '@/hooks/useFavorites'
import { formatPrice } from '@/utils/currency'

// ============================================================================
// Карточка товара (Graphite). Монохром: цвет — только акцент на кнопке.
// ============================================================================

export interface MarketProductCardProps {
  part: MarketPart
}

const CONDITION_KEY: Record<string, string> = {
  new: 'card.condNew',
  used: 'card.condUsed',
  damaged: 'card.condDamaged',
}

export function MarketProductCard({ part }: MarketProductCardProps) {
  const { t } = useTranslation('market')
  const { addItem, items } = useCart()
  const inCart = items.some(i => i.inventoryId === part.id)
  const fav = useFavorites()
  const [imgError, setImgError] = useState(false)

  const handleFav = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!fav.canUse) { toast.error(t('card.loginForFav'), { position: 'top-center' }); return }
    fav.toggle(part.id)
  }

  const p0 = part.photos?.[0]
  const photo = part.photoUrl || p0?.thumb_url || p0?.url || null
  // Адаптив под плотность экрана: браузер выберет нужное разрешение по
  // размеру отрисовки × devicePixelRatio (чёткое фото на Retina/2K/4K).
  const srcSet = p0
    ? [
        p0.thumb_url && `${photoSrc(p0.thumb_url)} 180w`,
        (p0.medium_url || p0.display_url) && `${photoSrc(p0.medium_url || p0.display_url)} 480w`,
        p0.url && `${photoSrc(p0.url)} 1000w`,
      ].filter(Boolean).join(', ')
    : undefined
  const conditionLabel = part.condition && CONDITION_KEY[part.condition] ? t(CONDITION_KEY[part.condition]) : null
  const vehicleStr = part.vehicle
    ? `${part.vehicle.make} ${part.vehicle.model}${part.vehicle.year ? ` ${part.vehicle.year}` : ''}`.trim()
    : null

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    addItem({
      inventoryId: part.id,
      name: part.name,
      sellingPrice: part.sellingPrice,
      priceCurrency: part.priceCurrency,
      photoUrl: photo,
      quantity: 1,
      maxQty: part.quantity,
      companyId: part.company.id,
      companyName: part.company.name,
      condition: part.condition,
    })
    toast.success(t('card.addedToCart'), { position: 'top-center' })
  }

  const carLine = [conditionLabel, vehicleStr ? t('card.fromCar', { car: vehicleStr }) : null].filter(Boolean).join(', ')
  const favOn = fav.isFavorite(part.id)

  return (
    <div className="mk-card mk-card-interactive overflow-hidden flex flex-col group relative">
      <Link to={`/market/part/${part.id}`} className="flex flex-col flex-1 min-w-0 focus-visible:outline-none" aria-label={part.name}>
        <div className="relative aspect-square overflow-hidden flex-shrink-0 mx-2 mt-2 rounded-[var(--mk-r-btn)]" style={{ background: 'var(--mk-surface-2)' }}>
          {photo && !imgError ? (
            <img
              src={photoSrc(photo)}
              srcSet={srcSet}
              sizes="(min-width:1280px) 220px, (min-width:640px) 33vw, 47vw"
              alt={part.name}
              loading="lazy"
              decoding="async"
              draggable={false}
              onError={() => setImgError(true)}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <NoPhoto size="card" />
          )}
        </div>

        <div className="flex flex-col flex-1 px-3 pt-2.5 pb-1 gap-1 min-w-0">
          {part.partNumber && (
            <span className="text-xs font-bold truncate" style={{ color: 'var(--mk-text)' }} title={t('card.oemTitle', { n: part.partNumber })}>
              {part.partNumber}
            </span>
          )}
          <h3 className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: 'var(--mk-accent)' }}>
            {part.name}
          </h3>
          {carLine && <p className="text-xs mk-meta truncate">{carLine}</p>}
        </div>
      </Link>

      <div className="mt-auto px-3 pb-3 pt-1 min-w-0">
        {part.quantity > 0 && (
          <p className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: 'var(--mk-text-2)' }}>
            <span className="mk-dot" aria-hidden="true" />{t('card.inStock')}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="mk-price text-lg truncate">{formatPrice(part.sellingPrice, part.priceCurrency)}</span>
          <button
            type="button"
            onClick={handleAdd}
            className="mk-add"
            aria-label={inCart ? t('card.inCart', { name: part.name }) : t('card.addToCart', { name: part.name })}
          >
            {inCart
              ? <Check className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
              : <ShoppingCart className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {fav.enabled && (
        <button
          type="button"
          onClick={handleFav}
          aria-label={favOn ? t('card.removeFav') : t('card.addFav')}
          aria-pressed={favOn}
          className="absolute top-3 right-3 w-8 h-8 rounded-[var(--mk-r-btn)] inline-flex items-center justify-center transition-colors"
          style={{ background: 'var(--mk-surface)', border: '1px solid var(--mk-border)' }}
        >
          <Heart className="w-4 h-4" strokeWidth={1.75}
            fill={favOn ? 'var(--mk-accent)' : 'none'}
            color={favOn ? 'var(--mk-accent)' : 'var(--mk-text-2)'} />
        </button>
      )}
    </div>
  )
}

export default MarketProductCard
