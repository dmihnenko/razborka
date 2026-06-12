import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, Search, Store } from 'lucide-react'
import { getMarketSuppliers } from '@/services/marketplaceService'
import { SupplierCard, pluralizeParts } from '@/components/market/SupplierCard'
import EmptyState from '@/components/ui/EmptyState'

// ============================================================================
// /market/suppliers — публичный список разборок
// ============================================================================

/** Skeleton-карточка разборки */
function SkeletonSupplierCard() {
  return (
    <div className="card p-4 flex items-start gap-3.5">
      <div className="w-12 h-12 animate-shimmer rounded-2xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 animate-shimmer rounded-lg w-3/4" />
        <div className="h-3 animate-shimmer rounded-lg w-1/2" />
        <div className="h-3 animate-shimmer rounded-lg w-2/3" />
      </div>
    </div>
  )
}

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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="space-y-4"
      >
        <div>
          <div className="h-7 animate-shimmer rounded-xl w-32 mb-1" />
          <div className="h-4 animate-shimmer rounded-lg w-48" />
        </div>
        <div className="h-11 animate-shimmer rounded-xl max-w-md" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonSupplierCard key={i} />
          ))}
        </div>
      </motion.div>
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      {/* Заголовок + счётчик */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="page-title">Разборки</h1>
          <p className="page-subtitle">
            {filtered.length > 0 && search.trim()
              ? `Найдено: ${filtered.length} из ${suppliers?.length ?? 0}`
              : `Всего разборок: ${suppliers?.length ?? 0}`}
          </p>
        </div>

        {/* Суммарно товаров — плашка */}
        {!search.trim() && suppliers && suppliers.length > 0 && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200/60 text-xs font-bold text-green-700 self-start sm:self-auto">
            <Store className="w-3.5 h-3.5" strokeWidth={1.5} />
            {pluralizeParts(suppliers.reduce((sum, s) => sum + s.availableParts, 0))} в наличии
          </div>
        )}
      </div>

      {/* Поиск по названию (локальный) */}
      <div className="relative max-w-md">
        <Search
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          strokeWidth={1.5}
        />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск разборки по названию…"
          className="form-input pl-10"
          aria-label="Поиск разборки по названию"
        />
      </div>

      {/* Сетка / пусто */}
      <AnimatePresence mode="wait">
        {filtered.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <EmptyState
              icon={Store}
              title={search.trim() ? 'Ничего не найдено' : 'Разборок пока нет'}
              description={
                search.trim()
                  ? 'Попробуйте изменить запрос'
                  : 'Активные разборки появятся здесь'
              }
            />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger-children"
          >
            {filtered.map(s => (
              <SupplierCard key={s.id} supplier={s} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default MarketSuppliers
