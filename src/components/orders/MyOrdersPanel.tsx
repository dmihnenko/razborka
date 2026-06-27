import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Package, ShoppingBag, Store } from 'lucide-react'
import { getMyMarketplaceOrders, cancelMyMarketplaceOrder } from '@/services/marketplaceService'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import OrderCard from '@/components/orders/OrderCard'
import type { MyMarketplaceOrder, MarketplaceOrderStatus } from '@/types/marketplace'

type TabKey = 'active' | 'sent' | 'archive' | 'all'

const TABS: { key: TabKey; label: string; statuses: MarketplaceOrderStatus[] | null }[] = [
  { key: 'active', label: 'В работе', statuses: ['new', 'viewed'] },
  { key: 'sent', label: 'Отправленные', statuses: ['closed'] },
  { key: 'archive', label: 'Архив', statuses: ['cancelled'] },
  { key: 'all', label: 'Все', statuses: null },
]

/**
 * Полный интерфейс заказов покупателя с разборок: вкладки по статусам
 * (в работе / отправленные / архив / все), список карточек, отмена заявки.
 * Используется и как самостоятельная страница /my-orders, и внутри кабинета «Мои авто».
 */
export default function MyOrdersPanel() {
  const { data: profile } = useUserProfile()
  const queryClient = useQueryClient()
  const { confirm: showConfirm, dialogProps } = useConfirm()
  const [tab, setTab] = useState<TabKey>('active')

  const {
    data: orders = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['my-orders', profile?.id],
    queryFn: getMyMarketplaceOrders,
    enabled: !!profile?.id,
  })

  const cancelMutation = useMutation({
    mutationFn: (order: MyMarketplaceOrder) => cancelMyMarketplaceOrder(order.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-orders'] })
      toast.success('Заявка отменена')
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Не удалось отменить заявку')
    },
  })

  const handleCancel = async (order: MyMarketplaceOrder) => {
    const ok = await showConfirm({
      title: 'Отменить заявку',
      message: 'Вы уверены, что хотите отменить эту заявку?',
      confirmText: 'Отменить заявку',
      danger: true,
    })
    if (ok) cancelMutation.mutate(order)
  }

  const countFor = (statuses: MarketplaceOrderStatus[] | null) =>
    statuses ? orders.filter((o) => statuses.includes(o.status)).length : orders.length

  const activeTab = TABS.find((t) => t.key === tab)!
  const filtered = activeTab.statuses
    ? orders.filter((o) => activeTab.statuses!.includes(o.status))
    : orders

  if (isError) {
    return (
      <EmptyState
        icon={Package}
        title="Не удалось загрузить заказы"
        description="Попробуйте обновить страницу."
        action={
          <button onClick={() => refetch()} className="btn-secondary">
            Повторить
          </button>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Вкладки по статусам */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tt) => {
          const cnt = countFor(tt.statuses)
          const isActive = tt.key === tab
          return (
            <button
              key={tt.key}
              onClick={() => setTab(tt.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                isActive
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-700'
              }`}
            >
              {tt.label}
              <span className={`text-xs tabular-nums ${isActive ? 'text-blue-100' : 'text-gray-400'}`}>{cnt}</span>
            </button>
          )
        })}
      </div>

      {/* Список */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-5 w-1/3 rounded-lg bg-gray-100 animate-shimmer" />
                <div className="h-5 w-16 rounded-full bg-gray-100 animate-shimmer" />
              </div>
              <div className="h-4 w-1/2 rounded-lg bg-gray-100 animate-shimmer" />
              <div className="h-9 rounded-xl bg-gray-100 animate-shimmer" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="У вас пока нет заказов"
          description="Закажите запчасти на маркете — и они появятся здесь."
          action={
            <Link to="/market/catalog" className="btn-primary">
              <Store className="w-4 h-4" strokeWidth={1.5} />
              В каталог запчастей
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-sm text-gray-500">В этой вкладке пока пусто</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onCancel={handleCancel}
              canceling={cancelMutation.isPending && cancelMutation.variables?.id === order.id}
            />
          ))}
        </div>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
