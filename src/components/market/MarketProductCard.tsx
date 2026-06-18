import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Car, MapPin, Package, Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { MarketPart } from '@/types/marketplace'
import { useCart } from '@/hooks/useCart'
import { formatPrice } from '@/utils/currency'
import { PARTS_CONDITION_LABELS } from '@/utils/status'

// ============================================================================
// Карточка товара (Graphite). Монохром: цвет — только акцент на кнопке.
// ============================================================================

export interface MarketProductCardProps {
  part: MarketPart
}

const CONDITION_BADGE: Record<string, string> = {
  new: 'mk-badge-new',
  used: 'mk-badge-used',
  damaged: 'mk-badge-damaged',
}

export function MarketProductCard({ part }: MarketProductCardProps) {
  const { addItem } = useCart()
  const [imgError, setImgError] = useState(false)

  const p0 = part.photos?.[0]
  const photo = part.photoUrl || p0?.thumb_url || p0?.url || null
  // Адаптив под плотность экрана: браузер выберет нужное разрешение по
  // размеру отрисовки × devicePixelRatio (чёткое фото на Retina/2K/4K).
  const srcSet = p0
    ? [
        p0.thumb_url && `${p0.thumb_url} 180w`,
        (p0.medium_url || p0.display_url) && `${p0.medium_url || p0.display_url} 480w`,
        p0.url && `${p0.url} 1000w`,
      ].filter(Boolean).join(', ')
    : undefined
  const conditionLabel = part.condition ? PARTS_CONDITION_LABELS[part.condition] ?? part.condition : null
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
      companyId: part.company.id,
      companyName: part.company.name,
      condition: part.condition,
    })
    toast.success('Добавлено в корзину')
  }

  return (
    <div className="mk-card mk-card-interactive overflow-hidden flex flex-col group">
      <Link to={`/market/part/${part.id}`} className="flex flex-col flex-1 min-w-0 focus-visible:outline-none" aria-label={part.name}>
        {/* Фото */}
        <div className="relative aspect-[4/3] overflow-hidden flex-shrink-0" style={{ background: 'var(--mk-surface-2)' }}>
          {photo && !imgError ? (
            <img
              src={photo}
              srcSet={srcSet}
              sizes="(min-width:1280px) 220px, (min-width:640px) 33vw, 47vw"
              alt={part.name}
              loading="lazy"
              decoding="async"
              draggable={false}
              onError={() => setImgError(true)}
              className="absolute inset-0 w-full h-full object-contain p-1.5 transition-transform duration-300 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
              <Package className="w-9 h-9" strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--mk-text-3)' }} />
              <span className="text-[11px] mk-meta">Нет фото</span>
            </div>
          )}
          {conditionLabel && (
            <span className={['mk-badge mk-photo-badge', CONDITION_BADGE[part.condition] ?? 'mk-badge-neutral'].join(' ')}>
              {conditionLabel}
            </span>
          )}
        </div>

        {/* Контент */}
        <div className="flex flex-col flex-1 px-3 pt-2.5 pb-2 gap-1 min-w-0">
          <h3 className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: 'var(--mk-text)' }}>
            {part.name}
          </h3>
          {part.partNumber && (
            <span
              className="inline-flex items-center gap-1 w-fit text-[11px] font-mono px-1.5 py-0.5 rounded-md"
              style={{ background: 'var(--mk-surface-2)', color: 'var(--mk-text-2)' }}
              title={`Оригинальный номер: ${part.partNumber}`}
            >
              <span className="font-sans" style={{ color: 'var(--mk-text-3)' }}>OEM</span>
              {part.partNumber}
            </span>
          )}
          {vehicleStr && (
            <p className="flex items-center gap-1.5 text-xs min-w-0 mk-meta">
              <Car className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <span className="truncate">{vehicleStr}</span>
            </p>
          )}
          {part.company.address && (
            <p className="flex items-center gap-1.5 text-[11px] min-w-0 mk-meta">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <span className="truncate">{part.company.address}</span>
            </p>
          )}
        </div>
      </Link>

      {/* Футер: цена + добавить */}
      <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1 min-w-0">
        <span className="mk-price text-base truncate">{formatPrice(part.sellingPrice, part.priceCurrency)}</span>
        <button type="button" onClick={handleAdd} className="mk-add" aria-label={`Добавить в корзину: ${part.name}`}>
          <Plus className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

export default MarketProductCard
