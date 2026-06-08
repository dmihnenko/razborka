import { useParams, useNavigate } from 'react-router-dom'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft, Pencil, Trash2, DollarSign, Package,
  MapPin, Tag, Car, Hash, FileText, AlertTriangle,
  CheckCircle, Clock, Share2, Edit2, Copy,
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

  const copyShareLink = () => {
    const url = `${window.location.origin}/public/parts-item/${id}`
    navigator.clipboard.writeText(url)
      .then(() => toast.success('Ссылка скопирована'))
      .catch(() => {
        const el = document.createElement('input')
        el.value = url
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
        toast.success('Ссылка скопирована')
      })
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
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
              onClick={copyShareLink}
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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── Левая колонка: фото и основная инфо ────────────────────── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Основная информация */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              {/* Шапка: фото слева + статус, название, оригинальный номер справа */}
              <div className="flex flex-col sm:flex-row gap-4">
                {photos.length > 0 && (
                  <div className="rounded-xl overflow-hidden w-full sm:w-52 md:w-56 flex-shrink-0 self-start">
                    <PhotoGallery
                      photos={photos as any[]}
                      alt={item.name}
                      mainAspect="aspect-[4/3]"
                      objectFit="cover"
                    />
                  </div>
                )}

                <div className="flex-1 min-w-0 flex flex-col">
                  {/* Статус + категория */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${STATUS_CLS[item.status]}`}>
                      {STATUS_LABEL[item.status]}
                    </span>
                    {item.category && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        <Tag className="w-3 h-3" />
                        {item.category.name}
                      </span>
                    )}
                    {lowStock && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                        <AlertTriangle className="w-3 h-3" />
                        Мало
                      </span>
                    )}
                  </div>

                  {/* Название */}
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 leading-snug">{item.name}</h2>

                  {/* Оригинальный номер */}
                  {item.part_number && (
                    <div className="mt-auto">
                      <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-1">Оригинальный номер</p>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(item.part_number!.toUpperCase())
                          toast.success('Номер скопирован')
                        }}
                        title="Нажмите, чтобы скопировать"
                        className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border-2 border-blue-200 shadow-md hover:border-blue-400 hover:shadow-lg active:scale-95 transition-all"
                      >
                        <Hash className="w-3.5 h-3.5 text-blue-500" />
                        <span className="font-mono font-bold tracking-wider text-gray-800 uppercase">
                          {item.part_number.toUpperCase()}
                        </span>
                        <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Цена */}
              <div className="py-2.5 border-t border-b border-gray-100 my-3">
                {isSold ? (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-1">Продано за</p>
                    <p className="text-2xl font-bold text-gray-600">
                      {item.sold_price ? formatPrice(item.sold_price, (item.price_currency as 'UAH' | 'USD') || 'USD') : '—'}
                    </p>
                  </div>
                ) : item.selling_price ? (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-1">Цена</p>
                    <p className="text-3xl font-bold text-primary">
                      {formatPrice(item.selling_price, (item.price_currency as 'UAH' | 'USD') || 'USD')}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-amber-600 font-medium">Цена не указана</p>
                )}
              </div>

              {/* Основные характеристики */}
              <div className="grid grid-cols-2 gap-3">
                {item.condition && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-0.5">Состояние</p>
                    <p className="text-sm font-semibold text-gray-900">{PARTS_CONDITION_LABELS[item.condition] || item.condition}</p>
                  </div>
                )}
                {!item.vehicle_id && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-0.5">Количество</p>
                    <p className={`text-sm font-semibold ${lowStock ? 'text-red-600' : 'text-gray-900'}`}>{item.quantity} шт</p>
                  </div>
                )}
                {item.location && (
                  <div className="col-span-2">
                    <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-0.5">Место</p>
                    <p className="text-sm text-gray-700">{item.location}{item.shelf ? ` · полка ${item.shelf}` : ''}{item.bin ? ` · ячейка ${item.bin}` : ''}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-0.5">Добавлена</p>
                  <p className="text-sm text-gray-700">{new Date(item.created_at).toLocaleDateString('ru-RU')}</p>
                </div>
              </div>
            </div>

            {/* Авто */}
            {item.vehicle && (
              <button
                onClick={() => navigate(`/parts/vehicles/${item.vehicle_id}`)}
                className="w-full bg-white rounded-xl shadow-sm p-4 text-left hover:shadow-md transition-shadow"
              >
                <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-2 flex items-center gap-1.5">
                  <Car className="w-3 h-3" /> Снята с авто
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {item.vehicle.make} {item.vehicle.model}
                  {(item.vehicle as any).year ? ` (${(item.vehicle as any).year})` : ''}
                </p>
                {(item.vehicle as any).vin && (
                  <p className="text-xs text-gray-500 font-mono mt-1">VIN: {(item.vehicle as any).vin}</p>
                )}
              </button>
            )}

            {/* Описание */}
            {item.description && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-2 flex items-center gap-1.5">
                  <FileText className="w-3 h-3" /> Описание
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{item.description}</p>
              </div>
            )}
          </div>

          {/* ── Правая колонка: действия и заметки ────────────────────── */}
          <div className="lg:col-span-1 space-y-4">

            {/* Быстрые действия — продать */}
            {!isSold && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <button
                  onClick={() => navigate('/parts/inventory', { state: { sellItemId: item.id } })}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
                >
                  <DollarSign className="w-4 h-4" />
                  Продать
                </button>
              </div>
            )}

            {/* Заметки */}
            {item.notes && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-2">Заметки</p>
                <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{item.notes}</p>
              </div>
            )}

            {/* Полная информация о товаре */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-3">Информация</p>
              <dl className="divide-y divide-gray-100 text-sm">
                <div className="flex items-center justify-between gap-3 py-2">
                  <dt className="text-gray-500">Статус</dt>
                  <dd>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${STATUS_CLS[item.status]}`}>
                      {STATUS_LABEL[item.status]}
                    </span>
                  </dd>
                </div>
                {item.category && (
                  <div className="flex items-center justify-between gap-3 py-2">
                    <dt className="text-gray-500">Категория</dt>
                    <dd className="font-medium text-gray-900 text-right">{item.category.name}</dd>
                  </div>
                )}
                {item.condition && (
                  <div className="flex items-center justify-between gap-3 py-2">
                    <dt className="text-gray-500">Состояние</dt>
                    <dd className="font-medium text-gray-900 text-right">{PARTS_CONDITION_LABELS[item.condition] || item.condition}</dd>
                  </div>
                )}
                {!item.vehicle_id && (
                  <div className="flex items-center justify-between gap-3 py-2">
                    <dt className="text-gray-500">Количество</dt>
                    <dd className={`font-semibold text-right ${lowStock ? 'text-red-600' : 'text-gray-900'}`}>{item.quantity} шт</dd>
                  </div>
                )}
                {item.location && (
                  <div className="flex items-center justify-between gap-3 py-2">
                    <dt className="text-gray-500">Место</dt>
                    <dd className="font-medium text-gray-900 text-right">
                      {item.location}{item.shelf ? ` · полка ${item.shelf}` : ''}{item.bin ? ` · ячейка ${item.bin}` : ''}
                    </dd>
                  </div>
                )}
                {item.vehicle && (
                  <div className="flex items-center justify-between gap-3 py-2">
                    <dt className="text-gray-500">Авто</dt>
                    <dd className="font-medium text-gray-900 text-right">
                      {item.vehicle.make} {item.vehicle.model}{(item.vehicle as any).year ? ` (${(item.vehicle as any).year})` : ''}
                    </dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 py-2">
                  <dt className="text-gray-500">{isSold ? 'Продано за' : 'Цена'}</dt>
                  <dd className="font-bold text-gray-900 text-right">
                    {isSold
                      ? (item.sold_price ? formatPrice(item.sold_price, (item.price_currency as 'UAH' | 'USD') || 'USD') : '—')
                      : (item.selling_price ? formatPrice(item.selling_price, (item.price_currency as 'UAH' | 'USD') || 'USD') : '—')}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2">
                  <dt className="text-gray-500">Добавлена</dt>
                  <dd className="font-medium text-gray-900 text-right">{new Date(item.created_at).toLocaleDateString('ru-RU')}</dd>
                </div>
              </dl>
            </div>
          </div>

        </div>
      </div>

      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
