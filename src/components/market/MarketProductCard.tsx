import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Car, MapPin, Package, Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { MarketPart } from '@/types/marketplace'
import { useCart } from '@/hooks/useCart'
import { formatPrice } from '@/utils/currency'
import { PARTS_CONDITION_LABELS } from '@/utils/status'

// ============================================================================
// Карточка товара для сеток каталога / «похожих» / страницы разборки.
// «Azure Market» — плотная карточка: фото → бейдж состояния поверх,
// контент, футер «цена + добавить». Тач-таргет кнопки ≥44px.
// ============================================================================

export interface MarketProductCardProps {
  part: MarketPart
}

const CONDITION_BADGE: Record<string, string> = {
  new: 'badge-green',
  used: 'badge-blue',
  damaged: 'badge-red',
}

export function MarketProductCard({ part }: MarketProductCardProps) {
  const { addItem } = useCart()
  const [imgError, setImgError] = useState(false)

  const photo = part.photoUrl || part.photos?.[0]?.thumb_url || part.photos?.[0]?.url || null
  const conditionLabel = part.condition
    ? PARTS_CONDITION_LABELS[part.condition] ?? part.condition
    : null
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
    <div className="card card-interactive p-0 overflow-hidden flex flex-col group focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-0">
      <Link
        to={`/market/part/${part.id}`}
        className="flex flex-col flex-1 min-w-0 focus-visible:outline-none"
        aria-label={part.name}
      >
        {/* Фото */}
        <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden flex-shrink-0">
          {photo && !imgError ? (
            <img
              src={photo}
              alt={part.name}
              loading="lazy"
              decoding="async"
              draggable={false}
              onError={() => setImgError(true)}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-gray-50">
              <Package className="w-10 h-10 text-gray-300" strokeWidth={1.5} aria-hidden="true" />
              <span className="text-[11px] font-medium text-gray-400">Нет фото</span>
            </div>
          )}
          {conditionLabel && (
            <span className={['badge market-photo-badge', CONDITION_BADGE[part.condition] ?? 'badge-gray'].join(' ')}>
              {conditionLabel}
            </span>
          )}
        </div>

        {/* Контент */}
        <div className="flex flex-col flex-1 px-3 pt-2.5 pb-2 gap-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {part.name}
          </h3>

          {vehicleStr && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500 min-w-0">
              <Car className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" strokeWidth={1.5} aria-hidden="true" />
              <span className="truncate">{vehicleStr}</span>
            </p>
          )}

          {part.company.address && (
            <p className="flex items-center gap-1.5 text-[11px] text-gray-500 min-w-0">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" strokeWidth={1.5} aria-hidden="true" />
              <span className="truncate">{part.company.address}</span>
            </p>
          )}
        </div>
      </Link>

      {/* Футер: цена + добавить */}
      <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1 min-w-0">
        <span className="market-price truncate">
          {formatPrice(part.sellingPrice, part.priceCurrency)}
        </span>
        <button
          type="button"
          onClick={handleAdd}
          className="market-add-btn"
          aria-label={`Добавить в корзину: ${part.name}`}
        >
          <Plus className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

export default MarketProductCard
