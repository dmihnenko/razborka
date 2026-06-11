import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Car, MapPin, Package, ShoppingCart, Store } from 'lucide-react'
import { toast } from 'sonner'
import type { MarketPart } from '@/types/marketplace'
import { useCart } from '@/hooks/useCart'
import { formatPrice } from '@/utils/currency'
import { PARTS_CONDITION_LABELS } from '@/utils/status'

// ============================================================================
// Карточка товара для сеток каталога / «похожих» / страницы разборки
// ============================================================================

export interface MarketProductCardProps {
  part: MarketPart
}

const CONDITION_CLS: Record<string, string> = {
  new: 'bg-green-100 text-green-700',
  used: 'bg-blue-50 text-blue-700',
  damaged: 'bg-red-50 text-red-700',
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
    <div className="rounded-xl bg-white shadow-sm border border-gray-100 flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <Link
        to={`/market/part/${part.id}`}
        className="flex flex-col flex-1 min-w-0"
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
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-gray-50">
              <Package className="w-10 h-10 text-gray-300" strokeWidth={1.5} />
              <span className="text-[11px] text-gray-400">Нет фото</span>
            </div>
          )}
          {conditionLabel && (
            <span
              className={[
                'absolute top-2 left-2 px-2 py-0.5 text-[10px] font-semibold rounded-md backdrop-blur-sm',
                CONDITION_CLS[part.condition] ?? 'bg-gray-100 text-gray-600',
              ].join(' ')}
            >
              {conditionLabel}
            </span>
          )}
        </div>

        {/* Контент */}
        <div className="flex flex-col flex-1 px-3 pt-2.5 pb-2 gap-1">
          <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
            {part.name}
          </h3>

          {vehicleStr && (
            <p className="flex items-center gap-1 text-xs text-gray-500 min-w-0">
              <Car className="w-3 h-3 flex-shrink-0 text-gray-400" />
              <span className="truncate">{vehicleStr}</span>
            </p>
          )}

          <p className="flex items-center gap-1 text-[11px] text-gray-400 min-w-0">
            <Store className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{part.company.name}</span>
          </p>
          {part.company.address && (
            <p className="flex items-center gap-1 text-[11px] text-gray-400 min-w-0">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{part.company.address}</span>
            </p>
          )}

          <p className="mt-auto pt-1.5 text-lg font-bold text-primary leading-tight">
            {formatPrice(part.sellingPrice, part.priceCurrency)}
          </p>
        </div>
      </Link>

      {/* В корзину */}
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={handleAdd}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-lg bg-primary text-white hover:bg-primary/90 active:scale-[0.98] transition-all"
        >
          <ShoppingCart className="w-4 h-4" />
          В корзину
        </button>
      </div>
    </div>
  )
}

export default MarketProductCard
