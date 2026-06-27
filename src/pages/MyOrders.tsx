import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Package, ShoppingBag, Store } from 'lucide-react'
import { getMyMarketplaceOrders, cancelMyMarketplaceOrder } from '@/services/marketplaceService'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import OrderCard from '@/components/orders/OrderCard'
import type { MyMarketplaceOrder } from '@/types/marketplace'

export default function MyOrders() {
  const { t } = useTranslation('cabinet')
  const { data: profile } = useUserProfile()
  const queryClient = useQueryClient()
  const { confirm: showConfirm, dialogProps } = useConfirm()

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
      toast.success(t('myOrdersPage.cancelled'))
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : t('myOrdersPage.cancelled'))
    },
  })

  const handleCancel = async (order: MyMarketplaceOrder) => {
    const ok = await showConfirm({
      title: t('myOrdersPage.cancelOrder'),
      message: t('myOrdersPage.cancelConfirm'),
      confirmText: t('myOrdersPage.cancelOrder'),
      danger: true,
    })
    if (ok) cancelMutation.mutate(order)
  }

  return (
    <div className="py-1 sm:py-2">
      <div className="mx-auto w-full max-w-3xl space-y-5 sm:space-y-6">
        {/* Шапка */}
        <header className="card p-5 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="icon-tile-lg bg-blue-50 text-blue-600 shrink-0">
              <Package className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <h1 className="page-title">{t('myOrdersPage.title')}</h1>
              <p className="page-subtitle">
                {orders.length > 0
                  ? t('myOrdersPage.subtitleCount', { count: orders.length })
                  : t('myOrdersPage.subtitle')}
              </p>
            </div>
          </div>
        </header>

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
        ) : isError ? (
          <EmptyState
            icon={Package}
            title={t('myOrdersPage.errorTitle')}
            description={t('myOrdersPage.errorDescription')}
            action={
              <button onClick={() => refetch()} className="btn-secondary">
                {t('myOrdersPage.retry')}
              </button>
            }
          />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title={t('myOrdersPage.emptyTitle')}
            description={t('myOrdersPage.emptyDescription')}
            action={
              <Link to="/market/catalog" className="btn-primary">
                <Store className="w-4 h-4" strokeWidth={1.5} />
                {t('myOrdersPage.toCatalog')}
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onCancel={handleCancel}
                canceling={cancelMutation.isPending && cancelMutation.variables?.id === order.id}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
