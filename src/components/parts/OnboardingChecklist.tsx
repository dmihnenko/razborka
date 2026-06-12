import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X } from 'lucide-react'
import { createPartsCategoriesBulk } from '@/services/partsService'

const DEFAULT_CATEGORIES = [
  'Двигатель',
  'Коробка передач',
  'Подвеска',
  'Тормозная система',
  'Электрика',
  'Кузовные детали',
  'Оптика',
  'Салон',
  'Колёса и диски',
  'Система охлаждения',
]

interface Props {
  partsCompanyId: string
}

export default function OnboardingChecklist({ partsCompanyId }: Props) {
  const queryClient = useQueryClient()
  const [dismissed, setDismissed] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // 1. Категории
  const { data: categoriesCount = null } = useQuery({
    queryKey: ['onboarding-categories', partsCompanyId],
    queryFn: async () => {
      const { count } = await supabase
        .from('parts_categories')
        .select('id', { count: 'exact', head: true })
        .eq('parts_company_id', partsCompanyId)
      return count ?? 0
    },
    enabled: !!partsCompanyId,
    staleTime: 2 * 60 * 1000,
  })

  // 2. Авто
  const { data: vehiclesCount = null } = useQuery({
    queryKey: ['onboarding-vehicles', partsCompanyId],
    queryFn: async () => {
      const { count } = await supabase
        .from('parts_vehicles')
        .select('id', { count: 'exact', head: true })
        .eq('parts_company_id', partsCompanyId)
      return count ?? 0
    },
    enabled: !!partsCompanyId,
    staleTime: 2 * 60 * 1000,
  })

  // 3. Запчасти
  const { data: inventoryCount = null } = useQuery({
    queryKey: ['onboarding-inventory', partsCompanyId],
    queryFn: async () => {
      const { count } = await supabase
        .from('parts_inventory')
        .select('id', { count: 'exact', head: true })
        .eq('parts_company_id', partsCompanyId)
      return count ?? 0
    },
    enabled: !!partsCompanyId,
    staleTime: 2 * 60 * 1000,
  })

  // 4. Контакты
  const { data: companyContacts = null } = useQuery({
    queryKey: ['onboarding-contacts', partsCompanyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('parts_companies')
        .select('phone, telegram, address')
        .eq('id', partsCompanyId)
        .single()
      return data
    },
    enabled: !!partsCompanyId,
    staleTime: 2 * 60 * 1000,
  })

  // 5. Заявки с маркета
  const { data: marketOrdersCount = null } = useQuery({
    queryKey: ['onboarding-market-orders', partsCompanyId],
    queryFn: async () => {
      const { count } = await supabase
        .from('marketplace_orders')
        .select('id', { count: 'exact', head: true })
        .eq('parts_company_id', partsCompanyId)
      return count ?? 0
    },
    enabled: !!partsCompanyId,
    staleTime: 2 * 60 * 1000,
  })

  const addCategoriesMutation = useMutation({
    mutationFn: () => createPartsCategoriesBulk(DEFAULT_CATEGORIES, partsCompanyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-categories', partsCompanyId] })
      queryClient.invalidateQueries({ queryKey: ['parts-categories'] })
      queryClient.invalidateQueries({ queryKey: ['parts-categories-manage'] })
      toast.success('Базовые категории добавлены')
    },
    onError: () => {
      toast.error('Не удалось добавить категории')
    },
  })

  // Считаем статусы
  const loading =
    categoriesCount === null ||
    vehiclesCount === null ||
    inventoryCount === null ||
    companyContacts === null ||
    marketOrdersCount === null

  const hasCats = (categoriesCount ?? 0) >= 1
  const hasVehicles = (vehiclesCount ?? 0) >= 1
  const hasInventory = (inventoryCount ?? 0) >= 1
  const hasContacts =
    !!companyContacts?.phone &&
    !!(companyContacts?.telegram || companyContacts?.address)
  const hasMarketOrder = (marketOrdersCount ?? 0) >= 1

  const doneCount = [hasCats, hasVehicles, hasInventory, hasContacts, hasMarketOrder].filter(Boolean).length
  const total = 5
  const allDone = doneCount === total
  const progressPct = Math.round((doneCount / total) * 100)

  // Не показываем, если пользователь скрыл
  if (dismissed) return null

  // Если всё готово — показываем «Всё настроено» (можно скрыть)
  if (!loading && allDone) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-green-50 border border-green-200/70 animate-fade-in">
        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" strokeWidth={1.5} />
        <span className="text-sm font-semibold text-green-700 flex-1">Всё настроено</span>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Скрыть"
          className="p-1 rounded-lg hover:bg-green-100 transition-colors text-green-500"
        >
          <X className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>
    )
  }

  // Не показываем во время загрузки (предотвращаем «прыжок»)
  if (loading) return null

  return (
    <div className="card overflow-hidden animate-fade-in" aria-label="Чек-лист настройки разборки">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-100">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-sm font-bold text-gray-800">С чего начать</p>
            <span className="badge badge-blue text-xs">{doneCount} из {total}</span>
          </div>
          {/* Прогресс-бар */}
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
        <button
          onClick={() => setCollapsed(v => !v)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Развернуть чек-лист' : 'Свернуть чек-лист'}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 flex-shrink-0"
        >
          {collapsed
            ? <ChevronDown className="w-4 h-4" strokeWidth={1.5} />
            : <ChevronUp className="w-4 h-4" strokeWidth={1.5} />
          }
        </button>
      </div>

      {/* Steps */}
      {!collapsed && (
        <ul className="divide-y divide-gray-100" role="list">
          {/* 1. Категории */}
          <li className="flex items-start gap-3 px-4 py-3">
            {hasCats
              ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
              : <Circle className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
            }
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${hasCats ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                Добавьте категории запчастей
              </p>
              {!hasCats && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    onClick={() => addCategoriesMutation.mutate()}
                    disabled={addCategoriesMutation.isPending}
                    className="btn-primary btn-sm"
                  >
                    {addCategoriesMutation.isPending ? 'Добавление…' : 'Добавить базовые'}
                  </button>
                  <Link
                    to="/parts/categories"
                    className="btn-secondary btn-sm"
                  >
                    Открыть категории
                  </Link>
                </div>
              )}
            </div>
          </li>

          {/* 2. Авто */}
          <li className="flex items-start gap-3 px-4 py-3">
            {hasVehicles
              ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
              : <Circle className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
            }
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${hasVehicles ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                Добавьте первое авто
              </p>
              {!hasVehicles && (
                <div className="mt-2">
                  <Link to="/parts/vehicles" className="btn-secondary btn-sm">
                    Добавить авто
                  </Link>
                </div>
              )}
            </div>
          </li>

          {/* 3. Запчасти */}
          <li className="flex items-start gap-3 px-4 py-3">
            {hasInventory
              ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
              : <Circle className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
            }
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${hasInventory ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                Добавьте запчасти на склад
              </p>
              {!hasInventory && (
                <div className="mt-2">
                  <Link to="/parts/inventory" className="btn-secondary btn-sm">
                    Открыть склад
                  </Link>
                </div>
              )}
            </div>
          </li>

          {/* 4. Контакты */}
          <li className="flex items-start gap-3 px-4 py-3">
            {hasContacts
              ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
              : <Circle className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
            }
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${hasContacts ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                Заполните контакты разборки
              </p>
              {!hasContacts && (
                <div className="mt-2">
                  <Link to="/parts/settings" className="btn-secondary btn-sm">
                    Настройки
                  </Link>
                </div>
              )}
            </div>
          </li>

          {/* 5. Маркет */}
          <li className="flex items-start gap-3 px-4 py-3">
            {hasMarketOrder
              ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
              : <Circle className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
            }
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${hasMarketOrder ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                Получите первую заявку с маркета
              </p>
              {!hasMarketOrder && (
                <div className="mt-2">
                  <Link to="/market" className="btn-secondary btn-sm">
                    Открыть маркет
                  </Link>
                </div>
              )}
            </div>
          </li>
        </ul>
      )}
    </div>
  )
}
