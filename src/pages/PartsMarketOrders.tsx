import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Phone, Inbox, MessageSquare, Store, ClipboardCheck, ArrowRight, Trash2, Car, MapPin } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import { Spinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { formatPrice } from '@/utils/currency'
import { formatDateTime } from '@/utils/date'
import {
  getMarketplaceOrders,
  deleteMarketplaceOrder,
  convertMarketplaceOrderToPartsOrder,
} from '@/services/marketplaceService'
import type { MarketplaceOrder, MarketplaceOrderStatus } from '@/types/marketplace'

type StatusFilter = 'active' | 'archive'

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

/** Группируем позиции по авто (с какой машины) — удобно собирать заказ */
function groupItemsByVehicle(items: MarketplaceOrder['items']) {
  const groups: { key: string; vehicleName: string | null; items: MarketplaceOrder['items'] }[] = []
  const index = new Map<string, number>()
  for (const it of items) {
    const key = it.vehicleName || '__none__'
    let i = index.get(key)
    if (i === undefined) {
      i = groups.length
      index.set(key, i)
      groups.push({ key, vehicleName: it.vehicleName || null, items: [] })
    }
    groups[i].items.push(it)
  }
  return groups
}

/** Сумма заявки: если все позиции в одной валюте — показываем её, иначе UAH по умолчанию */
function formatOrderTotal(order: MarketplaceOrder): string {
  const currencies = Array.from(new Set(order.items.map((i) => i.priceCurrency)))
  const currency = currencies.length === 1 ? currencies[0] : 'UAH'
  return formatPrice(order.totalAmount, currency)
}

function MarketOrderCard({
  order,
  onDelete,
  isDeleting,
  onConvert,
  onOpenOrder,
  isConverting,
}: {
  order: MarketplaceOrder
  onDelete: (order: MarketplaceOrder) => void
  isDeleting: boolean
  onConvert: (order: MarketplaceOrder) => void
  onOpenOrder: (orderId: string) => void
  isConverting: boolean
}) {
  const telHref = `tel:${order.buyerPhone.replace(/[^\d+]/g, '')}`

  return (
    <div className="cab-card overflow-hidden">
      {/* Шапка: покупатель + телефон + статус */}
      <div className="flex items-start justify-between gap-3 px-4 py-3.5 border-b border-gray-100">
        <div className="min-w-0">
          <p className="text-base font-bold text-gray-900 truncate">{order.buyerName || 'Покупатель'}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
            <a
              href={telHref}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              <Phone className="w-3.5 h-3.5" strokeWidth={1.5} /> {order.buyerPhone}
            </a>
            <span className="kicker">{formatDateTime(order.createdAt)}</span>
          </div>
        </div>
        <span className={`${STATUS_BADGES[order.status]} flex-shrink-0`}>
          {STATUS_LABELS[order.status]}
        </span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Комментарий покупателя */}
        {order.comment && (
          <div className="alert alert-info gap-2.5">
            <MessageSquare className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <p className="text-sm whitespace-pre-wrap break-words">{order.comment}</p>
          </div>
        )}

        {/* Позиции — сгруппированы по авто (удобно собирать заказ) */}
        <div className="space-y-3">
          {groupItemsByVehicle(order.items).map((g) => (
            <div key={g.key}>
              {/* Заголовок: с какой машины */}
              <div className="flex items-center gap-1.5 mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">
                <Car className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                <span className="truncate">{g.vehicleName || 'Магазин / без авто'}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {g.items.map((item) => (
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
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-400">
                        <span>× {item.quantity}</span>
                        {item.storageName && (
                          <span className="inline-flex items-center gap-1 text-gray-600 font-medium">
                            <MapPin className="w-3 h-3 flex-shrink-0" strokeWidth={1.5} /> {item.storageName}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm font-extrabold text-gray-900 whitespace-nowrap tabular">
                      {formatPrice(item.sellingPrice, item.priceCurrency)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Футер: сумма + действия (в одну строку) */}
      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="kicker">Сумма</p>
          <p className="text-lg font-extrabold text-primary tabular leading-none">{formatOrderTotal(order)}</p>
        </div>
        <div className="flex items-center gap-2 justify-end flex-shrink-0">
          {order.convertedOrderId ? (
            <button
              onClick={() => onOpenOrder(order.convertedOrderId!)}
              className="cab-btn cab-btn-secondary cab-btn-sm"
            >
              <ClipboardCheck className="w-3.5 h-3.5 text-green-600" strokeWidth={1.5} /> Открыть заказ
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          ) : (
            <>
              <button
                onClick={() => onDelete(order)}
                disabled={isDeleting}
                className="cab-btn cab-btn-ghost cab-btn-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                title="Удалить заявку (товар вернётся в маркет)"
              >
                {isDeleting ? <Spinner size="sm" /> : <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />}
                <span className="hidden sm:inline">Удалить</span>
              </button>
              <button
                onClick={() => onConvert(order)}
                disabled={isConverting}
                className="cab-btn cab-btn-primary cab-btn-sm disabled:opacity-50"
              >
                {isConverting ? <Spinner size="sm" /> : <ClipboardCheck className="w-3.5 h-3.5" strokeWidth={1.5} />}
                Оформить заказ
              </button>
            </>
          )}
        </div>
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
  const { confirm: showConfirm, dialogProps } = useConfirm()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['marketplace-orders', partsCompanyId],
    queryFn: () => getMarketplaceOrders(partsCompanyId!),
    enabled: !!partsCompanyId,
  })

  const deleteMutation = useMutation({
    mutationFn: (order: MarketplaceOrder) => deleteMarketplaceOrder(order),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-orders', partsCompanyId] })
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      toast.success('Заявка удалена, товар возвращён в маркет')
    },
    onError: () => {
      toast.error('Не удалось удалить заявку')
    },
  })

  const handleDelete = async (order: MarketplaceOrder) => {
    const ok = await showConfirm({
      message: `Удалить заявку от «${order.buyerName || order.buyerPhone}»? Забронированный товар вернётся в маркет.`,
      danger: true,
    })
    if (ok) deleteMutation.mutate(order)
  }

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

  // Активные = неоформленные (без созданного заказа); Архив = оформленные
  const activeCount = orders.filter((o) => !o.convertedOrderId).length
  const visibleOrders = statusFilter === 'active'
    ? orders.filter((o) => !o.convertedOrderId)
    : orders.filter((o) => o.convertedOrderId)

  return (
    <div className="min-h-dvh bg-gray-50">
      <PartsPageHeader
        title="Заявки с маркета"
        subtitle={
          activeCount > 0
            ? <span className="font-bold text-primary">{activeCount} активных</span>
            : 'Активных заявок нет'
        }
        backPath="/parts/dashboard"
      />

      <div className="page-container">
        {/* Фильтр: Активные / Архив */}
        <div className="flex gap-2 mb-4">
          {(
            [
              { key: 'active', label: 'Активные' },
              { key: 'archive', label: 'Архив' },
            ] as { key: StatusFilter; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`chip ${statusFilter === key ? 'chip-active' : ''}`}
            >
              {label}
              {key === 'active' && activeCount > 0 && (
                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-xs font-bold ${statusFilter === key ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {activeCount}
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
            title={statusFilter === 'active' ? 'Активных заявок нет' : 'Архив пуст'}
            description={
              statusFilter === 'active'
                ? 'Когда покупатели на маркетплейсе отправят заявку на ваши запчасти, она появится здесь.'
                : 'Оформленные заявки переезжают сюда.'
            }
          />
        ) : (
          <div className="max-w-3xl mx-auto space-y-3">
            {visibleOrders.map((order) => (
              <MarketOrderCard
                key={order.id}
                order={order}
                onDelete={handleDelete}
                isDeleting={
                  deleteMutation.isPending && deleteMutation.variables?.id === order.id
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
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
