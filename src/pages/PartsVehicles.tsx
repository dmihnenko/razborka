import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import { Spinner } from '@/components/ui/Spinner'
import { Plus, Search, Car, Filter, Grid, List } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useSubscriptionLimits } from '@/hooks/useSubscription'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import LimitReachedBanner from '@/components/subscription/LimitReachedBanner'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { getPartsVehicles, createPartsVehicle, updatePartsVehicle, deletePartsVehicle, getPartsCategoryTemplates, getPartsInventoryByVehicle } from '@/services/partsService'
import { moveToTrash } from '@/services/trashService'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import PartsVehicleModal from '@/components/parts/PartsVehicleModal'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import type { PartsVehicle, CreatePartsVehicleInput, PartsVehicleStatus } from '@/types/parts'

const statusLabels: Record<PartsVehicleStatus, string> = {
  awaiting: i18n.t('cabinet:vehiclesPage.statusAwaiting'),
  in_progress: i18n.t('cabinet:vehiclesPage.statusInProgress'),
  dismantled: i18n.t('cabinet:vehiclesPage.statusDismantled'),
}

const statusBadge: Record<PartsVehicleStatus, string> = {
  awaiting:    'cab-chip text-amber-700 bg-amber-50 border-amber-200',
  in_progress: 'cab-chip cab-chip-signal',
  dismantled:  'cab-chip text-emerald-700 bg-emerald-50 border-emerald-200',
}

const statusDot: Record<PartsVehicleStatus, string> = {
  awaiting:    'bg-yellow-500',
  in_progress: 'bg-blue-500',
  dismantled:  'bg-green-500',
}

type ViewMode = 'grid' | 'list'

export default function PartsVehicles() {
  const { t } = useTranslation('cabinet')
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const { rate: globalRate } = usePartsExchangeRate()

  const formatPriceUSD = (vehicle: PartsVehicle) => {
    if (!vehicle.purchase_price) return '—'
    const rate = vehicle.exchange_rate || globalRate || 41
    const usd = vehicle.purchase_price / rate
    return '$' + usd.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<PartsVehicle | null>(null)

  const queryClient = useQueryClient()
  const { confirm: showConfirm, dialogProps } = useConfirm()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id
  const { canCreate, usage, limits } = useSubscriptionLimits()

  // Fetch vehicles
  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['parts-vehicles', partsCompanyId],
    queryFn: () => getPartsVehicles(partsCompanyId!),
    enabled: !!partsCompanyId
  })

  // Create/Update vehicle
  const saveMutation = useMutation({
    mutationFn: async (data: CreatePartsVehicleInput) => {
      if (selectedVehicle) {
        return updatePartsVehicle(selectedVehicle.id, data)
      } else {
        if (!canCreate.vehicle()) throw new Error(t('vehiclesPage.limitReachedError'))
        return createPartsVehicle(data, partsCompanyId!)
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['parts-vehicles'] })
      toast.success(selectedVehicle ? t('vehiclesPage.vehicleUpdated') : t('vehiclesPage.vehicleAdded'))
      setIsModalOpen(false)
      // Check for brand templates when creating new vehicle
      if (!selectedVehicle && data?.make) {
        const make = data.make
        getPartsCategoryTemplates(make).then(templates => {
          if (templates.length > 0) {
            toast(t('vehiclesPage.templatesFound', { n: templates.length, make }), {
              description: t('vehiclesPage.templatesDescription'),
              action: {
                label: t('vehiclesPage.open'),
                onClick: () => navigate(`/parts/categories?tab=templates&brand=${encodeURIComponent(make)}`),
              },
              duration: 9000,
            })
          }
        }).catch(() => {})
      }
      setSelectedVehicle(null)
    },
    onError: (error: any) => {
      const msg = error?.message || error?.details || t('vehiclesPage.saveError')
      toast.error(msg)
      console.error(error)
    }
  })

  // Delete vehicle
  const deleteMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      const vehicle = await import('@/services/partsService').then(m => m.getPartsVehicle(vehicleId).catch(() => null))
      const parts = await getPartsInventoryByVehicle(vehicleId)
      if (vehicle) {
        await moveToTrash({
          entityType: 'parts_vehicle',
          entityId: vehicleId,
          entityLabel: `${vehicle.make || ''} ${vehicle.model || ''}`.trim() || t('vehiclesPage.entityFallback'),
          entityData: { vehicle, parts: parts || [] },
          partsCompanyId,
        })
      }
      await deletePartsVehicle(vehicleId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-vehicles'] })
      toast.success(t('vehiclesPage.vehicleDeleted'))
    },
    onError: () => {
      toast.error(t('vehiclesPage.deleteError'))
    }
  })

  // Filter vehicles
  const filteredVehicles = vehicles.filter(vehicle => {
    const matchesSearch = searchQuery === '' ||
      vehicle.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.vin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.license_plate?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === 'all' || vehicle.status === statusFilter

    return matchesSearch && matchesStatus
  })

  // Group by status for statistics
  const stats = {
    total: vehicles.length,
    awaiting: vehicles.filter(v => v.status === 'awaiting').length,
    in_progress: vehicles.filter(v => v.status === 'in_progress').length,
    dismantled: vehicles.filter(v => v.status === 'dismantled').length,
  }

  const handleEdit = (vehicle: PartsVehicle, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedVehicle(vehicle)
    setIsModalOpen(true)
  }

  const handleDelete = async (vehicleId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const ok = await showConfirm({ message: t('vehiclesPage.deleteConfirm'), danger: true })
    if (!ok) return
    deleteMutation.mutate(vehicleId)
  }

  if (!partsCompanyId) {
    return <PartsAccessDenied />
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <PartsPageHeader
        title={i18n.t('cabinet:pages.vehicles')}
        subtitle={i18n.t('cabinet:pages.totalN', { n: stats.total })}
        backPath="/parts/dashboard"
        actions={
          <button
            onClick={() => {
              setSelectedVehicle(null)
              setIsModalOpen(true)
            }}
            className="cab-btn cab-btn-primary"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t('vehiclesPage.add')}</span>
          </button>
        }
      />

      <div className="page-container animate-fade-in">

      {/* Limit reached banner */}
      {!canCreate.vehicle() && limits.maxVehicles !== null && (
        <div className="mb-5">
          <LimitReachedBanner
            used={usage.vehicles}
            max={limits.maxVehicles}
            label={t('vehiclesPage.vehiclesLabel')}
            ctaHref="/parts/subscription"
          />
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {([
          { key: 'all',         label: t('vehiclesPage.statTotal'),    value: stats.total,       dotCls: 'bg-gray-400',   ringCls: 'ring-primary' },
          { key: 'awaiting',    label: t('vehiclesPage.statAwaiting'),  value: stats.awaiting,    dotCls: statusDot.awaiting,    ringCls: 'ring-yellow-500' },
          { key: 'in_progress', label: t('vehiclesPage.statInProgress'), value: stats.in_progress, dotCls: statusDot.in_progress, ringCls: 'ring-blue-500' },
          { key: 'dismantled',  label: t('vehiclesPage.statDismantled'),value: stats.dismantled,  dotCls: statusDot.dismantled,  ringCls: 'ring-green-500' },
        ] as const).map(({ key, label, value, dotCls, ringCls }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`cab-card p-4 text-left ${statusFilter === key ? `ring-2 ${ringCls}` : ''}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="kicker">{label}</span>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotCls}`} />
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 tabular-nums" style={{ letterSpacing: '-0.03em' }}>
              {value}
            </p>
          </button>
        ))}
      </div>

      {/* Filters & View Controls */}
      <div className="cab-card mb-5 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder={t('vehiclesPage.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input pl-9"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 self-start sm:self-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`btn-icon-sm ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              title={t('vehiclesPage.gridView')}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`btn-icon-sm ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              title={t('vehiclesPage.listView')}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {statusFilter !== 'all' && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-sm text-gray-500">
              {t('vehiclesPage.filterLabel')} <span className="font-semibold text-gray-700">{statusLabels[statusFilter as PartsVehicleStatus]}</span>
            </span>
            <button
              onClick={() => setStatusFilter('all')}
              className="text-sm text-primary hover:underline font-medium"
            >
              {t('vehiclesPage.reset')}
            </button>
          </div>
        )}
      </div>

      {/* Vehicles List/Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="md" />
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="cab-card p-4">
          <div className="empty-state">
            <div className="empty-state-icon">
              <Car className="w-8 h-8 text-gray-400" />
            </div>
            <p className="empty-state-title">
              {searchQuery || statusFilter !== 'all' ? t('vehiclesPage.notFound') : t('vehiclesPage.empty')}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <>
                <p className="empty-state-text">{t('vehiclesPage.emptyText')}</p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="cab-btn cab-btn-primary mt-5"
                >
                  <Plus className="w-4 h-4" />
                  {t('vehiclesPage.addVehicle')}
                </button>
              </>
            )}
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* ── Grid (mobile: 1 col, sm: 2, lg: 3) ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {filteredVehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              onClick={() => navigate(`/parts/vehicles/${vehicle.id}`)}
              className="cab-card cab-card-hover flex flex-col overflow-hidden"
            >
              {/* Card body */}
              <div className="p-4 flex-1">
                {/* Status */}
                <div className="mb-3">
                  <span className={statusBadge[vehicle.status]}>
                    {statusLabels[vehicle.status]}
                  </span>
                </div>

                {/* Title */}
                <h3 className="heading-3 mb-0.5 group-hover:text-primary transition-colors">
                  {vehicle.make} {vehicle.model}
                </h3>
                {vehicle.year && (
                  <p className="text-sm text-gray-500 tabular-nums">{vehicle.year} {t('vehiclesPage.yearSuffix')}</p>
                )}

                {/* Details */}
                <div className="mt-3 space-y-1.5 text-sm">
                  {vehicle.vin && (
                    <div className="flex items-baseline gap-1.5 text-gray-600 min-w-0">
                      <span className="kicker shrink-0">VIN</span>
                      <span className="font-mono text-xs truncate text-gray-700">{vehicle.vin}</span>
                    </div>
                  )}
                  {vehicle.color && (
                    <div className="flex items-baseline gap-1.5 text-gray-600">
                      <span className="kicker shrink-0">{t('vehiclesPage.color')}</span>
                      <span>{vehicle.color}</span>
                    </div>
                  )}
                  {vehicle.purchase_price && (
                    <div className="flex items-baseline gap-1.5">
                      <span className="kicker shrink-0">{t('vehiclesPage.purchase')}</span>
                      <span className="font-semibold text-gray-900 tabular-nums">{formatPriceUSD(vehicle)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions footer */}
              <div className="border-t border-gray-100 px-4 py-3 flex gap-2 bg-gray-50/60">
                <button
                  onClick={(e) => handleEdit(vehicle, e)}
                  className="cab-btn cab-btn-secondary cab-btn-sm flex-1"
                >
                  {t('vehiclesPage.edit')}
                </button>
                <button
                  onClick={(e) => handleDelete(vehicle.id, e)}
                  className="cab-btn cab-btn-danger cab-btn-sm"
                >
                  {t('vehiclesPage.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── Table (list mode) ── */
        <div className="cab-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header-cell">{t('vehiclesPage.colVehicle')}</th>
                  <th className="table-header-cell hidden lg:table-cell">VIN</th>
                  <th className="table-header-cell hidden md:table-cell">{t('vehiclesPage.colStatus')}</th>
                  <th className="table-header-cell text-right hidden sm:table-cell">{t('vehiclesPage.colPurchasePrice')}</th>
                  <th className="table-header-cell text-right">{t('vehiclesPage.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredVehicles.map((vehicle) => (
                  <tr
                    key={vehicle.id}
                    onClick={() => navigate(`/parts/vehicles/${vehicle.id}`)}
                    className="table-row cursor-pointer"
                  >
                    <td className="table-cell">
                      <p className="font-semibold text-gray-900">{vehicle.make} {vehicle.model}</p>
                      {vehicle.year && (
                        <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
                          {vehicle.year}{vehicle.color ? ` · ${vehicle.color}` : ''}
                        </p>
                      )}
                    </td>
                    <td className="table-cell hidden lg:table-cell">
                      {vehicle.vin
                        ? <span className="font-mono text-xs text-gray-600 max-w-[160px] block truncate">{vehicle.vin}</span>
                        : <span className="text-gray-400">—</span>
                      }
                    </td>
                    <td className="table-cell hidden md:table-cell">
                      <span className={statusBadge[vehicle.status]}>
                        {statusLabels[vehicle.status]}
                      </span>
                    </td>
                    <td className="table-cell hidden sm:table-cell text-right font-semibold text-gray-900 tabular-nums">
                      {formatPriceUSD(vehicle)}
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => handleEdit(vehicle, e)}
                          className="cab-btn cab-btn-ghost cab-btn-sm"
                        >
                          {t('vehiclesPage.change')}
                        </button>
                        <button
                          onClick={(e) => handleDelete(vehicle.id, e)}
                          className="cab-btn cab-btn-ghost cab-btn-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          {t('vehiclesPage.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <PartsVehicleModal
          isOpen={isModalOpen}
          vehicle={selectedVehicle}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedVehicle(null)
          }}
          onSubmit={async (data) => {
            await saveMutation.mutateAsync(data)
          }}
        />
      )}
      <ConfirmDialog {...dialogProps} />
      </div>
    </div>
  )
}
