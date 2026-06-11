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
  return (
    <Link
      to={`/market/supplier/${supplier.id}`}
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-start gap-3 transition-shadow hover:shadow-md group"
    >
      <span className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Store className="w-5 h-5 text-primary" />
      </span>

      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-gray-900 leading-snug truncate group-hover:text-primary transition-colors">
          {supplier.name}
        </h3>

        <p className="flex items-center gap-1 text-xs text-gray-500 mt-1">
          <Package className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          {supplier.availableParts > 0
            ? `${pluralizeParts(supplier.availableParts)} в наличии`
            : 'Нет товаров в наличии'}
        </p>

        {supplier.phone && (
          <p className="flex items-center gap-1 text-xs text-gray-500 mt-0.5 truncate">
            <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            {supplier.phone}
          </p>
        )}

        {supplier.address && (
          <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5 truncate">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{supplier.address}</span>
          </p>
        )}
      </div>

      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1 group-hover:text-primary transition-colors" />
    </Link>
  )
}

export default SupplierCard
