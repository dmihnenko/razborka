import { Link } from 'react-router-dom'
import { ChevronRight, MapPin, Package, Phone, Store } from 'lucide-react'
import type { MarketSupplier } from '@/types/marketplace'

// ============================================================================
// Карточка разборки для списка /market/suppliers
// ============================================================================

export interface SupplierCardProps {
  supplier: MarketSupplier
}

/** Русское склонение: 1 товар / 2 товара / 5 товаров */
export function pluralizeParts(n: number): string {
  const abs = Math.abs(n) % 100
  const d = abs % 10
  if (abs > 10 && abs < 20) return `${n} товаров`
  if (d === 1) return `${n} товар`
  if (d >= 2 && d <= 4) return `${n} товара`
  return `${n} товаров`
}

export function SupplierCard({ supplier }: SupplierCardProps) {
  const hasParts = supplier.availableParts > 0

  return (
    <Link
      to={`/market/supplier/${supplier.id}`}
      className="card card-interactive p-4 flex items-start gap-3.5 group"
      aria-label={`Разборка ${supplier.name}`}
    >
      <span className="icon-tile-lg bg-primary/10 text-primary">
        <Store className="w-6 h-6" strokeWidth={1.5} aria-hidden="true" />
      </span>

      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-gray-900 leading-snug truncate group-hover:text-primary transition-colors">
          {supplier.name}
        </h3>

        <p className="flex items-center gap-1.5 text-xs font-medium mt-1.5">
          <Package
            className={`w-3.5 h-3.5 flex-shrink-0 ${hasParts ? 'text-green-600' : 'text-gray-400'}`}
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <span className={hasParts ? 'text-gray-600' : 'text-gray-400'}>
            {hasParts
              ? `${pluralizeParts(supplier.availableParts)} в наличии`
              : 'Нет товаров в наличии'}
          </span>
        </p>

        {supplier.phone && (
          <p className="flex items-center gap-1.5 text-xs text-gray-500 mt-1 truncate">
            <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
            {supplier.phone}
          </p>
        )}

        {supplier.address && (
          <p className="flex items-center gap-1.5 text-xs text-gray-500 mt-1 truncate">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" strokeWidth={1.5} aria-hidden="true" />
            <span className="truncate">{supplier.address}</span>
          </p>
        )}
      </div>

      <ChevronRight
        className="w-[18px] h-[18px] text-gray-300 flex-shrink-0 mt-1 transition-all group-hover:text-primary group-hover:translate-x-0.5"
        strokeWidth={1.5}
        aria-hidden="true"
      />
    </Link>
  )
}

export default SupplierCard
