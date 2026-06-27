import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Archive, Car, Edit, Package, User, Clock, ShoppingBag } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { getPersonalVehicles } from '@/services/personalVehicles'
import { getMyMarketplaceOrders } from '@/services/marketplaceService'
import { useUserProfile } from '@/hooks/useUserProfile'
import PersonalVehicleModal from '@/components/personal-vehicles/PersonalVehicleModal'
import ShareLinkModal from '@/components/personal-vehicles/ShareLinkModal'
import EmptyState from '@/components/ui/EmptyState'
import ProfileSettings from '@/pages/ProfileSettings'
import MyOrdersPanel from '@/components/orders/MyOrdersPanel'
import { STATUS_CHIP, totalsByCurrency, dateLocale } from '@/components/orders/OrderCard'
import { formatPrice } from '@/utils/currency'

const NO_IMAGE_URL = '/noimage_final.png'

// Короткие RU-подписи статусов для превью последнего заказа в рейле.
const STATUS_LABEL: Record<string, string> = {
  new: 'Новый',
  viewed: 'Принят',
  closed: 'Закрыт',
  cancelled: 'Отменён',
}

type CabinetTab = 'vehicles' | 'orders' | 'profile'

export default function MyVehicles() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [shareVehicleId, setShareVehicleId] = useState<string | null>(null)
  const [tab, setTab] = useState<CabinetTab>('vehicles')

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['personal-vehicles', profile?.id],
    queryFn: () => getPersonalVehicles(profile!.id, false),
    enabled: !!profile?.id,
    staleTime: 60_000,
  })

  // Лёгкий запрос только ради счётчика заказов в рейле (ключ общий с панелью — кэш переиспользуется).
  const { data: orders = [] } = useQuery({
    queryKey: ['my-orders', profile?.id],
    queryFn: getMyMarketplaceOrders,
    enabled: !!profile?.id,
  })

  const handleEdit = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigate(`/public/personal-vehicle/${id}`)
  }

  const handleCardClick = (id: string) => {
    navigate(`/public/personal-vehicle/${id}`)
  }

  const handleCreateSuccess = (vehicleId: string) => {
    queryClient.invalidateQueries({ queryKey: ['personal-vehicles'] })
    navigate(`/public/personal-vehicle/${vehicleId}`)
  }

  const renderClassicCard = (vehicle: any) => {
    const usdRate = vehicle.usdRate || 1
    const allItems = [
      ...(vehicle.lotItems || []),
      ...(vehicle.partsItems || []),
      ...(vehicle.workItems || []),
      ...(vehicle.additionalItems || []),
    ]
    const totalUSD = allItems.filter((i) => i.currency === 'USD').reduce((s, i) => s + i.cost, 0)
    const totalUAH = allItems.filter((i) => i.currency === 'UAH').reduce((s, i) => s + i.cost, 0)
    const grandTotal = totalUSD + totalUAH / usdRate

    return (
      <div
        key={vehicle.id}
        onClick={() => handleCardClick(vehicle.id)}
        className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer group"
      >
        <div className="relative h-32 sm:h-40 md:h-48 overflow-hidden">
          <img
            src={vehicle.photoUrl || NO_IMAGE_URL}
            alt={vehicle.makeModel}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
        </div>

        <div className="p-3 sm:p-4 md:p-5">
          <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 mb-2 truncate">
            {vehicle.makeModel}
          </h3>

          <div className="space-y-0.5 sm:space-y-1 mb-2.5 sm:mb-3 md:mb-4">
            <p className="text-gray-600 text-xs sm:text-sm">
              <span className="font-medium">Год:</span> {vehicle.year}
            </p>
            {vehicle.vin ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-gray-600 text-xs sm:text-sm font-mono truncate">
                  <span className="font-medium font-sans">VIN:</span> {vehicle.vin}
                </p>
                <div className="bg-blue-50 rounded-lg px-2 py-0.5 sm:px-3 sm:py-1 border border-blue-200 flex-shrink-0">
                  <p className="text-xs sm:text-xs text-gray-500 uppercase tracking-wide leading-tight text-right">Стоимость</p>
                  <p className="text-sm sm:text-base md:text-lg font-bold text-blue-600 whitespace-nowrap leading-tight">
                    ${grandTotal.toFixed(2)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <div className="bg-blue-50 rounded-lg px-2 py-0.5 sm:px-3 sm:py-1 border border-blue-200">
                  <p className="text-xs sm:text-xs text-gray-500 uppercase tracking-wide leading-tight text-right">Стоимость</p>
                  <p className="text-sm sm:text-base md:text-lg font-bold text-blue-600 whitespace-nowrap leading-tight">
                    ${grandTotal.toFixed(2)}
                  </p>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={(e) => handleEdit(vehicle.id, e)}
            className="w-full flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-700 text-white rounded-md hover:bg-blue-800 transition-colors text-xs sm:text-sm font-medium"
          >
            <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
            Открыть
          </button>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-gray-400">
          <span className="w-5 h-5 border-2 border-gray-200 border-t-primary rounded-full animate-spin" />
          <span className="text-sm font-medium">Загрузка…</span>
        </div>
      </div>
    )
  }

  // ── Кнопка раздела в левом рейле ─────────────────────────────────────
  const NavButton = ({
    id,
    icon: Icon,
    label,
    count,
  }: {
    id: CabinetTab
    icon: typeof Car
    label: string
    count?: number
  }) => {
    const isActive = tab === id
    return (
      <button
        onClick={() => setTab(id)}
        className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-colors text-left ${
          isActive
            ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
            : 'bg-white border-gray-100 text-gray-700 hover:border-blue-200 hover:bg-blue-50/50'
        }`}
      >
        <Icon className="w-5 h-5 shrink-0" strokeWidth={1.5} />
        <span className="font-semibold text-sm">{label}</span>
        {count !== undefined && count > 0 && (
          <span className={`ml-auto text-xs font-medium tabular-nums ${isActive ? 'text-blue-100' : 'text-gray-400'}`}>
            {count}
          </span>
        )}
      </button>
    )
  }

  const lastOrder = orders[0]
  const lastOrderTotals = lastOrder ? totalsByCurrency(lastOrder) : []

  const rail = (
    <aside className="lg:w-72 lg:shrink-0 space-y-2">
      <NavButton id="vehicles" icon={Car} label="Мои авто" count={vehicles.length} />
      <NavButton id="orders" icon={Package} label="Заказы с разборки" count={orders.length} />

      {/* Превью последнего заказа — клик открывает раздел заказов; если заказов нет — плашка с кнопкой в маркет */}
      {!lastOrder ? (
        <div className="bg-white border border-gray-100 rounded-xl px-3.5 py-5 text-center">
          <ShoppingBag className="w-6 h-6 text-gray-300 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-xs text-gray-400 mb-3">Пока нет заказов с разборок</p>
          <button
            onClick={() => navigate('/market/catalog')}
            className="btn-secondary btn-sm w-full justify-center"
          >
            В каталог запчастей
          </button>
        </div>
      ) : (
        <button
          onClick={() => setTab('orders')}
          className="w-full text-left bg-white border border-gray-100 rounded-xl px-3.5 py-3 hover:border-blue-200 hover:bg-blue-50/40 transition-colors"
        >
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
            Последний заказ
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-800 truncate">
              {lastOrder.company?.name || 'Заказ'}
            </span>
            <span
              className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${
                STATUS_CHIP[lastOrder.status] || STATUS_CHIP.closed
              }`}
            >
              {STATUS_LABEL[lastOrder.status] || lastOrder.status}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-1">
            <span className="flex items-center gap-1 text-[11px] text-gray-400 min-w-0">
              <Clock className="w-3 h-3 shrink-0" />
              <span className="truncate">
                {formatDistanceToNow(new Date(lastOrder.createdAt), { addSuffix: true, locale: dateLocale() })}
              </span>
            </span>
            <span className="shrink-0 text-xs font-bold text-blue-600 tabular-nums">
              {lastOrderTotals.map((tt) => formatPrice(tt.sum, tt.currency)).join(' · ')}
            </span>
          </div>
        </button>
      )}

      <NavButton id="profile" icon={User} label="Профиль" />
    </aside>
  )

  // ── Раздел «Мои авто» ────────────────────────────────────────────────
  const vehiclesView = (
    <div className="space-y-5">
      <header className="card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="icon-tile-lg bg-blue-50 text-blue-600 shrink-0">
              <Car className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <h1 className="page-title">Мои авто</h1>
              <p className="page-subtitle">
                Расходы и история
                {vehicles.length > 0 && ` · ${vehicles.length}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={() => navigate('/my-vehicles/archive')} className="btn-secondary flex-1 sm:flex-none">
              <Archive className="w-4 h-4" strokeWidth={1.5} />
              <span>Архив</span>
            </button>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary flex-1 sm:flex-none">
              <Plus className="w-4 h-4" strokeWidth={1.5} />
              <span>Добавить</span>
            </button>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-0 overflow-hidden">
              <div className="aspect-[16/10] bg-gray-100 animate-shimmer" />
              <div className="p-4 space-y-3">
                <div className="h-5 w-2/3 rounded-lg bg-gray-100 animate-shimmer" />
                <div className="h-4 w-1/2 rounded-lg bg-gray-100 animate-shimmer" />
                <div className="h-9 rounded-xl bg-gray-100 animate-shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <EmptyState
          icon={Car}
          title="У вас пока нет автомобилей"
          description="Добавьте ваш первый автомобиль — и отслеживайте расходы и историю."
          action={
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              <Plus className="w-4 h-4" strokeWidth={1.5} />
              Добавить автомобиль
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {vehicles.map((vehicle) => renderClassicCard(vehicle))}
        </div>
      )}
    </div>
  )

  // ── Раздел «Заказы с разборки» ───────────────────────────────────────
  const ordersView = (
    <div className="space-y-5">
      <header className="card p-5 sm:p-6">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="icon-tile-lg bg-blue-50 text-blue-600 shrink-0">
            <Package className="w-6 h-6" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <h1 className="page-title">Заказы с разборки</h1>
            <p className="page-subtitle">
              Ваши заявки на запчасти
              {orders.length > 0 && ` · ${orders.length}`}
            </p>
          </div>
        </div>
      </header>
      <MyOrdersPanel />
    </div>
  )

  return (
    <div className="py-1 sm:py-2">
      <div className="lg:flex lg:gap-6 space-y-4 lg:space-y-0">
        {rail}
        <div className="flex-1 min-w-0">
          {tab === 'orders' ? ordersView : tab === 'profile' ? <ProfileSettings embedded /> : vehiclesView}
        </div>
      </div>

      {/* Модалки */}
      <PersonalVehicleModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
        userId={profile.id}
      />

      {shareVehicleId && (
        <ShareLinkModal
          isOpen={true}
          onClose={() => setShareVehicleId(null)}
          vehicleId={shareVehicleId}
          userId={profile.id}
        />
      )}
    </div>
  )
}
