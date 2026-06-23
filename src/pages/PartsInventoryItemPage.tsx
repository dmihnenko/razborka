import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft, Trash2, Package,
  MapPin, Tag, Car, FileText, AlertTriangle,
  Share2, Edit2, Copy, Warehouse, CheckCircle2, QrCode, TrendingUp, ChevronDown, ChevronRight, History, RotateCcw,
} from 'lucide-react'
import { getPartsInventoryItem, deletePartsInventoryItem, getStorageLocations, updatePartsInventoryItem } from '@/services/partsService'
import { getEntityActivity } from '@/services/activityLogService'
import { formatDate } from '@/utils/date'
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
  const { t } = useTranslation('cabinet')
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
          {t('inventoryItemPage.margin')}
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
            <p className="kicker mb-0.5">{t('inventoryItemPage.purchase')}</p>
            <p className="text-sm font-bold text-gray-700 tabular-nums">{formatPrice(pp, currency)}</p>
          </div>
          <div className="rounded-xl bg-[color:var(--cab-surface-2)] border border-[color:var(--cab-border)] p-2.5">
            <p className="kicker mb-0.5">{t('inventoryItemPage.sellingPrice')}</p>
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
  const { t } = useTranslation('cabinet')
  const { confirm: showConfirm, dialogProps } = useConfirm()
  const statusLabel: Record<PartsInventoryStatus, string> = {
    available: t('inventoryItemPage.statusAvailable'),
    reserved: t('inventoryItemPage.statusReserved'),
    sold: t('inventoryItemPage.statusSold'),
    damaged: t('inventoryItemPage.statusDamaged'),
  }
  const { data: profile } = useUserProfile()
  const queryClient = useQueryClient()
  const [isSellOpen, setIsSellOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)

  const { data: item, isLoading, error } = useQuery({
    queryKey: ['parts-inventory-item', id],
    queryFn: () => getPartsInventoryItem(id!),
    enabled: !!id,
  })

  /* История позиции (изменения цены, статусы) — из журнала активности */
  const { data: history = [] } = useQuery({
    queryKey: ['parts-inventory-item-activity', id],
    queryFn: () => getEntityActivity(profile!.parts_company_id!, 'inventory', id!),
    enabled: !!id && !!profile?.parts_company_id,
  })

  /* Возврат проданной позиции в наличие (sold → available) */
  const returnMutation = useMutation({
    mutationFn: async () => {
      await updatePartsInventoryItem(id!, {
        status: 'available',
        sold_price: null, sold_at: null, sold_quantity: null,
        sold_to_customer_id: null, exchange_rate_at_sale: null,
      } as any)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-inventory-item', id] })
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      queryClient.invalidateQueries({ queryKey: ['parts-inventory-item-activity', id] })
      toast.success(t('inventoryItemPage.toastReturned'))
    },
    onError: () => toast.error(t('inventoryItemPage.toastReturnError')),
  })

  const handleReturn = async () => {
    const ok = await showConfirm({ message: t('inventoryItemPage.returnConfirm') })
    if (!ok) return
    returnMutation.mutate()
  }

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
          entityLabel: item.name || t('inventoryItemPage.partFallback'),
          entityData: item,
          partsCompanyId: profile?.parts_company_id,
        })
      }
      await deletePartsInventoryItem(id!)
    },
    onSuccess: () => {
      toast.success(t('inventoryItemPage.toastDeleted'))
      navigate('/parts/inventory')
    },
    onError: () => toast.error(t('inventoryItemPage.toastDeleteError')),
  })

  const handleDelete = async () => {
    const ok = await showConfirm({
      message: t('inventoryItemPage.deleteConfirm', { name: item?.name }),
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
        <p className="empty-state-title">{t('inventoryItemPage.notFoundTitle')}</p>
        <p className="empty-state-text">{t('inventoryItemPage.notFoundText')}</p>
        <button
          onClick={() => navigate('/parts/inventory')}
          className="cab-btn cab-btn-secondary cab-btn-sm mt-4"
        >
          {t('inventoryItemPage.backToInventory')}
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-gray-50">

      {/* ── Sticky header ────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100"
           style={{ boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        <div className="w-full h-14 flex items-center gap-3">

          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            className="btn-icon flex-shrink-0"
            aria-label={t('inventoryItemPage.back')}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Title */}
          <h1 className="page-title flex-1 truncate text-sm sm:text-base">
            {item.name}
          </h1>

          {/* Actions — в шапке только Поделиться и QR */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setShareOpen(true)}
              className="btn-icon"
              title={t('inventoryItemPage.share')}
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setQrOpen(true)}
              className="btn-icon"
              title={t('inventoryItemPage.qrLabel')}
            >
              <QrCode className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────── */}
      <div className="w-full py-4 sm:py-5 animate-fade-in grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 items-start">
        <div className="cab-card overflow-hidden lg:col-span-2">

          {/* ── Верх: фото (компактно) + ключевая инфо ── */}
          <div className="flex flex-col sm:flex-row">

            {/* Фото — компактная колонка, не на пол-экрана */}
            <div className="sm:w-64 lg:w-80 flex-shrink-0 border-b sm:border-b-0 sm:border-r border-gray-100">
              {photos.length > 0 ? (
                <PhotoGallery
                  photos={photos as any[]}
                  alt={item.name}
                  mainAspect="aspect-square"
                  objectFit="contain"
                  mainBgClass="bg-white"
                />
              ) : (
                <div className="aspect-square bg-gray-50 flex flex-col items-center justify-center gap-2 text-gray-300">
                  <Package className="w-12 h-12" />
                  <span className="kicker text-gray-400">{t('inventoryItemPage.noPhotos')}</span>
                </div>
              )}
            </div>

          {/* ── Hero: статус · название · артикул · цена · продать ── */}
          <div className="flex-1 min-w-0 p-4 sm:p-5">

            {/* Status badges */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className={STATUS_CLS[item.status]}>
                {item.status === 'available' && <span className="status-dot status-dot-pulse bg-green-500" />}
                {item.status === 'sold'      && <CheckCircle2 className="w-3 h-3" />}
                {statusLabel[item.status]}
              </span>
              {lowStock && (
                <span className="badge badge-red">
                  <AlertTriangle className="w-3 h-3" />
                  {t('inventoryItemPage.lowStock')}
                </span>
              )}
            </div>

            {/* Name */}
            <h2 className="heading-2 leading-tight mb-3">{item.name}</h2>

            {/* Артикул (внутренний SKU — для поиска сотрудниками) */}
            {item.article && (
              <div className="mb-4">
                <p className="kicker mb-1.5">{t('inventoryItemPage.article')}</p>
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white border border-[color:var(--cab-border-strong)]">
                  <span className="font-mono font-bold tracking-wider text-gray-800 tabular">{item.article}</span>
                </span>
              </div>
            )}

            {/* Part number */}
            {item.part_number && (
              <div className="mb-4">
                <p className="kicker mb-1.5">{t('inventoryItemPage.originalNumber')}</p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(item.part_number!.toUpperCase())
                    toast.success(t('inventoryItemPage.toastNumberCopied'))
                  }}
                  title={t('inventoryItemPage.clickToCopy')}
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
                    <p className="kicker mb-1">{t('inventoryItemPage.soldFor')}</p>
                    <p className="text-2xl font-bold text-gray-500 tabular">
                      {item.sold_price
                        ? formatPrice(item.sold_price, (item.price_currency as 'UAH' | 'USD') || 'USD')
                        : '—'}
                    </p>
                  </>
                ) : item.selling_price ? (
                  <>
                    <p className="kicker mb-1">{t('inventoryItemPage.sellingPrice')}</p>
                    <p className="text-3xl font-bold text-primary leading-none tabular">
                      {formatPrice(item.selling_price, (item.price_currency as 'UAH' | 'USD') || 'USD')}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-amber-600 font-semibold">{t('inventoryItemPage.priceNotSet')}</p>
                )}
              </div>

              {!isSold && (
                <button
                  onClick={() => setIsSellOpen(true)}
                  className="cab-btn cab-btn-success cab-btn-lg sm:w-44 justify-center"
                >
                  {t('inventoryItemPage.sell')}
                </button>
              )}
            </div>
          </div>
          </div>{/* /верх: фото + инфо */}

          {/* ── Характеристики + Расположение ───────────────────── */}
          <div className="border-t border-gray-100 px-4 sm:px-5">
            <dl className="divide-y divide-gray-100 text-sm">

              {item.category && (
                <div className="flex items-start justify-between gap-3 py-2.5">
                  <dt className="text-gray-500 flex items-center gap-1.5 min-w-0 flex-shrink-0">
                    <Tag className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    {t('inventoryItemPage.category')}
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
                          <span className="badge badge-sm badge-gray">{t('inventoryItemPage.shelfPrefix')}{item.shelf}</span>
                        )}
                        {item.bin && (
                          <span className="badge badge-sm badge-gray">{t('inventoryItemPage.binPrefix')}{item.bin}</span>
                        )}
                      </span>
                    )}
                  </dd>
                </div>
              )}

              {item.condition && (
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-gray-500">{t('inventoryItemPage.condition')}</dt>
                  <dd className="font-semibold text-gray-900 text-right">
                    {PARTS_CONDITION_LABELS[item.condition] || item.condition}
                  </dd>
                </div>
              )}

              {!item.vehicle_id && (
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-gray-500">{t('inventoryItemPage.quantity')}</dt>
                  <dd className={`font-semibold text-right tabular ${lowStock ? 'text-red-600' : 'text-gray-900'}`}>
                    {item.quantity} {t('inventoryItemPage.pcs')}
                  </dd>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-gray-500">{t('inventoryItemPage.added')}</dt>
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
                {t('inventoryItemPage.removedFromCar')}
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
                    {t('inventoryItemPage.description')}
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {item.description}
                  </p>
                </div>
              )}
              {item.notes && (
                <div className={item.description ? 'pt-3 border-t border-gray-50' : ''}>
                  <p className="kicker mb-1.5">{t('inventoryItemPage.notes')}</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed italic">
                    {item.notes}
                  </p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── Правая колонка: QR/ссылка + управление ───────────────── */}
        <div className="space-y-4 lg:sticky lg:top-20">

        {/* ── QR-этикетка и ссылка на товар (заметный блок) ───────── */}
        <div className="cab-card overflow-hidden">
          {/* QR с размещением */}
          <button
            onClick={() => setQrOpen(true)}
            className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
          >
            <span className="icon-tile bg-slate-100 text-slate-700 flex-shrink-0">
              <QrCode className="w-5 h-5" strokeWidth={1.5} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-gray-900">{t('inventoryItemPage.qrBlockTitle')}</span>
              <span className="block text-xs text-gray-500 mt-0.5 truncate">
                {locationPath.length > 0
                  ? locationPath.join(' / ')
                  : item.location || t('inventoryItemPage.qrBlockHint')}
              </span>
            </span>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </button>

          {/* Ссылка на товар → модуль «Поделиться» (мессенджеры + копировать) */}
          <button
            onClick={() => setShareOpen(true)}
            className="w-full flex items-center gap-3 p-4 border-t border-gray-100 hover:bg-gray-50 transition-colors text-left"
          >
            <span className="icon-tile bg-primary/10 text-primary flex-shrink-0">
              <Share2 className="w-5 h-5" strokeWidth={1.5} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-gray-900">{t('inventoryItemPage.linkBlockTitle')}</span>
              <span className="block text-xs text-gray-500 mt-0.5">{t('inventoryItemPage.linkBlockHint')}</span>
            </span>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </button>
        </div>

        {/* Управление позицией */}
        <div className="cab-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/parts/inventory', { state: { editItemId: id } })}
              className="cab-btn cab-btn-secondary cab-btn-sm flex-1 gap-1.5"
            >
              <Edit2 className="w-4 h-4" /> {t('inventoryItemPage.edit')}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="cab-btn cab-btn-danger cab-btn-sm gap-1.5"
            >
              <Trash2 className="w-4 h-4" /> {t('inventoryItemPage.delete')}
            </button>
          </div>
          {/* Возврат в наличие — для проданных позиций */}
          {isSold && (
            <button
              onClick={handleReturn}
              disabled={returnMutation.isPending}
              className="cab-btn cab-btn-secondary cab-btn-sm w-full justify-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" /> {t('inventoryItemPage.returnToStock')}
            </button>
          )}
        </div>

        {/* История позиции (цена/статусы) */}
        {history.length > 0 && (
          <div className="cab-card p-4">
            <p className="kicker flex items-center gap-1.5 mb-3">
              <History className="w-3.5 h-3.5" /> {t('inventoryItemPage.history')}
            </p>
            <ol className="relative border-l border-gray-200 ml-1.5 space-y-3">
              {history.map((e) => (
                <li key={e.id} className="ml-3">
                  <span className="absolute -left-[5px] w-2 h-2 rounded-full bg-gray-300 mt-1.5" />
                  <p className="text-xs text-gray-700">{e.detail || e.action}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(e.created_at)}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        </div>{/* /правая колонка */}
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
          title={t('inventoryItemPage.shareTitle')}
          subtitle={t('inventoryItemPage.shareSubtitle')}
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
          subtitle={[
            item.part_number ? item.part_number.toUpperCase() : null,
            locationPath.length > 0 ? locationPath.join(' / ') : item.location || null,
          ].filter(Boolean).join('  ·  ') || undefined}
          value={`${window.location.origin}/public/parts-item/${id}`}
          onClose={() => setQrOpen(false)}
        />
      )}
    </div>
  )
}
