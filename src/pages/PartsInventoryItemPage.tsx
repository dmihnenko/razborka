import { useParams, useNavigate } from 'react-router-dom'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft, Pencil, Trash2, DollarSign, Package,
  MapPin, Tag, Car, ChevronRight,
  Hash, FileText, AlertTriangle, CheckCircle, Clock, Wrench,
} from 'lucide-react'
import { getPartsInventoryItem, deletePartsInventoryItem } from '@/services/partsService'
import { moveToTrash } from '@/services/trashService'
import { useUserProfile } from '@/hooks/useUserProfile'
import { formatPrice } from '@/utils/currency'
import { PARTS_CONDITION_LABELS } from '@/utils/status'
import type { PartsInventoryStatus } from '@/types/parts'
import PhotoGallery from '@/components/parts/PhotoGallery'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

const statusLabels: Record<PartsInventoryStatus, string> = {
  available: 'В наличии',
  reserved: 'Зарезервировано',
  sold: 'Продано',
  damaged: 'Повреждено',
}

const statusColors: Record<PartsInventoryStatus, string> = {
  available: 'bg-green-100 text-green-800 border-green-200',
  reserved: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  sold: 'bg-gray-100 text-gray-600 border-gray-200',
  damaged: 'bg-red-100 text-red-800 border-red-200',
}

const statusIcons: Record<PartsInventoryStatus, React.ReactNode> = {
  available: <CheckCircle className="w-4 h-4" />,
  reserved: <Clock className="w-4 h-4" />,
  sold: <DollarSign className="w-4 h-4" />,
  damaged: <AlertTriangle className="w-4 h-4" />,
}

export default function PartsInventoryItemPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { confirm: showConfirm, dialogProps } = useConfirm()
  const { data: profile } = useUserProfile()

  const { data: item, isLoading, error } = useQuery({
    queryKey: ['parts-inventory-item', id],
    queryFn: () => getPartsInventoryItem(id!),
    enabled: !!id,
  })

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="xl" />
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Package className="w-12 h-12 text-gray-300" />
        <p className="text-gray-500">Запчасть не найдена</p>
        <button onClick={() => navigate('/parts/inventory')} className="text-primary hover:underline">
          Вернуться к инвентарю
        </button>
      </div>
    )
  }

  const isSold = item.status === 'sold'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline text-sm font-medium">Назад</span>
            </button>

            <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate flex-1 text-center">
              {item.name}
            </h1>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => navigate('/parts/inventory', { state: { editItemId: id } })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Pencil className="w-4 h-4" />
                <span className="hidden sm:inline">Редактировать</span>
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
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 space-y-4">

        {/* Photos */}
        {photos.length > 0 && (
          <PhotoGallery
            photos={photos as any[]}
            alt={item.name}
            mainAspect="aspect-video sm:aspect-[16/7]"
          />
        )}

        {/* Main info */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5">
          <div className="flex flex-wrap items-start gap-2 mb-4">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${statusColors[item.status]}`}>
              {statusIcons[item.status]}
              {statusLabels[item.status]}
            </span>
            {item.category && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200">
                <Tag className="w-3.5 h-3.5" />
                {item.category.name}
              </span>
            )}
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">{item.name}</h2>
          {item.part_number && (
            <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-4">
              <Hash className="w-4 h-4" />
              Арт: <span className="font-mono font-medium text-gray-700">{item.part_number}</span>
            </p>
          )}

          {/* Price block */}
          <div className="mt-4 p-3 sm:p-4 rounded-lg bg-primary/5 border border-primary/10">
            {isSold ? (
              <div>
                <p className="text-xs text-gray-500 mb-1">Продано за</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-700">
                  {item.sold_price
                    ? formatPrice(item.sold_price, (item.price_currency as 'UAH' | 'USD') || 'USD')
                    : '—'}
                </p>
                {item.selling_price && (
                  <p className="text-xs text-gray-400 mt-1">
                    Была объявленная: {formatPrice(item.selling_price, (item.price_currency as 'UAH' | 'USD') || 'USD')}
                  </p>
                )}
              </div>
            ) : item.selling_price ? (
              <div>
                <p className="text-xs text-gray-500 mb-1">Цена продажи</p>
                <p className="text-2xl sm:text-3xl font-bold text-primary">
                  {formatPrice(item.selling_price, (item.price_currency as 'UAH' | 'USD') || 'USD')}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Цена не указана</p>
            )}
          </div>

          {/* Sell button */}
          {!isSold && (
            <button
              onClick={() => navigate('/parts/inventory', { state: { sellItemId: item.id } })}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors font-medium"
            >
              <DollarSign className="w-4 h-4" />
              Продать
            </button>
          )}
        </div>

        {/* Details grid */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Характеристики</h3>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4">
            <div>
              <dt className="text-xs text-gray-500 mb-0.5">Состояние</dt>
              <dd className="text-sm font-medium text-gray-900">
                {PARTS_CONDITION_LABELS[item.condition] || item.condition}
              </dd>
            </div>
            {!item.vehicle_id && (
              <div>
                <dt className="text-xs text-gray-500 mb-0.5">Количество</dt>
                <dd className={`text-sm font-bold ${item.quantity <= 2 && !isSold ? 'text-red-600' : 'text-gray-900'}`}>
                  {item.quantity} шт
                  {item.quantity <= 2 && !isSold && (
                    <AlertTriangle className="inline w-3.5 h-3.5 ml-1 text-red-500" />
                  )}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-gray-500 mb-0.5">Добавлена</dt>
              <dd className="text-sm font-medium text-gray-900">
                {new Date(item.created_at).toLocaleDateString('ru-RU')}
              </dd>
            </div>
          </dl>
        </div>

        {/* Vehicle */}
        {item.vehicle && (
          <button
            onClick={() => navigate(`/parts/vehicles/${item.vehicle_id}`)}
            className="w-full bg-white rounded-xl shadow-sm p-4 sm:p-5 text-left hover:shadow-md transition-shadow"
          >
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Car className="w-4 h-4" />
              Автомобиль
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900 text-base">
                  {item.vehicle.make} {item.vehicle.model}
                  {(item.vehicle as any).year && ` (${(item.vehicle as any).year})`}
                </p>
                {(item.vehicle as any).vin && (
                  <p className="text-xs text-gray-500 font-mono mt-0.5">VIN: {(item.vehicle as any).vin}</p>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
            </div>
          </button>
        )}

        {/* Location */}
        {(item.location || item.shelf || item.bin) && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Место хранения
            </h3>
            <div className="flex flex-wrap gap-2">
              {item.location && (
                <span className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                  📍 {item.location}
                </span>
              )}
              {item.shelf && (
                <span className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                  Полка: {item.shelf}
                </span>
              )}
              {item.bin && (
                <span className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                  Ячейка: {item.bin}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Description */}
        {item.description && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Описание
            </h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{item.description}</p>
          </div>
        )}

        {/* Notes */}
        {item.notes && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Заметки
            </h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{item.notes}</p>
          </div>
        )}

      </div>
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
