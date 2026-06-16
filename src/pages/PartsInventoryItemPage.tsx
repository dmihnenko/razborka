import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft, Trash2, Package,
  MapPin, Tag, Car, FileText, AlertTriangle,
  Share2, Edit2, Copy, Warehouse, CheckCircle2, QrCode, TrendingUp, ChevronDown,
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
import QrLabelModal from '@/components/parts/QrLabelModal'
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

/* ── Margin row with expand ─────────────────────────────────────── */
function MarginRow({
  pp, sp, margin, markup, isPositive, currency,
}: {
  pp: number; sp: number; margin: number; markup: number; isPositive: boolean; currency: 'UAH' | 'USD'
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-gray-100">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5 hover:bg-gray-50 transition-colors text-left group"
      >
        <span className="flex items-center gap-1.5 text-sm text-gray-500">
          <TrendingUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          Маржа
        </span>
        <span className="flex items-center gap-2">
          <span className={`text-sm font-bold tabular-nums ${isPositive ? 'text-green-700' : 'text-red-600'}`}>
            {isPositive ? '+' : ''}{formatPrice(margin, currency)}&ensp;({isPositive ? '+' : ''}{markup.toFixed(1)}%)
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="px-4 sm:px-5 pb-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-gray-50 p-2.5">
            <p className="kicker mb-0.5">Закупка</p>
            <p className="text-sm font-bold text-gray-700 tabular-nums">{formatPrice(pp, currency)}</p>
          </div>
          <div className="rounded-xl bg-[color:var(--cab-surface-2)] border border-[color:var(--cab-border)] p-2.5">
            <p className="kicker mb-0.5">Цена продажи</p>
            <p className="text-sm font-bold text-primary tabular-nums">{formatPrice(sp, currency)}</p>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Component ──────────────────────────────────────────────────── */
export default function PartsInventoryItemPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { confirm: showConfirm, dialogProps } = useConfirm()
  const { data: profile } = useUserProfile()
  const [isSellOpen, setIsSellOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)

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
          className="cab-btn cab-btn-secondary cab-btn-sm mt-4"
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
              onClick={() => setQrOpen(true)}
              className="btn-icon"
              title="QR / Этикетка"
            >
              <QrCode className="w-4 h-4" />
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
        <div className="cab-card overflow-hidden">

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
                  className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[color:var(--cab-border-strong)] hover:border-[color:var(--cab-ink-3)] active:scale-95 transition-all"
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
              <div className="flex-1 p-3.5 rounded-xl bg-[color:var(--cab-surface-2)] border border-[color:var(--cab-border)] flex flex-col justify-center">
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
                  className="cab-btn cab-btn-success cab-btn-lg sm:w-44 justify-center"
                >
                  Продать
                </button>
              )}
            </div>
          </div>

          {/* ── Характеристики + Расположение ───────────────────── */}
          <div className="border-t border-gray-100 px-4 sm:px-5">
            <dl className="divide-y divide-gray-100 text-sm">

              {item.category && (
                <div className="flex items-start justify-between gap-3 py-2.5">
                  <dt className="text-gray-500 flex items-center gap-1.5 min-w-0 flex-shrink-0">
                    <Tag className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    Категория
                  </dt>
                  <dd className="font-semibold text-gray-900 text-right flex flex-wrap items-center justify-end gap-1.5">
                    <span className="truncate">{item.category.name}</span>
                    {/* Локация строкой рядом с категорией */}
                    {(locationPath.length > 0 || item.location || item.shelf || item.bin) && (
                      <span className="flex flex-wrap items-center gap-1">
                        {locationPath.length > 0 && locationPath.map((name, i) => (
                          <span key={i} className="inline-flex items-center gap-0.5">
                            {i > 0 && <span className="text-gray-300 text-xs">/</span>}
                            <span className={`badge badge-sm ${i === locationPath.length - 1 ? 'badge-blue' : 'badge-gray'}`}>
                              {i === locationPath.length - 1 && <MapPin className="w-2.5 h-2.5" />}
                              {name}
                            </span>
                          </span>
                        ))}
                        {!locationPath.length && item.location && (
                          <span className="badge badge-sm badge-blue">
                            <Warehouse className="w-2.5 h-2.5" />
                            {item.location}
                          </span>
                        )}
                        {item.shelf && (
                          <span className="badge badge-sm badge-gray">П{item.shelf}</span>
                        )}
                        {item.bin && (
                          <span className="badge badge-sm badge-gray">Я{item.bin}</span>
                        )}
                      </span>
                    )}
                  </dd>
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

          {/* ── Окупаемость (компактная строка с раскрытием) ──── */}
          {(() => {
            const sp = item.selling_price
            const pp = item.purchase_price
            if (!sp || !pp || pp <= 0 || sp <= 0) return null
            const currency = (item.price_currency as 'UAH' | 'USD') || 'USD'
            const margin = sp - pp
            const markup = ((sp - pp) / pp) * 100
            const isPositive = margin > 0
            return (
              <MarginRow
                pp={pp}
                sp={sp}
                margin={margin}
                markup={markup}
                isPositive={isPositive}
                currency={currency}
              />
            )
          })()}

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

          {/* ── Описание + Заметки (один блок) ─────────────────── */}
          {(item.description || item.notes) && (
            <div className="border-t border-gray-100 p-4 sm:p-5 space-y-3">
              {item.description && (
                <div>
                  <p className="kicker flex items-center gap-1.5 mb-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Описание
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {item.description}
                  </p>
                </div>
              )}
              {item.notes && (
                <div className={item.description ? 'pt-3 border-t border-gray-50' : ''}>
                  <p className="kicker mb-1.5">Заметки</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed italic">
                    {item.notes}
                  </p>
                </div>
              )}
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

      {qrOpen && (
        <QrLabelModal
          title={item.name}
          subtitle={item.part_number ? item.part_number.toUpperCase() : undefined}
          value={`${window.location.origin}/public/parts-item/${id}`}
          onClose={() => setQrOpen(false)}
        />
      )}
    </div>
  )
}
