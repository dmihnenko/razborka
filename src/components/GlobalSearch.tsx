import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Package, Car, ShoppingCart, Users, Search, X, Loader2 } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'
import { searchCabinet } from '@/services/partsService'

interface GlobalSearchProps {
  open: boolean
  onClose: () => void
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const navigate = useNavigate()
  const { data: profile } = useUserProfile()
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const debouncedQ = useDebounce(q, 250)

  const companyId = profile?.parts_company_id ?? ''

  const { data, isFetching } = useQuery({
    queryKey: ['cabinet-search', companyId, debouncedQ],
    queryFn: () => searchCabinet(companyId, debouncedQ),
    enabled: !!companyId && debouncedQ.trim().length >= 2,
    staleTime: 30_000,
  })

  // Автофокус при открытии; сброс при закрытии
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQ('')
    }
  }, [open])

  // Закрытие по Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const parts = data?.parts ?? []
  const vehicles = data?.vehicles ?? []
  const orders = data?.orders ?? []
  const customers = data?.customers ?? []
  const hasResults = parts.length > 0 || vehicles.length > 0 || orders.length > 0 || customers.length > 0
  const searched = debouncedQ.trim().length >= 2

  function go(path: string) {
    navigate(path)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-[3px] px-3 pt-12 sm:pt-20"
      role="dialog"
      aria-modal="true"
      aria-label="Глобальный поиск"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-modal-pop"
        onClick={e => e.stopPropagation()}
      >
        {/* Строка поиска */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          {isFetching
            ? <Loader2 className="w-5 h-5 text-gray-400 flex-shrink-0 animate-spin" strokeWidth={1.5} />
            : <Search className="w-5 h-5 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
          }
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Поиск по запчастям, авто, заказам, клиентам…"
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
          />
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Закрыть поиск"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Результаты */}
        <div className="max-h-[60dvh] overflow-y-auto overscroll-contain">
          {/* Пусто: ещё не начали вводить */}
          {!searched && (
            <p className="px-4 py-8 text-center text-sm text-gray-400">
              Введите не менее 2 символов для поиска
            </p>
          )}

          {/* Ищем, но нет результатов */}
          {searched && !isFetching && !hasResults && (
            <p className="px-4 py-8 text-center text-sm text-gray-400">
              Ничего не найдено по запросу «{debouncedQ}»
            </p>
          )}

          {/* Группы результатов */}
          {hasResults && (
            <div className="py-2">
              {/* Запчасти */}
              {parts.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 px-4 py-1.5">
                    <Package className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.5} />
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Запчасти</span>
                  </div>
                  {parts.map((item: any) => (
                    <button
                      key={item.id}
                      onClick={() => go(`/parts/inventory/${item.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                        {item.part_number && (
                          <p className="text-xs text-gray-400 truncate">Арт: {item.part_number}</p>
                        )}
                      </div>
                      {item.selling_price != null && (
                        <span className="text-sm font-semibold text-gray-700 flex-shrink-0">
                          {item.selling_price.toLocaleString('ru-RU')} {item.price_currency === 'USD' ? '$' : '₴'}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Автомобили */}
              {vehicles.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 px-4 py-1.5">
                    <Car className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.5} />
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Автомобили</span>
                  </div>
                  {vehicles.map((v: any) => (
                    <button
                      key={v.id}
                      onClick={() => go(`/parts/vehicles/${v.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {[v.make, v.model, v.year].filter(Boolean).join(' ')}
                        </p>
                        {v.vin && (
                          <p className="text-xs text-gray-400 truncate">VIN: {v.vin}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Заказы */}
              {orders.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 px-4 py-1.5">
                    <ShoppingCart className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.5} />
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Заказы</span>
                  </div>
                  {orders.map((o: any) => (
                    <button
                      key={o.id}
                      onClick={() => go(`/parts/orders/${o.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          Заказ #{o.order_number}
                        </p>
                        {o.status && (
                          <p className="text-xs text-gray-400 truncate capitalize">{o.status}</p>
                        )}
                      </div>
                      {o.total_amount != null && (
                        <span className="text-sm font-semibold text-gray-700 flex-shrink-0">
                          {o.total_amount.toLocaleString('ru-RU')} ₴
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Клиенты */}
              {customers.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 px-4 py-1.5">
                    <Users className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.5} />
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Клиенты</span>
                  </div>
                  {customers.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => go(`/parts/customers/${c.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.full_name}</p>
                        {c.phone && (
                          <p className="text-xs text-gray-400 truncate">{c.phone}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Подсказка снизу */}
        <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-400">Esc — закрыть</span>
          <span className="text-xs text-gray-400">Ctrl+K / ⌘K — открыть</span>
        </div>
      </div>
    </div>
  )
}
