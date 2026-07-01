import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Spinner } from '@/components/ui/Spinner'
import { Trash2, RotateCcw, Car, Package, Tag, Users, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow, differenceInDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
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
  parts_order: 'bg-amber-50 text-amber-600',
  parts_vehicle: 'bg-orange-50 text-orange-600',
  parts_inventory: 'bg-red-50 text-red-600',
  parts_category: 'bg-yellow-50 text-yellow-700',
  parts_customer: 'bg-indigo-50 text-indigo-600',
}

function daysUntilExpiry(expiresAt: string): number {
  return differenceInDays(new Date(expiresAt), new Date())
}

export default function Trash() {
  const { t } = useTranslation('cabinet')
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
      toast.success(t('trashPage.restored'))
    },
    onError: (err) => {
      toast.error(t('trashPage.restoreError', { error: err instanceof Error ? err.message : t('trashPage.unknownError') }))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (trashId: string) => permanentlyDelete(trashId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash'] })
      toast.success(t('trashPage.deletedForever'))
    },
    onError: () => toast.error(t('trashPage.deleteError')),
  })

  const handleRestore = async (item: TrashItem) => {
    const ok = await showConfirm({
      message: t('trashPage.confirmRestore', { label: item.entity_label }),
      danger: false,
    })
    if (!ok) return
    restoreMutation.mutate(item)
  }

  const handlePermanentDelete = async (item: TrashItem) => {
    const ok = await showConfirm({
      message: t('trashPage.confirmDelete', { label: item.entity_label }),
      danger: true,
    })
    if (!ok) return
    deleteMutation.mutate(item.id)
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      <PartsPageHeader
        title={t('trashPage.title')}
        subtitle={t('trashPage.subtitle')}
        backPath={backPath}
      />

      <div className="w-full py-5 sm:py-6">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Spinner size="lg" />
          </div>
        ) : items.length === 0 ? (
          <div className="cab-card flex flex-col items-center justify-center py-20 text-center">
            <div className="icon-tile mb-4">
              <Trash2 className="w-7 h-7 text-gray-400" />
            </div>
            <p className="heading-3 mb-1">{t('trashPage.empty')}</p>
            <p className="text-sm text-gray-500">{t('trashPage.emptyHint')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const daysLeft = daysUntilExpiry(item.expires_at)
              const expiringSoon = daysLeft <= 1
              return (
                <div
                  key={item.id}
                  className={`cab-card p-4 ${expiringSoon ? 'ring-1 ring-red-200' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div
                      className={`p-2 rounded-lg flex-shrink-0 ${
                        ENTITY_COLORS[item.entity_type as TrashEntityType] || 'bg-gray-50 text-gray-500'
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
                        <span className="cab-chip">
                          {ENTITY_LABELS[item.entity_type as TrashEntityType] || item.entity_type}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-1">
                        {t('trashPage.deletedAt')}{' '}
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
                          ? t('trashPage.expiresToday')
                          : t('trashPage.daysLeft', { count: daysLeft })}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleRestore(item)}
                        disabled={restoreMutation.isPending || deleteMutation.isPending}
                        className="cab-btn cab-btn-success cab-btn-sm"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {t('trashPage.restore')}
                      </button>
                      <button
                        onClick={() => handlePermanentDelete(item)}
                        disabled={restoreMutation.isPending || deleteMutation.isPending}
                        className="cab-btn cab-btn-danger cab-btn-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('trashPage.deleteForever')}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
