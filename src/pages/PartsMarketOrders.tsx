import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Phone, Inbox, Eye, CheckCircle2, MessageSquare, User, Store, ClipboardCheck, ArrowRight } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import { Spinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import { formatPrice } from '@/utils/currency'
import { formatDateTime } from '@/utils/date'
import {
  getMarketplaceOrders,
  updateMarketplaceOrderStatus,
  convertMarketplaceOrderToPartsOrder,
} from '@/services/marketplaceService'
import type { MarketplaceOrder, MarketplaceOrderStatus } from '@/types/marketplace'

type StatusFilter = 'new' | 'all'

const STATUS_LABELS: Record<MarketplaceOrderStatus, string> = {
  new: 'Новая',
  viewed: 'Просмотрена',
  closed: 'Закрыта',
}

const STATUS_BADGES: Record<MarketplaceOrderStatus, string> = {
  new: 'badge badge-blue',
  viewed: 'badge badge-yellow',
  closed: 'badge badge-gray',
}

/** Сумма заявки: если все позиции в одной валюте — показываем её, иначе UAH по умолчанию */
function formatOrderTotal(order: MarketplaceOrder): string {
  const currencies = Array.from(new Set(order.items.map((i) => i.priceCurrency)))
  const currency = currencies.length === 1 ? currencies[0] : 'UAH'
  return formatPrice(order.totalAmount, currency)
}

function MarketOrderCard({
  order,
  onSetStatus,
  isUpdating,
  onConvert,
  onOpenOrder,
  isConverting,
}: {
  order: MarketplaceOrder
  onSetStatus: (id: string, status: MarketplaceOrderStatus) => void
  isUpdating: boolean
  onConvert: (order: MarketplaceOrder) => void
  onOpenOrder: (orderId: string) => void
  isConverting: boolean
}) {
  const telHref = `tel:${order.buyerPhone.replace(/[^\d+]/g, '')}`

  return (
    <div className="card p-0 overflow-hidden animate-fade-in">
      {/* Шапка: телефон + статус */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <a
              href={telHref}
              className="text-xl sm:text-2xl font-extrabold text-gray-900 hover:text-blue-600 transition-colors tracking-tight block"
              style={{ letterSpacing: '-0.02em' }}
              onClick={(e) => e.stopPropagation()}
            >
              {order.buyerPhone}
            </a>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-sm text-gray-500">
              {order.buyerName && (
                <span className="inline-flex items-center gap-1 font-medium text-gray-700">
                  <User className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.5} />
                  {order.buyerName}
                </span>
              )}
              <span className="text-gray-400">{formatDateTime(order.createdAt)}</span>
            </div>
          </div>
          <span className={`${STATUS_BADGES[order.status]} flex-shrink-0`}>
            {STATUS_LABELS[order.status]}
          </span>
        </div>

        {/* CTA — позвонить прямо в шапке */}
        <a
          href={telHref}
          onClick={(e) => e.stopPropagation()}
          className="btn-primary mt-3 w-full sm:w-auto flex items-center justify-center gap-2"
        >
          <Phone className="w-4 h-4" strokeWidth={1.5} />
          Позвонить
        </a>
      </div>

      <div className="px-5 py-4 space-y-3">
        {/* Комментарий покупателя */}
        {order.comment && (
          <div className="flex items-start gap-2.5 bg-gray-50 rounded-xl px-3.5 py-3 border border-gray-100">
            <MessageSquare className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{order.comment}</p>
          </div>
        )}

        {/* Позиции */}
        <div className="divide-y divide-gray-100">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 py-2.5">
              {item.photoUrl ? (
                <img
                  src={item.photoUrl}
                  alt=""
                  className="w-11 h-11 rounded-xl object-cover bg-gray-100 flex-shrink-0"
                  loading="lazy"
                />
              ) : (
                <div className="icon-tile bg-gray-100 text-gray-300 flex-shrink-0">
                  <Store className="w-5 h-5" strokeWidth={1.5} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 line-clamp-2">{item.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">× {item.quantity}</p>
              </div>
              <p className="text-sm font-extrabold text-gray-900 whitespace-nowrap" style={{ letterSpacing: '-0.01em' }}>
                {formatPrice(item.sellingPrice, item.priceCurrency)}
              </p>
            </div>
          ))}
        </div>

        {/* Сумма */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className="text-sm text-gray-500 font-medium">Сумма заявки</span>
          <span className="text-lg font-extrabold text-blue-600" style={{ letterSpacing: '-0.02em' }}>{formatOrderTotal(order)}</span>
        </div>

        {/* Оформление заказа из заявки */}
        {order.convertedOrderId ? (
          <button
            onClick={() => onOpenOrder(order.convertedOrderId!)}
            className="btn-secondary w-full justify-center"
          >
            <ClipboardCheck className="w-4 h-4 text-green-600" strokeWidth={1.5} />
            Заказ оформлен — открыть
            <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
          </button>
        ) : (
          <button
            onClick={() => onConvert(order)}
            disabled={isConverting}
            className="btn-primary w-full justify-center disabled:opacity-50"
          >
            {isConverting ? (
              <Spinner size="sm" />
            ) : (
              <ClipboardCheck className="w-4 h-4" strokeWidth={1.5} />
            )}
            Оформить заказ
          </button>
        )}

        {/* Статусные действия */}
        {(order.status === 'new' || order.status !== 'closed') && (
          <div className="flex flex-wrap gap-2 pt-1">
            {order.status === 'new' && (
              <button
                onClick={() => onSetStatus(order.id, 'viewed')}
                disabled={isUpdating}
                className="btn-secondary btn-sm flex-1 sm:flex-none justify-center disabled:opacity-50"
              >
                <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
                Просмотрена
              </button>
            )}
            {order.status !== 'closed' && (
              <button
                onClick={() => onSetStatus(order.id, 'closed')}
                disabled={isUpdating}
                className="btn-secondary btn-sm flex-1 sm:flex-none justify-center disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                Закрыть
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PartsMarketOrders() {
  const { data: profile } = useUserProfile()
  const partsCompanyId: string | undefined = profile?.parts_company_id
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { rate } = usePartsExchangeRate()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('new')

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['marketplace-orders', partsCompanyId],
    queryFn: () => getMarketplaceOrders(partsCompanyId!),
    enabled: !!partsCompanyId,
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: MarketplaceOrderStatus }) =>
      updateMarketplaceOrderStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-orders', partsCompanyId] })
    },
    onError: () => {
      toast.error('Не удалось обновить статус заявки')
    },
  })

  const convertMutation = useMutation({
    mutationFn: (order: MarketplaceOrder) =>
      convertMarketplaceOrderToPartsOrder(order, partsCompanyId!, rate),
    onSuccess: ({ orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-orders', partsCompanyId] })
      queryClient.invalidateQueries({ queryKey: ['parts-orders'] })
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      toast.success('Заказ создан из заявки')
      navigate(`/parts/orders/${orderId}`)
    },
    onError: () => {
      toast.error('Не удалось оформить заказ из заявки')
    },
  })

  if (!partsCompanyId) {
    return <PartsAccessDenied />
  }

  const newCount = orders.filter((o) => o.status === 'new').length
  const visibleOrders = statusFilter === 'new' ? orders.filter((o) => o.status === 'new') : orders

  return (
    <div className="min-h-dvh bg-gray-50">
      <PartsPageHeader
        title="Заявки с маркета"
        subtitle={
          newCount > 0
            ? <span className="font-bold text-blue-600">{newCount} новых</span>
            : 'Новых заявок нет'
        }
        backPath="/parts/dashboard"
      />

      <div className="w-full py-4 sm:py-6">
        {/* Фильтр по статусу */}
        <div className="inline-flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
          {(
            [
              { key: 'new', label: 'Новые' },
              { key: 'all', label: 'Все' },
            ] as { key: StatusFilter; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                statusFilter === key
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
              {key === 'new' && newCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-white text-xs font-bold" style={{ background: 'linear-gradient(180deg, #3B82F6 0%, #2563EB 100%)' }}>
                  {newCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="md" />
          </div>
        ) : visibleOrders.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={statusFilter === 'new' ? 'Новых заявок нет' : 'Заявок пока нет'}
            description={
              statusFilter === 'new'
                ? 'Все заявки обработаны. Посмотреть историю можно во вкладке «Все».'
                : 'Когда покупатели на маркетплейсе отправят заявку на ваши запчасти, она появится здесь.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 stagger-children">
            {visibleOrders.map((order) => (
              <MarketOrderCard
                key={order.id}
                order={order}
                onSetStatus={(id, status) => statusMutation.mutate({ id, status })}
                isUpdating={
                  statusMutation.isPending && statusMutation.variables?.id === order.id
                }
                onConvert={(o) => convertMutation.mutate(o)}
                onOpenOrder={(orderId) => navigate(`/parts/orders/${orderId}`)}
                isConverting={
                  convertMutation.isPending && convertMutation.variables?.id === order.id
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
