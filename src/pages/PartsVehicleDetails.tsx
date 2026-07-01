import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Spinner } from '@/components/ui/Spinner'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Edit, TrendingUp, TrendingDown, Plus, Settings, Tag, Sparkles, X, Car, DollarSign, Download } from 'lucide-react'
import { exportSingleVehicleXlsx } from '@/utils/vehiclesXlsx'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { getPartsCategoryTemplates, createPartsInventoryItem, getStorageLocations, updateVehicleStatus } from '@/services/partsService'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { toast } from 'sonner'
import type { PartsVehicle, PartsVehicleStatus, CreatePartsInventoryInput, CreatePartsVehicleInput, StorageLocation, PartsInventoryItem } from '@/types/parts'
import type { ImgbbPhoto } from '@/services/imgbbService'
import PartsVehicleModal from '@/components/parts/PartsVehicleModal'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import SellPartModal from '@/components/parts/SellPartModal'
import { formatPrice } from '@/utils/currency'
import { PartsInventoryModal } from '@/pages/PartsInventory'

// ── Статусы разборки ──────────────────────────────────────────────────────────
const STATUS_BADGE: Record<PartsVehicleStatus, string> = {
  awaiting:    'cab-chip text-amber-700 bg-amber-50 border-amber-200',
  in_progress: 'cab-chip cab-chip-signal',
  dismantled:  'cab-chip text-emerald-700 bg-emerald-50 border-emerald-200',
}

const STATUS_BTN_ACTIVE: Record<PartsVehicleStatus, string> = {
  awaiting:    'bg-amber-100 text-amber-800 border border-amber-300',
  in_progress: 'bg-primary/10 text-primary border border-primary/30',
  dismantled:  'bg-emerald-100 text-emerald-800 border border-emerald-300',
}

// ── Статусы запчастей ─────────────────────────────────────────────────────────
const PART_STATUS_BADGE: Record<string, string> = {
  available: 'badge badge-green',
  sold:      'badge badge-gray',
  reserved:  'badge badge-yellow',
  damaged:   'badge badge-red',
}

// ── Строка характеристики hero-карточки ──────────────────────────────────────
function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="kicker text-gray-400">{label}</dt>
      <dd className={`text-sm font-semibold text-gray-900 ${mono ? 'font-mono tabular break-all' : ''}`}>
        {value}
      </dd>
    </div>
  )
}

export default function PartsVehicleDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslation('cabinet')
  const statusLabels: Record<PartsVehicleStatus, string> = {
    awaiting:    t('vehicleDetailsPage.status_awaiting'),
    in_progress: t('vehicleDetailsPage.status_in_progress'),
    dismantled:  t('vehicleDetailsPage.status_dismantled'),
  }
  const partStatusLabels: Record<string, string> = {
    available: t('vehicleDetailsPage.partStatus_available'),
    sold:      t('vehicleDetailsPage.partStatus_sold'),
    reserved:  t('vehicleDetailsPage.partStatus_reserved'),
  }
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddPartOpen, setIsAddPartOpen] = useState(false)
  const [sellPart, setSellPart] = useState<PartsInventoryItem | null>(null)
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)
  const [exporting, setExporting] = useState(false)
  const { rate: globalRate, isStale: rateIsStale } = usePartsExchangeRate()

  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id

  // Fetch vehicle
  const { data: vehicle, isLoading } = useQuery({
    queryKey: ['parts-vehicle', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_vehicles')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as PartsVehicle
    },
    enabled: !!id,
  })

  // Fetch all company categories (for add-part modal + template suggestion)
  const { data: categories = [] } = useQuery({
    queryKey: ['parts-categories', partsCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_categories')
        .select('id, name')
        .eq('parts_company_id', partsCompanyId)
        .order('name')
      if (error) throw error
      return data
    },
    enabled: !!partsCompanyId && isAddPartOpen,
  })

  const { data: storageLocations = [] } = useQuery({
    queryKey: ['storage-locations', partsCompanyId],
    queryFn: () => getStorageLocations(partsCompanyId!),
    enabled: !!partsCompanyId && isAddPartOpen,
  })

  // Fetch brand-level template categories for suggestion banner
  const { data: brandTemplates = [] } = useQuery({
    queryKey: ['parts-brand-templates', vehicle?.make],
    queryFn: () => getPartsCategoryTemplates(vehicle!.make),
    enabled: !!vehicle?.make && !!partsCompanyId && !suggestionDismissed,
    staleTime: 1000 * 60 * 10,
  })

  // Company's own category names (for dedup check)
  const { data: myCategoryNames = [] } = useQuery<string[]>({
    queryKey: ['parts-category-names', partsCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_categories')
        .select('name')
        .eq('parts_company_id', partsCompanyId)
        .eq('is_active', true)
      if (error) throw error
      return (data || []).map(c => c.name.toLowerCase())
    },
    enabled: !!partsCompanyId && !suggestionDismissed,
    staleTime: 1000 * 60 * 5,
  })

  const unimportedTemplates = brandTemplates.filter(
    t => !myCategoryNames.includes(t.name.toLowerCase()),
  )

  // Add part mutation
  const addPartMutation = useMutation({
    mutationFn: (data: CreatePartsInventoryInput) =>
      createPartsInventoryItem({ ...data, vehicle_id: data.vehicle_id || id }, partsCompanyId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-parts', id] })
      toast.success(t('vehicleDetailsPage.toastPartAdded'))
      setIsAddPartOpen(false)
    },
    onError: () => toast.error(t('vehicleDetailsPage.toastAddError')),
  })

  const addBulkMutation = useMutation({
    mutationFn: (items: CreatePartsInventoryInput[]) =>
      Promise.all(
        items.map(data =>
          createPartsInventoryItem({ ...data, vehicle_id: data.vehicle_id || id }, partsCompanyId!),
        ),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-parts', id] })
      toast.success(t('vehicleDetailsPage.toastPartsAdded'))
      setIsAddPartOpen(false)
    },
    onError: () => toast.error(t('vehicleDetailsPage.toastAddError')),
  })

  // Fetch parts for this vehicle
  const { data: parts = [] } = useQuery({
    queryKey: ['vehicle-parts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_inventory')
        .select('*')
        .eq('vehicle_id', id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as PartsInventoryItem[]
    },
    enabled: !!id,
  })

  // Update status
  const statusMutation = useMutation({
    mutationFn: async (status: PartsVehicleStatus) => {
      await updateVehicleStatus(id!, status, vehicle)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-vehicle', id] })
      queryClient.invalidateQueries({ queryKey: ['parts-vehicles'] })
      toast.success(t('vehicleDetailsPage.toastStatusUpdated'))
    },
    onError: () => toast.error(t('vehicleDetailsPage.toastStatusError')),
  })

  // Update vehicle
  const updateMutation = useMutation({
    mutationFn: async (updates: CreatePartsVehicleInput) => {
      const { error } = await supabase
        .from('parts_vehicles')
        .update(updates)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-vehicle', id] })
      queryClient.invalidateQueries({ queryKey: ['parts-vehicles'] })
      setIsEditModalOpen(false)
      toast.success(t('vehicleDetailsPage.toastSaved'))
    },
    onError: () => toast.error(t('vehicleDetailsPage.toastSaveError')),
  })

  // ── Окупаемость ───────────────────────────────────────────────────────────
  // Курс фиксируется в МОМЕНТ продажи (exchange_rate_at_sale на запчасти).
  // Старые продажи без зафиксированного курса — фолбэк на курс авто/текущий.
  const exchangeRate = vehicle?.exchange_rate || globalRate // курс авто (закупка); undefined пока не загружен
  const purchasePrice = vehicle?.purchase_price || 0
  const purchasePriceUSD = exchangeRate ? purchasePrice / exchangeRate : 0
  const sold = parts.filter(p => p.status === 'sold')
  const totalRevenue = sold.reduce((sum, p) => {
    const price = (p.sold_price != null ? p.sold_price : p.selling_price) || 0
    const rate = p.exchange_rate_at_sale || exchangeRate // зафиксированный на момент продажи
    // USD-позиция без курса — пропускаем (без NaN); грн — считаем как есть
    const inUAH = p.price_currency === 'UAH' ? price : (rate ? price * rate : 0)
    return sum + inUAH
  }, 0)
  const totalRevenueUSD = sold.reduce((sum, p) => {
    const price = (p.sold_price != null ? p.sold_price : p.selling_price) || 0
    const rate = p.exchange_rate_at_sale || exchangeRate
    const inUSD = p.price_currency === 'UAH' ? (rate ? price / rate : 0) : price
    return sum + inUSD
  }, 0)
  const profit = totalRevenue - purchasePrice
  const profitUSD = totalRevenueUSD - purchasePriceUSD
  const isProfitable = profitUSD > 0

  // ── Loading / empty states ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-dvh">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!vehicle) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <Car className="w-8 h-8 text-gray-400" />
        </div>
        <p className="empty-state-title">{t('vehicleDetailsPage.notFound')}</p>
        <button
          onClick={() => navigate('/parts/vehicles')}
          className="mt-3 cab-btn cab-btn-ghost cab-btn-sm"
        >
          {t('vehicleDetailsPage.backToList')}
        </button>
      </div>
    )
  }

  const soldCount      = parts.filter(p => p.status === 'sold').length
  const availableCount = parts.filter(p => p.status === 'available').length
  const recoveryPct    = purchasePrice > 0
    ? ((totalRevenue / purchasePrice) * 100).toFixed(1)
    : null

  // ── Экспорт этого авто (один лист XLSX) ──
  const handleExportVehicle = async () => {
    if (!vehicle) return
    setExporting(true)
    try {
      const res = await exportSingleVehicleXlsx(vehicle, parts as PartsInventoryItem[])
      toast.success(t('vehicleDetailsPage.exportDone', { p: res.parts }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('vehicleDetailsPage.exportError'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-dvh bg-gray-50">

      {/* ── Sticky page header ─────────────────────────────────────────────── */}
      <PartsPageHeader
        backPath="/parts/vehicles"
        height="sm"
        title={`${vehicle.make} ${vehicle.model}${vehicle.year ? ` (${vehicle.year})` : ''}`}
        actions={
          <>
            <span className={`${STATUS_BADGE[vehicle.status]} hidden sm:inline-flex`}>
              {t(`vehicleDetailsPage.status_${vehicle.status}`)}
            </span>
            <button
              onClick={handleExportVehicle}
              disabled={exporting}
              className="cab-btn cab-btn-secondary cab-btn-sm"
              title={t('vehicleDetailsPage.exportVehicle')}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{exporting ? t('vehicleDetailsPage.exporting') : t('vehicleDetailsPage.exportVehicle')}</span>
            </button>
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="cab-btn cab-btn-secondary cab-btn-sm"
            >
              <Edit className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('vehicleDetailsPage.edit')}</span>
            </button>
          </>
        }
      />

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="page-container py-5 space-y-5">

        {/* ── Hero: vehicle info + status ──────────────────────────────────── */}
        <div className="cab-card p-4">
          {/* Status switcher */}
          <div className="mb-5">
            <p className="kicker text-gray-400 mb-2">{t('vehicleDetailsPage.dismantleStatus')}</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(statusLabels) as PartsVehicleStatus[]).map(status => (
                <button
                  key={status}
                  onClick={() => statusMutation.mutate(status)}
                  disabled={statusMutation.isPending}
                  className={`cab-btn cab-btn-sm transition-all ${
                    vehicle.status === status
                      ? STATUS_BTN_ACTIVE[status]
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                  }`}
                >
                  {t(`vehicleDetailsPage.status_${status}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Info grid */}
          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4 border-t border-gray-100 pt-5">
            {vehicle.make && vehicle.model && (
              <InfoRow label={t('vehicleDetailsPage.makeModel')} value={`${vehicle.make} ${vehicle.model}`} />
            )}
            {vehicle.year && (
              <InfoRow label={t('vehicleDetailsPage.year')} value={vehicle.year} />
            )}
            {vehicle.vin && (
              <div className="col-span-2 flex flex-col gap-0.5">
                <dt className="kicker text-gray-400">VIN</dt>
                <dd className="text-sm font-semibold text-gray-900 font-mono tabular tracking-wide break-all">
                  {vehicle.vin}
                </dd>
              </div>
            )}
            {vehicle.color && (
              <InfoRow label={t('vehicleDetailsPage.color')} value={vehicle.color} />
            )}
            {vehicle.mileage && (
              <InfoRow
                label={t('vehicleDetailsPage.mileage')}
                value={
                  <span className="tabular">
                    {vehicle.mileage.toLocaleString('ru-RU')} {t('vehicleDetailsPage.km')}
                  </span>
                }
              />
            )}
            {vehicle.license_plate && (
              <InfoRow label={t('vehicleDetailsPage.licensePlate')} value={vehicle.license_plate} mono />
            )}
            {vehicle.purchase_price ? (
              <InfoRow
                label={t('vehicleDetailsPage.purchasePrice')}
                value={
                  <span className="tabular text-red-600">
                    ${purchasePriceUSD.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                  </span>
                }
              />
            ) : null}
            {vehicle.purchase_date && (
              <InfoRow
                label={t('vehicleDetailsPage.purchaseDate')}
                value={new Date(vehicle.purchase_date).toLocaleDateString('ru-RU')}
              />
            )}
          </dl>

          {vehicle.notes && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="kicker text-gray-400 mb-1">{t('vehicleDetailsPage.notes')}</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{vehicle.notes}</p>
            </div>
          )}
        </div>

        {/* ── Two-column grid: parts + sidebar ──────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── Parts list ────────────────────────────────────────────────── */}
          <div className="lg:col-span-2 cab-card overflow-hidden">
            {/* Section header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="heading-3 text-base">
                {t('vehicleDetailsPage.parts')}
                {parts.length > 0 && (
                  <span className="ml-2 kicker text-gray-400 normal-case">
                    {parts.length}
                  </span>
                )}
              </h2>
              <button
                onClick={() => setIsAddPartOpen(true)}
                className="cab-btn cab-btn-primary cab-btn-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('vehicleDetailsPage.add')}</span>
              </button>
            </div>

            {parts.length === 0 ? (
              <div className="empty-state py-12">
                <div className="empty-state-icon">
                  <Tag className="w-8 h-8 text-gray-400" />
                </div>
                <p className="empty-state-title">{t('vehicleDetailsPage.partsEmpty')}</p>
                <p className="empty-state-text">{t('vehicleDetailsPage.partsEmptyText')}</p>
                <button
                  onClick={() => setIsAddPartOpen(true)}
                  className="mt-4 cab-btn cab-btn-primary cab-btn-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t('vehicleDetailsPage.addPart')}
                </button>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="table-header-cell">{t('vehicleDetailsPage.colPart')}</th>
                        <th className="table-header-cell text-right">{t('vehicleDetailsPage.colPrice')}</th>
                        <th className="table-header-cell text-center">{t('vehicleDetailsPage.colStatus')}</th>
                        <th className="table-header-cell w-28" />
                      </tr>
                    </thead>
                    <tbody className="grid-hairline">
                      {parts.map((part) => (
                        <tr
                          key={part.id}
                          onClick={() => navigate(`/parts/inventory/${part.id}`)}
                          className="table-row cursor-pointer hover:bg-gray-50"
                        >
                          <td className="table-cell">
                            <div className="font-semibold text-gray-900 leading-tight">{part.name}</div>
                            {part.part_number && (
                              <div className="text-xs text-gray-500 font-mono mt-0.5">
                                № {part.part_number}
                              </div>
                            )}
                            {(part.photos?.length ?? 0) > 0 && (
                              <div className="flex gap-1 mt-1.5 flex-wrap">
                                {(part.photos ?? []).slice(0, 4).map((photo: ImgbbPhoto, i: number) => (
                                  <img
                                    key={i}
                                    src={photo.thumb_url || photo.url}
                                    alt={part.name}
                                    className="w-9 h-9 object-cover rounded border border-gray-200"
                                  />
                                ))}
                                {(part.photos ?? []).length > 4 && (
                                  <div className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded border border-gray-200 text-xs text-gray-500 font-medium">
                                    +{(part.photos ?? []).length - 4}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="table-cell text-right tabular font-semibold text-gray-900">
                            {part.status === 'sold'
                              ? formatPrice(
                                  part.sold_price ?? part.selling_price,
                                  (part.price_currency || 'USD') as 'UAH' | 'USD',
                                )
                              : formatPrice(
                                  part.selling_price,
                                  (part.price_currency || 'USD') as 'UAH' | 'USD',
                                )}
                          </td>
                          <td className="table-cell text-center">
                            <span className={PART_STATUS_BADGE[part.status] ?? 'badge badge-gray'}>
                              {partStatusLabels[part.status] ? t(`vehicleDetailsPage.partStatus_${part.status}`) : part.status}
                            </span>
                          </td>
                          <td className="table-cell w-28 pr-3 text-right" onClick={(e) => e.stopPropagation()}>
                            {part.status !== 'sold' ? (
                              <button
                                onClick={() => setSellPart(part)}
                                className="cab-btn cab-btn-success cab-btn-sm"
                                title={t('vehicleDetailsPage.sellBtn')}
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                                <span className="hidden lg:inline">{t('vehicleDetailsPage.sellBtn')}</span>
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">{t('vehicleDetailsPage.partStatus_sold')}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden divide-y divide-gray-100">
                  {parts.map((part) => (
                    <div
                      key={part.id}
                      onClick={() => navigate(`/parts/inventory/${part.id}`)}
                      className="px-4 py-3 flex items-start gap-3 cursor-pointer active:bg-gray-50"
                    >
                      {/* Thumb */}
                      {(part.photos?.length ?? 0) > 0 ? (
                        <img
                          src={part.photos?.[0]?.thumb_url || part.photos?.[0]?.url}
                          alt={part.name}
                          className="w-12 h-12 rounded-lg object-cover border border-gray-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Tag className="w-5 h-5 text-gray-300" />
                        </div>
                      )}

                      {/* Main */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-sm text-gray-900 truncate leading-tight">
                            {part.name}
                          </span>
                          <span className={`${PART_STATUS_BADGE[part.status] ?? 'badge badge-gray'} flex-shrink-0`}>
                            {partStatusLabels[part.status] ? t(`vehicleDetailsPage.partStatus_${part.status}`) : part.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1 gap-2">
                          <span className="text-sm tabular font-semibold text-gray-700">
                            {part.status === 'sold'
                              ? formatPrice(
                                  part.sold_price ?? part.selling_price,
                                  (part.price_currency || 'USD') as 'UAH' | 'USD',
                                )
                              : formatPrice(
                                  part.selling_price,
                                  (part.price_currency || 'USD') as 'UAH' | 'USD',
                                )}
                          </span>
                          {part.part_number && (
                            <span className="text-xs text-gray-400 font-mono truncate">
                              № {part.part_number}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Sell */}
                      {part.status !== 'sold' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSellPart(part) }}
                          className="cab-btn cab-btn-success cab-btn-sm flex-shrink-0"
                          title={t('vehicleDetailsPage.sellBtn')}
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── Sidebar ──────────────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Объединённая карточка: Статистика + Окупаемость */}
            <div className="cab-card p-4 space-y-4">

              {/* 3 мини-плитки */}
              <dl className="grid grid-cols-3 gap-2">
                {[
                  { label: t('vehicleDetailsPage.statTotal'), value: parts.length, cls: 'text-gray-900' },
                  { label: t('vehicleDetailsPage.statSold'), value: soldCount, cls: 'text-emerald-600' },
                  { label: t('vehicleDetailsPage.statAvailable'), value: availableCount, cls: 'text-primary' },
                ].map(({ label, value, cls }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center justify-center bg-gray-50 rounded-xl py-3 gap-0.5"
                  >
                    <dd className={`text-xl font-extrabold tabular leading-none ${cls}`}>{value}</dd>
                    <dt className="kicker text-gray-400">{label}</dt>
                  </div>
                ))}
              </dl>

              {/* Stale rate warning */}
              {!vehicle?.exchange_rate && rateIsStale && (
                <div className="alert alert-warning py-2 text-xs">
                  <span className="flex-1">{t('vehicleDetailsPage.rateNotUpdated')}</span>
                  <button
                    onClick={() => navigate('/parts/settings')}
                    className="flex items-center gap-1 font-semibold hover:underline flex-shrink-0"
                  >
                    <Settings className="w-3 h-3" />
                    {t('vehicleDetailsPage.refresh')}
                  </button>
                </div>
              )}

              {/* Финансовые строки */}
              <div className="panel-divided border-t border-gray-100 pt-4">
                {/* Purchase */}
                <div className="flex items-center justify-between gap-3 pb-2.5">
                  <span className="text-sm text-gray-500">{t('vehicleDetailsPage.finPurchase')}</span>
                  <div className="text-right">
                    <div className="tabular font-semibold text-red-600 text-sm">
                      ${purchasePriceUSD.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                    </div>
                    {purchasePrice > 0 && (
                      <div className="text-xs text-gray-400 tabular">
                        {purchasePrice.toLocaleString('ru-RU')} {t('vehicleDetailsPage.uah')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Revenue */}
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-sm text-gray-500">{t('vehicleDetailsPage.finRevenue')}</span>
                  <div className="text-right">
                    <div className="tabular font-semibold text-emerald-600 text-sm">
                      ${totalRevenueUSD.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                    </div>
                    {totalRevenue > 0 && (
                      <div className="text-xs text-gray-400 tabular">
                        {totalRevenue.toLocaleString('ru-RU')} {t('vehicleDetailsPage.uah')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Total profit */}
                <div className="pt-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {isProfitable
                        ? <TrendingUp className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        : <TrendingDown className="w-4 h-4 text-red-600 flex-shrink-0" />}
                      <span className="font-semibold text-sm text-gray-700">{t('vehicleDetailsPage.finTotal')}</span>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-xl font-extrabold tabular leading-none ${
                          isProfitable ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {profitUSD > 0 ? '+' : ''}$
                        {Math.abs(profitUSD).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                      </div>
                      <div
                        className={`text-xs tabular font-medium mt-0.5 ${
                          isProfitable ? 'text-emerald-500' : 'text-red-400'
                        }`}
                      >
                        {profit > 0 ? '+' : ''}{profit.toLocaleString('ru-RU')} {t('vehicleDetailsPage.uah')}
                        {recoveryPct && <span className="ml-1 text-gray-400">· {recoveryPct}%</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Brand template suggestion */}
            {!suggestionDismissed && unimportedTemplates.length > 0 && (
              <div className="cab-card p-4 border-primary/20 bg-primary/5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="icon-tile-sm bg-primary/10">
                      <Sparkles className="w-4 h-4 text-primary" />
                    </span>
                    <p className="text-sm font-semibold text-primary leading-tight">
                      {t('vehicleDetailsPage.templatesCount', { n: unimportedTemplates.length, make: vehicle.make })}
                    </p>
                  </div>
                  <button
                    onClick={() => setSuggestionDismissed(true)}
                    className="btn-icon-sm text-primary/60 hover:text-primary"
                    aria-label={t('vehicleDetailsPage.close')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-primary/70 mb-3">
                  {t('vehicleDetailsPage.templatesHint')}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      navigate(
                        `/parts/categories?tab=templates&brand=${encodeURIComponent(vehicle.make)}`,
                      )
                    }
                    className="flex-1 cab-btn cab-btn-signal cab-btn-sm"
                  >
                    <Tag className="w-3 h-3" />
                    {t('vehicleDetailsPage.import')}
                  </button>
                  <button
                    onClick={() => navigate('/parts/categories')}
                    className="flex-1 cab-btn cab-btn-secondary cab-btn-sm"
                  >
                    {t('vehicleDetailsPage.createOwn')}
                  </button>
                </div>
              </div>
            )}

            {/* No categories nudge */}
            {(suggestionDismissed || unimportedTemplates.length === 0) &&
              myCategoryNames.length === 0 && (
                <div className="cab-card p-4 text-center py-6">
                  <div className="empty-state-icon mx-auto">
                    <Tag className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{t('vehicleDetailsPage.noCategories')}</p>
                  <button
                    onClick={() => navigate('/parts/categories')}
                    className="text-primary hover:underline text-xs font-semibold"
                  >
                    {t('vehicleDetailsPage.addCategories')}
                  </button>
                </div>
              )}
          </div>
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <PartsVehicleModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={async data => {
          await updateMutation.mutateAsync(data)
        }}
        vehicle={vehicle}
      />

      {isAddPartOpen && (
        <PartsInventoryModal
          item={null}
          categories={categories}
          vehicles={[vehicle]}
          storageLocations={storageLocations as StorageLocation[]}
          onClose={() => setIsAddPartOpen(false)}
          onSave={data => addPartMutation.mutate(data)}
          onSaveBulk={items => addBulkMutation.mutate(items)}
          isSaving={addPartMutation.isPending || addBulkMutation.isPending}
          initialVehicleId={id}
        />
      )}


      {sellPart && partsCompanyId && (
        <SellPartModal
          item={sellPart}
          partsCompanyId={partsCompanyId}
          onClose={() => setSellPart(null)}
          onSold={() => {
            queryClient.invalidateQueries({ queryKey: ['vehicle-parts', id] })
            queryClient.invalidateQueries({ queryKey: ['parts-vehicle', id] })
          }}
        />
      )}
    </div>
  )
}
