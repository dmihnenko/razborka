import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Spinner } from '@/components/ui/Spinner'
import { Link } from 'react-router-dom'
import { ArrowLeft, Trash2, RotateCcw, Car, Package, Tag, Users, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow, differenceInDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import {
  getTrashItems,
  restoreFromTrash,
  permanentlyDelete,
  ENTITY_LABELS,
  type TrashItem,
  type TrashEntityType,
} from '@/services/trashService'

const ENTITY_ICONS: Record<TrashEntityType, React.ReactNode> = {
  parts_order: <ShoppingCart className="w-5 h-5" />,
  parts_vehicle: <Car className="w-5 h-5" />,
  parts_inventory: <Package className="w-5 h-5" />,
  parts_category: <Tag className="w-5 h-5" />,
  parts_customer: <Users className="w-5 h-5" />,
}

const ENTITY_COLORS: Record<TrashEntityType, string> = {
  parts_order: 'bg-amber-100 text-amber-600',
  parts_vehicle: 'bg-orange-100 text-orange-600',
  parts_inventory: 'bg-red-100 text-red-600',
  parts_category: 'bg-yellow-100 text-yellow-700',
  parts_customer: 'bg-indigo-100 text-indigo-600',
}

function daysUntilExpiry(expiresAt: string): number {
  return differenceInDays(new Date(expiresAt), new Date())
}

export default function Trash() {
  const { data: profile } = useUserProfile()
  const queryClient = useQueryClient()
  const { confirm: showConfirm, dialogProps } = useConfirm()

  const partsCompanyId = profile?.parts_company_id ?? null
  const backPath = '/parts/settings'

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['trash', partsCompanyId],
    queryFn: () => getTrashItems({ partsCompanyId }),
    enabled: !!partsCompanyId,
  })

  const restoreMutation = useMutation({
    mutationFn: (item: TrashItem) => restoreFromTrash(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash'] })
      queryClient.invalidateQueries({ queryKey: ['parts-orders'] })
      queryClient.invalidateQueries({ queryKey: ['parts-vehicles'] })
      queryClient.invalidateQueries({ queryKey: ['parts-customers'] })
      queryClient.invalidateQueries({ queryKey: ['parts-categories'] })
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      toast.success('Объект восстановлен')
    },
    onError: (err: any) => {
      toast.error('Ошибка при восстановлении: ' + (err.message || 'Неизвестная ошибка'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (trashId: string) => permanentlyDelete(trashId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash'] })
      toast.success('Объект удалён навсегда')
    },
    onError: () => toast.error('Ошибка при удалении'),
  })

  const handleRestore = async (item: TrashItem) => {
    const ok = await showConfirm({
      message: `Восстановить "${item.entity_label}"?`,
      danger: false,
    })
    if (!ok) return
    restoreMutation.mutate(item)
  }

  const handlePermanentDelete = async (item: TrashItem) => {
    const ok = await showConfirm({
      message: `Навсегда удалить "${item.entity_label}"? Восстановление будет невозможно.`,
      danger: true,
    })
    if (!ok) return
    deleteMutation.mutate(item.id)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="container-mobile">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          to={backPath}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="heading-mobile-1">Корзина</h1>
          <p className="text-mobile-sm text-gray-500">
            Удалённые объекты хранятся 7 дней
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-5 bg-gray-100 rounded-full mb-4">
            <Trash2 className="w-10 h-10 text-gray-400" />
          </div>
          <p className="text-xl font-semibold text-gray-700 mb-1">Корзина пуста</p>
          <p className="text-sm text-gray-500">Удалённые объекты будут появляться здесь</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const daysLeft = daysUntilExpiry(item.expires_at)
            const expiringSoon = daysLeft <= 1
            return (
              <div
                key={item.id}
                className={`bg-white rounded-lg border p-4 ${
                  expiringSoon ? 'border-red-300' : 'border-gray-200'
                } shadow-sm`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className={`p-2 rounded-lg flex-shrink-0 ${
                      ENTITY_COLORS[item.entity_type as TrashEntityType] || 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {ENTITY_ICONS[item.entity_type as TrashEntityType] || <Trash2 className="w-5 h-5" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-gray-900 truncate">
                        {item.entity_label}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {ENTITY_LABELS[item.entity_type as TrashEntityType] || item.entity_type}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">
                      Удалён{' '}
                      {formatDistanceToNow(new Date(item.deleted_at), {
                        addSuffix: true,
                        locale: ru,
                      })}
                    </p>
                    <p
                      className={`text-xs font-medium ${
                        expiringSoon ? 'text-red-600' : 'text-gray-400'
                      }`}
                    >
                      {daysLeft <= 0
                        ? 'Истекает сегодня'
                        : `Осталось ${daysLeft} дн.`}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleRestore(item)}
                      disabled={restoreMutation.isPending || deleteMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Восстановить
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(item)}
                      disabled={restoreMutation.isPending || deleteMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Удалить навсегда
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
