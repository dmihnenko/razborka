import { useState, useCallback, useMemo } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import { formatDate } from '@/utils/date'
import { PartsOrder, PartsOrderStatus } from '@/types/parts'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, ShoppingCart, LayoutList, Columns3 } from 'lucide-react'
import { getPartsOrderStatusText } from '@/utils/status'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import i18n from '@/i18n'
import { updatePartsOrderStatus } from '@/services/partsService'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'

// ─── Статусы для канбана ─────────────────────────────────────────────────────
const BOARD_COLUMNS: { status: PartsOrderStatus; label: string; dot: string; ring: string }[] = [
  { status: 'new',         label: 'Новый',    dot: 'bg-blue-500',    ring: 'ring-blue-400'   },
  { status: 'in_progress', label: 'В работе', dot: 'bg-amber-400',   ring: 'ring-amber-400'  },
  { status: 'completed',   label: 'Завершён', dot: 'bg-emerald-500', ring: 'ring-emerald-500'},
]

// ─── Бейджи ──────────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  new:         'badge badge-blue',
  in_progress: 'badge badge-yellow',
  completed:   'badge badge-green',
  cancelled:   'badge badge-red',
}

function statusBadge(status: string) {
  return STATUS_BADGE[status] ?? 'badge badge-gray'
}

// ─── Draggable карточка на доске ─────────────────────────────────────────────
interface BoardCardProps {
  order: PartsOrder
  formatUSD: (v?: number | null) => string
  computeOrderUSD: (o: PartsOrder) => number | null
  onClick: () => void
  isDragging?: boolean
}

function BoardCard({ order, formatUSD, computeOrderUSD, onClick, isDragging }: BoardCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isCurrentlyDragging } =
    useSortable({ id: order.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isCurrentlyDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        ...(isDragging ? { boxShadow: '0 8px 24px -8px rgba(22,24,29,.25)', borderColor: 'var(--cab-ink)' } : {}),
      }}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="cab-card p-3 cursor-grab active:cursor-grabbing select-none transition-shadow"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wide truncate" style={{ color: 'var(--cab-ink-3)' }}>{order.order_number}</span>
        <span className="text-sm font-extrabold tabular-nums flex-shrink-0" style={{ color: 'var(--cab-ink)', letterSpacing: '-0.02em' }}>
          {formatUSD(computeOrderUSD(order))}
        </span>
      </div>
      <p className="text-sm font-semibold truncate mb-1" style={{ color: 'var(--cab-ink)' }}>
        {order.customer?.full_name ?? '—'}
      </p>
      <p className="text-xs" style={{ color: 'var(--cab-ink-3)' }}>{formatDate(order.order_date)}</p>
    </div>
  )
}

// ─── Droppable колонка ────────────────────────────────────────────────────────
interface BoardColumnProps {
  status: PartsOrderStatus
  label: string
  dot: string
  ring: string
  orders: PartsOrder[]
  formatUSD: (v?: number | null) => string
  computeOrderUSD: (o: PartsOrder) => number | null
  onCardClick: (id: string) => void
  activeId: string | null
}

function BoardColumn({ status, label, dot, ring, orders, formatUSD, computeOrderUSD, onCardClick, activeId }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const { t } = useTranslation('cabinet')

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col min-h-[200px] rounded-xl p-3 transition-colors"
      style={{ background: isOver ? 'var(--cab-signal-weak)' : 'var(--cab-surface-2)', boxShadow: isOver ? '0 0 0 1px var(--cab-signal)' : undefined }}
    >
      {/* Заголовок колонки */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
        <span className="text-sm font-bold" style={{ color: 'var(--cab-ink)' }}>{label}</span>
        <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ring-1 ${ring} bg-white`} style={{ color: 'var(--cab-ink-2)' }}>
          {orders.length}
        </span>
      </div>

      {/* Карточки */}
      <div className="flex flex-col gap-2 flex-1">
        {orders.map(order => (
          <BoardCard
            key={order.id}
            order={order}
            formatUSD={formatUSD}
            computeOrderUSD={computeOrderUSD}
            onClick={() => onCardClick(order.id)}
            isDragging={activeId === order.id}
          />
        ))}
        {orders.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-8 text-xs text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
            {t('ordersPage.noOrders')}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function PartsOrders() {
  const { t } = useTranslation('cabinet')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id

  const { rate: usdRate } = usePartsExchangeRate()

  const formatUSD = (amount?: number | null) => {
    if (amount == null || amount === 0) return '—'
    return `$${Math.round(amount).toLocaleString('ru-RU')}`
  }

  const computeOrderUSD = useCallback((order: PartsOrder): number | null => {
    if (!order.items || order.items.length === 0) return null
    const rate = (order as any).exchange_rate_at_sale || usdRate
    if (!rate) return null
    return order.items.reduce((sum, item) => {
      const amount = (item.price_at_sale ?? 0) * (item.quantity ?? 1)
      return sum + (item.price_at_sale_currency === 'USD' ? amount : amount / rate)
    }, 0)
  }, [usdRate])

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list')

  // DnD state
  const [activeId, setActiveId] = useState<string | null>(null)
  // Оптимистичный список: id → status
  const [optimisticOverrides, setOptimisticOverrides] = useState<Record<string, PartsOrderStatus>>({})

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // ─── Запрос заказов ──────────────────────────────────────────────────────
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['parts-orders', partsCompanyId, statusFilter],
    queryFn: async () => {
      if (!partsCompanyId) return []

      let query = supabase
        .from('parts_orders')
        .select(`
          *,
          customer:parts_customers(id, full_name, phone),
          items:parts_order_items(id, quantity, subtotal, price_at_sale, price_at_sale_currency, inventory_item_id, inventory_item:parts_inventory(name))
        `)
        .eq('parts_company_id', partsCompanyId)
        .order('order_date', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query
      if (error) throw error
      return data as PartsOrder[]
    },
    enabled: !!partsCompanyId,
  })

  // ─── Мутация смены статуса ────────────────────────────────────────────────
  const statusMutation = useMutation({
    mutationFn: ({ orderId, newStatus, inventoryIds }: {
      orderId: string
      newStatus: PartsOrderStatus
      inventoryIds: string[]
    }) => updatePartsOrderStatus(orderId, newStatus, inventoryIds, usdRate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-orders'] })
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
    },
    onError: (_, variables) => {
      // Откат оптимистичного
      setOptimisticOverrides(prev => {
        const next = { ...prev }
        delete next[variables.orderId]
        return next
      })
      toast.error(t('ordersPage.statusUpdateError'))
    },
  })

  // ─── DnD handlers ─────────────────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const orderId = active.id as string
    const newStatus = over.id as PartsOrderStatus

    // Находим заказ
    const order = orders.find(o => o.id === orderId)
    if (!order) return

    const currentStatus = optimisticOverrides[orderId] ?? order.status
    if (currentStatus === newStatus) return

    // Допустимые целевые статусы (только колонки доски)
    const validStatuses: PartsOrderStatus[] = ['new', 'in_progress', 'completed']
    if (!validStatuses.includes(newStatus)) return

    // Собираем inventory_item_id из items
    const inventoryIds = (order.items ?? [])
      .map(i => (i as any).inventory_item_id as string | undefined)
      .filter((id): id is string => !!id)

    // Оптимистичный апдейт
    setOptimisticOverrides(prev => ({ ...prev, [orderId]: newStatus }))

    statusMutation.mutate({ orderId, newStatus, inventoryIds })
  }

  // ─── Фильтрация ───────────────────────────────────────────────────────────
  const filteredOrders = useMemo(() => orders.filter(order => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      order.order_number.toLowerCase().includes(query) ||
      order.customer?.full_name?.toLowerCase().includes(query) ||
      order.customer?.phone?.toLowerCase().includes(query)
    )
  }), [orders, searchQuery])

  // Применяем оптимистичные статусы
  const ordersWithOptimistic = useMemo(() =>
    filteredOrders.map(o =>
      optimisticOverrides[o.id] ? { ...o, status: optimisticOverrides[o.id] } : o
    ),
  [filteredOrders, optimisticOverrides])

  // ─── Статистика ───────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: orders.length,
    new: orders.filter(o => o.status === 'new').length,
    in_progress: orders.filter(o => o.status === 'in_progress').length,
    completed: orders.filter(o => o.status === 'completed').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
    totalRevenue: (() => {
      if (!usdRate) return 0
      return orders
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (computeOrderUSD(o) ?? 0), 0)
    })(),
  }), [orders, usdRate, computeOrderUSD])

  // Активный заказ для DragOverlay
  const activeOrder = activeId ? orders.find(o => o.id === activeId) : null

  if (!partsCompanyId) {
    return <PartsAccessDenied />
  }

  return (
    <div className="min-h-dvh" style={{ background: 'var(--cab-bg)' }}>
      {/* Header */}
      <PartsPageHeader
        title={i18n.t('cabinet:pages.orders')}
        subtitle={t('ordersPage.totalCount', { n: stats.total })}
        backPath="/parts/dashboard"
        actions={
          <button
            onClick={() => navigate('/parts/orders/create')}
            className="cab-btn cab-btn-primary cab-btn-sm"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            <span className="hidden sm:inline">{t('ordersPage.createOrder')}</span>
          </button>
        }
      />

      {/* Content */}
      <div className="page-container">

        {/* Stats — фильтр-плитки */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          {[
            { key: 'all',         label: t('ordersPage.statAll'),        value: stats.total,       dot: '#8B909A' },
            { key: 'new',         label: t('ordersPage.statNew'),        value: stats.new,         dot: 'var(--cab-signal)' },
            { key: 'in_progress', label: t('ordersPage.statInProgress'), value: stats.in_progress, dot: '#D97706' },
            { key: 'completed',   label: t('ordersPage.statCompleted'),  value: stats.completed,   dot: '#16A34A' },
          ].map(({ key, label, value, dot }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className="cab-card cab-card-hover p-4 text-left"
              style={statusFilter === key ? { borderColor: 'var(--cab-ink)', boxShadow: '0 0 0 1px var(--cab-ink)' } : undefined}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold" style={{ color: 'var(--cab-ink-2)' }}>{label}</p>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dot }} />
              </div>
              <p className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--cab-ink)', letterSpacing: '-0.03em' }}>
                {value}
              </p>
            </button>
          ))}

          {/* Выручка */}
          <div className="cab-card p-4">
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--cab-ink-2)' }}>{t('ordersPage.revenue')}</p>
            <p className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--cab-ink)', letterSpacing: '-0.03em' }}>
              {formatUSD(stats.totalRevenue)}
            </p>
          </div>
        </div>

        {/* Поиск + фильтры + переключатель вида */}
        <div className="cab-card p-4 mb-4">
          {/* Поиск */}
          <div className="relative mb-3">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('ordersPage.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input pl-10"
            />
          </div>

          {/* Чипы статуса + переключатель вида */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex flex-wrap gap-2 flex-1">
              {[
                { key: 'all',         label: t('ordersPage.chipAll') },
                { key: 'new',         label: t('ordersPage.chipNew') },
                { key: 'in_progress', label: t('ordersPage.chipInProgress') },
                { key: 'completed',   label: t('ordersPage.chipCompleted') },
                { key: 'cancelled',   label: t('ordersPage.chipCancelled') },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`chip ${statusFilter === key ? 'chip-active' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Переключатель вида (только на десктопе) */}
            <div className="hidden md:flex items-center gap-1 border border-gray-200 rounded-lg p-0.5 flex-shrink-0">
              <button
                onClick={() => setViewMode('list')}
                title={t('ordersPage.viewList')}
                className={`btn-icon-sm rounded-md ${viewMode === 'list' ? 'bg-primary text-white hover:bg-primary hover:text-white' : ''}`}
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('board')}
                title={t('ordersPage.viewBoard')}
                className={`btn-icon-sm rounded-md ${viewMode === 'board' ? 'bg-primary text-white hover:bg-primary hover:text-white' : ''}`}
              >
                <Columns3 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Список заказов */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="md" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="cab-card">
            <div className="empty-state">
              <div className="empty-state-icon">
                <ShoppingCart className="w-7 h-7 text-gray-400" />
              </div>
              <p className="empty-state-title">
                {searchQuery || statusFilter !== 'all' ? t('ordersPage.notFound') : t('ordersPage.empty')}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <p className="empty-state-text">
                  <button
                    onClick={() => navigate('/parts/orders/create')}
                    className="text-primary font-semibold hover:underline"
                  >
                    {t('ordersPage.createFirst')}
                  </button>
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* ── Канбан-доска (только md+, только viewMode=board) ── */}
            {viewMode === 'board' && (
              <div className="hidden md:block mb-4">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <div className="grid grid-cols-3 gap-4">
                    {BOARD_COLUMNS.map(col => {
                      const colOrders = ordersWithOptimistic.filter(o => o.status === col.status)
                      return (
                        <BoardColumn
                          key={col.status}
                          status={col.status}
                          label={t(`ordersPage.boardCol_${col.status}`)}
                          dot={col.dot}
                          ring={col.ring}
                          orders={colOrders}
                          formatUSD={formatUSD}
                          computeOrderUSD={computeOrderUSD}
                          onCardClick={(id) => navigate(`/parts/orders/${id}`)}
                          activeId={activeId}
                        />
                      )
                    })}
                  </div>

                  {/* DragOverlay — «призрак» при перетаскивании */}
                  <DragOverlay>
                    {activeOrder ? (
                      <div className="cab-card p-3 shadow-2xl rotate-2 opacity-95 w-64">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wide truncate" style={{ color: 'var(--cab-ink-3)' }}>{activeOrder.order_number}</span>
                          <span className="text-sm font-extrabold tabular-nums flex-shrink-0" style={{ color: 'var(--cab-ink)', letterSpacing: '-0.02em' }}>
                            {formatUSD(computeOrderUSD(activeOrder))}
                          </span>
                        </div>
                        <p className="text-sm font-semibold truncate mb-1" style={{ color: 'var(--cab-ink)' }}>
                          {activeOrder.customer?.full_name ?? '—'}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--cab-ink-3)' }}>{formatDate(activeOrder.order_date)}</p>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </div>
            )}

            {/* ── Таблица (md+, viewMode=list) — скрыта в режиме доски ── */}
            {(viewMode === 'list') && (
              <div className="cab-card p-0 overflow-hidden hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="table-header-cell">{t('ordersPage.thOrderNumber')}</th>
                        <th className="table-header-cell">{t('ordersPage.thParts')}</th>
                        <th className="table-header-cell">{t('ordersPage.thCustomer')}</th>
                        <th className="table-header-cell">{t('ordersPage.thDate')}</th>
                        <th className="table-header-cell">{t('ordersPage.thStatus')}</th>
                        <th className="table-header-cell text-right">{t('ordersPage.thSum')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredOrders.map((order) => (
                        <tr
                          key={order.id}
                          onClick={() => navigate(`/parts/orders/${order.id}`)}
                          className="table-row cursor-pointer group/row"
                        >
                          <td className="table-cell">
                            <span className="kicker text-gray-400">{order.order_number}</span>
                          </td>
                          <td className="table-cell">
                            <div className="font-semibold text-gray-900 group-hover/row:text-primary transition-colors line-clamp-2 max-w-xs">
                              {order.items && order.items.length > 0
                                ? order.items.map((i) => i.inventory_item?.name).filter(Boolean).join(', ')
                                : '—'}
                            </div>
                            {order.items && order.items.length > 0 && (
                              <span className="text-xs text-gray-400 mt-0.5 block">{t('ordersPage.positions', { n: order.items.length })}</span>
                            )}
                          </td>
                          <td className="table-cell">
                            {order.customer ? (
                              <div>
                                <div className="font-semibold text-gray-800">{order.customer.full_name}</div>
                                {order.customer.phone && (
                                  <div className="text-xs text-gray-400 mt-0.5">{order.customer.phone}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="table-cell whitespace-nowrap text-gray-500">
                            {formatDate(order.order_date)}
                          </td>
                          <td className="table-cell whitespace-nowrap">
                            <span className={statusBadge(order.status)}>
                              {getPartsOrderStatusText(order.status)}
                            </span>
                          </td>
                          <td className="table-cell whitespace-nowrap text-right">
                            <span className="text-base font-extrabold tabular text-primary" style={{ letterSpacing: '-0.02em' }}>
                              {formatUSD(computeOrderUSD(order))}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Mobile — плоские карточки (<md, всегда список) */}
            <div className="flex flex-col gap-2 md:hidden stagger-children">
              {filteredOrders.map((order) => {
                const itemNames = order.items && order.items.length > 0
                  ? order.items.map((i) => i.inventory_item?.name).filter(Boolean).join(', ')
                  : '—'
                return (
                  <div
                    key={order.id}
                    onClick={() => navigate(`/parts/orders/${order.id}`)}
                    className="cab-card cab-card-hover p-4"
                  >
                    {/* Строка 1: клиент + сумма */}
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-900 truncate">
                          {order.customer?.full_name ?? '—'}
                        </p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{itemNames}</p>
                      </div>
                      <span className="text-base font-extrabold tabular text-primary flex-shrink-0" style={{ letterSpacing: '-0.02em' }}>
                        {formatUSD(computeOrderUSD(order))}
                      </span>
                    </div>
                    {/* Строка 2: дата · статус */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <span>{formatDate(order.order_date)}</span>
                      <span>·</span>
                      <span className={statusBadge(order.status)}>
                        {getPartsOrderStatusText(order.status)}
                      </span>
                      {order.items && order.items.length > 0 && (
                        <>
                          <span>·</span>
                          <span>{t('ordersPage.positions', { n: order.items.length })}</span>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
