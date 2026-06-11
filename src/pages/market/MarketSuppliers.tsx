import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Search, Store } from 'lucide-react'
import { getMarketSuppliers } from '@/services/marketplaceService'
import { SupplierCard, pluralizeParts } from '@/components/market/SupplierCard'
import EmptyState from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'

// ============================================================================
// /market/suppliers — публичный список разборок
// ============================================================================

export function MarketSuppliers() {
  const [search, setSearch] = useState('')

  const { data: suppliers, isLoading, isError } = useQuery({
    queryKey: ['market', 'suppliers'],
    queryFn: getMarketSuppliers,
    staleTime: 5 * 60 * 1000,
  })

  const filtered = useMemo(() => {
    const list = suppliers ?? []
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        (s.address ?? '').toLowerCase().includes(q)
    )
  }, [suppliers, search])

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  if (isError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Не удалось загрузить разборки"
        description="Проверьте соединение и обновите страницу"
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Заголовок + счётчик */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Разборки</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {filtered.length > 0
            ? `Найдено: ${filtered.length} из ${suppliers?.length ?? 0}`
            : `Всего: ${suppliers?.length ?? 0}`}
        </p>
      </div>

      {/* Поиск по названию (локальный) */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск разборки по названию…"
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          aria-label="Поиск разборки по названию"
        />
      </div>

      {/* Сетка / пусто */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Store}
          title={search.trim() ? 'Ничего не найдено' : 'Разборок пока нет'}
          description={
            search.trim()
              ? 'Попробуйте изменить запрос'
              : 'Активные разборки появятся здесь'
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(s => (
            <SupplierCard key={s.id} supplier={s} />
          ))}
        </div>
      )}

      {/* Сводка по товарам — только когда список не отфильтрован */}
      {!search.trim() && suppliers && suppliers.length > 0 && (
        <p className="text-xs text-gray-400 text-center pt-2">
          Всего в наличии:{' '}
          {pluralizeParts(suppliers.reduce((sum, s) => sum + s.availableParts, 0))}
        </p>
      )}
    </div>
  )
}

export default MarketSuppliers
