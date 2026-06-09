import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft, Trash2, DollarSign, Package,
  MapPin, Tag, Car, FileText, AlertTriangle,
  Share2, Edit2, Copy, Warehouse,
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

const STATUS_LABEL: Record<PartsInventoryStatus, string> = {
  available: 'В наличии', reserved: 'Резерв',
  sold: 'Продано', damaged: 'Повреждено',
}
const STATUS_CLS: Record<PartsInventoryStatus, string> = {
  available: 'bg-green-100 text-green-800 border-green-200',
  reserved: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  sold: 'bg-gray-100 text-gray-600 border-gray-200',
  damaged: 'bg-red-100 text-red-800 border-red-200',
}

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

  // Привязанное место хранения (дерево стеллаж → полка → ячейка)
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
    const ok = await showConfirm({ message: `Удалить "${item?.name}"? Это действие нельзя отменить.`, danger: true })
    if (!ok) return
    deleteMutation.mutate()
  }

  const photos = item?.photos || []
  const isSold = item?.status === 'sold'
  const lowStock = !item?.vehicle_id && item?.quantity! <= 2 && item?.status === 'available'

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-dvh"><Spinner size="xl" /></div>
  }

  if (error || !item) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-4">
        <Package className="w-12 h-12 text-gray-300" />
        <p className="text-gray-500">Запчасть не найдена</p>
        <button onClick={() => navigate('/parts/inventory')} className="text-primary hover:underline">
          Вернуться к инвентарю
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Sticky header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline text-sm font-medium">Назад</span>
          </button>

          <h1 className="text-sm sm:text-base font-bold text-gray-900 truncate flex-1">
            {item.name}
          </h1>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setShareOpen(true)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Поделиться"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/parts/inventory', { state: { editItemId: id } })}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Редактировать"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Удалить"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ══ ЕДИНОЕ ДОСЬЕ ══════════════════════════════════════════════ */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

          {/* Фото */}
          {photos.length > 0 ? (
            <PhotoGallery
              photos={photos as any[]}
              alt={item.name}
              mainAspect="aspect-[16/10] sm:aspect-[16/9]"
              objectFit="cover"
            />
          ) : (
            <div className="aspect-[16/10] bg-gray-50 flex items-center justify-center text-gray-300">
              <Package className="w-16 h-16" />
            </div>
          )}

          {/* Шапка: статус, название, номер, цена, продать */}
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border ${STATUS_CLS[item.status]}`}>
                {STATUS_LABEL[item.status]}
              </span>
              {lowStock && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                  <AlertTriangle className="w-3 h-3" /> Мало
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{item.name}</h1>

            {item.part_number && (
              <div className="mt-3">
                <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-1">Оригинальный номер</p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(item.part_number!.toUpperCase())
                    toast.success('Номер скопирован')
                  }}
                  title="Нажмите, чтобы скопировать"
                  className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border-2 border-primary/25 shadow-md hover:border-primary/50 hover:shadow-lg active:scale-95 transition-all"
                >
                  <span className="font-mono font-bold tracking-wider text-gray-800 uppercase">
                    {item.part_number.toUpperCase()}
                  </span>
                  <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary transition-colors" />
                </button>
              </div>
            )}

            {/* Цена + Продать */}
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <div className="flex-1 p-3.5 rounded-xl bg-primary/5 border border-primary/15 flex flex-col justify-center">
                {isSold ? (
                  <>
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-0.5">Продано за</p>
                    <p className="text-2xl font-bold text-gray-500">
                      {item.sold_price ? formatPrice(item.sold_price, (item.price_currency as 'UAH' | 'USD') || 'USD') : '—'}
                    </p>
                  </>
                ) : item.selling_price ? (
                  <>
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-0.5">Цена</p>
                    <p className="text-3xl font-bold text-primary leading-none">
                      {formatPrice(item.selling_price, (item.price_currency as 'UAH' | 'USD') || 'USD')}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-amber-600 font-medium">Цена не указана</p>
                )}
              </div>
              {!isSold && (
                <button
                  onClick={() => setIsSellOpen(true)}
                  className="sm:w-44 flex items-center justify-center gap-2 py-3 bg-green-600 text-white text-sm font-semibold rounded-xl shadow-sm hover:bg-green-700 active:scale-[0.99] transition-all"
                >
                  <DollarSign className="w-4 h-4" /> Продать
                </button>
              )}
            </div>
          </div>

          {/* Характеристики — строки */}
          <div className="border-t border-gray-100 px-4 sm:px-5">
            <dl className="divide-y divide-gray-100 text-sm">
              {item.category && (
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-gray-500 flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-gray-400" /> Категория</dt>
                  <dd className="font-semibold text-gray-900 text-right">{item.category.name}</dd>
                </div>
              )}
              {item.condition && (
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-gray-500">Состояние</dt>
                  <dd className="font-semibold text-gray-900 text-right">{PARTS_CONDITION_LABELS[item.condition] || item.condition}</dd>
                </div>
              )}
              {!item.vehicle_id && (
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-gray-500">Количество</dt>
                  <dd className={`font-semibold text-right ${lowStock ? 'text-red-600' : 'text-gray-900'}`}>{item.quantity} шт</dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-gray-500">Добавлена</dt>
                <dd className="font-medium text-gray-900 text-right">{new Date(item.created_at).toLocaleDateString('ru-RU')}</dd>
              </div>
            </dl>
          </div>

          {/* Снята с авто */}
          {item.vehicle && (
            <button
              onClick={() => navigate(`/parts/vehicles/${item.vehicle_id}`)}
              className="w-full border-t border-gray-100 p-4 sm:p-5 text-left hover:bg-gray-50 transition-colors"
            >
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5" /> Снята с авто
              </h2>
              <p className="text-sm font-semibold text-gray-900">
                {item.vehicle.make} {item.vehicle.model}{(item.vehicle as any).year ? ` (${(item.vehicle as any).year})` : ''}
              </p>
              {(item.vehicle as any).vin && (
                <p className="text-xs text-gray-400 font-mono mt-0.5">VIN: {(item.vehicle as any).vin}</p>
              )}
            </button>
          )}

          {/* Расположение на складе */}
          {(locationPath.length > 0 || item.location || item.shelf || item.bin) && (
            <div className="border-t border-gray-100 p-4 sm:p-5">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                <Warehouse className="w-3.5 h-3.5" /> Расположение на складе
              </h2>
              {locationPath.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 mb-2">
                  {locationPath.map((name, i) => (
                    <span key={i} className="inline-flex items-center gap-1">
                      {i > 0 && <span className="text-gray-300">/</span>}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-semibold ${i === locationPath.length - 1 ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-gray-50 text-gray-600 border border-gray-200'}`}>
                        {i === locationPath.length - 1 && <MapPin className="w-3.5 h-3.5" />}
                        {name}
                      </span>
                    </span>
                  ))}
                </div>
              )}
              {(item.location || item.shelf || item.bin) && (
                <div className="flex flex-wrap gap-2">
                  {item.location && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 text-sm font-semibold">
                      <MapPin className="w-3.5 h-3.5" /> {item.location}
                    </span>
                  )}
                  {item.shelf && (
                    <span className="inline-flex items-center px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-700 border border-gray-200 text-sm">
                      Полка <span className="font-semibold ml-1">{item.shelf}</span>
                    </span>
                  )}
                  {item.bin && (
                    <span className="inline-flex items-center px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-700 border border-gray-200 text-sm">
                      Ячейка <span className="font-semibold ml-1">{item.bin}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Описание */}
          {item.description && (
            <div className="border-t border-gray-100 p-4 sm:p-5">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Описание
              </h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{item.description}</p>
            </div>
          )}

          {/* Заметки */}
          {item.notes && (
            <div className="border-t border-gray-100 p-4 sm:p-5">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Заметки</h2>
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed italic">{item.notes}</p>
            </div>
          )}

        </div>
      </div>

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
          shareText={[item.name, item.vehicle ? `${item.vehicle.make} ${item.vehicle.model}` : '', item.selling_price ? formatPrice(item.selling_price, (item.price_currency as 'UAH' | 'USD') || 'USD') : ''].filter(Boolean).join(' · ')}
        />
      )}
    </div>
  )
}
