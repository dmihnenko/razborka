import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Edit, TrendingUp, TrendingDown, Plus, Settings, Trash2, Tag, Sparkles, X, Car, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { getPartsCategoryTemplates, createPartsInventoryItem, getStorageLocations, updateVehicleStatus } from '@/services/partsService'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { toast } from 'sonner'
import type { PartsVehicle, PartsVehicleStatus, CreatePartsInventoryInput, StorageLocation } from '@/types/parts'
import type { ImgbbPhoto } from '@/services/imgbbService'
import { deletePhotosFromImgbb } from '@/services/imgbbService'
import PartsVehicleModal from '@/components/parts/PartsVehicleModal'
import { ConveyorModal } from '@/components/parts/ConveyorModal'
import { formatPrice } from '@/utils/currency'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { PartsInventoryModal } from '@/pages/PartsInventory'
import { moveToTrash } from '@/services/trashService'

// ── Статусы разборки ──────────────────────────────────────────────────────────
const STATUS_BADGE: Record<PartsVehicleStatus, string> = {
  awaiting:    'badge badge-yellow',
  in_progress: 'badge badge-blue',
  dismantled:  'badge badge-green',
}

const STATUS_BTN_ACTIVE: Record<PartsVehicleStatus, string> = {
  awaiting:    'bg-yellow-100 text-yellow-800 border border-yellow-300',
  in_progress: 'bg-blue-100   text-blue-800   border border-blue-300',
  dismantled:  'bg-green-100  text-green-800  border border-green-300',
}

const STATUS_LABELS: Record<PartsVehicleStatus, string> = {
  awaiting:    'Ожидает',
  in_progress: 'В процессе',
  dismantled:  'Разобран',
}

// ── Статусы запчастей ─────────────────────────────────────────────────────────
const PART_STATUS_BADGE: Record<string, string> = {
  available: 'badge badge-green',
  sold:      'badge badge-gray',
  reserved:  'badge badge-yellow',
}
const PART_STATUS_LABELS: Record<string, string> = {
  available: 'В наличии',
  sold:      'Продано',
  reserved:  'Резерв',
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
  const { confirm: showConfirm, dialogProps } = useConfirm()
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddPartOpen, setIsAddPartOpen] = useState(false)
  const [isConveyorOpen, setIsConveyorOpen] = useState(false)
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)
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
    enabled: !!partsCompanyId && (isAddPartOpen || isConveyorOpen),
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
      toast.success('Запчасть добавлена')
      setIsAddPartOpen(false)
    },
    onError: () => toast.error('Ошибка при добавлении'),
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
      toast.success('Запчасти добавлены')
      setIsAddPartOpen(false)
    },
    onError: () => toast.error('Ошибка при добавлении'),
  })

  // Delete part mutation
  const deletePartMutation = useMutation({
    mutationFn: async (part: { id: string; photos?: ImgbbPhoto[]; name?: string }) => {
      if (part.photos?.length) {
        await deletePhotosFromImgbb(part.photos)
      }
      await moveToTrash({
        entityType: 'parts_inventory',
        entityId: part.id,
        entityLabel: part.name ? `Запчасть: ${part.name}` : 'Запчасть',
        entityData: part,
        partsCompanyId: partsCompanyId,
      })
      const { error } = await supabase
        .from('parts_inventory')
        .delete()
        .eq('id', part.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-parts', id] })
      queryClient.invalidateQueries({ queryKey: ['trash'] })
      toast.success('Запчасть перемещена в корзину')
    },
    onError: (error: any) => {
      if (error?.status === 409 || error?.code === '23503') {
        toast.error('Нельзя удалить: запчасть входит в заказ. Сначала удалите её из заказа.')
      } else {
        toast.error('Ошибка при удалении')
      }
    },
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
      return data
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
      toast.success('Статус обновлён')
    },
    onError: () => toast.error('Ошибка смены статуса'),
  })

  // Update vehicle
  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
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
      toast.success('Данные сохранены')
    },
    onError: () => toast.error('Ошибка сохранения'),
  })

  // ── Profitability ─────────────────────────────────────────────────────────
  const exchangeRate = vehicle?.exchange_rate || globalRate || 41
  const purchasePrice = vehicle?.purchase_price || 0
  const purchasePriceUSD = purchasePrice / exchangeRate
  const totalRevenue = parts
    .filter((p: any) => p.status === 'sold')
    .reduce((sum: number, p: any) => {
      const price = (p.sold_price != null ? p.sold_price : p.selling_price) || 0
      const inUAH = p.price_currency === 'UAH' ? price : price * exchangeRate
      return sum + inUAH
    }, 0)
  const totalRevenueUSD = totalRevenue / exchangeRate
  const profit = totalRevenue - purchasePrice
  const profitUSD = profit / exchangeRate
  const isProfitable = profit > 0

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
        <p className="empty-state-title">Автомобиль не найден</p>
        <button
          onClick={() => navigate('/parts/vehicles')}
          className="mt-3 btn-ghost btn-sm"
        >
          Вернуться к списку
        </button>
      </div>
    )
  }

  const soldCount      = parts.filter((p: any) => p.status === 'sold').length
  const availableCount = parts.filter((p: any) => p.status === 'available').length
  const recoveryPct    = purchasePrice > 0
    ? ((totalRevenue / purchasePrice) * 100).toFixed(1)
    : null

  return (
    <div className="animate-fade-in">

      {/* ── Sticky page header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="page-container py-0 flex items-center justify-between gap-3 h-14">
          {/* Back + title */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => navigate('/parts/vehicles')}
              className="btn-icon flex-shrink-0"
              aria-label="Назад"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h1 className="page-title truncate text-base sm:text-lg">
                {vehicle.make} {vehicle.model}
                {vehicle.year && (
                  <span className="text-gray-400 font-normal ml-1">({vehicle.year})</span>
                )}
              </h1>
            </div>
            <span className={STATUS_BADGE[vehicle.status]}>
              {STATUS_LABELS[vehicle.status]}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setIsConveyorOpen(true)}
              className="btn-primary btn-sm"
              title="Быстрый ввод запчастей (Конвейер)"
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Конвейер</span>
            </button>
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="btn-secondary btn-sm"
            >
              <Edit className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Редактировать</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="page-container space-y-5">

        {/* ── Hero: vehicle info + status ──────────────────────────────────── */}
        <div className="card">
          {/* Status switcher */}
          <div className="mb-5">
            <p className="kicker text-gray-400 mb-2">Статус разборки</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_LABELS) as PartsVehicleStatus[]).map(status => (
                <button
                  key={status}
                  onClick={() => statusMutation.mutate(status)}
                  disabled={statusMutation.isPending}
                  className={`btn btn-sm transition-all ${
                    vehicle.status === status
                      ? STATUS_BTN_ACTIVE[status]
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                  }`}
                >
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </div>

          {/* Info grid */}
          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4 border-t border-gray-100 pt-5">
            {vehicle.make && vehicle.model && (
              <InfoRow label="Марка и модель" value={`${vehicle.make} ${vehicle.model}`} />
            )}
            {vehicle.year && (
              <InfoRow label="Год выпуска" value={vehicle.year} />
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
              <InfoRow label="Цвет" value={vehicle.color} />
            )}
            {vehicle.mileage && (
              <InfoRow
                label="Пробег"
                value={
                  <span className="tabular">
                    {vehicle.mileage.toLocaleString('ru-RU')} км
                  </span>
                }
              />
            )}
            {vehicle.license_plate && (
              <InfoRow label="Гос. номер" value={vehicle.license_plate} mono />
            )}
            {vehicle.purchase_price ? (
              <InfoRow
                label="Цена покупки"
                value={
                  <span className="tabular text-red-600">
                    ${purchasePriceUSD.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                  </span>
                }
              />
            ) : null}
            {vehicle.purchase_date && (
              <InfoRow
                label="Дата покупки"
                value={new Date(vehicle.purchase_date).toLocaleDateString('ru-RU')}
              />
            )}
          </dl>

          {vehicle.notes && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="kicker text-gray-400 mb-1">Примечания</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{vehicle.notes}</p>
            </div>
          )}
        </div>

        {/* ── Two-column grid: parts + sidebar ──────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── Parts list ────────────────────────────────────────────────── */}
          <div className="lg:col-span-2 card p-0 overflow-hidden">
            {/* Section header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="heading-3 text-base">
                Запчасти
                {parts.length > 0 && (
                  <span className="ml-2 kicker text-gray-400 normal-case">
                    {parts.length}
                  </span>
                )}
              </h2>
              <button
                onClick={() => setIsAddPartOpen(true)}
                className="btn-primary btn-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Добавить</span>
              </button>
            </div>

            {parts.length === 0 ? (
              <div className="empty-state py-12">
                <div className="empty-state-icon">
                  <Tag className="w-8 h-8 text-gray-400" />
                </div>
                <p className="empty-state-title">Запчастей пока нет</p>
                <p className="empty-state-text">Добавьте первую запчасть с этого автомобиля</p>
                <button
                  onClick={() => setIsAddPartOpen(true)}
                  className="mt-4 btn-primary btn-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Добавить запчасть
                </button>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="table-header-cell">Запчасть</th>
                        <th className="table-header-cell text-right">Цена</th>
                        <th className="table-header-cell text-center">Статус</th>
                        <th className="table-header-cell w-10" />
                      </tr>
                    </thead>
                    <tbody className="grid-hairline">
                      {parts.map((part: any) => (
                        <tr key={part.id} className="table-row">
                          <td className="table-cell">
                            <div className="font-semibold text-gray-900 leading-tight">{part.name}</div>
                            {part.part_number && (
                              <div className="text-xs text-gray-400 font-mono mt-0.5">
                                № {part.part_number}
                              </div>
                            )}
                            {part.photos?.length > 0 && (
                              <div className="flex gap-1 mt-1.5 flex-wrap">
                                {part.photos.slice(0, 4).map((photo: ImgbbPhoto, i: number) => (
                                  <img
                                    key={i}
                                    src={photo.thumb_url || photo.url}
                                    alt={part.name}
                                    className="w-9 h-9 object-cover rounded border border-gray-200"
                                  />
                                ))}
                                {part.photos.length > 4 && (
                                  <div className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded border border-gray-200 text-xs text-gray-500 font-medium">
                                    +{part.photos.length - 4}
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
                              {PART_STATUS_LABELS[part.status] ?? part.status}
                            </span>
                          </td>
                          <td className="table-cell w-10 pr-3">
                            <button
                              onClick={async () => {
                                const ok = await showConfirm({
                                  message: `Удалить «${part.name}»?`,
                                  danger: true,
                                })
                                if (!ok) return
                                deletePartMutation.mutate({
                                  id: part.id,
                                  photos: part.photos,
                                  name: part.name,
                                })
                              }}
                              disabled={deletePartMutation.isPending}
                              className="btn-icon-sm text-gray-400 hover:text-red-600 hover:bg-red-50"
                              title="Удалить запчасть"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden divide-y divide-gray-100">
                  {parts.map((part: any) => (
                    <div key={part.id} className="px-4 py-3 flex items-start gap-3">
                      {/* Thumb */}
                      {part.photos?.length > 0 ? (
                        <img
                          src={part.photos[0].thumb_url || part.photos[0].url}
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
                            {PART_STATUS_LABELS[part.status] ?? part.status}
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

                      {/* Delete */}
                      <button
                        onClick={async () => {
                          const ok = await showConfirm({
                            message: `Удалить «${part.name}»?`,
                            danger: true,
                          })
                          if (!ok) return
                          deletePartMutation.mutate({
                            id: part.id,
                            photos: part.photos,
                            name: part.name,
                          })
                        }}
                        disabled={deletePartMutation.isPending}
                        className="btn-icon-sm text-gray-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                        title="Удалить"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── Sidebar ──────────────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Profitability card */}
            <div className="card space-y-4">
              <h2 className="heading-3 text-base">Окупаемость</h2>

              {/* Stale rate warning */}
              {!vehicle?.exchange_rate && rateIsStale && (
                <div className="alert alert-warning py-2 text-xs">
                  <span className="flex-1">Курс не обновлён сегодня</span>
                  <button
                    onClick={() => navigate('/parts/settings')}
                    className="flex items-center gap-1 font-semibold hover:underline flex-shrink-0"
                  >
                    <Settings className="w-3 h-3" />
                    Обновить
                  </button>
                </div>
              )}

              <div className="panel-divided">
                {/* Purchase */}
                <div className="flex items-center justify-between gap-3 pb-3">
                  <span className="text-sm text-gray-500">Цена покупки</span>
                  <div className="text-right">
                    <div className="tabular font-semibold text-red-600 text-sm">
                      ${purchasePriceUSD.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                    </div>
                    {purchasePrice > 0 && (
                      <div className="text-xs text-gray-400 tabular">
                        {purchasePrice.toLocaleString('ru-RU')} ₴ · курс {exchangeRate}
                      </div>
                    )}
                  </div>
                </div>

                {/* Revenue */}
                <div className="flex items-center justify-between gap-3 py-3">
                  <span className="text-sm text-gray-500">Доход от продаж</span>
                  <div className="text-right">
                    <div className="tabular font-semibold text-green-600 text-sm">
                      ${totalRevenueUSD.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                    </div>
                    {totalRevenue > 0 && (
                      <div className="text-xs text-gray-400 tabular">
                        {totalRevenue.toLocaleString('ru-RU')} ₴
                      </div>
                    )}
                  </div>
                </div>

                {/* Total profit */}
                <div className="pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-gray-700">Итого</span>
                    <div className="flex items-center gap-2">
                      {isProfitable
                        ? <TrendingUp className="w-4 h-4 text-green-600 flex-shrink-0" />
                        : <TrendingDown className="w-4 h-4 text-red-600 flex-shrink-0" />}
                      <div className="text-right">
                        <div
                          className={`text-xl font-extrabold tabular leading-none ${
                            isProfitable ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {profitUSD > 0 ? '+' : ''}$
                          {Math.abs(profitUSD).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                        </div>
                        <div
                          className={`text-xs tabular font-medium mt-0.5 ${
                            isProfitable ? 'text-green-500' : 'text-red-400'
                          }`}
                        >
                          {profit > 0 ? '+' : ''}{profit.toLocaleString('ru-RU')} ₴
                        </div>
                      </div>
                    </div>
                  </div>
                  {recoveryPct && (
                    <p className="text-xs text-gray-400 text-right mt-1 tabular">
                      {recoveryPct}% окупаемости
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Stats card */}
            <div className="card">
              <h2 className="heading-3 text-base mb-4">Статистика</h2>
              <dl className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Всего', value: parts.length, cls: 'text-gray-900' },
                  { label: 'Продано', value: soldCount, cls: 'text-green-600' },
                  { label: 'В наличии', value: availableCount, cls: 'text-primary' },
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
            </div>

            {/* Brand template suggestion */}
            {!suggestionDismissed && unimportedTemplates.length > 0 && (
              <div className="card border-indigo-200/80 bg-indigo-50/60">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="icon-tile-sm bg-indigo-100">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                    </span>
                    <p className="text-sm font-semibold text-indigo-900 leading-tight">
                      {unimportedTemplates.length} кат. для {vehicle.make}
                    </p>
                  </div>
                  <button
                    onClick={() => setSuggestionDismissed(true)}
                    className="btn-icon-sm text-indigo-400 hover:text-indigo-600"
                    aria-label="Закрыть"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-indigo-600/80 mb-3">
                  Стандартные категории от администратора — можно импортировать или создать свои.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      navigate(
                        `/parts/categories?tab=templates&brand=${encodeURIComponent(vehicle.make)}`,
                      )
                    }
                    className="flex-1 btn btn-sm bg-indigo-700 text-white hover:bg-indigo-800"
                  >
                    <Tag className="w-3 h-3" />
                    Импортировать
                  </button>
                  <button
                    onClick={() => navigate('/parts/categories')}
                    className="flex-1 btn btn-sm bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  >
                    Создать свои
                  </button>
                </div>
              </div>
            )}

            {/* No categories nudge */}
            {(suggestionDismissed || unimportedTemplates.length === 0) &&
              myCategoryNames.length === 0 && (
                <div className="card text-center py-6">
                  <div className="empty-state-icon mx-auto">
                    <Tag className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-500 mb-2">Категорий нет</p>
                  <button
                    onClick={() => navigate('/parts/categories')}
                    className="text-primary hover:underline text-xs font-semibold"
                  >
                    Добавить категории
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

      {isConveyorOpen && partsCompanyId && (
        <ConveyorModal
          partsCompanyId={partsCompanyId}
          vehicles={[{ id: vehicle.id, make: vehicle.make, model: vehicle.model, year: vehicle.year ?? undefined }]}
          categories={categories}
          initialVehicleId={vehicle.id}
          onClose={() => {
            queryClient.invalidateQueries({ queryKey: ['vehicle-parts', id] })
            queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
            setIsConveyorOpen(false)
          }}
        />
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
