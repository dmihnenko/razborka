import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Package, Car, ShoppingCart, Users, Search, X, Loader2, CornerDownLeft, ArrowRight, type LucideIcon } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'
import { searchCabinet } from '@/services/partsService'
import { adminMenu, partsOwnerMenu, partsWorkerMenu, type MenuItem } from '@/config/navigation'

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

// Плоский элемент палитры (для навигации клавиатурой по сквозному индексу)
interface CmdItem {
  key: string
  group: string
  icon: LucideIcon
  label: string
  sub?: string
  right?: string
  action: () => void
}

export default function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const navigate = useNavigate()
  const { data: profile } = useUserProfile()
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const debouncedQ = useDebounce(q, 250)

  const companyId = profile?.parts_company_id ?? ''
  const searched = debouncedQ.trim().length >= 2

  const { data, isFetching } = useQuery({
    queryKey: ['cabinet-search', companyId, debouncedQ],
    queryFn: () => searchCabinet(companyId, debouncedQ),
    enabled: !!companyId && searched,
    staleTime: 30_000,
  })

  // Меню текущей роли — для группы «Перейти»
  const navMenu: MenuItem[] = useMemo(() => {
    const roles = profile?.roles?.map((r: { name: string }) => r.name) ?? []
    if (roles.includes('parts_owner')) return partsOwnerMenu
    if (roles.includes('parts_worker')) return partsWorkerMenu
    if (roles.includes('admin')) return adminMenu
    return []
  }, [profile])

  function go(path: string) {
    navigate(path)
    onClose()
  }

  // Сквозной плоский список (порядок = порядок отрисовки)
  const items = useMemo<CmdItem[]>(() => {
    const list: CmdItem[] = []
    const ql = q.trim().toLowerCase()

    // «Перейти»: при пустом запросе — всё меню; при вводе — совпадения по названию
    const navMatches = ql ? navMenu.filter(m => m.name.toLowerCase().includes(ql)) : navMenu
    for (const m of navMatches) {
      list.push({ key: 'nav:' + m.href, group: 'Перейти', icon: m.icon, label: m.name, action: () => go(m.href) })
    }

    if (searched && data) {
      for (const p of data.parts) {
        list.push({
          key: 'part:' + p.id, group: 'Запчасти', icon: Package, label: p.name,
          sub: p.part_number ? 'Арт: ' + p.part_number : undefined,
          right: p.selling_price != null ? `${p.selling_price.toLocaleString('ru-RU')} ${p.price_currency === 'USD' ? '$' : 'грн.'}` : undefined,
          action: () => go('/parts/inventory/' + p.id),
        })
      }
      for (const v of data.vehicles) {
        list.push({
          key: 'veh:' + v.id, group: 'Автомобили', icon: Car,
          label: [v.make, v.model, v.year].filter(Boolean).join(' '),
          sub: v.vin ? 'VIN: ' + v.vin : undefined,
          action: () => go('/parts/vehicles/' + v.id),
        })
      }
      for (const o of data.orders) {
        list.push({
          key: 'ord:' + o.id, group: 'Заказы', icon: ShoppingCart, label: 'Заказ #' + o.order_number,
          sub: o.status || undefined,
          right: o.total_amount != null ? `${o.total_amount.toLocaleString('ru-RU')} грн.` : undefined,
          action: () => go('/parts/orders/' + o.id),
        })
      }
      for (const c of data.customers) {
        list.push({
          key: 'cust:' + c.id, group: 'Клиенты', icon: Users, label: c.full_name,
          sub: c.phone || undefined,
          action: () => go('/parts/customers/' + c.id),
        })
      }
    }
    return list
  }, [q, navMenu, searched, data])

  // Автофокус при открытии; сброс при закрытии
  useEffect(() => {
    if (open) {
      setQ('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Активный индекс не выходит за пределы списка
  useEffect(() => { setActive(0) }, [debouncedQ])
  useEffect(() => { if (active >= items.length) setActive(0) }, [items.length, active])

  // Клавиатура: ↑/↓ навигация, Enter — выбрать, Esc — закрыть
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (!items.length) return
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i + 1) % items.length) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i - 1 + items.length) % items.length) }
      else if (e.key === 'Enter') { e.preventDefault(); items[active]?.action() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, items, active, onClose])

  if (!open) return null

  const hasResults = items.length > 0

  // Отрисовка: идём по плоскому списку, вставляя заголовок при смене группы
  let prevGroup = ''
  let flatIndex = -1

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-[3px] px-3 pt-12 sm:pt-20"
      role="dialog"
      aria-modal="true"
      aria-label="Командное меню"
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
            : <Search className="w-5 h-5 text-gray-400 flex-shrink-0" strokeWidth={1.5} />}
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Поиск или переход — запчасти, авто, заказы, страницы…"
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
          />
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Список */}
        <div className="max-h-[60dvh] overflow-y-auto overscroll-contain py-2">
          {!hasResults && searched && !isFetching && (
            <p className="px-4 py-8 text-center text-sm text-gray-400">
              Ничего не найдено по запросу «{debouncedQ}»
            </p>
          )}
          {!hasResults && !searched && (
            <p className="px-4 py-8 text-center text-sm text-gray-400">
              Начните вводить — поиск по базе и переход на страницы
            </p>
          )}

          {items.map(item => {
            flatIndex += 1
            const idx = flatIndex
            const isActive = idx === active
            const showHeader = item.group !== prevGroup
            prevGroup = item.group
            const Icon = item.icon
            return (
              <div key={item.key}>
                {showHeader && (
                  <div className="px-4 pt-2.5 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    {item.group}
                  </div>
                )}
                <button
                  onClick={() => item.action()}
                  onMouseMove={() => setActive(idx)}
                  ref={isActive ? (el => el?.scrollIntoView({ block: 'nearest' })) : undefined}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                  style={isActive ? { background: 'var(--brand-50, #eef1fd)' } : undefined}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.5}
                    style={{ color: isActive ? 'var(--brand-600, #3538cd)' : '#9ca3af' }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.label}</p>
                    {item.sub && <p className="text-xs text-gray-400 truncate">{item.sub}</p>}
                  </div>
                  {item.right && <span className="text-sm font-semibold text-gray-700 flex-shrink-0">{item.right}</span>}
                  {item.group === 'Перейти' && !item.right && (
                    <ArrowRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" strokeWidth={1.5} />
                  )}
                  {isActive && (
                    <CornerDownLeft className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5}
                      style={{ color: 'var(--brand-600, #3538cd)' }} />
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* Подсказка снизу */}
        <div className="px-4 py-2.5 border-t border-gray-100 flex items-center gap-4 text-[11px] text-gray-400">
          <span><kbd className="px-1 border border-gray-200 rounded">↑</kbd><kbd className="px-1 border border-gray-200 rounded ml-0.5">↓</kbd> навигация</span>
          <span><kbd className="px-1 border border-gray-200 rounded">↵</kbd> выбрать</span>
          <span className="ml-auto"><kbd className="px-1 border border-gray-200 rounded">Esc</kbd> закрыть</span>
        </div>
      </div>
    </div>
  )
}
