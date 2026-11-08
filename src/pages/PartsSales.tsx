import { lazy, Suspense, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'
import { countNewMarketplaceOrders } from '@/services/marketplaceService'

// Содержимое вкладок — существующие страницы, встроенные как компоненты.
const PartsMarketOrders = lazy(() => import('./PartsMarketOrders'))
const PartsOrders = lazy(() => import('./PartsOrders'))
const PartsShipments = lazy(() => import('./PartsShipments'))

type SalesTab = 'inbox' | 'orders' | 'shipments'
const TABS: SalesTab[] = ['inbox', 'orders', 'shipments']

export default function PartsSales() {
  const { t } = useTranslation('cabinet')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: profile } = useUserProfile()
  const partsCompanyId: string | undefined = profile?.parts_company_id ?? undefined

  // Тот же ключ, что у бейджа в Layout — запрос общий.
  const { data: newCount = 0, isLoading: countLoading } = useQuery({
    queryKey: ['marketplace-orders', partsCompanyId, 'new-count'],
    queryFn: () => countNewMarketplaceOrders(partsCompanyId!),
    enabled: !!partsCompanyId,
    staleTime: 60_000,
  })

  // Без ?tab: есть новые заявки с маркета → «Входящие», иначе «Заказы».
  // Выбираем один раз после загрузки счётчика и фиксируем в адресе — вкладка не прыгает,
  // когда заявки обработаны или счётчик догрузился.
  const param = searchParams.get('tab')
  const valid = TABS.includes(param as SalesTab)
  useEffect(() => {
    if (valid || countLoading) return
    const next = new URLSearchParams(searchParams)
    next.set('tab', newCount > 0 ? 'inbox' : 'orders')
    setSearchParams(next, { replace: true })
  }, [valid, countLoading, newCount, searchParams, setSearchParams])
  const tab: SalesTab | null = valid ? (param as SalesTab) : null

  const labels: Record<SalesTab, string> = {
    inbox: t('sales.tabInbox', { defaultValue: 'Входящие' }),
    orders: t('sales.tabOrders', { defaultValue: 'Заказы' }),
    shipments: t('sales.tabShipments', { defaultValue: 'Отправки' }),
  }

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h1 className="page-title truncate">{t('sales.title', { defaultValue: 'Продажи' })}</h1>
        <button
          onClick={() => navigate('/parts/orders/create')}
          className="cab-btn cab-btn-primary cab-btn-sm flex-shrink-0"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
          {t('sales.newSale', { defaultValue: 'Продажа' })}
        </button>
      </div>

      <div role="tablist" className="flex gap-2 mb-3 overflow-x-auto">
        {TABS.map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setSearchParams({ tab: key }, { replace: true })}
            className={`${tab === key ? 'cab-chip cab-chip-signal' : 'cab-chip'} flex-shrink-0`}
          >
            {labels[key]}
            {key === 'inbox' && newCount > 0 && (
              <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-md text-xs font-bold ${tab === key ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-600'}`}>
                {newCount > 99 ? '99+' : newCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <Suspense fallback={null}>
        {tab === 'inbox' && <PartsMarketOrders embedded />}
        {tab === 'orders' && <PartsOrders embedded />}
        {tab === 'shipments' && <PartsShipments embedded />}
      </Suspense>
    </div>
  )
}
