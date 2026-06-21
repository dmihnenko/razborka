import { Link } from 'react-router-dom'
import { ChevronRight, MapPin, Package, Phone, Store } from 'lucide-react'
import type { MarketSupplier } from '@/types/marketplace'

// ============================================================================
// Карточка разборки (Graphite) для /market/suppliers и главной
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
      className="mk-card mk-card-interactive p-4 flex items-start gap-3.5 group"
      aria-label={`Разборка ${supplier.name}`}
    >
      <span className="mk-tile-icon w-12 h-12 rounded-2xl flex-shrink-0">
        <Store className="w-6 h-6" strokeWidth={1.5} aria-hidden="true" />
      </span>

      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold leading-snug truncate" style={{ color: 'var(--mk-text)' }}>
          {supplier.name}
        </h3>

        <p className="flex items-center gap-1.5 text-xs font-medium mt-1.5" style={{ color: hasParts ? 'var(--mk-text-2)' : 'var(--mk-text-3)' }}>
          <Package className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
          {hasParts ? `${pluralizeParts(supplier.availableParts)} в наличии` : 'Нет товаров в наличии'}
        </p>

        {supplier.phone && (
          <p className="flex items-center gap-1.5 text-xs mt-1 truncate mk-meta">
            <Phone className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
            {supplier.phone}
          </p>
        )}

        {(supplier.city || supplier.address) && (
          <p className="flex items-center gap-1.5 text-xs mt-1 truncate mk-meta">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
            <span className="truncate">
              {supplier.city && <span className="font-semibold" style={{ color: 'var(--mk-text-2)' }}>{supplier.city}</span>}
              {supplier.city && supplier.address && ' · '}
              {supplier.address}
            </span>
          </p>
        )}
      </div>

      <ChevronRight
        className="w-[18px] h-[18px] flex-shrink-0 mt-1 transition-transform group-hover:translate-x-0.5"
        strokeWidth={1.5}
        aria-hidden="true"
        style={{ color: 'var(--mk-text-3)' }}
      />
    </Link>
  )
}

export default SupplierCard
