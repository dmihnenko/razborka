import { useState, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import { Spinner } from '@/components/ui/Spinner'
import { Plus, Search, Car, Filter, Grid, List, Download, Upload, FileSpreadsheet, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useSubscriptionLimits } from '@/hooks/useSubscription'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import LimitReachedBanner from '@/components/subscription/LimitReachedBanner'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { getPartsVehicles, createPartsVehicle, updatePartsVehicle, deletePartsVehicle, getPartsCategoryTemplates, getPartsInventoryByVehicle, getVehicleRoi, getPartsInventory, createPartsInventoryItem, updateVehicleStatus } from '@/services/partsService'
import { moveToTrash } from '@/services/trashService'
import { exportVehiclesXlsx, downloadVehiclesTemplate, parseVehiclesFile, type ParsedVehicle, type ParsedPart } from '@/utils/vehiclesXlsx'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import PartsVehicleModal from '@/components/parts/PartsVehicleModal'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import type { PartsVehicle, CreatePartsVehicleInput, PartsVehicleStatus, VehicleRoi } from '@/types/parts'

/** Бейдж окупаемости авто: % возврата + цвет (окупилось/в процессе/в минусе). */
function roiBadge(r?: VehicleRoi): { pct: number; cls: string } | null {
  if (!r || r.investment_usd == null || r.investment_usd <= 0) return null
  const paid = r.realized_usd >= r.investment_usd
  const loss = r.realized_usd + r.stock_usd < r.investment_usd
  const cls = paid
    ? 'text-emerald-700 bg-emerald-50 ring-emerald-100'
    : loss
      ? 'text-red-700 bg-red-50 ring-red-100'
      : 'text-amber-700 bg-amber-50 ring-amber-100'
  return { pct: r.payback_pct ?? 0, cls }
}

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
  // Импорт/экспорт
  const [importOpen, setImportOpen] = useState(false)
  const [parsed, setParsed] = useState<{ vehicles: ParsedVehicle[]; parts: ParsedPart[] } | null>(null)
  const [exporting, setExporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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

  // Окупаемость по каждому авто (тот же RPC, что и страница «Окупаемость авто»)
  const { data: roiList = [] } = useQuery({
    queryKey: ['vehicle-roi', partsCompanyId, globalRate],
    queryFn: () => getVehicleRoi(partsCompanyId!, globalRate),
    enabled: !!partsCompanyId,
    staleTime: 5 * 60 * 1000,
  })
  const roiByVehicle = useMemo(
    () => new Map(roiList.map((r) => [r.vehicle_id, r])),
    [roiList],
  )

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

  // ── Экспорт: авто + их запчасти в оформленный XLSX ──
  const handleExport = async () => {
    setExporting(true)
    try {
      const all = await getPartsInventory(partsCompanyId!)
      const res = await exportVehiclesXlsx({ vehicles, parts: all, roi: roiByVehicle })
      toast.success(t('vehiclesPage.exportDone', { v: res.vehicles, p: res.parts }))
    } catch (e: any) {
      toast.error(e?.message || t('vehiclesPage.exportError'))
    } finally {
      setExporting(false)
    }
  }

  const handleFile = async (file: File) => {
    try {
      const data = await parseVehiclesFile(file)
      setParsed(data)
    } catch {
      toast.error(t('vehiclesPage.importParseError'))
    }
  }

  // ── Импорт: создаём авто и привязанные по VIN запчасти ──
  const importMutation = useMutation({
    mutationFn: async () => {
      if (!parsed) return { v: 0, p: 0, skipped: 0 }
      const existingVins = new Set(vehicles.map(v => v.vin?.toUpperCase()).filter(Boolean) as string[])
      const vinToId = new Map<string, string>()
      vehicles.forEach(v => { if (v.vin) vinToId.set(v.vin.toUpperCase(), v.id) })
      let cv = 0, cp = 0, skipped = 0
      for (const pv of parsed.vehicles) {
        if (pv._error) { skipped++; continue }
        const vinU = pv.vin?.toUpperCase()
        if (vinU && existingVins.has(vinU)) { skipped++; continue }   // дубль по VIN
        if (!canCreate.vehicle()) { skipped++; continue }              // лимит тарифа
        const created = await createPartsVehicle({
          make: pv.make, model: pv.model, year: pv.year, vin: pv.vin,
          license_plate: pv.license_plate, color: pv.color, mileage: pv.mileage,
          purchase_price: pv.purchase_price, purchase_date: pv.purchase_date, exchange_rate: pv.exchange_rate,
        }, partsCompanyId!)
        cv++
        if (vinU) { vinToId.set(vinU, created.id); existingVins.add(vinU) }
        if (pv.status !== 'awaiting') { try { await updateVehicleStatus(created.id, pv.status, created as any) } catch { /* статус не критичен */ } }
      }
      for (const pp of parsed.parts) {
        if (pp._error) { skipped++; continue }
        const vid = pp.vin ? vinToId.get(pp.vin.toUpperCase()) : undefined
        await createPartsInventoryItem({
          name: pp.name, part_number: pp.part_number, condition: pp.condition,
          quantity: pp.quantity, selling_price: pp.selling_price, price_currency: pp.price_currency,
          location: pp.location, vehicle_id: vid, status: 'available',
        }, partsCompanyId!)
        cp++
      }
      return { v: cv, p: cp, skipped }
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['parts-vehicles'] })
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      queryClient.invalidateQueries({ queryKey: ['vehicle-roi'] })
      toast.success(t('vehiclesPage.importDone', { v: r.v, p: r.p, skipped: r.skipped }))
      setImportOpen(false); setParsed(null)
    },
    onError: (e: any) => toast.error(e?.message || t('vehiclesPage.importError')),
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setImportOpen(true)}
              className="cab-btn cab-btn-secondary cab-btn-sm"
              title={t('vehiclesPage.import')}
            >
              <Upload className="w-4 h-4" strokeWidth={1.5} />
              <span className="hidden lg:inline">{t('vehiclesPage.import')}</span>
            </button>
            <button
              onClick={handleExport}
              disabled={exporting || vehicles.length === 0}
              className="cab-btn cab-btn-secondary cab-btn-sm"
              title={t('vehiclesPage.export')}
            >
              <Download className="w-4 h-4" strokeWidth={1.5} />
              <span className="hidden lg:inline">{exporting ? t('vehiclesPage.exporting') : t('vehiclesPage.export')}</span>
            </button>
            <button
              onClick={() => {
                setSelectedVehicle(null)
                setIsModalOpen(true)
              }}
              className="cab-btn cab-btn-primary cab-btn-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('vehiclesPage.add')}</span>
            </button>
          </div>
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
                  {(() => {
                    const b = roiBadge(roiByVehicle.get(vehicle.id))
                    return b && (
                      <div className="flex items-baseline gap-1.5">
                        <span className="kicker shrink-0">{t('vehiclesPage.recovery')}</span>
                        <span className={`inline-flex items-center px-1.5 h-5 rounded-full text-xs font-bold tabular-nums ring-1 ${b.cls}`}>
                          {b.pct}%
                        </span>
                      </div>
                    )
                  })()}
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
                  <th className="table-header-cell text-right hidden md:table-cell">{t('vehiclesPage.recovery')}</th>
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
                    <td className="table-cell hidden md:table-cell text-right">
                      {(() => {
                        const b = roiBadge(roiByVehicle.get(vehicle.id))
                        return b
                          ? <span className={`inline-flex items-center px-1.5 h-5 rounded-full text-xs font-bold tabular-nums ring-1 ${b.cls}`}>{b.pct}%</span>
                          : <span className="text-gray-400">—</span>
                      })()}
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

      {/* ── Модалка импорта авто + запчастей ── */}
      {importOpen && (
        <div className="modal-overlay" onClick={() => { setImportOpen(false); setParsed(null) }}>
          <div className="modal-sheet sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-gray-900">{t('vehiclesPage.importTitle')}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{t('vehiclesPage.importSubtitle')}</p>
              </div>
              <button type="button" onClick={() => { setImportOpen(false); setParsed(null) }} className="btn-icon btn-icon-sm ml-3 flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="modal-body space-y-4">
              {!parsed ? (
                <>
                  <label className="block border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".xlsx"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
                    />
                    <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" strokeWidth={1.5} />
                    <p className="text-sm font-medium text-gray-700">{t('vehiclesPage.importDrop')}</p>
                    <p className="text-xs text-gray-400 mt-1">{t('vehiclesPage.importHint')}</p>
                  </label>
                  <button onClick={() => downloadVehiclesTemplate()} className="cab-btn cab-btn-ghost cab-btn-sm w-full justify-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4" /> {t('vehiclesPage.template')}
                  </button>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="cab-card p-3">
                      <p className="kicker">{t('vehiclesPage.importVehicles')}</p>
                      <p className="heading-2 tabular-nums" style={{ color: 'var(--cab-ink)' }}>{parsed.vehicles.length}</p>
                    </div>
                    <div className="cab-card p-3">
                      <p className="kicker">{t('vehiclesPage.importParts')}</p>
                      <p className="heading-2 tabular-nums" style={{ color: 'var(--cab-ink)' }}>{parsed.parts.length}</p>
                    </div>
                  </div>
                  {(() => {
                    const errs = [...parsed.vehicles, ...parsed.parts].filter(x => x._error).length
                    return errs > 0 ? (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-700">
                        {t('vehiclesPage.importErrors', { n: errs })}
                      </div>
                    ) : null
                  })()}
                  <div className="max-h-44 overflow-auto rounded-lg border border-gray-100 divide-y divide-gray-50">
                    {parsed.vehicles.slice(0, 20).map((v, i) => (
                      <div key={i} className="px-3 py-1.5 text-xs flex items-center justify-between gap-2">
                        <span className="font-medium text-gray-800 truncate">{v.make} {v.model}{v.year ? ` ${v.year}` : ''}</span>
                        <span className="font-mono text-gray-400 truncate">{v.vin || '—'}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
              {parsed ? (
                <>
                  <button onClick={() => setParsed(null)} className="cab-btn cab-btn-secondary flex-1">{t('vehiclesPage.importOther')}</button>
                  <button onClick={() => importMutation.mutate()} disabled={importMutation.isPending} className="cab-btn cab-btn-primary flex-1">
                    {importMutation.isPending ? t('vehiclesPage.importing') : t('vehiclesPage.importDo')}
                  </button>
                </>
              ) : (
                <button onClick={() => setImportOpen(false)} className="cab-btn cab-btn-secondary w-full justify-center">{t('vehiclesPage.cancel')}</button>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
