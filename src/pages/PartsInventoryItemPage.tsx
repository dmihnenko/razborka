import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft, Trash2, Package,
  MapPin, Tag, Car, FileText, AlertTriangle,
  Share2, Edit2, Copy, Warehouse, CheckCircle2,
} from 'lucide-react'
import { getPartsInventoryItem, deletePartsInventoryItem, getStorageLocations } from '@/services/partsService'
import { moveToTrash } from '@/services/trashService'
import { useUserProfile } from '@/hooks/useUserProfile'
import { formatPrice } from '@/utils/currency'
import { PARTS_CONDITION_LABELS } from '@/utils/status'
import type { PartsInventoryStatus } from '@/types/parts'
import PhotoGallery from '@/components/parts/PhotoGallery'
import SellPartModal from '@/components/parts/SellPartModal'
import ShareModal from '@/components/ui/ShareModal'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

/* ── Status config ──────────────────────────────────────────────── */
const STATUS_LABEL: Record<PartsInventoryStatus, string> = {
  available: 'В наличии',
  reserved: 'Резерв',
  sold: 'Продано',
  damaged: 'Повреждено',
}

const STATUS_CLS: Record<PartsInventoryStatus, string> = {
  available: 'badge badge-green',
  reserved:  'badge badge-yellow',
  sold:      'badge badge-gray',
  damaged:   'badge badge-red',
}

/* ── Component ──────────────────────────────────────────────────── */
export default function PartsInventoryItemPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { confirm: showConfirm, dialogProps } = useConfirm()
  const { data: profile } = useUserProfile()
  const [isSellOpen, setIsSellOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const { data: item, isLoading, error } = useQuery({
    queryKey: ['parts-inventory-item', id],
    queryFn: () => getPartsInventoryItem(id!),
    enabled: !!id,
  })

  /* Storage location breadcrumb */
  const { data: locations = [] } = useQuery({
    queryKey: ['parts-storage-locations', profile?.parts_company_id],
    queryFn: () => getStorageLocations(profile!.parts_company_id!),
    enabled: !!profile?.parts_company_id && !!item?.storage_location_id,
    staleTime: 60_000,
  })

  const locationPath: string[] = (() => {
    if (!item?.storage_location_id || locations.length === 0) return []
    const byId = new Map(locations.map((l: any) => [l.id, l]))
    const path: string[] = []
    let cur: any = byId.get(item.storage_location_id)
    let guard = 0
    while (cur && guard++ < 20) {
      path.unshift(cur.name)
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
    }
    return path
  })()

  /* Delete mutation */
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (item) {
        await moveToTrash({
          entityType: 'parts_inventory',
          entityId: id!,
          entityLabel: item.name || 'Запчасть',
          entityData: item,
          partsCompanyId: profile?.parts_company_id,
        })
      }
      await deletePartsInventoryItem(id!)
    },
    onSuccess: () => {
      toast.success('Запчасть удалена')
      navigate('/parts/inventory')
    },
    onError: () => toast.error('Ошибка при удалении'),
  })

  const handleDelete = async () => {
    const ok = await showConfirm({
      message: `Удалить "${item?.name}"? Это действие нельзя отменить.`,
      danger: true,
    })
    if (!ok) return
    deleteMutation.mutate()
  }

  const photos = item?.photos || []
  const isSold = item?.status === 'sold'
  const lowStock = !item?.vehicle_id && (item?.quantity ?? 0) <= 2 && item?.status === 'available'

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <Spinner size="xl" />
      </div>
    )
  }

  /* ── Not found ── */
  if (error || !item) {
    return (
      <div className="empty-state min-h-dvh">
        <div className="empty-state-icon">
          <Package className="w-8 h-8 text-gray-400" />
        </div>
        <p className="empty-state-title">Запчасть не найдена</p>
        <p className="empty-state-text">Возможно, она была удалена или перемещена</p>
        <button
          onClick={() => navigate('/parts/inventory')}
          className="btn btn-secondary btn-sm mt-4"
        >
          Вернуться к инвентарю
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-background">

      {/* ── Sticky header ────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100"
           style={{ boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">

          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            className="btn-icon flex-shrink-0"
            aria-label="Назад"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Title */}
          <h1 className="page-title flex-1 truncate text-sm sm:text-base">
            {item.name}
          </h1>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setShareOpen(true)}
              className="btn-icon"
              title="Поделиться"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/parts/inventory', { state: { editItemId: id } })}
              className="btn-icon"
              title="Редактировать"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="btn-icon text-red-500 hover:bg-red-50 hover:text-red-600"
              title="Удалить"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-5 animate-fade-in">
        <div className="card p-0 overflow-hidden">

          {/* Photo gallery */}
          {photos.length > 0 ? (
            <PhotoGallery
              photos={photos as any[]}
              alt={item.name}
              mainAspect="aspect-[16/10] sm:aspect-[16/9]"
              objectFit="cover"
            />
          ) : (
            <div className="aspect-[16/10] bg-gray-50 flex flex-col items-center justify-center gap-2 text-gray-300 border-b border-gray-100">
              <Package className="w-14 h-14" />
              <span className="kicker text-gray-400">Фото отсутствуют</span>
            </div>
          )}

          {/* ── Hero: статус · название · артикул · цена · продать ── */}
          <div className="p-4 sm:p-5">

            {/* Status badges */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className={STATUS_CLS[item.status]}>
                {item.status === 'available' && <span className="status-dot status-dot-pulse bg-green-500" />}
                {item.status === 'sold'      && <CheckCircle2 className="w-3 h-3" />}
                {STATUS_LABEL[item.status]}
              </span>
              {lowStock && (
                <span className="badge badge-red">
                  <AlertTriangle className="w-3 h-3" />
                  Мало на складе
                </span>
              )}
            </div>

            {/* Name */}
            <h2 className="heading-2 leading-tight mb-3">{item.name}</h2>

            {/* Part number */}
            {item.part_number && (
              <div className="mb-4">
                <p className="kicker mb-1.5">Оригинальный номер</p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(item.part_number!.toUpperCase())
                    toast.success('Номер скопирован')
                  }}
                  title="Нажмите, чтобы скопировать"
                  className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border-2 border-primary/25 shadow-sm hover:border-primary/50 hover:shadow-md active:scale-95 transition-all"
                >
                  <span className="font-mono font-bold tracking-wider text-gray-800 uppercase tabular">
                    {item.part_number.toUpperCase()}
                  </span>
                  <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary transition-colors" />
                </button>
              </div>
            )}

            {/* Price + sell */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 p-3.5 rounded-xl bg-primary/5 border border-primary/15 flex flex-col justify-center">
                {isSold ? (
                  <>
                    <p className="kicker mb-1">Продано за</p>
                    <p className="text-2xl font-bold text-gray-500 tabular">
                      {item.sold_price
                        ? formatPrice(item.sold_price, (item.price_currency as 'UAH' | 'USD') || 'USD')
                        : '—'}
                    </p>
                  </>
                ) : item.selling_price ? (
                  <>
                    <p className="kicker mb-1">Цена продажи</p>
                    <p className="text-3xl font-bold text-primary leading-none tabular">
                      {formatPrice(item.selling_price, (item.price_currency as 'UAH' | 'USD') || 'USD')}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-amber-600 font-semibold">Цена не указана</p>
                )}
              </div>

              {!isSold && (
                <button
                  onClick={() => setIsSellOpen(true)}
                  className="btn btn-success btn-lg sm:w-44 justify-center"
                >
                  Продать
                </button>
              )}
            </div>
          </div>

          {/* ── Характеристики ──────────────────────────────────── */}
          <div className="border-t border-gray-100 px-4 sm:px-5 panel-divided">
            <dl className="divide-y divide-gray-100 text-sm">

              {item.category && (
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-gray-500 flex items-center gap-1.5 min-w-0">
                    <Tag className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    Категория
                  </dt>
                  <dd className="font-semibold text-gray-900 text-right truncate">{item.category.name}</dd>
                </div>
              )}

              {item.condition && (
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-gray-500">Состояние</dt>
                  <dd className="font-semibold text-gray-900 text-right">
                    {PARTS_CONDITION_LABELS[item.condition] || item.condition}
                  </dd>
                </div>
              )}

              {!item.vehicle_id && (
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-gray-500">Количество</dt>
                  <dd className={`font-semibold text-right tabular ${lowStock ? 'text-red-600' : 'text-gray-900'}`}>
                    {item.quantity} шт
                  </dd>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-gray-500">Добавлена</dt>
                <dd className="font-medium text-gray-900 text-right tabular">
                  {new Date(item.created_at).toLocaleDateString('ru-RU')}
                </dd>
              </div>

            </dl>
          </div>

          {/* ── Снята с авто ───────────────────────────────────── */}
          {item.vehicle && (
            <button
              onClick={() => navigate(`/parts/vehicles/${item.vehicle_id}`)}
              className="w-full border-t border-gray-100 p-4 sm:p-5 text-left hover:bg-gray-50 transition-colors group"
            >
              <p className="kicker flex items-center gap-1.5 mb-2">
                <Car className="w-3.5 h-3.5" />
                Снята с авто
              </p>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-primary transition-colors">
                {item.vehicle.make} {item.vehicle.model}
                {(item.vehicle as any).year ? ` (${(item.vehicle as any).year})` : ''}
              </p>
              {(item.vehicle as any).vin && (
                <p className="text-xs text-gray-400 font-mono mt-0.5 tabular">
                  VIN: {(item.vehicle as any).vin}
                </p>
              )}
            </button>
          )}

          {/* ── Расположение на складе ─────────────────────────── */}
          {(locationPath.length > 0 || item.location || item.shelf || item.bin) && (
            <div className="border-t border-gray-100 p-4 sm:p-5">
              <p className="kicker flex items-center gap-1.5 mb-3">
                <Warehouse className="w-3.5 h-3.5" />
                Расположение на складе
              </p>

              {locationPath.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 mb-2.5">
                  {locationPath.map((name, i) => (
                    <span key={i} className="inline-flex items-center gap-1">
                      {i > 0 && <span className="text-gray-300 text-xs">/</span>}
                      <span className={`badge ${i === locationPath.length - 1 ? 'badge-blue' : 'badge-gray'}`}>
                        {i === locationPath.length - 1 && <MapPin className="w-3 h-3" />}
                        {name}
                      </span>
                    </span>
                  ))}
                </div>
              )}

              {(item.location || item.shelf || item.bin) && (
                <div className="flex flex-wrap gap-2">
                  {item.location && (
                    <span className="badge badge-blue">
                      <MapPin className="w-3 h-3" />
                      {item.location}
                    </span>
                  )}
                  {item.shelf && (
                    <span className="badge badge-gray">
                      Полка&nbsp;<span className="font-bold">{item.shelf}</span>
                    </span>
                  )}
                  {item.bin && (
                    <span className="badge badge-gray">
                      Ячейка&nbsp;<span className="font-bold">{item.bin}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Описание ───────────────────────────────────────── */}
          {item.description && (
            <div className="border-t border-gray-100 p-4 sm:p-5">
              <p className="kicker flex items-center gap-1.5 mb-2">
                <FileText className="w-3.5 h-3.5" />
                Описание
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {item.description}
              </p>
            </div>
          )}

          {/* ── Заметки ────────────────────────────────────────── */}
          {item.notes && (
            <div className="border-t border-gray-100 p-4 sm:p-5">
              <p className="kicker mb-2">Заметки</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed italic">
                {item.notes}
              </p>
            </div>
          )}

        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────────── */}
      <ConfirmDialog {...dialogProps} />

      {isSellOpen && profile?.parts_company_id && (
        <SellPartModal
          item={item}
          partsCompanyId={profile.parts_company_id}
          onClose={() => setIsSellOpen(false)}
        />
      )}

      {shareOpen && (
        <ShareModal
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          url={`${window.location.origin}/public/parts-item/${id}`}
          title="Поделиться запчастью"
          subtitle="Ссылка открывает карточку запчасти"
          shareTitle={item.name}
          shareText={[
            item.name,
            item.vehicle ? `${item.vehicle.make} ${item.vehicle.model}` : '',
            item.selling_price
              ? formatPrice(item.selling_price, (item.price_currency as 'UAH' | 'USD') || 'USD')
              : '',
          ].filter(Boolean).join(' · ')}
        />
      )}
    </div>
  )
}
