import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Search, Store } from 'lucide-react'
import { getMarketSuppliers } from '@/services/marketplaceService'
import { SupplierCard, pluralizeParts } from '@/components/market/SupplierCard'
import EmptyState from '@/components/ui/EmptyState'

// ============================================================================
// /market/suppliers — список разборок (Graphite)
// ============================================================================

export function MarketSuppliers() {
  const [search, setSearch] = useState('')

  const { data: suppliers, isLoading, isError } = useQuery({
    queryKey: ['market', 'suppliers'], queryFn: getMarketSuppliers, staleTime: 5 * 60 * 1000,
  })

  const filtered = useMemo(() => {
    const list = suppliers ?? []
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(s => s.name.toLowerCase().includes(q) || (s.address ?? '').toLowerCase().includes(q))
  }, [suppliers, search])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-7 rounded-xl w-32" style={{ background: 'var(--mk-surface-2)' }} />
        <div className="h-11 rounded-xl max-w-md" style={{ background: 'var(--mk-surface-2)' }} />
        <div className="mk-grid-wide">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="mk-card h-24" aria-hidden="true" />)}</div>
      </div>
    )
  }

  if (isError) {
    return <EmptyState icon={AlertCircle} title="Не удалось загрузить разборки" description="Проверьте соединение и обновите страницу" />
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="mk-h1">Разборки</h1>
          <p className="mk-sub mt-1" aria-live="polite">
            {filtered.length > 0 && search.trim()
              ? `Найдено: ${filtered.length} из ${suppliers?.length ?? 0}`
              : `Всего разборок: ${suppliers?.length ?? 0}`}
          </p>
        </div>
        {!search.trim() && suppliers && suppliers.length > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-bold self-start sm:self-auto" style={{ background: 'var(--mk-surface-2)', color: 'var(--mk-text-2)' }}>
            <Store className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" />
            {pluralizeParts(suppliers.reduce((s, x) => s + x.availableParts, 0))} в наличии
          </span>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none mk-meta" strokeWidth={1.5} aria-hidden="true" />
        <input
          type="search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск разборки по названию…" className="mk-input mk-search" aria-label="Поиск разборки по названию"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Store}
          title={search.trim() ? 'Ничего не найдено' : 'Разборок пока нет'}
          description={search.trim() ? 'Попробуйте изменить запрос' : 'Активные разборки появятся здесь'}
        />
      ) : (
        <div className="mk-grid-wide">{filtered.map(s => <SupplierCard key={s.id} supplier={s} />)}</div>
      )}
    </div>
  )
}

export default MarketSuppliers
